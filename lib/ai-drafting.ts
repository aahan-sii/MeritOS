import OpenAI from "openai";
import { canDraftField, cleanDraftingText, dedupeDraftText, needsPersonalInput, normalizedMaxLength, selectRelevantEvidence } from "./ai-drafting-core";

export { buildDraftingPrompt, canDraftField, dedupeDraftText, dedupeEvidence, needsPersonalInput, normalizedMaxLength, selectRelevantEvidence, textSimilarity } from "./ai-drafting-core";

export type DraftField = {
  id?: string;
  label: string;
  kind?: string;
  type?: string;
  name?: string;
  maxLength?: number;
  control?: string;
  options?: Array<{ label?: string; value?: string } | string>;
};

export type DraftEvidence = {
  id: string;
  category: string;
  statement: string;
};

type DraftRequest = {
  field: DraftField;
  page?: { title?: string; url?: string };
  evidence: DraftEvidence[];
};

export type DraftResult =
  | { status: "draft"; draft: string; usedEvidenceIds: string[]; questions: string[] }
  | { status: "needs_input"; draft: ""; usedEvidenceIds: string[]; questions: string[] }
  | { status: "not_configured"; draft: ""; usedEvidenceIds: string[]; questions: string[] };

type DraftBatchRequest = {
  fields: DraftField[];
  page?: { title?: string; url?: string };
  evidence: DraftEvidence[];
};

function needsInput(question: string): DraftResult {
  return { status: "needs_input", draft: "", usedEvidenceIds: [], questions: [question] };
}

export async function createGroundedDraft(request: DraftRequest): Promise<DraftResult> {
  const results = await createGroundedDraftBatch({ fields: [request.field], page: request.page, evidence: request.evidence });
  return results[0] || needsInput("MeritOS could not analyze this field safely.");
}

export async function createGroundedDraftBatch(request: DraftBatchRequest): Promise<DraftResult[]> {
  type PreparedField = { field: DraftField; immediate?: DraftResult; evidence?: DraftEvidence[] };
  const prepared: PreparedField[] = request.fields.map((field): PreparedField => {
    if (needsPersonalInput(field)) return { field, immediate: needsInput("Why does this specific opportunity matter to you? Add your own reason in MeritOS before drafting this answer.") };
    if (!canDraftField(field)) return { field, immediate: needsInput("This field needs application-specific or sensitive information that MeritOS will not guess.") };
    const evidence = selectRelevantEvidence(field, request.evidence);
    if (!evidence.length) return { field, immediate: needsInput("No matching verified evidence was found for this question. Add or verify a relevant fact first.") };
    return { field, evidence };
  });
  const eligible = prepared.filter((item): item is PreparedField & { evidence: DraftEvidence[] } => Boolean(item.evidence));
  if (!eligible.length) return prepared.map((item) => item.immediate || needsInput("More verified context is required."));
  if (!process.env.OPENAI_API_KEY) {
    return prepared.map((item) => item.immediate || ({ status: "not_configured", draft: "", usedEvidenceIds: [], questions: ["AI drafting is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."] }));
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const evidenceCatalog = new Map<string, DraftEvidence>();
  eligible.forEach((item) => item.evidence.forEach((evidence) => evidenceCatalog.set(evidence.id, evidence)));
  const response = await client.responses.create({
    model: process.env.OPENAI_DRAFT_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol",
    reasoning: { effort: "low" },
    input: [
      {
        role: "developer",
        content: [
          "You are MeritOS, an evidence-bound application field analyst.",
          "Analyze every supplied field independently. The evidence catalog is shared across the form; for each field, use only evidence IDs listed in that field's allowedEvidenceIds.",
          "Never transfer identity/contact information into a field about a teacher, recommender, reference, supervisor, parent, guardian, or other third party.",
          "Never invent or infer credentials, grades, dates, metrics, motivations, eligibility, consent, demographics, legal status, or work authorization.",
          "For narrative fields, answer directly in a concise first-person voice while preserving evidence meaning.",
          "Write one cohesive answer and remove semantic repetition. Never restate the same role, metric, action, or outcome in a second sentence. Use bullets only when the field explicitly requests a list.",
          "For radio, checkbox, or select fields, draft must exactly equal one supplied option label and only when evidence directly supports it.",
          "If support is incomplete, return needs_input with one specific question. Return one result for every fieldId and only JSON matching the schema.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          page: request.page || {},
          verifiedEvidence: [...evidenceCatalog.values()].map((item) => ({ id: item.id, category: item.category, statement: item.statement })),
          fields: eligible.map(({ field, evidence }) => ({
            fieldId: field.id || field.label,
            label: cleanDraftingText(field.label, 500),
            type: cleanDraftingText(field.type, 80),
            control: cleanDraftingText(field.control, 40),
            maxCharacters: normalizedMaxLength(field),
            options: Array.isArray(field.options) ? field.options.slice(0, 40).map((option) => cleanDraftingText(typeof option === "string" ? option : option.label || option.value, 180)) : [],
            allowedEvidenceIds: evidence.map((item) => item.id),
          })),
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "meritos_grounded_field_batch",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["fieldId", "status", "draft", "usedEvidenceIds", "questions"],
                properties: {
                  fieldId: { type: "string" }, status: { type: "string", enum: ["draft", "needs_input"] }, draft: { type: "string" },
                  usedEvidenceIds: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  });
  let payload: { items?: Array<{ fieldId?: string; status?: string; draft?: string; usedEvidenceIds?: unknown; questions?: unknown }> };
  try { payload = JSON.parse(response.output_text); } catch { throw new Error("The drafting service returned an invalid response."); }
  const byId = new Map((payload.items || []).map((item) => [String(item.fieldId), item]));
  return prepared.map((item) => {
    if (item.immediate) return item.immediate;
    const fieldId = item.field.id || item.field.label;
    const parsed = byId.get(fieldId);
    const evidence = item.evidence || [];
    const validIds = new Set(evidence.map((entry) => entry.id));
    const usedEvidenceIds = Array.isArray(parsed?.usedEvidenceIds) ? parsed.usedEvidenceIds.filter((id): id is string => typeof id === "string" && validIds.has(id)) : [];
    const questions = Array.isArray(parsed?.questions) ? parsed.questions.map((question) => cleanDraftingText(question, 300)).filter(Boolean).slice(0, 2) : [];
    let draft = dedupeDraftText(parsed?.draft, normalizedMaxLength(item.field));
    if (Array.isArray(item.field.options) && item.field.options.length && draft) {
      const option = item.field.options.find((candidate) => {
        const label = typeof candidate === "string" ? candidate : candidate.label || candidate.value || "";
        return label.toLowerCase().trim() === draft.toLowerCase().trim();
      });
      draft = option ? (typeof option === "string" ? option : option.label || option.value || "") : "";
    }
    return parsed?.status === "draft" && draft && usedEvidenceIds.length
      ? { status: "draft", draft, usedEvidenceIds, questions: [] }
      : needsInput(questions[0] || "The verified evidence does not yet support a truthful answer to this question.");
  });
}
