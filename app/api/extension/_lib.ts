import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { extensionTokens } from "@/db/schema";

export const extensionCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export async function requireExtensionConnection(request: Request) {
  const raw = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw?.startsWith("merit_")) {
    return null;
  }
  const db = await getDb();
  const hash = createHash("sha256").update(raw).digest("hex");
  const [connection] = await db
    .select()
    .from(extensionTokens)
    .where(and(eq(extensionTokens.tokenHash, hash), isNull(extensionTokens.revokedAt)))
    .limit(1);
  if (!connection) return null;
  await db
    .update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, connection.id));
  return { db, connection };
}
