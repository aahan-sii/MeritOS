import assert from "node:assert/strict";
import test from "node:test";
import { buildHumanProfile } from "../lib/human-profile.ts";

test("builds a grounded Human Profile from verified evidence", () => {
  const profile = buildHumanProfile([
    { id: "education", category: "Education", statement: "North Valley High School | Expected May 2027" },
    { id: "research", category: "Research experience", statement: "Built bioinformatics and genomics workflows for disease research." },
    { id: "leadership", category: "Leadership", statement: "President who coordinated student outreach." },
    { id: "skills", category: "Skills or certification", statement: "Python, Bash, Linux, HPC" },
  ]);
  assert.match(profile.summary, /computational biology/i);
  assert.ok(profile.themes.includes("computational biology"));
  assert.ok(profile.technicalFocus.includes("python"));
  assert.equal(profile.needsOpportunityContext, true);
});
