import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { createGroundedDraftBatch } from "@/lib/ai-drafting";
import { futurePhysiciansEvidence, futurePhysiciansKnowledge } from "@/lib/future-physicians";
import { ApiError, asRecord, asString, jsonError, requireApiUser } from "../../_lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!process.env.OPENAI_API_KEY) throw new ApiError(503, "The grant assistant is not configured yet.");
    const body = asRecord(await request.json(), "body");
    const question = asString(body.question, "question", 1_200);
    const context = typeof body.context === "string" ? body.context.slice(0, 4_000) : "";
    const db = await getDb();
    const memberEvidence = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")))
      .orderBy(desc(claims.updatedAt))
      .limit(80);

    const [result] = await createGroundedDraftBatch({
      fields: [{ id: "grant_assistant", label: question, description: context, control: "textarea", maxLength: 3_000 }],
      page: { title: "FuturePhysicians grant and award assistant", opportunityContext: context },
      evidence: memberEvidence,
      organizationEvidence: futurePhysiciansEvidence,
      organizationName: futurePhysiciansKnowledge.organizationName,
      proactive: true,
    });

    if (!result || result.status !== "draft") {
      return NextResponse.json({ answer: "", questions: result?.questions || ["What detail should MeritOS use for this answer?"], usedSources: [] });
    }
    return NextResponse.json({
      answer: result.draft,
      alternatives: result.alternatives,
      questions: [],
      assumptions: result.assumptions,
      usedSources: result.usedEvidenceIds,
    });
  } catch (error) {
    return jsonError(error);
  }
}
