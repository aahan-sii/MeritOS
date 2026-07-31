import assert from "node:assert/strict";
import test from "node:test";
import { cleanProfileText } from "../lib/profile-intelligence.ts";

test("cleanProfileText removes bracketed and bare internal claim IDs", () => {
  const result = cleanProfileText(
    "I built a genomics workflow. [claim_b7cab07c-935c-4174-b16b-5d65ed742222] claim_d16ea13b-d77f-4baf-a252-9c3602c44306",
  );

  assert.equal(result, "I built a genomics workflow.");
  assert.doesNotMatch(result, /claim_/i);
});

test("cleanProfileText normalizes punctuation and obeys a visible length limit", () => {
  const result = cleanProfileText("A supported point   , followed by context.", 24);

  assert.equal(result, "A supported point, follo");
  assert.equal(result.length, 24);
});
