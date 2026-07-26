import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applications, opportunities } from "@/db/schema";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

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
          deadline: opportunities.deadline,
        },
      })
      .from(applications)
      .innerJoin(opportunities, eq(applications.opportunityId, opportunities.id))
      .where(eq(applications.userEmail, user.email))
      .orderBy(desc(applications.updatedAt));
    return NextResponse.json({ applications: rows });
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
