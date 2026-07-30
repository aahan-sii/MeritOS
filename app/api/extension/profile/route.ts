import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { claims, profiles } from "@/db/schema";
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
    })
    .from(claims)
    .where(and(eq(claims.userEmail, connection.connection.userEmail), eq(claims.status, "verified")))
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
      },
    },
    { headers: extensionCorsHeaders },
  );
}
