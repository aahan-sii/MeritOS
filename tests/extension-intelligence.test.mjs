import assert from "node:assert/strict";
import test from "node:test";

await import("../extension/form-core.js");
await import("../extension/intelligence.js");

const intelligence = globalThis.MeritOSIntelligence;
const identity = { displayName: "Aahan Singh", email: "aahan@example.com" };
const claims = [
  { category: "Education", statement: "American Leadership Academy, Queen Creek, AZ | Expected May 2027" },
  { category: "Education", statement: "2026–27 Coursework: AP Calculus BC, AP Physics C, AP Statistics" },
  { category: "Research experience", statement: "Research Intern | Computational Genomics & Bioinformatics" },
  { category: "Leadership", statement: "Founded a five-student Bioinformatics Club and coordinated weekly workshops." },
  { category: "Project or impact", statement: "Built leakage-safe workflows for DNA methylation quality control." },
  { category: "Community contribution", statement: "Volunteered weekly as a coding mentor for first-generation students." },
  { category: "Award or distinction", statement: "NCWIT Aspirations in Computing Honorable Mention" },
];
const field = (label, type = "textarea") => ({ id: label, label, type, kind: type, maxLength: 1200 });

test("matches account identity fields directly", () => {
  assert.equal(intelligence.suggest(field("Full name", "text"), claims, identity).text, "Aahan Singh");
  assert.equal(intelligence.suggest(field("Email address", "email"), claims, identity).text, "aahan@example.com");
});

test("never substitutes applicant contact details for another person", () => {
  const teacher = intelligence.suggest(field("Teacher email address", "email"), claims, identity);
  assert.equal(teacher.text, "");
  assert.equal(teacher.intent, "third_party_email");
  assert.match(teacher.source, /someone else/i);
});

test("matches supported radio and select options exactly", () => {
  const optionField = { ...field("Current school", "select"), options: [{ label: "American Leadership Academy", value: "ala" }, { label: "Other", value: "other" }] };
  assert.equal(intelligence.suggest(optionField, claims, identity).text, "American Leadership Academy");
});

test("chooses a real institution over coursework", () => {
  const result = intelligence.suggest(field("Current school, institution, or organization", "text"), claims, identity);
  assert.match(result.text, /American Leadership Academy/);
  assert.doesNotMatch(result.text, /Coursework/i);
});

test("does not confuse a school name with leadership evidence", () => {
  const result = intelligence.suggest(field("Give an example of leadership or initiative."), claims, identity);
  assert.match(result.text, /Founded a five-student/);
  assert.doesNotMatch(result.text, /^American Leadership Academy/);
});

test("keeps opportunity-specific motivation blank", () => {
  const result = intelligence.suggest(field("Why are you applying for this fellowship?"), claims, identity);
  assert.equal(result.text, "");
  assert.match(result.source, /Needs your input/);
});

test("maps project, community, and awards to their matching facts", () => {
  assert.match(intelligence.suggest(field("Describe a project and the impact it created."), claims, identity).text, /Built leakage-safe/);
  assert.match(intelligence.suggest(field("How have you contributed to your community?"), claims, identity).text, /coding mentor/);
  assert.match(intelligence.suggest(field("List an award, achievement, or distinction."), claims, identity).text, /NCWIT/);
});
