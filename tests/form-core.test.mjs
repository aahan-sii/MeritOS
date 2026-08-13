import assert from "node:assert/strict";
import test from "node:test";

await import("../extension/form-core.js");
const formCore = globalThis.MeritOSFormCore;

test("matches exact standard and Google Forms option labels", () => {
  const options = [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }];
  assert.deepEqual(formCore.matchOption("yes", options), options[0]);
  assert.deepEqual(formCore.matchOption("FALSE", options), options[1]);
});

test("does not guess between unrelated choices", () => {
  assert.equal(formCore.matchOption("maybe", [{ label: "Yes" }, { label: "No" }]), null);
});

test("recognizes third-party contact questions", () => {
  assert.equal(formCore.thirdPartyContactQuestion("Teacher email address"), true);
  assert.equal(formCore.thirdPartyContactQuestion("Your email address"), false);
});

test("application runs continue only through safe progress actions and stop before submission", () => {
  for (const label of ["Next", "Continue", "Save & Continue", "Review application", "Proceed"]) {
    assert.equal(formCore.progressActionKind(label), "next");
  }
  for (const label of ["Submit", "Submit application", "Apply now", "Finish application", "Send application"]) {
    assert.equal(formCore.progressActionKind(label), "final");
  }
  assert.equal(formCore.progressActionKind("I agree to the terms"), "");
  assert.equal(formCore.progressActionKind("Authorize background check"), "");
});

test("formats graduation evidence for native calendar controls", () => {
  assert.deepEqual(formCore.normalizeTemporalValue("Expected 2027", "date"), { value: "2027-06-01", inferred: true });
  assert.deepEqual(formCore.normalizeTemporalValue("May 2027", "month"), { value: "2027-05", inferred: true });
  assert.deepEqual(formCore.normalizeTemporalValue("05/24/2027", "date"), { value: "2027-05-24", inferred: false });
  assert.deepEqual(formCore.normalizeTemporalValue("2:30 PM", "time"), { value: "14:30", inferred: false });
});

test("classifies exact actions for on-page guidance", () => {
  assert.equal(formCore.guidanceActionKind("Create account"), "signup");
  assert.equal(formCore.guidanceActionKind("Sign in"), "login");
  assert.equal(formCore.guidanceActionKind("Start application"), "apply");
  assert.equal(formCore.guidanceActionKind("Continue"), "next");
});

test("splits multi-select answers without splitting normal commas", () => {
  assert.deepEqual(formCore.splitMultipleValues("Research; Leadership | Community"), ["Research", "Leadership", "Community"]);
  assert.deepEqual(formCore.splitMultipleValues("Phoenix, Arizona"), ["Phoenix, Arizona"]);
});
