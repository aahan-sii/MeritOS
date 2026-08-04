import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { claims } from "@/db/schema";
import { parseOpportunityRows } from "@/lib/opportunity-watch-core";
import { extensionCorsHeaders, requireExtensionConnection } from "../_lib";

export const runtime = "nodejs";
const sources = [
  { name: "Summer 2027 internships", repo: "sndsh404/summer-2027-internships", raw: "https://raw.githubusercontent.com/sndsh404/summer-2027-internships/main/README.md" },
  { name: "2027 internship engine", repo: "zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships", raw: "https://raw.githubusercontent.com/zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships/main/README.md" },
  { name: "2027 internships", repo: "zapplyjobs/Internships-2027", raw: "https://raw.githubusercontent.com/zapplyjobs/Internships-2027/main/README.md" },
  { name: "2027 SWE roles", repo: "speedyapply/2027-SWE-College-Jobs", raw: "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/main/README.md" },
];
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: extensionCorsHeaders }); }
function terms(value: string) {
  const ignored = new Set(["with", "that", "this", "from", "into", "summer", "internship", "internships", "program", "programs", "looking", "find"]);
  return [...new Set(value.toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2 && !ignored.has(word)))];
}
async function scan(source: (typeof sources)[number], query: string) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000);
  const response = await fetch(source.raw, { signal: controller.signal, headers: { "User-Agent": "MeritOS-Opportunity-Discovery/1.0" }, next: { revalidate: 900 } }).finally(() => clearTimeout(timer));
  if (!response.ok) return [];
  return parseOpportunityRows((await response.text()).slice(0, 1_250_000), query, source);
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
    const settled = await Promise.allSettled(sources.map((source) => scan(source, query)));
    const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .filter((item, index, all) => all.findIndex((other) => other.url === item.url) === index)
      .map((item) => { const text = `${item.company} ${item.title} ${item.location}`.toLowerCase(); const matches = profileTerms.filter((term) => text.includes(term)).slice(0, 5); return { ...item, fitScore: Math.min(99, 45 + item.matchCount * 12 + matches.length * 4), matchReasons: matches.length ? matches : ["Matches your search goal"] }; })
      .sort((a, b) => b.fitScore - a.fitScore || b.matchCount - a.matchCount).slice(0, 24);
    return NextResponse.json({ items, checkedAt: new Date().toISOString(), note: "Live public listings. MeritOS prepares selected applications but never submits them." }, { headers: extensionCorsHeaders });
  } catch { return NextResponse.json({ error: "Opportunity search is temporarily unavailable. Try a more specific goal." }, { status: 502, headers: extensionCorsHeaders }); }
}
