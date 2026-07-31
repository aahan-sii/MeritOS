import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, interviewSessions } from "@/db/schema";
import { createInterviewQuestions, evaluateInterviewAnswer } from "@/lib/profile-intelligence";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const [row] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userEmail, user.email))
      .orderBy(desc(interviewSessions.updatedAt))
      .limit(1);
    return NextResponse.json({
      session: row ? { ...row, questions: JSON.parse(row.questions) } : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(503, "AI interview practice is not configured yet.");
    }
    const body = asRecord(await request.json(), "body");
    const action = body.action === "evaluate" ? "evaluate" : "generate";
    const target = asString(body.target, "target", 600);
    const db = await getDb();
    const verified = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")));
    if (!verified.length) throw new ApiError(400, "Verify profile facts before interview practice.");

    if (action === "evaluate") {
      const question = asString(body.question, "question", 1200);
      const answer = asString(body.answer, "answer", 10000);
      const feedback = await evaluateInterviewAnswer({ target, question, answer, claims: verified });
      return NextResponse.json({ feedback });
    }

    const questions = await createInterviewQuestions({ target, claims: verified });
    const now = new Date();
    const sessionId = id("interview");
    const session = {
      id: sessionId,
      userEmail: user.email,
      target,
      questions: JSON.stringify(questions),
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(interviewSessions).values(session);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "interview_session",
      entityId: sessionId,
      action: "generated",
      detail: { target, questionCount: questions.length },
    });
    return NextResponse.json({ session: { ...session, questions } });
  } catch (error) {
    return jsonError(error);
  }
}
