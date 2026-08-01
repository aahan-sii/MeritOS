import assert from "node:assert/strict";
import test from "node:test";

await import("../extension/form-core.js");
await import("../extension/intelligence.js");
const core = globalThis.MeritOSFormCore;
const intelligence = globalThis.MeritOSIntelligence;
const identity = { displayName: "Jordan Avery Lee", email: "jordan@example.com" };
const claims = [
  { category: "Education", statement: "North Valley High School | Expected May 2027" },
  { category: "Research experience", statement: "Completed a genomics research project using reproducible analysis workflows." },
];

test("form intelligence handles 1,200 deterministic field variants without unsafe guessing", () => {
  let checked = 0;
  for (let index = 0; index < 400; index += 1) {
    const target = `Choice ${index}`;
    const options = [{ label: `Other ${index}` }, { label: target }, { label: `None ${index}` }];
    assert.equal(core.matchOption(target.toUpperCase(), options)?.label, target);
    checked += 1;
  }
  for (let index = 0; index < 200; index += 1) {
    assert.equal(core.matchOption(`Unsupported ${index}`, [{ label: "Yes" }, { label: "No" }]), null);
    checked += 1;
  }
  const people = ["teacher", "recommender", "reference", "counselor", "mentor", "supervisor", "manager", "parent", "guardian", "contact person"];
  for (let index = 0; index < 300; index += 1) {
    const person = people[index % people.length];
    const result = intelligence.suggest({ label: `${person} email address ${index}`, type: "email", kind: "input" }, claims, identity);
    assert.equal(result.text, "");
    assert.equal(result.intent, "third_party_email");
    checked += 1;
  }
  for (let index = 0; index < 100; index += 1) {
    assert.equal(intelligence.suggest({ label: `Applicant first name ${index}`, type: "text" }, claims, identity).text, "Jordan");
    assert.equal(intelligence.suggest({ label: `Applicant last name ${index}`, type: "text" }, claims, identity).text, "Avery Lee");
    checked += 2;
  }
  for (let index = 0; index < 100; index += 1) {
    const result = intelligence.suggest({ label: `Work authorization status ${index}`, type: "radio", options: [{ label: "Yes" }, { label: "No" }] }, claims, identity);
    assert.equal(result.text, "");
    checked += 1;
  }
  assert.equal(checked, 1_200);
});
