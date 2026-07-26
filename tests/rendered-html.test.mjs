import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MeritOS application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>MeritOS · Evidence-backed application intelligence<\/title>/i,
  );
  assert.match(html, /Application dashboard/);
  assert.match(html, /Application review/);
  assert.match(html, /LifeGraph/);
  assert.match(html, /No unsupported claim/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the protected MeritOS API routes", async () => {
  const worker = await import("../dist/server/index.js");
  const request = new Request("https://meritos.local/api/health");
  const response = await worker.default.fetch(request, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.safeguards.automaticSubmission, false);
  assert.equal(payload.safeguards.unsupportedClaims, "blocked");
});
