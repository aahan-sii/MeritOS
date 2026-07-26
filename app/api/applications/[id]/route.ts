import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applications } from "@/db/schema";
import { recordAuditEvent } from "../../_lib/audit";
import { ApiError, asRecord, asString, jsonError, requireApiUser } from "../../_lib/request";

const statuses = new Set(["planning", "drafting", "review", "submitted", "withdrawn"]);
const readinessBands = new Set(["not_ready", "developing", "plausible", "competitive", "standout"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = asRecord(await request.json(), "body");
    const changes: Record<string, unknown> = { updatedAt: new Date() };

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !statuses.has(body.status)) {
        throw new ApiError(400, "status is invalid.");
      }
      changes.status = body.status;
    }
    if (body.readinessBand !== undefined) {
      if (typeof body.readinessBand !== "string" || !readinessBands.has(body.readinessBand)) {
        throw new ApiError(400, "readinessBand is invalid.");
      }
      changes.readinessBand = body.readinessBand;
    }

    const isFreezingSubmission = body.status === "submitted";
    if (isFreezingSubmission) {
      if (!body.submissionSnapshot || typeof body.submissionSnapshot !== "object" || Array.isArray(body.submissionSnapshot)) {
        throw new ApiError(400, "submissionSnapshot is required before marking an application submitted.");
      }
      changes.submissionSnapshot = JSON.stringify(body.submissionSnapshot);
      changes.confirmationNumber = asString(body.confirmationNumber, "confirmationNumber", 300);
      changes.submittedAt = new Date();
    } else if (body.submissionSnapshot !== undefined || body.confirmationNumber !== undefined) {
      throw new ApiError(400, "Submission details can only be recorded while marking an application submitted.");
    }

    if (Object.keys(changes).length === 1) throw new ApiError(400, "Provide at least one change.");
    const db = await getDb();
    const result = await db
      .update(applications)
      .set(changes)
      .where(and(eq(applications.id, id), eq(applications.userEmail, user.email)))
      .returning();
    const application = result[0];
    if (!application) throw new ApiError(404, "Application not found.");

    await recordAuditEvent({
      userEmail: user.email,
      entityType: "application",
      entityId: id,
      action: isFreezingSubmission ? "submission_frozen" : "updated",
      detail: isFreezingSubmission
        ? { confirmationNumber: application.confirmationNumber }
        : { fields: Object.keys(body) },
    });
    return NextResponse.json({ application });
  } catch (error) {
    return jsonError(error);
  }
}
