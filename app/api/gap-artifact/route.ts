import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { createGapArtifact } from "@/lib/profile-intelligence";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!process.env.OPENAI_API_KEY) throw new ApiError(503, "AI Artifact Studio is not configured yet.");
    const body = asRecord(await request.json(), "body");
    const gap = asRecord(body.gap, "gap");
    const input = {
      target: asString(body.target, "target", 600),
      gap: {
        area: asString(gap.area, "gap.area", 180),
        whyItMatters: asString(gap.whyItMatters, "gap.whyItMatters", 700),
        action: asString(gap.action, "gap.action", 700),
      },
    };
    const db = await getDb();
    const verified = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")));
    if (!verified.length) throw new ApiError(400, "Verify at least one profile fact first.");
    const artifact = await createGapArtifact({ ...input, claims: verified });
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "gap_artifact",
      entityId: id("artifact"),
      action: "generated",
      detail: { target: input.target, area: input.gap.area, artifactType: artifact.artifactType },
    });
    return NextResponse.json({ artifact });
  } catch (error) {
    return jsonError(error);
  }
}
