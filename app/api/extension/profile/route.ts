import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, extensionTokens, profiles } from "@/db/schema";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw?.startsWith("merit_")) {
    return NextResponse.json({ error: "Connect MeritOS first." }, { status: 401, headers: corsHeaders });
  }
  const db = await getDb();
  const hash = createHash("sha256").update(raw).digest("hex");
  const [connection] = await db
    .select()
    .from(extensionTokens)
    .where(and(eq(extensionTokens.tokenHash, hash), isNull(extensionTokens.revokedAt)))
    .limit(1);
  if (!connection) {
    return NextResponse.json({ error: "This connection key is invalid or revoked." }, { status: 401, headers: corsHeaders });
  }
  await db
    .update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, connection.id));
  const rows = await db
    .select({
      id: claims.id,
      category: claims.category,
      statement: claims.statement,
      evidence: claims.evidence,
      sensitivity: claims.sensitivity,
    })
    .from(claims)
    .where(and(eq(claims.userEmail, connection.userEmail), eq(claims.status, "verified")))
    .orderBy(desc(claims.updatedAt));
  const [accountProfile] = await db
    .select({
      displayName: profiles.displayName,
      email: profiles.email,
      headline: profiles.headline,
    })
    .from(profiles)
    .where(eq(profiles.email, connection.userEmail))
    .limit(1);
  return NextResponse.json(
    {
      profile: {
        identity: {
          displayName: accountProfile?.displayName ?? "",
          email: accountProfile?.email ?? connection.userEmail,
          headline: accountProfile?.headline ?? "",
        },
        claims: rows.map((row) => ({
          ...row,
          evidence: JSON.parse(row.evidence),
        })),
      },
    },
    { headers: corsHeaders },
  );
}
