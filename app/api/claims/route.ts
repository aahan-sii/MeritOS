import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { recordAuditEvent } from "../_lib/audit";
import {
  ApiError,
  asRecord,
  asString,
  id,
  jsonError,
  requireApiUser,
} from "../_lib/request";

const claimStatuses = new Set([
  "verified",
  "draft",
  "inference",
  "restricted",
  "missing",
]);

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const rows = await db
      .select()
      .from(claims)
      .where(eq(claims.userEmail, user.email))
      .orderBy(desc(claims.updatedAt));
    return NextResponse.json({ claims: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const status = body.status ?? "draft";
    if (typeof status !== "string" || !claimStatuses.has(status)) {
      throw new ApiError(400, "status is invalid.");
    }
    const confidence = body.confidence ?? 0;
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
      throw new ApiError(400, "confidence must be an integer between 0 and 100.");
    }

    const now = new Date();
    const claim = {
      id: id("claim"),
      userEmail: user.email,
      category: asString(body.category, "category", 100),
      statement: asString(body.statement, "statement", 4000),
      status: status as "verified" | "draft" | "inference" | "restricted" | "missing",
      evidence: JSON.stringify(Array.isArray(body.evidence) ? body.evidence : []),
      sensitivity: body.sensitivity === "sensitive" ? "sensitive" as const : "standard" as const,
      allowedUses: JSON.stringify(Array.isArray(body.allowedUses) ? body.allowedUses : []),
      confidence,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    await db.insert(claims).values(claim);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "claim",
      entityId: claim.id,
      action: "created",
      detail: { status: claim.status, category: claim.category },
    });
    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
