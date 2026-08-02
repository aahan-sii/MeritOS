import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ApiError } from "@/app/api/_lib/request";

const MAX_WEB_TEXT = 60_000;
const MAX_RESPONSE_BYTES = 1_750_000;

function privateAddress(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

export async function safePublicUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ApiError(400, "Enter a complete http or https URL."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ApiError(400, "Only public http or https URLs are supported.");
  }
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname) || hostname.endsWith(".local")) {
    throw new ApiError(400, "Private network URLs are not supported.");
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((item) => privateAddress(item.address))) {
    throw new ApiError(400, "That website could not be safely reached.");
  }
  return url;
}

export function visiblePageText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_WEB_TEXT);
}

export async function fetchPublicPage(start: URL, userAgent = "MeritOS-Public-Reader/1.0") {
  let url = start;
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": userAgent, Accept: "text/html,text/plain,application/xhtml+xml" },
    }).finally(() => clearTimeout(timer));
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ApiError(400, "The website redirected without a destination.");
      url = await safePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new ApiError(400, `The website returned ${response.status}. Paste the official instructions instead.`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) throw new ApiError(400, "That page is too large. Paste the relevant official instructions instead.");
    const type = response.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) throw new ApiError(400, "That URL is not a readable public webpage.");
    const html = (await response.text()).slice(0, MAX_RESPONSE_BYTES);
    return { url, text: visiblePageText(html) };
  }
  throw new ApiError(400, "The website redirected too many times.");
}

export const publicWebLimits = { maxText: MAX_WEB_TEXT };
