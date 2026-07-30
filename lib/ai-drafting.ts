import OpenAI from "openai";
import { buildDraftingPrompt, canDraftField, cleanDraftingText, needsPersonalInput, normalizedMaxLength, selectRelevantEvidence } from "./ai-drafting-core";

export { buildDraftingPrompt, canDraftField, needsPersonalInput, normalizedMaxLength, selectRelevantEvidence } from "./ai-drafting-core";

export type DraftField = {
  id?: string;
  label: string;
  kind?: string;
  type?: string;
  name?: string;
  maxLength?: number;
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

function needsInput(question: string): DraftResult {
  return { status: "needs_input", draft: "", usedEvidenceIds: [], questions: [question] };
}

export async function createGroundedDraft(request: DraftRequest): Promise<DraftResult> {
  if (needsPersonalInput(request.field)) {
    return needsInput("Why does this specific opportunity matter to you? Add your own reason in MeritOS before drafting this answer.");
  }
  if (!canDraftField(request.field)) {
    return needsInput("MeritOS needs a clearer application question or more matching verified evidence before it can draft this safely.");
  }
  if (!request.evidence.length) {
    return needsInput("Verify at least one relevant profile fact before asking MeritOS to draft this answer.");
  }
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: "not_configured",
      draft: "",
      usedEvidenceIds: [],
      questions: ["AI drafting is not configured yet. Add OPENAI_API_KEY in Vercel, then redeploy."],
    };
  }

  const relevantEvidence = selectRelevantEvidence(request.field, request.evidence);
  if (!relevantEvidence.length) {
    return needsInput("No matching verified evidence was found for this question. Add or verify a relevant fact first.");
  }
  const prompt = buildDraftingPrompt({ ...request, evidence: relevantEvidence });
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    input: [
      { role: "developer", content: prompt.developer },
      { role: "user", content: prompt.user },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "meritos_grounded_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["status", "draft", "usedEvidenceIds", "questions"],
          properties: {
            status: { type: "string", enum: ["draft", "needs_input"] },
            draft: { type: "string" },
            usedEvidenceIds: { type: "array", items: { type: "string" } },
            questions: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  });

  let parsed: { status?: string; draft?: string; usedEvidenceIds?: unknown; questions?: unknown };
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new Error("The drafting service returned an invalid response.");
  }

  const validIds = new Set(relevantEvidence.map((item: DraftEvidence) => item.id));
  const usedEvidenceIds = Array.isArray(parsed.usedEvidenceIds)
    ? parsed.usedEvidenceIds.filter((item): item is string => typeof item === "string" && validIds.has(item))
    : [];
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.map((item) => cleanDraftingText(item, 300)).filter(Boolean).slice(0, 2)
    : [];
  const draft = cleanDraftingText(parsed.draft, normalizedMaxLength(request.field));

  if (parsed.status !== "draft" || !draft || !usedEvidenceIds.length) {
    return needsInput(questions[0] || "The verified evidence does not yet support a truthful answer to this question.");
  }
  return { status: "draft", draft, usedEvidenceIds, questions: [] };
}
