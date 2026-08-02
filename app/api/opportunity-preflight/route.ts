import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { applications, claims, opportunities } from "@/db/schema";
import { analyzeOpportunity } from "@/lib/opportunity-intelligence";
import { fetchPublicPage, publicWebLimits, safePublicUrl } from "@/lib/public-web";
import { recordAuditEvent } from "../_lib/audit";
import { ApiError, asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const requestedUrl = await safePublicUrl(asString(body.url, "url", 2_000));
    if (!process.env.OPENAI_API_KEY) throw new ApiError(503, "AI opportunity analysis is not configured. Add OPENAI_API_KEY in Vercel, then redeploy.");
    const pastedText = typeof body.pastedText === "string" ? body.pastedText.trim().slice(0, publicWebLimits.maxText) : "";
    const page = pastedText ? { url: requestedUrl, text: pastedText } : await fetchPublicPage(requestedUrl, "MeritOS-Opportunity-Preflight/1.0");
    if (page.text.length < 120) throw new ApiError(400, "Not enough official page text was available. Paste the eligibility and application instructions and try again.");
    const db = await getDb();
    const verifiedClaims = await db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, user.email), eq(claims.status, "verified")))
      .orderBy(desc(claims.updatedAt))
      .limit(100);
    const preflight = await analyzeOpportunity({ sourceUrl: page.url.toString(), sourceText: page.text, claims: verifiedClaims });
    const existing = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(eq(opportunities.userEmail, user.email), eq(opportunities.url, page.url.toString())))
      .limit(1);
    const now = new Date();
    const parsedDeadline = preflight.deadlineIso ? new Date(preflight.deadlineIso) : null;
    const deadline = parsedDeadline && !Number.isNaN(parsedDeadline.getTime()) ? parsedDeadline : null;
    let opportunityId = existing[0]?.id;
    const opportunityValues = {
      title: preflight.title || page.url.hostname,
      organization: preflight.organization || page.url.hostname,
      url: page.url.toString(),
      deadline,
      eligibility: JSON.stringify({ preflight }),
      aiPolicy: preflight.aiPolicy.status,
      sourceText: page.text.slice(0, 50_000),
      updatedAt: now,
    };
    if (opportunityId) {
      await db.update(opportunities).set(opportunityValues).where(and(eq(opportunities.id, opportunityId), eq(opportunities.userEmail, user.email)));
    } else {
      opportunityId = id("opp");
      await db.insert(opportunities).values({ ...opportunityValues, id: opportunityId, userEmail: user.email, createdAt: now });
    }
    const existingApplication = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.userEmail, user.email), eq(applications.opportunityId, opportunityId)))
      .limit(1);
    let applicationId = existingApplication[0]?.id;
    if (!applicationId) {
      applicationId = id("app");
      await db.insert(applications).values({
        id: applicationId, userEmail: user.email, opportunityId, status: "planning", readinessBand: null,
        submissionSnapshot: null, confirmationNumber: null, submittedAt: null, createdAt: now, updatedAt: now,
      });
    }
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "opportunity",
      entityId: opportunityId,
      action: existing[0] ? "preflight_refreshed" : "preflight_created",
      detail: { applicationId, url: page.url.toString(), requirementCount: preflight.requirements.length },
    });
    return NextResponse.json({ preflight, opportunityId, applicationId, sourceUrl: page.url.toString() }, { status: existing[0] ? 200 : 201 });
  } catch (error) {
    return jsonError(error);
  }
}
