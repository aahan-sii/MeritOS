import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { claims, opportunities, profiles } from "@/db/schema";
import { buildHumanProfile } from "@/lib/human-profile";
import { extensionCorsHeaders, requireExtensionConnection } from "../_lib";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders });
}

export async function GET(request: NextRequest) {
  const connection = await requireExtensionConnection(request);
  if (!connection) {
    return NextResponse.json({ error: "This connection key is invalid or revoked." }, { status: 401, headers: extensionCorsHeaders });
  }
  const rows = await connection.db
    .select({
      id: claims.id,
      category: claims.category,
      statement: claims.statement,
      evidence: claims.evidence,
      sensitivity: claims.sensitivity,
      status: claims.status,
      confidence: claims.confidence,
    })
    .from(claims)
    .where(and(
      eq(claims.userEmail, connection.connection.userEmail),
      or(
        eq(claims.status, "verified"),
        and(
          eq(claims.status, "draft"),
          gte(claims.confidence, 95),
          inArray(claims.category, ["Identity", "Contact details", "Links & profiles"]),
        ),
      ),
    ))
    .orderBy(desc(claims.updatedAt));
  const [accountProfile] = await connection.db
    .select({
      displayName: profiles.displayName,
      email: profiles.email,
      headline: profiles.headline,
    })
    .from(profiles)
    .where(eq(profiles.email, connection.connection.userEmail))
    .limit(1);
  const [activeOpportunity] = await connection.db
    .select({ id: opportunities.id, title: opportunities.title, organization: opportunities.organization, url: opportunities.url, deadline: opportunities.deadline })
    .from(opportunities)
    .where(eq(opportunities.userEmail, connection.connection.userEmail))
    .orderBy(desc(opportunities.updatedAt))
    .limit(1);
  const coverageAreas = [
    ["Contact details", /contact|phone|mobile|telephone|email/i],
    ["Links & profiles", /linkedin|github|portfolio|website|https?:\/\//i],
    ["Education", /education|academic|school|coursework|degree|gpa/i],
    ["Experience", /experience|employment|intern|work|research/i],
    ["Projects & impact", /project|impact|portfolio|built|developed/i],
    ["Leadership", /leadership|led|founded|president|captain|mentor/i],
    ["Awards", /award|distinction|honou?r|recognition|achievement/i],
    ["Community", /community|service|volunteer|outreach/i],
    ["Motivation & goals", /motivation|goal|interest|why|aspiration/i],
  ] as const;
  const coverage = coverageAreas.map(([name, pattern]) => ({ name, ready: rows.some((row) => pattern.test(`${row.category} ${row.statement}`)) }));
  return NextResponse.json(
    {
      profile: {
        identity: {
          displayName: accountProfile?.displayName ?? "",
          email: accountProfile?.email ?? connection.connection.userEmail,
          headline: accountProfile?.headline ?? "",
        },
        claims: rows.map((row) => ({
          ...row,
          evidence: JSON.parse(row.evidence),
        })),
        coverage,
        activeOpportunity: activeOpportunity || null,
        humanProfile: buildHumanProfile(rows),
      },
    },
    { headers: extensionCorsHeaders },
  );
}
