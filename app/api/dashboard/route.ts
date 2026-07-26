import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { applications, auditEvents, claims, opportunities } from "@/db/schema";
import { jsonError, requireApiUser } from "../_lib/request";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const [claimRows, opportunityRows, applicationRows, activity] = await Promise.all([
      db.select({ id: claims.id, status: claims.status }).from(claims).where(eq(claims.userEmail, user.email)),
      db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.userEmail, user.email)),
      db.select({ id: applications.id, status: applications.status }).from(applications).where(eq(applications.userEmail, user.email)),
      db.select().from(auditEvents).where(eq(auditEvents.userEmail, user.email)).orderBy(desc(auditEvents.createdAt)).limit(12),
    ]);
    return NextResponse.json({
      summary: {
        claims: claimRows.length,
        verifiedClaims: claimRows.filter((claim) => claim.status === "verified").length,
        opportunities: opportunityRows.length,
        activeApplications: applicationRows.filter((application) => application.status !== "submitted" && application.status !== "withdrawn").length,
      },
      activity,
    });
  } catch (error) {
    return jsonError(error);
  }
}
