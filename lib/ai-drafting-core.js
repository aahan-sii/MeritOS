const MAX_FIELD_LENGTH = 12_000;
const NARRATIVE_PATTERN = /research|leadership|initiative|project|impact|community|volunteer|service|award|honou?r|achievement|distinction|education|coursework/i;
const PERSONAL_INTENT_PATTERN = /why\s+(are|do)\s+you\s+(applying|want)|why.*(fellowship|program|opportunity|grant|scholarship)|motivation|motivated|personal statement|statement of purpose|career goal/i;
const THIRD_PARTY_PATTERN = /\b(recommender|recommendation|reference|referee|teacher|counselor|counsellor|mentor|supervisor|manager|principal|parent|guardian|emergency contact|contact person)\b/i;
const UNSAFE_FIELD_PATTERN = /\b(password|social security|ssn|bank account|credit card|routing number)\b/i;
const DIRECT_IDENTITY_PATTERN = /\b(full name|legal name|applicant name|your name|your e-?mail|email address|phone|telephone|mobile|linkedin|personal website|portfolio url|github url)\b/i;
const LEGAL_OR_DEMOGRAPHIC_PATTERN = /\b(work authori[sz]ation|legally authorized|visa sponsorship|citizenship|gender|race|ethnicity|disability|veteran status|sexual orientation|date of birth|birth date|consent|permission|agree to|authorize contact|may we contact)\b/i;
const EVIDENCE_HINTS = {
  research: /research|laboratory|lab\b|experiment|genomics|bioinformatics|publication|poster|abstract|investigation/i,
  leadership: /leadership|initiative|led\b|founded|president|captain|chair|organized|managed|mentored|supervised/i,
  project: /project|impact|built|developed|designed|created|implemented|engineered|prototype|platform/i,
  community: /community|volunteer|service|outreach|nonprofit|tutor|fundrais/i,
  award: /award|honou?r|achievement|distinction|recognition|winner|finalist|scholarship|medal/i,
  education: /education|coursework|degree|university|college|academy|high school|gpa/i,
  motivation: /motivation|goal|interest|aspiration|career|direction|passion|why|purpose/i,
};

export function cleanDraftingText(value, maxLength) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength) : "";
}

function wordSet(value) {
  return new Set(String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
}

export function textSimilarity(left, right) {
  const leftWords = wordSet(left);
  const rightWords = wordSet(right);
  if (!leftWords.size || !rightWords.size) return 0;
  let shared = 0;
  for (const word of leftWords) if (rightWords.has(word)) shared += 1;
  const lexicalScore = shared / Math.min(leftWords.size, rightWords.size);
  const leftNumbers = new Set(String(left || "").match(/\d[\d,.%]*/g)?.map((value) => value.replace(/[^\d]/g, "")) || []);
  const rightNumbers = new Set(String(right || "").match(/\d[\d,.%]*/g)?.map((value) => value.replace(/[^\d]/g, "")) || []);
  const sharedNumbers = [...leftNumbers].filter((value) => value && rightNumbers.has(value)).length;
  return sharedNumbers >= 2 && lexicalScore >= 0.35 ? Math.max(lexicalScore, 0.8) : lexicalScore;
}

export function dedupeEvidence(evidence, limit = 6) {
  const result = [];
  for (const item of evidence) {
    if (!item?.statement || result.some((existing) => textSimilarity(existing.statement, item.statement) >= 0.58)) continue;
    result.push(item);
    if (result.length === limit) break;
  }
  return result;
}

export function dedupeDraftText(value, maxLength = MAX_FIELD_LENGTH) {
  const cleaned = cleanDraftingText(value, maxLength);
  if (!cleaned) return "";
  const parts = cleaned.split(/(?<=[.!?])\s+|\n+/).map((part) => part.replace(/^\s*[•*-]\s*/, "").trim()).filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (unique.some((existing) => textSimilarity(existing, part) >= 0.58)) continue;
    unique.push(part);
  }
  return unique.join(" ").slice(0, maxLength).trim();
}

export function normalizedMaxLength(field) {
  const limit = Number(field.maxLength);
  if (Number.isFinite(limit) && limit > 0) return Math.min(Math.floor(limit), MAX_FIELD_LENGTH);
  return ["textarea", "contenteditable"].includes(String(field.control || field.kind || "").toLowerCase()) ? 1_200 : 240;
}

export function needsPersonalInput(field) {
  return PERSONAL_INTENT_PATTERN.test(`${field.label} ${field.name ?? ""}`);
}

export function canDraftField(field, options = {}) {
  const value = `${field.label} ${field.name ?? ""} ${field.kind ?? ""} ${field.type ?? ""}`;
  if ((needsPersonalInput(field) && !options.proactive) || THIRD_PARTY_PATTERN.test(value) || UNSAFE_FIELD_PATTERN.test(value) || DIRECT_IDENTITY_PATTERN.test(value) || LEGAL_OR_DEMOGRAPHIC_PATTERN.test(value)) return false;
  if (/password|file|hidden|submit/i.test(String(field.type || ""))) return false;
  return NARRATIVE_PATTERN.test(value) || cleanDraftingText(field.label, 500).length >= 4;
}

export function selectRelevantEvidence(field, evidence) {
  const question = `${field.label} ${field.name ?? ""}`.toLowerCase();
  const requested = Object.entries(EVIDENCE_HINTS)
    .filter(([, pattern]) => pattern.test(question))
    .map(([intent]) => intent);
  if (!requested.length) return dedupeEvidence(evidence, 12);
  return dedupeEvidence(evidence
    .map((item) => {
      const value = `${item.category} ${item.statement}`;
      const score = requested.reduce((total, intent) => total + (EVIDENCE_HINTS[intent].test(value) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item), 10);
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
      "For a project, research, leadership, or community narrative, introduce the experience and the applicant's role, then the applicant's action, then the supported result or learning. Never begin with an isolated result or metric.",
      "If the evidence contains a result but does not establish the applicant's role or action, return needs_input instead of drafting a result-only answer.",
      "If the evidence cannot truthfully answer the question, return status needs_input with one or two short, specific questions. Do not produce a partial or generic draft in that case.",
      "For radio, checkbox, or select fields, return exactly one supplied option label and only when verified evidence directly supports it. Never guess eligibility, consent, demographic, legal, or work-authorization answers.",
      "Write one unified answer. Do not repeat the same achievement, metric, action, or outcome in multiple sentences. Do not use bullets unless the field explicitly asks for a list.",
      "Return only JSON matching the requested schema.",
    ].join(" "),
    user: JSON.stringify({
      field: {
        label: cleanDraftingText(field.label, 500),
        type: cleanDraftingText(field.type, 80),
        maxCharacters: maxLength,
        control: cleanDraftingText(field.control, 40),
        options: Array.isArray(field.options) ? field.options.slice(0, 40).map((option) => cleanDraftingText(option?.label || option?.value || option, 180)) : [],
      },
      page: {
        title: cleanDraftingText(page?.title, 300),
        url: cleanDraftingText(page?.url, 1_000),
      },
      verifiedEvidence: safeEvidence,
    }),
  };
}
