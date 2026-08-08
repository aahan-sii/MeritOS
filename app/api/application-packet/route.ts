import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applications, claims, opportunities } from "@/db/schema";
import { createGroundedDraftBatch, type DraftField } from "@/lib/ai-drafting";
import type { OpportunityPreflight } from "@/lib/opportunity-intelligence";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, jsonError, requireApiUser } from "../_lib/request";

export const runtime = "nodejs";

function parsePreflight(value: string): OpportunityPreflight {
  try {
    const parsed = JSON.parse(value) as { preflight?: OpportunityPreflight };
    if (parsed.preflight?.title) return parsed.preflight;
  } catch {}
  throw new ApiError(400, "Run an opportunity preflight before building its application packet.");
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const opportunityId = asString(body.opportunityId, "opportunityId", 120);
    const highInitiative = body.mode === "high_initiative";
    const proactive = body.mode === "proactive" || highInitiative;
    const db = await getDb();
    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.id, opportunityId), eq(opportunities.userEmail, user.email)))
      .limit(1);
    if (!opportunity) throw new ApiError(404, "Opportunity not found.");
    const preflight = parsePreflight(opportunity.eligibility);
    const evidence = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")))
      .orderBy(desc(claims.updatedAt))
      .limit(100);
    const fields: DraftField[] = preflight.applicationQuestions.slice(0, 20).map((question, index) => ({
      id: `packet-${index}`,
      label: question,
      kind: "textarea",
      control: "textarea",
      maxLength: 1_200,
    }));
    const results = fields.length
      ? await createGroundedDraftBatch({ fields, page: { title: `${preflight.title} — ${preflight.organization}`, url: opportunity.url }, evidence, proactive, highInitiative })
      : [];
    const answers = fields.map((field, index) => ({ question: field.label, ...results[index] }));
    const missingInputs = Array.from(new Set([
      ...preflight.missingInformationQuestions,
      ...answers.flatMap((answer) => answer.status === "needs_input" || answer.status === "not_configured" ? answer.questions : []),
    ])).slice(0, 20);
    const [application] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.userEmail, user.email), eq(applications.opportunityId, opportunityId)))
      .limit(1);
    if (application) {
      await db.update(applications).set({ status: "drafting", updatedAt: new Date() }).where(eq(applications.id, application.id));
    }
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "application",
      entityId: application?.id || opportunityId,
      action: "packet_built",
      detail: { opportunityId, questions: fields.length, supportedDrafts: answers.filter((answer) => answer.status === "draft").length },
    });
    return NextResponse.json({
      packet: {
        opportunityId,
        applicationId: application?.id || "",
        title: preflight.title,
        organization: preflight.organization,
        sourceUrl: opportunity.url,
        deadlineText: preflight.deadlineText,
        requiredDocuments: preflight.requiredDocuments,
        requirements: preflight.requirements,
        answers,
        missingInputs,
        nextActions: preflight.nextActions,
        safetyNote: "Drafts are evidence-backed working material. Review every answer and submit the official form yourself.",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
