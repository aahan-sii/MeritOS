import { auditEvents } from "@/db/schema";
import { getDb } from "@/db";
import { id } from "./request";

export async function recordAuditEvent(input: {
  userEmail: string;
  entityType: string;
  entityId: string;
  action: string;
  detail?: Record<string, unknown>;
}) {
  const db = await getDb();
  await db.insert(auditEvents).values({
    id: id("audit"),
    userEmail: input.userEmail,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    detail: JSON.stringify(input.detail ?? {}),
    createdAt: new Date(),
  });
}
