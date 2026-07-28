import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { asRecord, jsonError, requireApiUser } from "../_lib/request";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.clerkUserId, user.id))
      .limit(1);
    if (existing) return NextResponse.json({ profile: existing });

    const now = new Date();
    const profile = {
      clerkUserId: user.id,
      email: user.email,
      displayName: user.displayName,
      headline: "",
      onboardingComplete: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(profiles).values(profile);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const update = {
      displayName:
        typeof body.displayName === "string"
          ? body.displayName.trim().slice(0, 120)
          : user.displayName,
      headline:
        typeof body.headline === "string" ? body.headline.trim().slice(0, 240) : "",
      onboardingComplete: body.onboardingComplete === true,
      updatedAt: new Date(),
    };
    const db = await getDb();
    await db
      .insert(profiles)
      .values({
        clerkUserId: user.id,
        email: user.email,
        ...update,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.clerkUserId,
        set: { email: user.email, ...update },
      });
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.clerkUserId, user.id))
      .limit(1);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
