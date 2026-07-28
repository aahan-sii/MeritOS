import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { claims, documents } from "@/db/schema";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { recordAuditEvent } from "../_lib/audit";
import { storePrivateDocument } from "../_lib/storage";
import { ApiError, id, jsonError, requireApiUser } from "../_lib/request";

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

function candidateStatements(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•●▪◦*-]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 28 && line.length <= 360)
    .filter((line) => /[a-z]/i.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

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
    const storedFile = await storePrivateDocument(
      storageKey,
      buffer,
      file.type || "application/octet-stream",
    );
    const extractedText = await extractDocumentText(
      new File([buffer], file.name, { type: file.type }),
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
    const candidates = candidateStatements(extractedText).map((statement) => ({
      id: id("claim"),
      userEmail: user.email,
      category: "Imported résumé evidence",
      statement,
      status: "draft" as const,
      evidence: JSON.stringify([{ documentId, filename: file.name }]),
      sensitivity: "standard" as const,
      allowedUses: "[]",
      confidence: 70,
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
    return NextResponse.json({ document, candidateClaims: candidates }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
