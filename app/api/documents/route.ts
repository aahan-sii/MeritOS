import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { recordAuditEvent } from "../_lib/audit";
import { getFilesBucket } from "../_lib/storage";
import { ApiError, id, jsonError, requireApiUser } from "../_lib/request";

const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const acceptedExtensions = new Set(["pdf", "doc", "docx", "txt"]);

function extension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
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
      throw new ApiError(400, "Use a PDF, DOC, DOCX, or TXT document.");
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      throw new ApiError(400, "Documents must be between 1 byte and 12 MB.");
    }

    const documentId = id("doc");
    const storageKey = `${user.email}/${documentId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bucket = await getFilesBucket();
    await bucket.put(storageKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { userEmail: user.email, filename: file.name },
    });

    const document = {
      id: documentId,
      userEmail: user.email,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageKey,
      processingStatus: "stored" as const,
      extractedText: null,
      createdAt: new Date(),
    };
    const db = await getDb();
    await db.insert(documents).values(document);
    await recordAuditEvent({
      userEmail: user.email,
      entityType: "document",
      entityId: documentId,
      action: "uploaded",
      detail: { filename: file.name, sizeBytes: file.size },
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
