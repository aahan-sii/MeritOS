import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const query = asString(body.query, "query", 300);
    if (query.length < 3) throw new ApiError(400, "Add at least one role, field, or skill to scan for.");
    const results = await Promise.allSettled(sources.map((source) => scanSource(source, query)));
    const items = results
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .sort((left, right) => right.matchCount - left.matchCount)
      .filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index)
      .slice(0, 30);
    return NextResponse.json({
      items,
      sources: sources.map((source) => ({ name: source.name, repository: `https://github.com/${source.repo}` })),
      checkedAt: new Date().toISOString(),
      note: "Public board scan only. Confirm eligibility, freshness, and deadlines on the employer or program website.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
