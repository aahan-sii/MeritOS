import OpenAI from "openai";
import { canDraftField, cleanDraftingText, dedupeDraftText, dedupeEvidence, needsPersonalInput, normalizedMaxLength, selectRelevantEvidence } from "./ai-drafting-core";
import { isFuturePhysiciansOrganizationQuestion, isMemberContributionQuestion, routeFuturePhysiciansEvidence, selectFuturePhysiciansOrganizationEvidence } from "./future-physicians";

export { buildDraftingPrompt, canDraftField, dedupeDraftText, dedupeEvidence, needsPersonalInput, normalizedMaxLength, selectRelevantEvidence, textSimilarity } from "./ai-drafting-core";

export type DraftField = {
  id?: string;
  label: string;
  description?: string;
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
  page?: { title?: string; url?: string; opportunityContext?: string };
  evidence: DraftEvidence[];
};

export type DraftResult =
  | { status: "draft"; draft: string; alternatives: string[]; usedEvidenceIds: string[]; questions: string[]; confidence: "high" | "medium" | "low"; assumptions: string[] }
  | { status: "needs_input"; draft: ""; usedEvidenceIds: string[]; questions: string[]; confidence: "low"; assumptions: string[] }
  | { status: "not_configured"; draft: ""; usedEvidenceIds: string[]; questions: string[]; confidence: "low"; assumptions: string[] };

type DraftBatchRequest = {
  fields: DraftField[];
  page?: { title?: string; url?: string; opportunityContext?: string };
  evidence: DraftEvidence[];
  organizationEvidence?: DraftEvidence[];
  organizationName?: string;
  organizationApplication?: boolean;
  proactive?: boolean;
  highInitiative?: boolean;
};

function needsInput(question: string): DraftResult {
  return { status: "needs_input", draft: "", usedEvidenceIds: [], questions: [question], confidence: "low", assumptions: [] };
}

function evidenceOnlyFallback(field: DraftField, evidence: DraftEvidence[]): DraftResult {
  const control = String(field.control || field.kind || "").toLowerCase();
  if (["radio", "select", "checkbox"].includes(control)) {
    return needsInput("MeritOS could not safely choose an option while AI drafting is unavailable. Review the matching evidence instead.");
  }
  const limit = normalizedMaxLength(field);
  // A project/fit prompt needs one coherent experience. Combining two projects
  // creates a résumé dump and hides the applicant's strongest story.
  const supporting = dedupeEvidence(evidence, 1);
  const draft = dedupeDraftText(supporting.map((item) => item.statement).join(" "), limit);
  return draft
    ? { status: "draft", draft, alternatives: [], usedEvidenceIds: supporting.map((item) => item.id), questions: [], confidence: "low", assumptions: ["AI drafting was unavailable; this is a direct evidence-only fallback that needs review."] }
    : needsInput("No supported evidence was available for this field.");
}

export async function createGroundedDraft(request: DraftRequest): Promise<DraftResult> {
  const results = await createGroundedDraftBatch({ fields: [request.field], page: request.page, evidence: request.evidence });
  return results[0] || needsInput("MeritOS could not analyze this field safely.");
}

