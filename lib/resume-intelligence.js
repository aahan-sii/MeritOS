const SECTION_PATTERNS = [
  [/award|honou?r|achievement|distinction|recognition/i, "Award or distinction"],
  [/community|volunteer|service|outreach/i, "Community contribution"],
  [/leadership|activities|extracurricular/i, "Leadership"],
  [/research|publication|poster/i, "Research experience"],
  [/project|portfolio/i, "Project or impact"],
  [/education|school|academic|coursework/i, "Education"],
  [/experience|employment|work|internship/i, "Professional experience"],
];

const EDUCATION_MARKERS = /\b(university|college|academy|high school|school of|institute|institut)\b/i;

export function categoryForHeading(heading) {
  const normalized = heading.replace(/[:.]/g, "").trim();
  if (/[|,]/.test(normalized) || normalized.split(/\s+/).length > 4) return "";
  return SECTION_PATTERNS.find(([pattern]) => pattern.test(normalized))?.[1] ?? "";
}

export function categoryForStatement(statement) {
  const value = statement.toLowerCase();
  if (/\b(award|honou?r(?:able)?|scholarship|distinction|dean'?s list|finalist|winner|medal|champion|gold|silver|bronze)\b/.test(value)) return "Award or distinction";
  if (/\b(volunteer|community|service|nonprofit|outreach|tutor(?:ed|ing)?|fundrais)/.test(value)) return "Community contribution";
  if (/\b(led|founded|president|captain|chair|coordinated|organized|managed|mentored|supervised)\b/.test(value)) return "Leadership";
  if (/\b(research|laboratory|lab\b|genomics|bioinformatics|publication|poster|abstract|experiment)/.test(value)) return "Research experience";
  if (/\b(project|built|developed|designed|created|implemented|engineered|prototype|application|platform)/.test(value)) return "Project or impact";
  if (EDUCATION_MARKERS.test(value) || /\b(degree|gpa|coursework|graduat(?:ed|ion))\b/.test(value)) return "Education";
  if (/\b(intern|employment|worked|assistant|experience|role)\b/.test(value)) return "Professional experience";
  return "Other resume evidence";
}

export function extractResumeEvidence(text) {
  const seen = new Set();
  const candidates = [];
  let activeSection = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^[\s•●▪◦*-]+/, "").replace(/\s+/g, " ").trim();
    if (!line || line.length > 360 || !/[a-z]/i.test(line)) continue;
    const section = categoryForHeading(line);
    const looksLikeHeading = line.length <= 42 && (section || line === line.toUpperCase() || /:$/.test(line));
    if (looksLikeHeading) {
      if (section) activeSection = section;
      continue;
    }
    if (line.length < 10 || (line.length < 28 && !activeSection)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ statement: line, category: activeSection || categoryForStatement(line) });
    if (candidates.length >= 40) break;
  }
  return candidates;
}

export function bestInstitution(candidates) {
  const education = candidates.filter((item) => item.category === "Education" || EDUCATION_MARKERS.test(item.statement));
  return education
    .map((item) => ({
      ...item,
      score: (EDUCATION_MARKERS.test(item.statement) ? 30 : 0) +
        (/\b(coursework|ap |honors course|classes)\b/i.test(item.statement) ? -25 : 0) +
        Math.min(item.statement.length / 100, 3),
    }))
    .sort((a, b) => b.score - a.score)[0]?.statement ?? "";
}
