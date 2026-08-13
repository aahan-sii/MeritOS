import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { claims } from "@/db/schema";
import { parseOpportunityRows, scoreOpportunity } from "@/lib/opportunity-watch-core";
import { scanLiveWebOpportunities } from "@/lib/opportunity-web-search";
import { extensionCorsHeaders, requireExtensionConnection } from "../_lib";

export const runtime = "nodejs";
const sources = [
  { name: "Simplify 2027 internships", repo: "SimplifyJobs/Summer2027-Internships", raw: "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md" },
  { name: "Summer 2027 internships", repo: "sndsh404/summer-2027-internships", raw: "https://raw.githubusercontent.com/sndsh404/summer-2027-internships/main/README.md" },
  { name: "2027 internship engine", repo: "zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships", raw: "https://raw.githubusercontent.com/zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships/main/README.md" },
  { name: "2027 internships", repo: "zapplyjobs/Internships-2027", raw: "https://raw.githubusercontent.com/zapplyjobs/Internships-2027/main/README.md" },
  { name: "2027 SWE roles", repo: "speedyapply/2027-SWE-College-Jobs", raw: "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/main/README.md" },
  { name: "Community internship tracker", repo: "SuryaHarikrishnan/internship-tracker", raw: "https://raw.githubusercontent.com/SuryaHarikrishnan/internship-tracker/main/README.md" },
  { name: "Dreamwork 2027 internships", repo: "dreamworkhq/Tech-Internships-2027", raw: "https://raw.githubusercontent.com/dreamworkhq/Tech-Internships-2027/main/README.md" },
];
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: extensionCorsHeaders }); }
function terms(value: string) {
  const ignored = new Set(["with", "that", "this", "from", "into", "summer", "internship", "internships", "program", "programs", "looking", "find"]);
  return [...new Set(value.toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2 && !ignored.has(word)))];
}
function firstExternalHref(html: string) {
  const matches = [...String(html || "").matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)];
  return matches.map((match) => match[1].replace(/&amp;/g, "&")).find((url) => !/news\.ycombinator\.com|ycombinator\.com\/jobs/i.test(url)) || "";
}
async function scan(source: (typeof sources)[number], query: string) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(source.raw, { signal: controller.signal, headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).finally(() => clearTimeout(timer));
  if (!response.ok) return [];
  return parseOpportunityRows((await response.text()).slice(0, 1_250_000), query, source);
}

