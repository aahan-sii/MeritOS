import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { parseOpportunityRows, scoreOpportunity } from "@/lib/opportunity-watch-core";
import { scanLiveWebOpportunities } from "@/lib/opportunity-web-search";
import { ApiError, asRecord, asString, jsonError, requireApiUser } from "../_lib/request";

export const runtime = "nodejs";

const sources = [
  { name: "Simplify 2027 internships", repo: "SimplifyJobs/Summer2027-Internships", raw: "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md" },
  { name: "Summer 2027 internships", repo: "sndsh404/summer-2027-internships", raw: "https://raw.githubusercontent.com/sndsh404/summer-2027-internships/main/README.md" },
  { name: "Automated 2027 internship engine", repo: "zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships", raw: "https://raw.githubusercontent.com/zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships/main/README.md" },
  { name: "Zapply 2027 internships", repo: "zapplyjobs/Internships-2027", raw: "https://raw.githubusercontent.com/zapplyjobs/Internships-2027/main/README.md" },
  { name: "Community internship tracker", repo: "SuryaHarikrishnan/internship-tracker", raw: "https://raw.githubusercontent.com/SuryaHarikrishnan/internship-tracker/main/README.md" },
  { name: "Dreamwork 2027 internships", repo: "dreamworkhq/Tech-Internships-2027", raw: "https://raw.githubusercontent.com/dreamworkhq/Tech-Internships-2027/main/README.md" },
];

async function scanSource(source: (typeof sources)[number], query: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(source.raw, { signal: controller.signal, headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`${source.name} was unavailable.`);
  const markdown = (await response.text()).slice(0, 1_000_000);
  return parseOpportunityRows(markdown, query, source);
}

type ExternalJob = { company: string; title: string; location: string; url: string; source: string; repository: string; searchText?: string; eligible: boolean; matchCount: number; relevanceScore: number; audienceFit: string; matchReasons: string[] };

function firstExternalHref(html: string) {
  const matches = [...String(html || "").matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)];
  return matches.map((match) => match[1].replace(/&amp;/g, "&")).find((url) => !/news\.ycombinator\.com|ycombinator\.com\/jobs/i.test(url)) || "";
}

function externalMatch(item: Omit<ExternalJob, "eligible" | "matchCount" | "relevanceScore" | "audienceFit" | "matchReasons">, query: string): ExternalJob | null {
  const scored = scoreOpportunity(item, query);
  return scored.eligible ? { ...item, ...scored } : null;
}

