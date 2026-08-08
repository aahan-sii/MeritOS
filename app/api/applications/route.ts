import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applications, opportunities } from "@/db/schema";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";
import type { OpportunityPreflight } from "@/lib/opportunity-intelligence";

const statuses = new Set(["planning", "drafting", "review", "submitted", "withdrawn"]);

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const rows = await db
      .select({
        application: applications,
        opportunity: {
          id: opportunities.id,
          title: opportunities.title,
          organization: opportunities.organization,
          url: opportunities.url,
          deadline: opportunities.deadline,
          eligibility: opportunities.eligibility,
        },
      })
      .from(applications)
      .innerJoin(opportunities, eq(applications.opportunityId, opportunities.id))
      .where(eq(applications.userEmail, user.email))
      .orderBy(desc(applications.updatedAt));
    const enriched = rows.map((row) => {
      let preflight: OpportunityPreflight | null = null;
      try {
        const parsed = JSON.parse(row.opportunity.eligibility || "{}") as { preflight?: OpportunityPreflight };
        preflight = parsed.preflight || null;
      } catch {}
      const requirements = preflight?.requirements || [];
      const supported = requirements.filter((item) => item.status === "supported").length;
      const missing = requirements.filter((item) => item.status !== "supported").length
        + (preflight?.missingInformationQuestions.length || 0);
      const readiness = requirements.length ? Math.round((supported / requirements.length) * 100) : 0;
      const opportunity = {
        id: row.opportunity.id,
        title: row.opportunity.title,
        organization: row.opportunity.organization,
        url: row.opportunity.url,
        deadline: row.opportunity.deadline,
      };
      return {
        application: row.application,
        opportunity,
        preparation: {
          readiness,
          supported,
          requirementCount: requirements.length,
          missing,
          missingItems: [
            ...(preflight?.requirements.filter((item) => item.status !== "supported").map((item) => item.action || item.requirement) || []),
            ...(preflight?.missingInformationQuestions || []),
          ].filter(Boolean).slice(0, 8),
          requiredDocuments: preflight?.requiredDocuments || [],
          visibleQuestions: preflight?.applicationQuestions.length || 0,
          aiPolicy: preflight?.aiPolicy.status || "unknown",
        },
      };
    });
    return NextResponse.json({ applications: enriched });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const opportunityId = asString(body.opportunityId, "opportunityId", 100);
    const db = await getDb();
    const opportunity = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(eq(opportunities.id, opportunityId), eq(opportunities.userEmail, user.email)));
    if (!opportunity[0]) throw new ApiError(404, "Opportunity not found.");

    const status = body.status ?? "planning";
    if (typeof status !== "string" || !statuses.has(status)) throw new ApiError(400, "status is invalid.");
    const now = new Date();
    const application = {
      id: id("app"),
      userEmail: user.email,
      opportunityId,
      status: status as "planning" | "drafting" | "review" | "submitted" | "withdrawn",
      readinessBand: null,
      submissionSnapshot: null,
      confirmationNumber: null,
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(applications).values(application);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "application",
      entityId: application.id,
      action: "created",
      detail: { opportunityId },
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