export async function createGroundedDraftBatch(request: DraftBatchRequest): Promise<DraftResult[]> {
  type PreparedField = { field: DraftField; immediate?: DraftResult; evidence?: DraftEvidence[] };
  const prepared: PreparedField[] = request.fields.map((field): PreparedField => {
    const fieldText = `${field.label} ${field.description || ""} ${field.name || ""}`.toLowerCase();
    const directPersonalField = /\b(full|legal) name\b|\byour (?:e-?mail|email|phone|telephone)\b|\bapplicant (?:name|email|phone)\b/.test(fieldText);
    const organizationScoped = Boolean(request.organizationApplication) && !isMemberContributionQuestion(field) && !directPersonalField;
    if (needsPersonalInput(field) && !request.proactive && !organizationScoped) return { field, immediate: needsInput("Why does this specific opportunity matter to you? Add your own reason in MeritOS before drafting this answer.") };
    if (!canDraftField(field, { proactive: request.proactive })) return { field, immediate: needsInput("This field needs application-specific or sensitive information that MeritOS will not guess.") };
    const routedEvidence = organizationScoped
      ? [...(request.organizationEvidence || []), ...request.evidence.filter((item) => /futurephysicians/i.test(item.statement))]
      : routeFuturePhysiciansEvidence(field, request.evidence, request.organizationEvidence || []);
    let evidence = (organizationScoped || isFuturePhysiciansOrganizationQuestion(field))
      ? dedupeEvidence([
        ...selectFuturePhysiciansOrganizationEvidence(field, request.organizationEvidence || []),
        ...routedEvidence.filter((item) => !item.id.startsWith("fp_org_")),
      ], 14)
      : selectRelevantEvidence(field, routedEvidence);
    if (request.proactive && needsPersonalInput(field) && !evidence.length) evidence = routedEvidence.slice(0, 12);
    if (!evidence.length) return { field, immediate: needsInput("No matching verified evidence was found for this question. Add or verify a relevant fact first.") };
    return { field, evidence };
  });
  const eligible = prepared.filter((item): item is PreparedField & { evidence: DraftEvidence[] } => Boolean(item.evidence));
  if (!eligible.length) return prepared.map((item) => item.immediate || needsInput("More verified context is required."));
  if (!process.env.OPENAI_API_KEY) {
    return prepared.map((item) => item.immediate || ({ status: "not_configured", draft: "", usedEvidenceIds: [], questions: ["AI drafting is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."], confidence: "low", assumptions: [] }));
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const evidenceCatalog = new Map<string, DraftEvidence>();
  eligible.forEach((item) => item.evidence.forEach((evidence) => evidenceCatalog.set(evidence.id, evidence)));
  let response: Awaited<ReturnType<typeof client.responses.create>>;
  try {
    response = await client.responses.create({
    model: process.env.OPENAI_DRAFT_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol",
    reasoning: { effort: "low" },
    input: [
      {
        role: "developer",
        content: [
          "You are MeritOS, an evidence-bound application field analyst.",
          request.organizationName
            ? `This workspace belongs to ${request.organizationName}. Evidence IDs beginning with fp_org_ describe the organization, never the individual member.`
            : "Evidence IDs beginning with fp_org_ describe an organization, never the individual applicant.",
          "For organization, mission, program, accomplishment, grant-budget, or use-of-funds questions, write as FuturePhysicians.org or first-person plural (we/our). For personal, applicant, contact, or member-contribution questions, write in first-person singular and never use fp_org_ evidence.",
          "Never attribute an organization-wide accomplishment, reach, program, or impact to the individual member unless separate member evidence explicitly establishes that person's contribution.",
          "Evidence labeled FuturePhysicians use of funds or FuturePhysicians grant plan describes future proposed activity. Keep it in future tense and never present it as a completed program, secured partnership, or past impact. Award-recognition answers must rely on documented historical impact rather than proposed grant plans.",
          "Preserve every [[PLACEHOLDER]] token exactly. A placeholder marks unresolved application-specific information and must never be guessed or silently removed.",
          "Analyze every supplied field independently. The evidence catalog is shared across the form; for each field, use only evidence IDs listed in that field's allowedEvidenceIds.",
          "Never transfer identity/contact information into a field about a teacher, recommender, reference, supervisor, parent, guardian, or other third party.",
          "Never invent credentials, grades, dates, metrics, achievements, eligibility, consent, demographics, legal status, or work authorization. Motivation may be inferred only in PROACTIVE MODE from verified applicant direction plus official opportunity context, and must be disclosed as an assumption.",
          "For narrative fields, answer directly in a concise first-person voice while preserving evidence meaning.",
          "Treat employment, entrepreneurship, nonprofit service, teaching, creative work, caregiving, athletics, skilled trades, and research as equally valid evidence. Choose the experience that best answers the exact question instead of defaulting to research.",
          "For project, research, leadership, or community narratives, introduce the experience and the applicant's role first, then describe the applicant's individual action, then the supported result or learning. Never open with an isolated metric or result.",
          "If the allowed evidence contains only a result but does not establish the applicant's role or action, return needs_input and ask for that missing contribution instead of producing a result-only answer.",
          "Use the application page title only to understand the question context. Do not invent requirements or applicant facts from the title or URL, and never infer motivation from the title alone.",
          "Official opportunity context may clarify what a prompt is asking, but it is never evidence about the applicant and cannot support an applicant claim by itself.",
          request.highInitiative
            ? "HIGH-INITIATIVE MODE: Complete every low-risk field that can be reasonably inferred from verified evidence and official opportunity context. Prefer a coherent answer over a follow-up question, but label all inferred emphasis, fit, motivation, availability preferences, or likely intent in assumptions and use medium or low confidence. Do not infer identity, new achievements, credentials, grades, dates, metrics, legal or work-authorization status, demographics, sensitive disclosures, consent, or third-party facts."
            : request.proactive
            ? "PROACTIVE MODE: Prefer a useful complete draft over asking for input when verified evidence supports a reasonable low-risk interpretation. You may infer emphasis, fit, motivation, or likely intent from the applicant's verified goals and experiences plus the official opportunity context. Record every such inference in assumptions and use medium or low confidence. Never infer new factual achievements, credentials, grades, dates, metrics, legal status, demographics, consent, or third-party information."
            : "STANDARD MODE: If applicant intent or support is incomplete, ask for input instead of inferring it.",
          "Write one cohesive answer and remove semantic repetition. Never restate the same role, metric, action, or outcome in a second sentence. Use bullets only when the field explicitly requests a list.",
          "For radio, checkbox, or select fields, draft must exactly equal one supplied option label and only when evidence directly supports it.",
          "For open-text fields with medium or low confidence, alternatives may contain up to two meaningfully different grounded phrasings that use the same allowed evidence and introduce no new facts. Return an empty alternatives array for high-confidence or choice fields.",
          "If support is incomplete, return needs_input with one specific question. Return one result for every fieldId and only JSON matching the schema.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          page: {
            title: cleanDraftingText(request.page?.title, 300),
            url: cleanDraftingText(request.page?.url, 1_000),
            officialOpportunityContext: cleanDraftingText(request.page?.opportunityContext, 5_000),
          },
          verifiedEvidence: [...evidenceCatalog.values()].map((item) => ({ id: item.id, category: item.category, statement: item.statement })),
          fields: eligible.map(({ field, evidence }) => ({
            fieldId: field.id || field.label,
            label: cleanDraftingText(field.label, 500),
            description: cleanDraftingText(field.description, 500),
            type: cleanDraftingText(field.type, 80),
            control: cleanDraftingText(field.control, 40),
            maxCharacters: normalizedMaxLength(field),
            options: Array.isArray(field.options) ? field.options.slice(0, 40).map((option) => cleanDraftingText(typeof option === "string" ? option : option.label || option.value, 180)) : [],
            allowedEvidenceIds: evidence.map((item) => item.id),
            answerScope: isMemberContributionQuestion(field) ? "individual_member" : request.organizationApplication || isFuturePhysiciansOrganizationQuestion(field) ? "futurephysicians_organization" : "individual_member",
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
                required: ["fieldId", "status", "draft", "alternatives", "usedEvidenceIds", "questions", "confidence", "assumptions"],
                properties: {
                  fieldId: { type: "string" }, status: { type: "string", enum: ["draft", "needs_input"] }, draft: { type: "string" },
                  alternatives: { type: "array", maxItems: 2, items: { type: "string" } },
                  usedEvidenceIds: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } },
                  confidence: { type: "string", enum: ["high", "medium", "low"] }, assumptions: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    });
  } catch {
    return prepared.map((item) => item.immediate || evidenceOnlyFallback(item.field, item.evidence || []));
  }
  let payload: { items?: Array<{ fieldId?: string; status?: string; draft?: string; alternatives?: unknown; usedEvidenceIds?: unknown; questions?: unknown; confidence?: unknown; assumptions?: unknown }> };
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
    const confidence = ["high", "medium", "low"].includes(String(parsed?.confidence)) ? parsed?.confidence as "high" | "medium" | "low" : "low";
    const assumptions = Array.isArray(parsed?.assumptions) ? parsed.assumptions.map((assumption) => cleanDraftingText(assumption, 240)).filter(Boolean).slice(0, 4) : [];
    let draft = dedupeDraftText(parsed?.draft, normalizedMaxLength(item.field));
    let alternatives = Array.isArray(parsed?.alternatives)
      ? [...new Set(parsed.alternatives.map((alternative) => dedupeDraftText(alternative, normalizedMaxLength(item.field))).filter((alternative) => alternative && alternative !== draft))].slice(0, 2)
      : [];
    if (Array.isArray(item.field.options) && item.field.options.length && draft) {
      const option = item.field.options.find((candidate) => {
        const label = typeof candidate === "string" ? candidate : candidate.label || candidate.value || "";
        return label.toLowerCase().trim() === draft.toLowerCase().trim();
      });
      draft = option ? (typeof option === "string" ? option : option.label || option.value || "") : "";
      alternatives = [];
    }
    return parsed?.status === "draft" && draft && usedEvidenceIds.length
      ? { status: "draft", draft, alternatives, usedEvidenceIds, questions: [], confidence, assumptions }
      : needsInput(questions[0] || "The verified evidence does not yet support a truthful answer to this question.");
  });
}
