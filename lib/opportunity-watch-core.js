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

export function parseOpportunityRows(markdown, query, source) {
  const rawQuery = String(query || "").toLowerCase();
  const stopWords = new Set(["intern", "internship", "internships", "summer", "application", "applications", "role", "roles", "position", "positions", "program", "programs"]);
  const terms = rawQuery.split(/[^a-z0-9+#.]+/).filter((term) => term.length >= 3 && !stopWords.has(term)).slice(0, 12);
  if (/computational biology|bioinformatics/i.test(rawQuery)) terms.push("bioinformatics", "genomics", "biomedical");
  if (/high school|secondary school/i.test(rawQuery)) terms.push("student", "youth");
  if (/research/i.test(rawQuery)) terms.push("laboratory", "lab");
  const rows = [];
  for (const line of String(markdown || "").split(/\r?\n/)) {
    if (!line.includes("|") || /---|company\s*\|\s*(role|title)/i.test(line)) continue;
    const url = linkFrom(line);
    if (!url) continue;
    const cells = line.split("|").map(cleanCell).filter(Boolean);
    const searchable = cells.join(" ").toLowerCase();
    const matches = terms.length ? terms.filter((term) => searchable.includes(term)).length : 0;
    if (terms.length && matches === 0) continue;
    rows.push({
      company: cells[0] || "Opportunity",
      title: cells[1] || cells[0] || "Open listing",
      location: cells[2] || "Check listing",
      url,
      source: source.name,
      repository: `https://github.com/${source.repo}`,
      matchCount: matches,
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
      const searchable = cells.join(" ").toLowerCase();
      const matches = terms.length ? terms.filter((term) => searchable.includes(term)).length : 0;
      if (terms.length && matches === 0) continue;
      rows.push({
        company: cells[0] || "Opportunity",
        title: cells[1] || cells[0] || "Open listing",
        location: cells[2] || "Check listing",
        url,
        source: source.name,
        repository: `https://github.com/${source.repo}`,
        matchCount: matches,
      });
      if (rows.length >= 20) break;
    }
  }
  return rows;
}
