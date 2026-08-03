import assert from "node:assert/strict";
import test from "node:test";
import { generateSyntheticApplicationCases } from "../scripts/synthetic-form-corpus.mjs";

await import("../extension/form-core.js");
await import("../extension/intelligence.js");
const intelligence = globalThis.MeritOSIntelligence;

test("10,000 synthetic applicant profiles map basic and diverse experience fields correctly", () => {
  const cases = generateSyntheticApplicationCases(10_000);
  let correct = 0;
  let total = 0;
  for (const fixture of cases) {
    for (const expectedField of fixture.fields) {
      const field = { ...expectedField, id: `${fixture.id}-${total}`, kind: expectedField.type, maxLength: 1_200 };
      const result = intelligence.suggest(field, fixture.claims, fixture.identity);
      const matches = expectedField.expected ? result.text === expectedField.expected : result.text.includes(expectedField.expectedContains);
      if (matches) correct += 1;
      total += 1;
    }
  }
  assert.equal(total, 70_000);
  assert.equal(correct, total, `field-routing accuracy was ${(correct / total * 100).toFixed(2)}%`);
});