async function scanJsonBoards(query: string) {
  const requests = await Promise.allSettled([
    fetch("https://remotive.com/api/remote-jobs?limit=100", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://remoteok.com/api", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://jobicy.com/api/v2/remote-jobs?count=100", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://www.themuse.com/api/public/jobs?page=0&descending=true", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=50`, { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
  ]);
  const [remotive, arbeitnow, remoteok, jobicy, muse, hackerNews] = requests.map((result) => result.status === "fulfilled" ? result.value : null);
  return [
    ...((remotive?.jobs || []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.company_name || "Employer"), title: String(job.title || "Open role"), location: String(job.candidate_required_location || "Remote"), url: String(job.url || ""), source: "Remotive", repository: "https://remotive.com/remote-jobs", searchText: `${job.title || ""} ${job.company_name || ""} ${job.candidate_required_location || ""} ${job.description || ""}` }, query))),
    ...((arbeitnow?.data || []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.company_name || "Employer"), title: String(job.title || "Open role"), location: String(job.location || (job.remote ? "Remote" : "Check listing")), url: String(job.url || ""), source: "Arbeitnow", repository: "https://www.arbeitnow.com/", searchText: `${job.title || ""} ${job.company_name || ""} ${job.location || ""} ${job.description || ""} ${Array.isArray(job.tags) ? job.tags.join(" ") : ""}` }, query))),
    ...((Array.isArray(remoteok) ? remoteok.slice(1) : []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.company || "Employer"), title: String(job.position || "Open role"), location: String(job.location || "Remote"), url: String(job.apply_url || job.url || ""), source: "Remote OK", repository: "https://remoteok.com/", searchText: `${job.position || ""} ${job.company || ""} ${job.location || ""} ${job.description || ""} ${Array.isArray(job.tags) ? job.tags.join(" ") : ""}` }, query))),
    ...((jobicy?.jobs || []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.companyName || "Employer"), title: String(job.jobTitle || "Open role"), location: String(job.jobGeo || "Remote"), url: String(job.url || ""), source: "Jobicy", repository: "https://jobicy.com/", searchText: `${job.jobTitle || ""} ${job.companyName || ""} ${job.jobGeo || ""} ${job.jobDescription || ""}` }, query))),
    ...((muse?.results || []).map((job: Record<string, unknown>) => {
      const company = job.company && typeof job.company === "object" ? String((job.company as Record<string, unknown>).name || "Employer") : "Employer";
      const locations = Array.isArray(job.locations) ? job.locations.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).name || "") : "").filter(Boolean).join(", ") : "Check listing";
      const refs = job.refs && typeof job.refs === "object" ? job.refs as Record<string, unknown> : {};
      return externalMatch({ company, title: String(job.name || "Open role"), location: locations, url: String(refs.landing_page || ""), source: "The Muse", repository: "https://www.themuse.com/search/", searchText: `${job.name || ""} ${company} ${locations} ${job.contents || ""}` }, query);
    })),
    ...((hackerNews?.hits || []).map((hit: Record<string, unknown>) => {
      const text = String(hit.comment_text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return externalMatch({ company: String(hit.author || "Hacker News"), title: text.slice(0, 120) || String(hit.story_title || "Who is hiring opportunity"), location: /remote/i.test(text) ? "Remote mentioned" : "Check post", url: firstExternalHref(String(hit.comment_text || "")) || `https://news.ycombinator.com/item?id=${encodeURIComponent(String(hit.objectID || ""))}`, source: "Hacker News", repository: "https://hn.algolia.com/api", searchText: text }, query);
    })),
  ].filter((item): item is ExternalJob => Boolean(item?.url));
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const query = asString(body.query, "query", 300);
    if (query.length < 3) throw new ApiError(400, "Add at least one role, field, or skill to scan for.");
    const db = await getDb();
    const verified = await db.select({ category: claims.category, statement: claims.statement }).from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")));
    const ignored = new Set(["with", "from", "that", "this", "have", "experience", "project", "skills", "education"]);
    const profileTerms = [...new Set(verified.flatMap((claim) => `${claim.category} ${claim.statement}`.toLowerCase().split(/[^a-z0-9+#.]+/)).filter((term) => term.length > 3 && !ignored.has(term)))].slice(0, 100);
    const profileContext = verified.slice(0, 35).map((claim) => `${claim.category}: ${claim.statement}`).join("\n");
    const results = await Promise.allSettled([...sources.map((source) => scanSource(source, query)), scanJsonBoards(query), scanLiveWebOpportunities(query, profileContext)]);
    const items = results
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
      .map((item) => {
        const searchable = `${item.company} ${item.title} ${item.location}`.toLowerCase();
        const matchedProfileTerms = profileTerms.filter((term) => searchable.includes(term)).slice(0, 6);
        const sourceReasons = Array.isArray(item.matchReasons) ? item.matchReasons : [];
        return { ...item, fitScore: Math.min(99, Math.max(1, 38 + Number(item.relevanceScore || 0) + matchedProfileTerms.length * 3)), matchReasons: [...sourceReasons, ...matchedProfileTerms.slice(0, 3).map((term) => `Profile match: ${term}`)].slice(0, 6) };
      })
      .sort((left, right) => right.fitScore - left.fitScore || right.matchCount - left.matchCount)
      .slice(0, 30);
    return NextResponse.json({
      items,
      sources: [...sources.map((source) => ({ name: source.name, repository: `https://github.com/${source.repo}` })), { name: "Remotive", repository: "https://remotive.com/remote-jobs" }, { name: "Arbeitnow", repository: "https://www.arbeitnow.com/" }, { name: "Remote OK", repository: "https://remoteok.com/" }, { name: "Jobicy", repository: "https://jobicy.com/" }, { name: "The Muse", repository: "https://www.themuse.com/search/" }, { name: "Hacker News", repository: "https://hn.algolia.com/api" }, ...(process.env.OPENAI_API_KEY ? [{ name: "Live official-web search", repository: "https://developers.openai.com/api/docs/guides/tools-web-search" }] : [])],
      checkedAt: new Date().toISOString(),
      note: "Public board scan only. Confirm eligibility, freshness, and deadlines on the employer or program website.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
