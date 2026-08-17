import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, documents } from "@/db/schema";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { recordAuditEvent } from "../_lib/audit";
import { storePrivateDocument } from "../_lib/storage";
import { ApiError, id, jsonError, requireApiUser } from "../_lib/request";
import { extractDocumentFacts } from "@/lib/document-facts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const acceptedExtensions = new Set(["pdf", "docx", "txt"]);

function extension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function extractDocumentText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extension(file.name);
  if (ext === "txt") return new TextDecoder().decode(bytes);
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  }
  if (ext === "pdf") {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    return result.text;
  }
  throw new ApiError(400, "Legacy .doc files cannot be extracted reliably. Save it as DOCX or PDF first.");
}

function sectionCategory(section: string) {
  const value = section.toLowerCase();
  if (/award|honou?r|achievement|distinction|recognition/.test(value)) return "Award or distinction";
  if (/community|volunteer|service|outreach/.test(value)) return "Community contribution";
  if (/leadership|activities|extracurricular/.test(value)) return "Leadership";
  if (/research|publication|poster/.test(value)) return "Research experience";
  if (/project|portfolio/.test(value)) return "Project or impact";
  if (/education|school|academic|coursework/.test(value)) return "Education";
  if (/experience|employment|work|internship/.test(value)) return "Professional experience";
  return "";
}

function candidateStatements(text: string) {
  const seen = new Set<string>();
  const candidates: { statement: string; category: string }[] = [];
  let activeSection = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine
      .replace(/^[\s•●▪◦*-]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!line || line.length > 360 || !/[a-z]/i.test(line)) continue;
    const possibleSection = sectionCategory(line);
    const looksLikeHeading =
      line.length <= 42 &&
      (possibleSection || line === line.toUpperCase() || /:$/.test(line));
    if (looksLikeHeading) {
      if (possibleSection) activeSection = possibleSection;
      continue;
    }
    if (line.length < 10 || (line.length < 28 && !activeSection)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      statement: line,
      category: activeSection || categorizeStatement(line),
    });
    if (candidates.length >= 30) break;
  }
  return candidates;
}

function categorizeStatement(statement: string) {
  const value = statement.toLowerCase();
  if (/\b(award|honou?r(?:able)?|scholarship|distinction|dean'?s list|finalist|winner|medal|champion|gold|silver|bronze)\b/.test(value)) {
    return "Award or distinction";
  }
  if (/\b(volunteer|community|service|nonprofit|outreach|tutor(?:ed|ing)?|fundrais)/.test(value)) {
    return "Community contribution";
  }
  if (/\b(led|founded|president|captain|chair|coordinated|organized|managed|mentored|supervised)\b/.test(value)) {
    return "Leadership";
  }
  if (/\b(research|laboratory|lab\b|genomics|bioinformatics|publication|poster|abstract|experiment)/.test(value)) {
    return "Research experience";
  }
  if (/\b(project|built|developed|designed|created|implemented|engineered|prototype|application|platform)\b/.test(value)) {
    return "Project or impact";
  }
  if (/\b(university|college|school|academy|degree|gpa|coursework|graduat(?:ed|ion))\b/.test(value)) {
    return "Education";
  }
  if (/\b(intern|employment|worked|assistant|experience|role)\b/.test(value)) {
    return "Professional experience";
  }
  return "Other résumé evidence";
}

void candidateStatements;

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = await getDb();
    const rows = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        contentType: documents.contentType,
        sizeBytes: documents.sizeBytes,
        processingStatus: documents.processingStatus,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.userEmail, user.email))
      .orderBy(desc(documents.createdAt));
    return NextResponse.json({ documents: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a document to upload.");
    if (!acceptedExtensions.has(extension(file.name))) {
      throw new ApiError(400, "Use a PDF, DOCX, or TXT document.");
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      throw new ApiError(400, "Documents must be between 1 byte and 12 MB.");
    }

    const documentId = id("doc");
    const storageKey = `${user.email}/${documentId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const buffer = await file.arrayBuffer();
    const extractedText = await extractDocumentText(
      new File([buffer], file.name, { type: file.type }),
    );
    const extraction = await extractDocumentFacts(extractedText, file.name);
    const storedFile = await storePrivateDocument(
      storageKey,
      buffer,
      file.type || "application/octet-stream",
    );

    const document = {
      id: documentId,
      userEmail: user.email,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageKey: storedFile.url,
      processingStatus: "ready" as const,
      extractedText,
      createdAt: new Date(),
    };
    const db = await getDb();
    await db.insert(documents).values(document);
    const now = new Date();
    const candidates = extraction.facts.map(({ statement, category, sourceQuote }) => ({
      id: id("claim"),
      userEmail: user.email,
      category,
      statement,
      status: "draft" as const,
      evidence: JSON.stringify([{ documentId, filename: file.name, quote: sourceQuote }]),
      sensitivity: "standard" as const,
      allowedUses: "[]",
      confidence: ["Identity", "Contact details", "Links & profiles"].includes(category)
        ? 98
        : extraction.mode === "ai" ? 85 : 55,
      createdAt: now,
      updatedAt: now,
    }));
    if (candidates.length) await db.insert(claims).values(candidates);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "document",
      entityId: documentId,
      action: "uploaded",
      detail: { filename: file.name, sizeBytes: file.size },
    });
    return NextResponse.json(
      { document, candidateClaims: candidates, extraction: { mode: extraction.mode, warning: extraction.warning } },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
