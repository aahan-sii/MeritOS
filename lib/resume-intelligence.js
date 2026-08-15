const SECTION_PATTERNS = [
  [/award|honou?r|achievement|distinction|recognition/i, "Award or distinction"],
  [/community|volunteer|service|outreach|nonprofit|philanthrop/i, "Community contribution"],
  [/leadership|activities|extracurricular|organization|association/i, "Leadership"],
  [/research|publication|poster|conference|laboratory/i, "Research experience"],
  [/project|portfolio|product|venture|startup|entrepreneur/i, "Project or impact"],
  [/education|school|academic|coursework/i, "Education"],
  [/experience|employment|work|internship|career|teaching/i, "Professional experience"],
  [/skill|technology|certification|license|language/i, "Skills or certification"],
];

const EDUCATION_MARKERS = /\b(university|college|academy|high school|secondary school|school of|institute|institut|polytechnic)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s|,)\]}]+|(?:linkedin\.com\/in|github\.com)\/[^\s|,)\]}]+/i;
const SECTION_HEADING = /^(education|academic background|experience|work experience|professional experience|employment|research(?: experience)?|projects?|selected projects?|leadership|activities|community(?: service)?|volunteer(?:ing)?|awards?(?: & honors?)?|honors?|skills?|certifications?|licenses?|publications?|portfolio|entrepreneurship|ventures?|nonprofit(?: experience)?)\s*:?​?$/i;

