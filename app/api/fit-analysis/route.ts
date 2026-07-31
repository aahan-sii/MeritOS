import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, fitAnalyses } from "@/db/schema";
import { createFitAnalysis } from "@/lib/profile-intelligence";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const [row] = await db
      .select()
      .from(fitAnalyses)
      .where(eq(fitAnalyses.userEmail, user.email))
      .orderBy(desc(fitAnalyses.updatedAt))
      .limit(1);
    return NextResponse.json({
      analysis: row ? { ...JSON.parse(row.analysis), id: row.id, createdAt: row.createdAt } : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(503, "AI profile analysis is not configured yet.");
    }
    const body = asRecord(await request.json(), "body");
    const target = asString(body.target, "target", 600);
    const profileCoverage =
      typeof body.profileCoverage === "number"
        ? Math.max(0, Math.min(100, Math.round(body.profileCoverage)))
        : 0;
    const db = await getDb();
    const verified = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")));
    if (!verified.length) throw new ApiError(400, "Verify at least one profile fact first.");

    const analysis = await createFitAnalysis({ target, claims: verified, profileCoverage });
    const now = new Date();
    const analysisId = id("fit");
    await db.insert(fitAnalyses).values({
      id: analysisId,
      userEmail: user.email,
      target,
      score: analysis.score,
      readinessBand: analysis.readinessBand,
      analysis: JSON.stringify(analysis),
      createdAt: now,
      updatedAt: now,
    });
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "fit_analysis",
      entityId: analysisId,
      action: "generated",
      detail: { target, score: analysis.score, verifiedClaims: verified.length },
    });
    return NextResponse.json({ analysis: { ...analysis, id: analysisId, createdAt: now } });
  } catch (error) {
    return jsonError(error);
  }
}
