export type HumanProfileEvidence = { id: string; category: string; statement: string };

export type HumanProfile = {
  summary: string;
  themes: string[];
  technicalFocus: string[];
  applicationDirections: string[];
  evidenceIds: string[];
  needsOpportunityContext: boolean;
};

const THEME_PATTERNS: Array<[string, RegExp]> = [
  ["computational biology", /computational biology|bioinformatics|genomics|methylation|epigenetic/i],
  ["health and disease research", /disease|autoimmune|clinical|health|biomedical|pneumonia/i],
  ["data and automation", /python|bash|workflow|pipeline|machine learning|data science|hpc|automation/i],
  ["research communication", /research fair|poster|presented|publication|conference/i],
  ["organizational leadership", /president|leadership|organized|coordinated|managed|onboarding/i],
  ["community access", /community|outreach|volunteer|shadowing|service/i],
];

function unique<T>(items: T[]) { return [...new Set(items)]; }

export function buildHumanProfile(evidence: HumanProfileEvidence[]): HumanProfile {
  const verified = evidence.filter((item) => item?.statement?.trim()).slice(0, 60);
  const text = verified.map((item) => `${item.category}: ${item.statement}`).join("\n");
  const themes = THEME_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([theme]) => theme);
  const technicalFocus = unique((text.match(/\b(?:Python|Bash|Git|Linux|HPC|bioinformatics|genomics|methylation|machine learning|data science|SCOPE|samtools|bcftools)\b/gi) || []).map((value) => value.toLowerCase())).slice(0, 8);
  const directions: string[] = [];
  if (themes.includes("computational biology")) directions.push("research internships and programs involving computational biology, genomics, bioinformatics, or data-driven health research");
  if (themes.includes("health and disease research")) directions.push("health, biomedical, disease-modeling, and translational research opportunities");
  if (themes.includes("organizational leadership")) directions.push("student leadership, outreach, and mission-driven team roles");
  if (!directions.length) directions.push("opportunities related to the applicant’s verified experience and stated interests");
  const education = verified.find((item) => /education/i.test(item.category) && /high school|academy|college|university/i.test(item.statement));
  const role = themes.includes("computational biology") ? "a student building computational biology research experience" : "a student building evidence-backed academic and extracurricular experience";
  const summary = `${education?.statement ? `${education.statement.split(/[|.]/)[0].trim()} — ` : ""}${role}${themes.length ? `, with demonstrated work in ${themes.slice(0, 3).join(", ")}` : ""}.`;
  return {
    summary,
    themes,
    technicalFocus,
    applicationDirections: directions,
    evidenceIds: verified.filter((item) => THEME_PATTERNS.some(([, pattern]) => pattern.test(`${item.category} ${item.statement}`))).map((item) => item.id).slice(0, 16),
    // A résumé can establish direction, never a truthful reason for one named program.
    needsOpportunityContext: true,
  };
}
