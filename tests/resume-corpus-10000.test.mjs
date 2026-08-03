import assert from "node:assert/strict";
import test from "node:test";
import { extractResumeEvidence, extractResumeProfile } from "../lib/resume-intelligence.js";
import { generateSyntheticResumeCases } from "../scripts/synthetic-resume-corpus.mjs";

test("10,000 diverse synthetic resumes preserve identity, contact, education, and primary experience", () => {
  const cases = generateSyntheticResumeCases(10_000);
  let correctBasics = 0;
  let correctExperience = 0;
  for (const fixture of cases) {
    const profile = extractResumeProfile(fixture.text);
    if (
      profile.name === fixture.expected.name
      && profile.email === fixture.expected.email
      && profile.phone === fixture.expected.phone
      && profile.institutions.some((value) => value.includes(fixture.expected.school))
      && profile.graduationYear === fixture.expected.graduationYear
      && profile.gradeLevel === fixture.expected.gradeLevel
    ) correctBasics += 1;
    const evidence = extractResumeEvidence(fixture.text);
    if (evidence.some((item) => item.category === fixture.expected.category && item.statement.includes(fixture.expected.experience.split(" ")[0]))) correctExperience += 1;
  }
  assert.equal(correctBasics, cases.length, `basic-profile recall was ${(correctBasics / cases.length * 100).toFixed(2)}%`);
  assert.equal(correctExperience, cases.length, `experience recall was ${(correctExperience / cases.length * 100).toFixed(2)}%`);
});
