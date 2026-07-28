import { put } from "@vercel/blob";

export async function storePrivateDocument(
  pathname: string,
  body: ArrayBuffer,
  contentType: string,
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is unavailable. Create a Vercel Blob store and connect it to this project.",
    );
  }

  return put(pathname, body, {
    access: "private",
    contentType,
    addRandomSuffix: true,
  });
}