async function scanExternalBoards(query: string) {
  const settled = await Promise.allSettled([
    fetch("https://remotive.com/api/remote-jobs?limit=100", { headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://remoteok.com/api", { headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://jobicy.com/api/v2/remote-jobs?count=100", { headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://www.themuse.com/api/public/jobs?page=0&descending=true", { headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=50`, { headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
  ]);
  const [remotive, arbeitnow, remoteok, jobicy, muse, hackerNews] = settled.map((result) => result.status === "fulfilled" ? result.value : null);
  const candidates = [
    ...((remotive?.jobs || []).map((job: Record<string, unknown>) => ({ company: String(job.company_name || "Employer"), title: String(job.title || "Open role"), location: String(job.candidate_required_location || "Remote"), url: String(job.url || ""), source: "Remotive", repository: "https://remotive.com/remote-jobs", searchText: `${job.title || ""} ${job.company_name || ""} ${job.candidate_required_location || ""} ${job.description || ""}` }))),
    ...((arbeitnow?.data || []).map((job: Record<string, unknown>) => ({ company: String(job.company_name || "Employer"), title: String(job.title || "Open role"), location: String(job.location || (job.remote ? "Remote" : "Check listing")), url: String(job.url || ""), source: "Arbeitnow", repository: "https://www.arbeitnow.com/", searchText: `${job.title || ""} ${job.company_name || ""} ${job.location || ""} ${job.description || ""} ${Array.isArray(job.tags) ? job.tags.join(" ") : ""}` }))),
    ...((Array.isArray(remoteok) ? remoteok.slice(1) : []).map((job: Record<string, unknown>) => ({ company: String(job.company || "Employer"), title: String(job.position || "Open role"), location: String(job.location || "Remote"), url: String(job.apply_url || job.url || ""), source: "Remote OK", repository: "https://remoteok.com/", searchText: `${job.position || ""} ${job.company || ""} ${job.location || ""} ${job.description || ""} ${Array.isArray(job.tags) ? job.tags.join(" ") : ""}` }))),
    ...((jobicy?.jobs || []).map((job: Record<string, unknown>) => ({ company: String(job.companyName || "Employer"), title: String(job.jobTitle || "Open role"), location: String(job.jobGeo || "Remote"), url: String(job.url || ""), source: "Jobicy", repository: "https://jobicy.com/", searchText: `${job.jobTitle || ""} ${job.companyName || ""} ${job.jobGeo || ""} ${job.jobDescription || ""}` }))),
    ...((muse?.results || []).map((job: Record<string, unknown>) => { const company = job.company && typeof job.company === "object" ? String((job.company as Record<string, unknown>).name || "Employer") : "Employer"; const locations = Array.isArray(job.locations) ? job.locations.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).name || "") : "").filter(Boolean).join(", ") : "Check listing"; const refs = job.refs && typeof job.refs === "object" ? job.refs as Record<string, unknown> : {}; return { company, title: String(job.name || "Open role"), location: locations, url: String(refs.landing_page || ""), source: "The Muse", repository: "https://www.themuse.com/search/", searchText: `${job.name || ""} ${company} ${locations} ${job.contents || ""}` }; })),
    ...((hackerNews?.hits || []).map((hit: Record<string, unknown>) => { const text = String(hit.comment_text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); return { company: String(hit.author || "Hacker News"), title: text.slice(0, 120) || String(hit.story_title || "Who is hiring opportunity"), location: /remote/i.test(text) ? "Remote mentioned" : "Check post", url: firstExternalHref(String(hit.comment_text || "")) || `https://news.ycombinator.com/item?id=${encodeURIComponent(String(hit.objectID || ""))}`, source: "Hacker News", repository: "https://hn.algolia.com/api", searchText: text }; })),
  ];
  return candidates.map((item) => ({ ...item, ...scoreOpportunity(item, query) }))
    .filter((item) => item.url && item.eligible);
}

export async function POST(request: NextRequest) {
  const connection = await requireExtensionConnection(request);
  if (!connection) return NextResponse.json({ error: "This connection key is invalid or revoked." }, { status: 401, headers: extensionCorsHeaders });
  try {
    const query = String((await request.json())?.query || "").trim().slice(0, 400);
    if (query.length < 5) return NextResponse.json({ error: "Describe the opportunity you want MeritOS to find." }, { status: 400, headers: extensionCorsHeaders });
    const profile = await connection.db.select({ statement: claims.statement, category: claims.category }).from(claims)
      .where(and(eq(claims.userEmail, connection.connection.userEmail), inArray(claims.status, ["verified", "draft"]))).orderBy(desc(claims.updatedAt)).limit(150);
    const profileTerms = terms(profile.map((item) => `${item.category} ${item.statement}`).join(" ")).slice(0, 80);
    const profileContext = profile.slice(0, 35).map((item) => `${item.category}: ${item.statement}`).join("\n");
    const settled = await Promise.allSettled([...sources.map((source) => scan(source, query)), scanExternalBoards(query), scanLiveWebOpportunities(query, profileContext)]);
    const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index)
      .map((item) => { const text = `${item.company} ${item.title} ${item.location}`.toLowerCase(); const matches = profileTerms.filter((term) => text.includes(term)).slice(0, 5); const sourceReasons = Array.isArray(item.matchReasons) ? item.matchReasons : []; return { ...item, fitScore: Math.min(99, Math.max(1, 38 + Number(item.relevanceScore || 0) + matches.length * 3)), matchReasons: [...sourceReasons, ...matches.slice(0, 3).map((term) => `Profile match: ${term}`)].slice(0, 6) }; })
      .sort((a, b) => b.fitScore - a.fitScore || b.matchCount - a.matchCount).slice(0, 24);
    return NextResponse.json({ items, checkedAt: new Date().toISOString(), note: "Live public listings. MeritOS prepares selected applications but never submits them." }, { headers: extensionCorsHeaders });
  } catch { return NextResponse.json({ error: "Opportunity search is temporarily unavailable. Try a more specific goal." }, { status: 502, headers: extensionCorsHeaders }); }
}
