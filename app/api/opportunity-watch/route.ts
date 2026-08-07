import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { parseOpportunityRows } from "@/lib/opportunity-watch-core";
import { ApiError, asRecord, asString, jsonError, requireApiUser } from "../_lib/request";

export const runtime = "nodejs";

const sources = [
  { name: "Simplify internships", repo: "SimplifyJobs/Summer2026-Internships", raw: "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md" },
  { name: "Summer 2027 internships", repo: "sndsh404/summer-2027-internships", raw: "https://raw.githubusercontent.com/sndsh404/summer-2027-internships/main/README.md" },
  { name: "Automated 2027 internship engine", repo: "zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships", raw: "https://raw.githubusercontent.com/zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships/main/README.md" },
];

async function scanSource(source: (typeof sources)[number], query: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(source.raw, { signal: controller.signal, headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).finally(() => clearTimeout(timer));
  if (!response.ok) throw new Error(`${source.name} was unavailable.`);
  const markdown = (await response.text()).slice(0, 1_000_000);
  return parseOpportunityRows(markdown, query, source);
}

type ExternalJob = { company: string; title: string; location: string; url: string; source: string; repository: string; matchCount: number };

function queryTerms(query: string) {
  const ignored = new Set(["intern", "internship", "internships", "job", "jobs", "role", "roles", "summer", "program", "programs", "remote"]);
  return query.toLowerCase().split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2 && !ignored.has(term)).slice(0, 15);
}

function externalMatch(item: Omit<ExternalJob, "matchCount">, query: string): ExternalJob | null {
  const terms = queryTerms(query);
  const text = `${item.company} ${item.title} ${item.location}`.toLowerCase();
  const matchCount = terms.filter((term) => text.includes(term)).length;
  return terms.length && !matchCount ? null : { ...item, matchCount };
}

async function scanJsonBoards(query: string) {
  const requests = await Promise.allSettled([
    fetch("https://remotive.com/api/remote-jobs?limit=100", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
    fetch("https://remoteok.com/api", { headers: { "User-Agent": "MeritOS-Opportunity-Watch/1.0" }, next: { revalidate: 900 } }).then((response) => response.json()),
  ]);
  const [remotive, arbeitnow, remoteok] = requests.map((result) => result.status === "fulfilled" ? result.value : null);
  return [
    ...((remotive?.jobs || []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.company_name || "Employer"), title: String(job.title || "Open role"), location: String(job.candidate_required_location || "Remote"), url: String(job.url || ""), source: "Remotive", repository: "https://remotive.com/remote-jobs" }, query))),
    ...((arbeitnow?.data || []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.company_name || "Employer"), title: String(job.title || "Open role"), location: String(job.location || (job.remote ? "Remote" : "Check listing")), url: String(job.url || ""), source: "Arbeitnow", repository: "https://www.arbeitnow.com/" }, query))),
    ...((Array.isArray(remoteok) ? remoteok.slice(1) : []).map((job: Record<string, unknown>) => externalMatch({ company: String(job.company || "Employer"), title: String(job.position || "Open role"), location: String(job.location || "Remote"), url: String(job.url || job.apply_url || ""), source: "Remote OK", repository: "https://remoteok.com/" }, query))),
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
    const results = await Promise.allSettled([...sources.map((source) => scanSource(source, query)), scanJsonBoards(query)]);
    const items = results
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
      .map((item) => {
        const searchable = `${item.company} ${item.title} ${item.location}`.toLowerCase();
        const matchedProfileTerms = profileTerms.filter((term) => searchable.includes(term)).slice(0, 6);
        return { ...item, fitScore: Math.min(99, 42 + item.matchCount * 11 + matchedProfileTerms.length * 5), matchReasons: matchedProfileTerms.length ? matchedProfileTerms : ["Matches your stated target"] };
      })
      .sort((left, right) => right.fitScore - left.fitScore || right.matchCount - left.matchCount)
      .slice(0, 30);
    return NextResponse.json({
      items,
      sources: [...sources.map((source) => ({ name: source.name, repository: `https://github.com/${source.repo}` })), { name: "Remotive", repository: "https://remotive.com/remote-jobs" }, { name: "Arbeitnow", repository: "https://www.arbeitnow.com/" }, { name: "Remote OK", repository: "https://remoteok.com/" }],
      checkedAt: new Date().toISOString(),
      note: "Public board scan only. Confirm eligibility, freshness, and deadlines on the employer or program website.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
