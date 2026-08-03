import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const resolve = (path) => new URL(path, root);

test("creates a deployable Next.js application build", () => {
  assert.ok(existsSync(resolve(".next/server/app-paths-manifest.json")));
  assert.ok(existsSync(resolve(".next/server/app/page.js")));
  assert.ok(existsSync(resolve(".next/server/app/api/health/route.js")));
  assert.ok(existsSync(resolve(".next/server/app/api/documents/route.js")));
  assert.ok(existsSync(resolve(".next/server/app/api/opportunity-preflight/route.js")));
  assert.ok(existsSync(resolve(".next/server/app/api/application-packet/route.js")));

  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");
});

test("keeps MeritOS safeguards and Vercel storage configuration", () => {
  const healthRoute = readFileSync(resolve("app/api/health/route.ts"), "utf8");
  const storage = readFileSync(resolve("app/api/_lib/storage.ts"), "utf8");
  const auth = readFileSync(resolve("app/chatgpt-auth.ts"), "utf8");
  const commandCenter = readFileSync(resolve("app/page.tsx"), "utf8");
  const preflight = readFileSync(resolve("lib/opportunity-intelligence.ts"), "utf8");
  const extensionPanel = readFileSync(resolve("extension/sidepanel.js"), "utf8");
  const formCore = readFileSync(resolve("extension/form-core.js"), "utf8");

  assert.match(healthRoute, /automaticSubmission: false/);
  assert.match(healthRoute, /unsupportedClaims: "blocked"/);
  assert.match(storage, /@vercel\/blob/);
  assert.match(storage, /access: "private"/);
  assert.match(auth, /MERITOS_DEMO_EMAIL/);
  assert.match(commandCenter, /It never silently presses Submit/);
  assert.match(preflight, /Do not claim the applicant is eligible overall/);
  assert.match(extensionPanel, /stopped before/);
  assert.match(formCore, /progressActionKind/);
  assert.match(formCore, /return "final"/);
});
