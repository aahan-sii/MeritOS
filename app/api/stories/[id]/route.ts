import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { stories } from "@/db/schema";
import { recordAuditEvent } from "../../_lib/audit";
import { ApiError, asRecord, jsonError, requireApiUser } from "../../_lib/request";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = asRecord(await request.json(), "body");
    const update: Partial<typeof stories.$inferInsert> = { updatedAt: new Date() };
    for (const field of ["title", "lens", "situation", "action", "result", "reflection"] as const) {
      if (typeof body[field] === "string") update[field] = body[field].trim().slice(0, 6000);
    }
    if (body.status === "draft" || body.status === "approved") update.status = body.status;
    const db = await getDb();
    const [existing] = await db
      .select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.id, id), eq(stories.userEmail, user.email)))
      .limit(1);
    if (!existing) throw new ApiError(404, "Story not found.");
    await db.update(stories).set(update).where(eq(stories.id, id));
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "story",
      entityId: id,
      action: "updated",
      detail: { status: update.status },
    });
    const [story] = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
    return NextResponse.json({
      story: { ...story, sourceClaimIds: JSON.parse(story.sourceClaimIds) },
    });
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
    const deleted = await db
      .delete(stories)
      .where(and(eq(stories.id, id), eq(stories.userEmail, user.email)))
      .returning({ id: stories.id });
    if (!deleted.length) throw new ApiError(404, "Story not found.");
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
