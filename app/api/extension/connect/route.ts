import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { extensionTokens } from "@/db/schema";
import { id, jsonError, requireApiUser } from "../../_lib/request";

export async function POST() {
  try {
    const user = await requireApiUser();
    const token = `merit_${randomBytes(24).toString("base64url")}`;
    const db = await getDb();
    await db
      .update(extensionTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(extensionTokens.userEmail, user.email),
          isNull(extensionTokens.revokedAt),
        ),
      );
    await db.insert(extensionTokens).values({
      id: id("ext"),
      userEmail: user.email,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      label: "Chrome extension",
      createdAt: new Date(),
    });
    return NextResponse.json({ token });
  } catch (error) {
    return jsonError(error);
  }
}
