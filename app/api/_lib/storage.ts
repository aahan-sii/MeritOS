import { put } from "@vercel/blob";

export async function storePrivateDocument(
  pathname: string,
  body: ArrayBuffer,
  contentType: string,
) {
  return put(pathname, body, {
    access: "private",
    contentType,
    addRandomSuffix: true,
  });
}
