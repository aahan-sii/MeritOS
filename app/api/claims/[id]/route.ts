import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { recordAuditEvent } from "../../_lib/audit";
import { ApiError, asRecord, asString, jsonError, requireApiUser } from "../../_lib/request";

const updatableFields = new Set([
  "category",
  "statement",
  "status",
  "evidence",
  "sensitivity",
  "allowedUses",
  "confidence",
]);
const statuses = new Set(["verified", "draft", "inference", "restricted", "missing"]);
const MAX_MANUAL_CONTRIBUTION_LENGTH = 20_000;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = asRecord(await request.json(), "body");
    const changes: Record<string, unknown> = { updatedAt: new Date() };

    for (const [key, value] of Object.entries(body)) {
      if (!updatableFields.has(key)) throw new ApiError(400, `${key} cannot be updated.`);
      if (key === "category") changes.category = asString(value, "category", 100);
      if (key === "statement") changes.statement = asString(value, "statement", MAX_MANUAL_CONTRIBUTION_LENGTH);
      if (key === "status") {
        if (typeof value !== "string" || !statuses.has(value)) throw new ApiError(400, "status is invalid.");
        changes.status = value;
      }
      if (key === "evidence" || key === "allowedUses") {
        if (!Array.isArray(value)) throw new ApiError(400, `${key} must be an array.`);
        changes[key === "allowedUses" ? "allowedUses" : "evidence"] = JSON.stringify(value);
      }
      if (key === "sensitivity") {
        if (value !== "standard" && value !== "sensitive") throw new ApiError(400, "sensitivity is invalid.");
        changes.sensitivity = value;
      }
      if (key === "confidence") {
        if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
          throw new ApiError(400, "confidence must be an integer between 0 and 100.");
        }
        changes.confidence = value;
      }
    }
    if (Object.keys(changes).length === 1) throw new ApiError(400, "Provide at least one change.");

    const db = await getDb();
    const result = await db
      .update(claims)
      .set(changes)
      .where(and(eq(claims.id, id), eq(claims.userEmail, user.email)))
      .returning();
    const claim = result[0];
    if (!claim) throw new ApiError(404, "Claim not found.");
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "claim",
      entityId: id,
      action: "updated",
      detail: { fields: Object.keys(body) },
    });
    return NextResponse.json({ claim });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const db = await getDb();
    const result = await db
      .delete(claims)
      .where(and(eq(claims.id, id), eq(claims.userEmail, user.email)))
      .returning({ id: claims.id });
    if (!result[0]) throw new ApiError(404, "Claim not found.");
    await recordAuditEvent({ userEmail: user.email, entityType: "claim", entityId: id, action: "deleted" });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
