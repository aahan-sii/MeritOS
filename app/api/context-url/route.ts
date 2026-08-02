import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims } from "@/db/schema";
import { extractDocumentFacts } from "@/lib/document-facts";
import { fetchPublicPage, publicWebLimits, safePublicUrl } from "@/lib/public-web";
import { recordAuditEvent } from "../_lib/audit";
import { asRecord, asString, id, jsonError, requireApiUser } from "../_lib/request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = asRecord(await request.json(), "body");
    const url = await safePublicUrl(asString(body.url, "url", 2_000));
    const pastedText = typeof body.pastedText === "string" ? body.pastedText.trim().slice(0, publicWebLimits.maxText) : "";
    const linkedin = /(^|\.)linkedin\.com$/i.test(url.hostname);
    let sourceText = pastedText;
    let finalUrl = url;
    if (!sourceText && !linkedin) {
      const page = await fetchPublicPage(url);
      sourceText = page.text;
      finalUrl = page.url;
    }
    const extraction = sourceText.length >= 40
      ? await extractDocumentFacts(sourceText, linkedin ? "LinkedIn profile text" : finalUrl.hostname)
      : { facts: [], mode: "fallback" as const, warning: linkedin ? "LinkedIn blocks dependable public import. Paste your About and Experience text or upload a LinkedIn PDF." : "No readable profile text was found." };
    const now = new Date();
    const rows = [
      {
        id: id("claim"), userEmail: user.email, category: "Links & profiles", statement: finalUrl.toString(), status: "draft" as const,
        evidence: JSON.stringify([{ source: linkedin ? "Applicant-provided LinkedIn URL" : "Applicant-provided public website", url: finalUrl.toString() }]),
        sensitivity: "standard" as const, allowedUses: "[]", confidence: 100, createdAt: now, updatedAt: now,
      },
      ...extraction.facts.map((fact) => ({
        id: id("claim"), userEmail: user.email, category: fact.category, statement: fact.statement, status: "draft" as const,
        evidence: JSON.stringify([{ source: linkedin ? "Pasted LinkedIn profile text" : finalUrl.toString(), quote: fact.sourceQuote }]),
        sensitivity: "standard" as const, allowedUses: "[]", confidence: extraction.mode === "ai" ? 82 : 50, createdAt: now, updatedAt: now,
      })),
    ];
    const db = await getDb();
    await db.insert(claims).values(rows);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "context_source",
      entityId: rows[0].id,
      action: "imported",
      detail: { hostname: finalUrl.hostname, extractedFacts: extraction.facts.length, mode: extraction.mode },
    });
    return NextResponse.json({ candidateClaims: rows, extraction: { mode: extraction.mode, warning: extraction.warning } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
