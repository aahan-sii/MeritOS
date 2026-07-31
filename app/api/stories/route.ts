import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, stories } from "@/db/schema";
import { cleanProfileText, createStory } from "@/lib/profile-intelligence";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const rows = await db
      .select()
      .from(stories)
      .where(eq(stories.userEmail, user.email))
      .orderBy(desc(stories.updatedAt));
    return NextResponse.json({
      stories: rows.map((row) => ({
        ...row,
        title: cleanProfileText(row.title, 180),
        situation: cleanProfileText(row.situation),
        action: cleanProfileText(row.action),
        result: cleanProfileText(row.result),
        reflection: cleanProfileText(row.reflection),
        sourceClaimIds: JSON.parse(row.sourceClaimIds),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(503, "AI Story Studio is not configured yet.");
    }
    const body = asRecord(await request.json(), "body");
    const target =
      typeof body.target === "string" && body.target.trim()
        ? body.target.trim().slice(0, 600)
        : "General future applications";
    const lens = asString(body.lens, "lens", 100);
    const focus =
      typeof body.focus === "string" && body.focus.trim()
        ? body.focus.trim().slice(0, 120)
        : "Best-supported experience";
    const depth =
      typeof body.depth === "string" && body.depth.trim()
        ? body.depth.trim().slice(0, 40)
        : "Standard";
    const db = await getDb();
    const verified = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")));
    if (!verified.length) throw new ApiError(400, "Verify profile facts before creating a story.");

    const generated = await createStory({ target, lens, focus, depth, claims: verified });
    const now = new Date();
    const storyId = id("story");
    const story = {
      id: storyId,
      userEmail: user.email,
      title: generated.title,
      lens: generated.lens,
      situation: generated.situation,
      action: generated.action,
      result: generated.result,
      reflection: generated.reflection,
      sourceClaimIds: JSON.stringify(generated.sourceClaimIds),
      status: "draft" as const,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(stories).values(story);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "story",
      entityId: storyId,
      action: "generated",
      detail: { lens, focus, depth, sourceClaimIds: generated.sourceClaimIds },
    });
    return NextResponse.json({
      story: { ...story, sourceClaimIds: generated.sourceClaimIds },
      missingQuestions: generated.missingQuestions,
    });
  } catch (error) {
    return jsonError(error);
  }
}
