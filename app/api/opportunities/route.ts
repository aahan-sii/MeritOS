import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { opportunities } from "@/db/schema";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

const aiPolicies = new Set(["permitted", "restricted", "prohibited", "unknown"]);

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const rows = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.userEmail, user.email))
      .orderBy(desc(opportunities.deadline));
    return NextResponse.json({ opportunities: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const aiPolicy = body.aiPolicy ?? "unknown";
    if (typeof aiPolicy !== "string" || !aiPolicies.has(aiPolicy)) {
      throw new ApiError(400, "aiPolicy is invalid.");
    }
    const deadline = body.deadline ? new Date(asString(body.deadline, "deadline", 64)) : null;
    if (deadline && Number.isNaN(deadline.getTime())) throw new ApiError(400, "deadline is invalid.");

    const now = new Date();
    const opportunity = {
      id: id("opp"),
      userEmail: user.email,
      title: asString(body.title, "title", 250),
      organization: asString(body.organization, "organization", 250),
      url: asString(body.url, "url", 2000),
      deadline,
      eligibility: JSON.stringify(
        body.eligibility && typeof body.eligibility === "object" && !Array.isArray(body.eligibility)
          ? body.eligibility
          : {},
      ),
      aiPolicy: aiPolicy as "permitted" | "restricted" | "prohibited" | "unknown",
      sourceText: typeof body.sourceText === "string" ? body.sourceText.slice(0, 50000) : "",
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    await db.insert(opportunities).values(opportunity);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "opportunity",
      entityId: opportunity.id,
      action: "created",
      detail: { aiPolicy: opportunity.aiPolicy },
    });
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
