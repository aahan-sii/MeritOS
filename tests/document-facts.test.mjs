import assert from "node:assert/strict";
import test from "node:test";

test("document fact validation requires an exact supporting excerpt", async () => {
  const { sanitizeDocumentFacts } = await import("../lib/document-facts.ts");
  const source = "Research Intern — Built a methylation analysis pipeline and presented results at the state fair.";
  const facts = sanitizeDocumentFacts([
    {
      category: "Project or impact",
      statement: "Built a methylation analysis pipeline and presented results at the state fair.",
      sourceQuote: "Built a methylation analysis pipeline and presented results at the state fair.",
    },
    {
      category: "Project or impact",
      statement: "Raised hospital outcomes by 40%.",
      sourceQuote: "Raised hospital outcomes by 40%.",
    },
  ], source);
  assert.equal(facts.length, 1);
  assert.match(facts[0].statement, /methylation analysis/i);
});

test("fallback extraction keeps resume basics and grouped non-research experience", async () => {
  const { fallbackFacts } = await import("../lib/document-facts.ts");
  const source = `Maya Patel\nmaya.patel@example.test | +1 (480) 555-0188\nEDUCATION\nNorth Valley High School | 11th grade | Expected May 2027\nENTREPRENEURSHIP\nFounder | Cedar Learning\nLaunched a tutoring marketplace and coordinated 12 tutors.`;
  const facts = fallbackFacts(source);
  assert.ok(facts.some((fact) => fact.category === "Identity" && /Maya Patel/.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Contact details" && /maya\.patel/.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Contact details" && /555-0188/.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Education" && /North Valley/.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Project or impact" && /Cedar Learning/.test(fact.statement)));
});

test("fallback extraction preserves research and leadership sections", async () => {
  const { fallbackFacts } = await import("../lib/document-facts.ts");
  const facts = fallbackFacts(`Jordan Lee\njordan@example.com\n\nRESEARCH EXPERIENCE\nResearch Intern | Built a computational biology pipeline for genomic analysis.\n\nLEADERSHIP\nPresident of the student science club; organized peer mentoring and community workshops.`);
  assert.ok(facts.some((fact) => fact.category === "Research experience"));
  assert.ok(facts.some((fact) => fact.category === "Leadership"));
});

test("fallback facts survive PDF bullet and line-wrap artifacts", async () => {
  const { fallbackFacts } = await import("../lib/document-facts.ts");
  const facts = fallbackFacts(`RESEARCH EXPERIENCE
Research Intern | Genomics Lab
● Developed a methylation workflow across disease cohorts.
● Achieved Gate-A AUC 0.813 after grouped validation.
LEADERSHIP
President | Student Health Network
● Scaled funding to $400,000 and distributed 3,000 opportunities.`);
  assert.ok(facts.some((fact) => fact.category === "Research experience" && /methylation workflow/i.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Research experience" && /Gate-A AUC 0.813/i.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Leadership" && /400,000/.test(fact.statement)));
});
