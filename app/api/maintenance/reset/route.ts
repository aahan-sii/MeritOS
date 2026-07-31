import { timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { del, list } from "@vercel/blob";
import { getDb } from "@/db";
import { applications, auditEvents, claims, documents, extensionTokens, opportunities, profiles } from "@/db/schema";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.MERITOS_RESET_SECRET;
  const provided = request.headers.get("x-meritos-reset") ?? "";
  if (!secret || secret.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
}

async function emptyBlobStore() {
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const result = await list({ cursor });
    if (result.blobs.length) {
      await del(result.blobs.map((blob) => blob.url));
      deleted += result.blobs.length;
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  return deleted;
}

async function deleteClerkUsers() {
  if (process.env.MERITOS_RESET_CLERK !== "true") return 0;
  const clerk = await clerkClient();
  let deleted = 0;
  while (true) {
    const users = await clerk.users.getUserList({ limit: 100, offset: 0 });
    if (!users.data.length) break;
    await Promise.all(users.data.map((user) => clerk.users.deleteUser(user.id)));
    deleted += users.data.length;
  }
  return deleted;
}

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Not found", { status: 404 });
  try {
    const [blobFiles, clerkUsers] = await Promise.all([emptyBlobStore(), deleteClerkUsers()]);
    const db = await getDb();
    const tables = [
      ["auditEvents", auditEvents],
      ["applications", applications],
      ["opportunities", opportunities],
      ["claims", claims],
      ["documents", documents],
      ["extensionTokens", extensionTokens],
      ["profiles", profiles],
    ] as const;
    const deletedRows: Record<string, number> = {};
    for (const [name, table] of tables) {
      const result = await db.delete(table).returning();
      deletedRows[name] = result.length;
    }
    return Response.json({ ok: true, blobFiles, clerkUsers, deletedRows });
  } catch (error) {
    console.error("MeritOS reset failed", error);
    return Response.json({ error: "Reset did not finish. Check the deployment logs before retrying." }, { status: 500 });
  }
}