function cleanLine(rawLine) {
  return String(rawLine || "")
    .replace(/^[\s•●▪◦*-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export function categoryForHeading(heading) {
  const normalized = cleanLine(heading).replace(/[:.]/g, "").trim();
  if (/[|,]/.test(normalized) || normalized.split(/\s+/).length > 4) return "";
  return SECTION_PATTERNS.find(([pattern]) => pattern.test(normalized))?.[1] ?? "";
}

export function categoryForStatement(statement) {
  const value = statement.toLowerCase();
  if (/\b(award|honou?r(?:able)?|scholarship|distinction|dean'?s list|finalist|winner|medal|champion|gold|silver|bronze)\b/.test(value)) return "Award or distinction";
  if (/\b(volunteer|community|service|nonprofit|outreach|tutor(?:ed|ing)?|fundrais|donat|advocacy)\b/.test(value)) return "Community contribution";
  if (/\b(led|leadership|founded|co-?founded|president|captain|chair|coordinated|organized|managed|mentored|supervised|directed)\b/.test(value)) return "Leadership";
  if (/\b(research|laboratory|lab\b|genomics|bioinformatics|publication|poster|abstract|experiment|investigat)\b/.test(value)) return "Research experience";
  if (/\b(project|built|developed|designed|created|implemented|engineered|prototype|application|platform|startup|venture|product|launched)\b/.test(value)) return "Project or impact";
  if (EDUCATION_MARKERS.test(value) || /\b(degree|gpa|coursework|graduat(?:ed|ing|ion)|class of|grade)\b/.test(value)) return "Education";
  if (/\b(intern|employment|worked|assistant|experience|role|associate|specialist|consultant|teacher|instructor|engineer|analyst|designer|developer)\b/.test(value)) return "Professional experience";
  if (/\b(skills?|certifi(?:ed|cation)|licensed?|technolog(?:y|ies)|proficien|languages?)\b/.test(value)) return "Skills or certification";
  return "Other resume evidence";
}

function looksLikeName(line) {
  if (!line || line.length < 4 || line.length > 70 || /\d|@|https?:|www\.|linkedin|github/i.test(line)) return false;
  if (SECTION_HEADING.test(line) || categoryForHeading(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (/\b(resume|curriculum vitae|student|engineer|researcher|developer|manager|founder|intern)\b/i.test(line)) return false;
  const titleCase = words.every((word) => /^\p{Lu}[\p{L}'\-]+$/u.test(word) || /^\p{Lu}\.?$/u.test(word));
  const allCaps = line === line.toUpperCase() && words.every((word) => /^[A-Z][A-Z'\-]+$/.test(word));
  return titleCase || allCaps;
}

function graduationFrom(text) {
  return text.match(/(?:class of|expected(?: graduation)?(?: in)?|graduat(?:ing|ion)[^0-9]{0,16})\s*(?:may|june|spring|fall|winter)?\s*(20\d{2})/i)?.[1]
    || text.match(/\b(20\d{2})\s*(?:expected|anticipated)\b/i)?.[1]
    || "";
}

function gradeFrom(text) {
  const direct = text.match(/\b(?:grade\s*)?(9|10|11|12)(?:th|st|nd|rd)?\s*(?:grade|grader|student|year)?\b/i)?.[1];
  if (direct) return `${direct}th grade`;
  const word = text.match(/\b(freshman|sophomore|junior|senior)\b/i)?.[1]?.toLowerCase();
  if (!word) return "";
  return `${({ freshman: 9, sophomore: 10, junior: 11, senior: 12 })[word]}th grade`;
}

export function extractResumeProfile(text) {
  const originalLines = String(text || "").split(/\r?\n/).map((raw, index) => ({ raw, line: cleanLine(raw), index })).filter((item) => item.line);
  const header = originalLines.slice(0, 18);
  const allText = originalLines.map((item) => item.line).join("\n");
  const emailLine = header.find((item) => EMAIL_PATTERN.test(item.line)) || originalLines.find((item) => EMAIL_PATTERN.test(item.line));
  const phoneLine = header.find((item) => PHONE_PATTERN.test(item.line)) || originalLines.find((item) => PHONE_PATTERN.test(item.line));
  // Multi-column PDFs sometimes emit a contact sidebar before the applicant's
  // name. Keep the fast header path, then allow a small fallback window rather
  // than scanning the whole document (where references and coauthors live).
  const nameLine = header.find((item) => looksLikeName(item.line))
    || originalLines.slice(18, 40).find((item) => looksLikeName(item.line));
  const linkLines = originalLines.filter((item) => URL_PATTERN.test(item.line)).slice(0, 8);
  const educationLines = originalLines.filter((item) => EDUCATION_MARKERS.test(item.line) || /\b(class of|expected graduation|graduating|gpa|\d{1,2}(?:th|st|nd|rd) grade)\b/i.test(item.line)).slice(0, 8);
  const educationText = educationLines.map((item) => item.line).join(" ");

  return {
    name: nameLine?.line || "",
    nameSource: nameLine?.line || "",
    email: emailLine?.line.match(EMAIL_PATTERN)?.[0] || "",
    emailSource: emailLine?.line || "",
    phone: phoneLine?.line.match(PHONE_PATTERN)?.[0] || "",
    phoneSource: phoneLine?.line || "",
    links: unique(linkLines.map((item) => item.line.match(URL_PATTERN)?.[0] || "")),
    linkSources: linkLines.map((item) => item.line),
    institutions: unique(educationLines.filter((item) => EDUCATION_MARKERS.test(item.line)).map((item) => item.line)),
    educationSources: educationLines.map((item) => item.line),
    graduationYear: graduationFrom(educationText || allText),
    gradeLevel: gradeFrom(educationText),
  };
}

export function extractCriticalResumeFacts(text) {
  const profile = extractResumeProfile(text);
  const facts = [];
  if (profile.name) facts.push({ category: "Identity", statement: profile.name, sourceQuote: profile.nameSource });
  if (profile.email) facts.push({ category: "Contact details", statement: `Email: ${profile.email}`, sourceQuote: profile.emailSource });
  if (profile.phone) facts.push({ category: "Contact details", statement: `Phone: ${profile.phone}`, sourceQuote: profile.phoneSource });
  for (let index = 0; index < profile.links.length; index += 1) {
    facts.push({ category: "Links & profiles", statement: profile.links[index], sourceQuote: profile.linkSources[index] || profile.links[index] });
  }
  for (const institution of profile.institutions.slice(0, 3)) {
    facts.push({ category: "Education", statement: institution, sourceQuote: institution });
  }
  const educationSource = profile.educationSources.find((line) => graduationFrom(line) || gradeFrom(line));
  if (educationSource && (profile.graduationYear || profile.gradeLevel)) {
    const details = [profile.gradeLevel, profile.graduationYear ? `expected graduation ${profile.graduationYear}` : ""].filter(Boolean).join("; ");
    facts.push({ category: "Education", statement: details, sourceQuote: educationSource });
  }
  return facts;
}

export function extractResumeEvidence(text) {
  const seen = new Set();
  const candidates = [];
  let activeSection = "";
  let sectionLines = [];

  const flushSection = () => {
    if (!activeSection || !sectionLines.length) return;
    const chunks = [];
    let current = [];
    for (const line of sectionLines) {
      const roleHeader = /\b(19|20)\d{2}\b|\s[|]\s|\s[-–—]\s|\b(intern|assistant|associate|founder|president|manager|engineer|analyst|teacher|designer|developer|researcher)\b/i.test(line);
      if (roleHeader && current.length >= 3) {
        chunks.push(current);
        current = [];
      }
      current.push(line);
    }
    if (current.length) chunks.push(current);
    for (const chunk of chunks) {
      const statement = chunk.join(" ").slice(0, 650);
      const key = statement.toLowerCase();
      if (statement.length >= 10 && !seen.has(key)) {
        seen.add(key);
        candidates.push({ statement, category: activeSection });
      }
    }
    sectionLines = [];
  };

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line || line.length > 420 || !/[a-z]/i.test(line)) continue;
    const section = categoryForHeading(line);
    const looksLikeHeading = line.length <= 48 && (SECTION_HEADING.test(line) || line === line.toUpperCase() || /:$/.test(line));
    if (looksLikeHeading) {
      flushSection();
      if (section) activeSection = section;
      continue;
    }
    if (activeSection) {
      sectionLines.push(line);
    } else if (line.length >= 18 && !EMAIL_PATTERN.test(line) && !PHONE_PATTERN.test(line)) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ statement: line, category: categoryForStatement(line) });
      }
    }
    if (candidates.length >= 55) break;
  }
  flushSection();
  return candidates.slice(0, 55);
}

export function bestInstitution(candidates) {
  const education = candidates.filter((item) => item.category === "Education" || EDUCATION_MARKERS.test(item.statement));
  return education
    .map((item) => ({
      ...item,
      statement: item.statement.split(/(?=\b(?:20\d{2}[-–]\d{2}\s+)?Coursework:)/i)[0].trim(),
      score: (EDUCATION_MARKERS.test(item.statement) ? 30 : 0) +
        (/\b(coursework|ap |honors course|classes)\b/i.test(item.statement) ? -25 : 0) +
        Math.min(item.statement.length / 100, 3),
    }))
    .sort((a, b) => b.score - a.score)[0]?.statement ?? "";
}
