import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeDocumentFacts } from "../lib/document-facts.ts";

test("1,000 document evidence fixtures preserve source support and grouped experiences", () => {
  let checked = 0;
  for (let index = 0; index < 1_000; index += 1) {
    const project = `Project ${index}: Built a reproducible analysis workflow for dataset ${index}. Validated the pipeline on ${index + 12} samples and documented the limitations.`;
    const source = `EDUCATION\nNorth Valley High School | Expected May 2027\nPROJECTS\n${project}\nAWARDS\nRegional science recognition ${index}`;
    const candidates = [
      { category: "Project or impact", statement: `Built and validated Project ${index}, a reproducible analysis workflow tested on ${index + 12} samples.`, sourceQuote: project },
      { category: "Project or impact", statement: `Built and validated Project ${index}, a reproducible analysis workflow tested on ${index + 12} samples.`, sourceQuote: project },
      { category: "Award or distinction", statement: `Won a national prize for Project ${index}.`, sourceQuote: `national prize ${index}` },
    ];
    const facts = sanitizeDocumentFacts(candidates, source);
    assert.equal(facts.length, 1);
    assert.equal(facts[0].sourceQuote, project);
    assert.match(facts[0].statement, new RegExp(`Project ${index}`));
    checked += 1;
  }
  assert.equal(checked, 1_000);
});
