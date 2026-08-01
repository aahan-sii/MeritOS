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
