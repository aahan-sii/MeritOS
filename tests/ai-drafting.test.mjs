import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDraftingPrompt,
  canDraftField,
  dedupeDraftText,
  dedupeEvidence,
  needsPersonalInput,
  normalizedMaxLength,
  selectRelevantEvidence,
} from "../lib/ai-drafting-core.js";

test("personal motivation prompts require applicant input instead of inference", async () => {
  const field = { label: "Why are you applying for this fellowship?", kind: "textarea", maxLength: 1200 };
  assert.equal(needsPersonalInput(field), true);
  assert.equal(canDraftField(field), false);
});

test("uses short defaults for single-line answers and longer defaults for paragraphs", () => {
  assert.equal(normalizedMaxLength({ label: "Short answer", control: "text" }), 240);
  assert.equal(normalizedMaxLength({ label: "Essay", control: "textarea" }), 1200);
});

test("removes near-duplicate evidence and repeated answer sentences", () => {
  const evidence = [
    { id: "a", statement: "As president, scaled funding to $400,000 and distributed 3,000 opportunities." },
    { id: "b", statement: "As president, reported scaling funding to approximately $400,000 and distributing over 3,000 opportunities." },
    { id: "c", statement: "Mentored five students in weekly workshops." },
  ];
  assert.deepEqual(dedupeEvidence(evidence).map((item) => item.id), ["a", "c"]);
  const answer = "I scaled funding to $400,000 and distributed 3,000 opportunities. I reported scaling funding to approximately $400,000 and distributing over 3,000 opportunities.";
  assert.equal(dedupeDraftText(answer), "I scaled funding to $400,000 and distributed 3,000 opportunities.");
});

test("only narrative fields are eligible for a paid drafting request", () => {
  assert.equal(canDraftField({ label: "Describe your most relevant research experience." }), true);
  assert.equal(canDraftField({ label: "Email address", type: "email" }), false);
});

test("draft prompt contains verified facts and a hard evidence-only instruction", () => {
  const prompt = buildDraftingPrompt({
    field: { label: "Describe a project and its impact.", maxLength: 400 },
    evidence: [{ id: "claim_1", category: "Project or Impact", statement: "Built a data pipeline for a class project." }],
  });
  assert.match(prompt.developer, /Never invent/i);
  assert.match(prompt.developer, /applicant's role/i);
  assert.match(prompt.developer, /isolated result or metric/i);
  assert.match(prompt.user, /claim_1/);
  assert.match(prompt.user, /400/);
});

test("drafting sends matching evidence instead of unrelated resume sections", () => {
  const evidence = [
    { id: "research", category: "Research Experience", statement: "Worked in a genomics lab." },
    { id: "award", category: "Award or Distinction", statement: "Science fair finalist." },
  ];
  assert.deepEqual(selectRelevantEvidence({ label: "Describe your research experience." }, evidence), [evidence[0]]);
});
