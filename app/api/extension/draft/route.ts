import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { createGroundedDraftBatch, type DraftField } from "@/lib/ai-drafting";
import { claims, opportunities, profiles } from "@/db/schema";
import { buildHumanProfile } from "@/lib/human-profile";
import { futurePhysiciansEvidence, futurePhysiciansKnowledge } from "@/lib/future-physicians";
import { extensionCorsHeaders, requireExtensionConnection } from "../_lib";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders });
}

function fieldFrom(value: unknown): DraftField | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.label !== "string" || !candidate.label.trim() || candidate.label.length > 500) return null;
  return {
    id: typeof candidate.id === "string" ? candidate.id.slice(0, 200) : undefined,
    label: candidate.label,
    description: typeof candidate.description === "string" ? candidate.description.slice(0, 500) : undefined,
    kind: typeof candidate.kind === "string" ? candidate.kind.slice(0, 80) : undefined,
    type: typeof candidate.type === "string" ? candidate.type.slice(0, 80) : undefined,
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 160) : undefined,
    maxLength: typeof candidate.maxLength === "number" ? candidate.maxLength : undefined,
    control: typeof candidate.control === "string" ? candidate.control.slice(0, 40) : undefined,
    options: Array.isArray(candidate.options) ? candidate.options.slice(0, 40).map((option) => {
      if (typeof option === "string") return option.slice(0, 180);
      if (!option || typeof option !== "object") return "";
      const value = option as Record<string, unknown>;
      return { label: typeof value.label === "string" ? value.label.slice(0, 180) : "", value: typeof value.value === "string" ? value.value.slice(0, 180) : "" };
    }).filter(Boolean) : undefined,
  };
}

export async function POST(request: NextRequest) {
  const connection = await requireExtensionConnection(request);
  if (!connection) {
    return NextResponse.json({ error: "Connect MeritOS first." }, { status: 401, headers: extensionCorsHeaders });
  }
  try {
    const body = await request.json();
    const rawFields: unknown[] = Array.isArray(body?.fields) ? body.fields : [body?.field];
    const fields = rawFields.map(fieldFrom).filter((field): field is DraftField => Boolean(field)).slice(0, 20);
    if (!fields.length) return NextResponse.json({ error: "At least one valid application field is required." }, { status: 400, headers: extensionCorsHeaders });
    const page = body?.page && typeof body.page === "object" ? body.page as Record<string, unknown> : {};
    const highInitiative = body?.mode === "high_initiative";
    const proactive = body?.mode === "proactive" || highInitiative;
    const organizationApplication = body?.organizationApplication === true;
    const [claimRows, opportunityRows, [accountProfile]] = await Promise.all([connection.db
      .select({ id: claims.id, category: claims.category, statement: claims.statement })
      .from(claims)
      .where(and(eq(claims.userEmail, connection.connection.userEmail), eq(claims.status, "verified")))
      .orderBy(desc(claims.updatedAt))
      .limit(60), connection.db
      .select({ title: opportunities.title, organization: opportunities.organization, url: opportunities.url, eligibility: opportunities.eligibility })
      .from(opportunities)
      .where(eq(opportunities.userEmail, connection.connection.userEmail))
      .orderBy(desc(opportunities.updatedAt))
      .limit(12), connection.db
      .select({ headline: profiles.headline })
      .from(profiles)
      .where(eq(profiles.email, connection.connection.userEmail))
      .limit(1)]);
    const rows = accountProfile?.headline?.trim()
      ? [{ id: "profile_direction", category: "Motivation & goals", statement: accountProfile.headline.trim() }, ...claimRows]
      : claimRows;
    const humanProfile = buildHumanProfile(rows);
    const pageUrl = typeof page.url === "string" ? page.url : "";
    const pageHost = (() => { try { return new URL(pageUrl).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    const activeOpportunity = opportunityRows.find((item) => {
      try { return pageHost && new URL(item.url).hostname.replace(/^www\./, "") === pageHost; } catch { return false; }
    }) || opportunityRows[0];
    const opportunityContext = activeOpportunity ? (() => {
      try {
        const parsed = JSON.parse(activeOpportunity.eligibility) as { preflight?: { summary?: string; eligibilityRules?: string[]; requiredDocuments?: string[] } };
        return JSON.stringify({ title: activeOpportunity.title, organization: activeOpportunity.organization, summary: parsed.preflight?.summary || "", eligibilityRules: parsed.preflight?.eligibilityRules || [], requiredDocuments: parsed.preflight?.requiredDocuments || [] });
      } catch { return `${activeOpportunity.title} — ${activeOpportunity.organization}`; }
    })() : "";
    const results = await createGroundedDraftBatch({
      fields,
      page: {
        title: typeof page.title === "string" ? page.title.slice(0, 300) : "",
        url: typeof page.url === "string" ? page.url.slice(0, 1_000) : "",
        opportunityContext: [opportunityContext, `HUMAN PROFILE (directional only; not evidence): ${humanProfile.summary}. Relevant directions: ${humanProfile.applicationDirections.join("; ")}.`].filter(Boolean).join("\n"),
      },
      evidence: rows,
      organizationEvidence: futurePhysiciansEvidence,
      organizationName: futurePhysiciansKnowledge.organizationName,
      organizationApplication,
      proactive,
      highInitiative,
    });
    return NextResponse.json(Array.isArray(body?.fields) ? { results } : results[0], { headers: extensionCorsHeaders });
  } catch (error) {
    console.error("MeritOS draft error", error);
    return NextResponse.json({ error: "MeritOS could not create a draft right now. Your application was not changed." }, { status: 500, headers: extensionCorsHeaders });
  }
}
