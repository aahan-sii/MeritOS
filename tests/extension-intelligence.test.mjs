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

test("prefers verified resume identity and contact details when available", () => {
  const resumeClaims = [
    ...claims,
    { category: "Identity", statement: "Maya Patel" },
    { category: "Contact details", statement: "Email: maya.patel@example.test" },
    { category: "Contact details", statement: "Phone: +1 (480) 555-0188" },
  ];
  assert.equal(intelligence.suggest(field("Full name", "text"), resumeClaims, identity).text, "Maya Patel");
  assert.equal(intelligence.suggest(field("Applicant email address", "email"), resumeClaims, identity).text, "maya.patel@example.test");
  assert.equal(intelligence.suggest(field("Phone number", "tel"), resumeClaims, identity).text, "+1 (480) 555-0188");
  assert.equal(intelligence.suggest(field("Phone number", "tel"), [...claims, { category: "Contact details", statement: "Phone: 4808594420" }], identity).text, "4808594420");
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
  assert.equal(intelligence.canDraftField(field("Why are you applying for this fellowship?")), false);
  assert.equal(intelligence.canDraftField(field("Why are you applying for this fellowship?"), true), true);
});

test("proactive mode attempts ambiguous low-risk questions but keeps protected fields blocked", () => {
  assert.equal(intelligence.canDraftField(field("What would you bring to this cohort?"), true), true);
  assert.equal(intelligence.canDraftField(field("Are you legally authorized to work?", "radio"), true), false);
  assert.equal(intelligence.canDraftField(field("Teacher email address", "email"), true), false);
});

test("maps project, community, and awards to their matching facts", () => {
  assert.match(intelligence.suggest(field("Describe a project and the impact it created."), claims, identity).text, /Built leakage-safe/);
  assert.match(intelligence.suggest(field("How have you contributed to your community?"), claims, identity).text, /coding mentor/);
  assert.match(intelligence.suggest(field("List an award, achievement, or distinction."), claims, identity).text, /NCWIT/);
});

test("uses research evidence when an application calls it a project or technical skill", () => {
  const researchOnly = [{ category: "Research experience", statement: "Built reproducible DNA methylation pipelines with Python, Bash, and HPC workflows." }];
  assert.match(intelligence.suggest(field("Describe a project that demonstrates your fit."), researchOnly, identity).text, /methylation pipelines/);
  assert.match(intelligence.suggest(field("What technical skill would you bring to this team?", "text"), researchOnly, identity).text, /Python/);
});

test("supports entrepreneurship, nonprofit, employment, teaching, and creative prompts", () => {
  const broadClaims = [
    { category: "Project or impact", statement: "Founded Cedar Learning and coordinated 12 tutors after interviewing 40 families." },
    { category: "Community contribution", statement: "Led a nonprofit food program serving 300 households with 25 volunteers." },
    { category: "Professional experience", statement: "Worked as a software engineer and shipped an accessible transit feature." },
    { category: "Professional experience", statement: "Taught weekly algebra lessons to 16 students." },
    { category: "Project or impact", statement: "Designed an interactive art installation from 80 oral histories." },
  ];
  assert.match(intelligence.suggest(field("Describe a startup you founded."), broadClaims, identity).text, /Cedar Learning/);
  assert.match(intelligence.suggest(field("Describe your nonprofit experience."), broadClaims, identity).text, /food program/);
  assert.match(intelligence.suggest(field("Summarize your professional work experience."), broadClaims, identity).text, /software engineer/);
  assert.match(intelligence.suggest(field("Describe your teaching experience."), broadClaims, identity).text, /algebra lessons/);
  assert.match(intelligence.suggest(field("Discuss a creative portfolio piece."), broadClaims, identity).text, /art installation/);
});

test("derives reviewable education answers from verified school evidence", () => {
  const levelField = { ...field("Current education level", "radio"), options: [{ label: "High school" }, { label: "Undergraduate" }, { label: "Graduate" }] };
  assert.equal(intelligence.suggest(levelField, claims, identity).text, "High school");
  const graduationField = { ...field("Expected graduation year", "select"), options: [{ label: "2026" }, { label: "2027" }, { label: "2028" }] };
  assert.equal(intelligence.suggest(graduationField, claims, identity).text, "2027");
  const graduationDate = intelligence.suggest(field("Expected graduation date", "date"), claims, identity);
  assert.equal(graduationDate.text, "2027-05-01");
  assert.equal(graduationDate.kind, "inference");
});

test("derives reviewable city and state answers from school location evidence", () => {
  const city = intelligence.suggest(field("Current city", "text"), claims, identity);
  const state = intelligence.suggest(field("State of residence", "text"), claims, identity);
  assert.equal(city.text, "Queen Creek");
  assert.equal(state.text, "Arizona");
  assert.equal(city.kind, "inference");
  assert.match(city.source, /review/i);
});

test("does not invent an exact street address from a school location", () => {
  const result = intelligence.suggest(field("Home street address", "text"), claims, identity);
  assert.equal(result.text, "");
  assert.match(result.source, /will not guess|explicit profile input/i);
});

test("labels raw narrative matches as evidence fragments rather than finished answers", () => {
  const result = intelligence.suggest(field("Describe a project that best demonstrates your fit."), claims, identity);
  assert.equal(result.kind, "evidence_preview");
  assert.match(result.source, /Analyze with AI/i);
});
