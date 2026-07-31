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
