function cleanCell(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/&nbsp;|&#32;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function linkFrom(line) {
  const links = [...line.matchAll(/href=["'](https?:\/\/[^"']+)/g)].map((match) => match[1]);
  const preferred = links.find((url) => !/simplify\.jobs\/(?:c|p)\//i.test(url) && !/i\.imgur\.com|res\.cloudinary\.com/i.test(url));
  const markdown = [...line.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].at(-1)?.[1];
  const html = preferred || links.at(-1);
  const plain = [...line.matchAll(/https?:\/\/[^\s|)"']+/g)].at(-1)?.[0];
  return markdown || html || plain || "";
}

const FIELD_EXPANSIONS = [
  {
    pattern: /computational biology|bioinformatics|computational genomics/i,
    terms: ["computational biology", "bioinformatics", "computational genomics", "genomics", "biomedical", "biostatistics", "systems biology", "molecular modeling", "life science data"],
  },
  { pattern: /software engineering|software developer|computer science/i, terms: ["software", "developer", "engineering", "computer science", "swe"] },
  { pattern: /data science|machine learning|artificial intelligence/i, terms: ["data science", "machine learning", "artificial intelligence", "ai", "analytics"] },
  { pattern: /neuroscience/i, terms: ["neuroscience", "neurobiology", "brain", "cognitive science"] },
];

const AUDIENCE_RULES = [
  {
    audience: "high_school",
    query: /high[ -]?school|secondary school|pre[ -]?college|teen|grades?\s*(?:9|10|11|12)/i,
    positive: /high[ -]?school|secondary school|pre[ -]?college|teen(?:ager)?|youth|grades?\s*(?:9|10|11|12)|rising (?:sophomore|junior|senior)/i,
    conflict: /undergraduate(?:s| students?)? only|college students? only|currently enrolled in (?:a )?(?:college|university)|bachelor(?:'s)? degree required|graduate students? only|master(?:'s)? students?|ph\.?d\.? students?/i,
  },
  {
    audience: "undergraduate",
    query: /undergraduate|college student|university student|bachelor/i,
    positive: /undergraduate|college student|university student|bachelor(?:'s)? candidate|rising (?:sophomore|junior|senior)/i,
    conflict: /high[ -]?school students? only|graduate students? only|master(?:'s)? students?|ph\.?d\.? students?/i,
  },
  {
    audience: "graduate",
    query: /graduate student|master(?:'s)?|ph\.?d\.?|doctoral/i,
    positive: /graduate student|master(?:'s)?|ph\.?d\.?|doctoral/i,
    conflict: /high[ -]?school students? only|undergraduate students? only/i,
  },
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function opportunityQuerySignals(query) {
  const raw = String(query || "").toLowerCase();
  const stopWords = new Set(["intern", "internship", "internships", "summer", "application", "applications", "role", "roles", "position", "positions", "program", "programs", "for", "the", "and", "with", "high", "school", "schooler", "student", "students"]);
  const lexical = raw.split(/[^a-z0-9+#.]+/).filter((term) => term.length >= 3 && !stopWords.has(term));
  const expanded = FIELD_EXPANSIONS.filter((group) => group.pattern.test(raw)).flatMap((group) => group.terms);
  const audienceRule = AUDIENCE_RULES.find((rule) => rule.query.test(raw)) || null;
  return { raw, fieldTerms: unique([...lexical, ...expanded]).slice(0, 24), audience: audienceRule?.audience || "", audienceRule };
}

export function scoreOpportunity(item, query) {
  const signals = opportunityQuerySignals(query);
  const searchable = String(item?.searchText || `${item?.company || ""} ${item?.title || ""} ${item?.location || ""}`).toLowerCase();
  const fieldMatches = signals.fieldTerms.filter((term) => searchable.includes(term));
  const audiencePositive = signals.audienceRule?.positive.test(searchable) || false;
  const audienceConflict = signals.audienceRule?.conflict.test(searchable) || false;
  const fieldRequired = signals.fieldTerms.length > 0;
  const eligible = (!fieldRequired || fieldMatches.length > 0) && !(audienceConflict && !audiencePositive);
  const audienceFit = !signals.audience ? "not_requested" : audiencePositive ? "confirmed" : audienceConflict ? "conflict" : "unconfirmed";
  const relevanceScore = Math.max(0, fieldMatches.length * 12 + (audiencePositive ? 30 : signals.audience ? -8 : 0));
  const matchReasons = unique([
    audienceFit === "confirmed" ? `${signals.audience.replace("_", "-")} audience stated` : "",
    audienceFit === "unconfirmed" ? `${signals.audience.replace("_", "-")} eligibility needs confirmation` : "",
    fieldMatches.length ? `Field match: ${fieldMatches.slice(0, 3).join(", ")}` : "",
  ]);
  return { eligible, matchCount: fieldMatches.length + (audiencePositive ? 2 : 0), relevanceScore, audienceFit, matchReasons };
}

export function parseOpportunityRows(markdown, query, source) {
  const rows = [];
  for (const line of String(markdown || "").split(/\r?\n/)) {
    if (!line.includes("|") || /---|company\s*\|\s*(role|title)/i.test(line)) continue;
    const url = linkFrom(line);
    if (!url) continue;
    const cells = line.split("|").map(cleanCell).filter(Boolean);
    const scored = scoreOpportunity({ company: cells[0], title: cells[1], location: cells[2], searchText: cells.join(" ") }, query);
    if (!scored.eligible) continue;
    rows.push({
      company: cells[0] || "Opportunity",
      title: cells[1] || cells[0] || "Open listing",
      location: cells[2] || "Check listing",
      url,
      source: source.name,
      repository: `https://github.com/${source.repo}`,
      ...scored,
    });
    if (rows.length >= 20) break;
  }
  if (rows.length < 20) {
    for (const match of String(markdown || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = match[1];
      const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((item) => cleanCell(item[1]));
      if (cells.length < 2) continue;
      const url = linkFrom(row);
      if (!url) continue;
      const scored = scoreOpportunity({ company: cells[0], title: cells[1], location: cells[2], searchText: cells.join(" ") }, query);
      if (!scored.eligible) continue;
      rows.push({
        company: cells[0] || "Opportunity",
        title: cells[1] || cells[0] || "Open listing",
        location: cells[2] || "Check listing",
        url,
        source: source.name,
        repository: `https://github.com/${source.repo}`,
        ...scored,
      });
      if (rows.length >= 20) break;
    }
  }
  return rows;
}
