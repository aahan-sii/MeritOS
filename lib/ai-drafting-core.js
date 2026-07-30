const MAX_FIELD_LENGTH = 12_000;
const NARRATIVE_PATTERN = /research|leadership|initiative|project|impact|community|volunteer|service|award|honou?r|achievement|distinction|education|coursework/i;
const PERSONAL_INTENT_PATTERN = /why\s+(are|do)\s+you\s+(applying|want)|why.*(fellowship|program|opportunity|grant|scholarship)|motivation|motivated|personal statement|statement of purpose|career goal/i;
const EVIDENCE_HINTS = {
  research: /research|laboratory|lab\b|experiment|genomics|bioinformatics|publication|poster|abstract|investigation/i,
  leadership: /leadership|initiative|led\b|founded|president|captain|chair|organized|managed|mentored|supervised/i,
  project: /project|impact|built|developed|designed|created|implemented|engineered|prototype|platform/i,
  community: /community|volunteer|service|outreach|nonprofit|tutor|fundrais/i,
  award: /award|honou?r|achievement|distinction|recognition|winner|finalist|scholarship|medal/i,
  education: /education|coursework|degree|university|college|academy|high school|gpa/i,
};

export function cleanDraftingText(value, maxLength) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength) : "";
}

export function normalizedMaxLength(field) {
  const limit = Number(field.maxLength);
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), MAX_FIELD_LENGTH) : 1_200;
}

export function needsPersonalInput(field) {
  return PERSONAL_INTENT_PATTERN.test(`${field.label} ${field.name ?? ""}`);
}

export function canDraftField(field) {
  return !needsPersonalInput(field) && NARRATIVE_PATTERN.test(`${field.label} ${field.name ?? ""} ${field.kind ?? ""}`);
}

export function selectRelevantEvidence(field, evidence) {
  const question = `${field.label} ${field.name ?? ""}`.toLowerCase();
  const requested = Object.entries(EVIDENCE_HINTS)
    .filter(([, pattern]) => pattern.test(question))
    .map(([intent]) => intent);
  if (!requested.length) return evidence.slice(0, 6);
  return evidence
    .map((item) => {
      const value = `${item.category} ${item.statement}`;
      const score = requested.reduce((total, intent) => total + (EVIDENCE_HINTS[intent].test(value) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map(({ item }) => item);
}

export function buildDraftingPrompt({ field, page = {}, evidence }) {
  const maxLength = normalizedMaxLength(field);
  const safeEvidence = evidence.slice(0, 12).map((item) => ({
    id: item.id,
    category: cleanDraftingText(item.category, 80),
    statement: cleanDraftingText(item.statement, 1_500),
  }));

  return {
    developer: [
      "You are MeritOS, an evidence-bound application drafting assistant.",
      "Use ONLY the supplied verified evidence. Never invent, assume, embellish, or infer credentials, grades, awards, publications, organizations, dates, responsibilities, metrics, outcomes, motivations, or personal circumstances.",
      "Answer the field question directly in a natural, concise first-person application voice. You may reorganize or compress supplied facts but must preserve their meaning.",
      "If the evidence cannot truthfully answer the question, return status needs_input with one or two short, specific questions. Do not produce a partial or generic draft in that case.",
      "Return only JSON matching the requested schema.",
    ].join(" "),
    user: JSON.stringify({
      field: {
        label: cleanDraftingText(field.label, 500),
        type: cleanDraftingText(field.type, 80),
        maxCharacters: maxLength,
      },
      page: {
        title: cleanDraftingText(page?.title, 300),
        url: cleanDraftingText(page?.url, 1_000),
      },
      verifiedEvidence: safeEvidence,
    }),
  };
}
