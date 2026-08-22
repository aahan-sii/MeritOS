import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { futurePhysiciansEvidence, futurePhysiciansTemplates, routeFuturePhysiciansEvidence, selectFuturePhysiciansOrganizationEvidence } from "../lib/future-physicians.ts";

const memberEvidence = [
  { id: "member_email", category: "Contact details", statement: "Email: member@example.org" },
  { id: "member_fp_role", category: "Leadership", statement: "Served as a chapter lead for FuturePhysicians.org." },
];

test("organization questions receive organization knowledge without unrelated personal facts", () => {
  const routed = routeFuturePhysiciansEvidence({ label: "What will your organization do with the grant money?" }, memberEvidence, futurePhysiciansEvidence);
  assert.ok(routed.some((item) => item.id.startsWith("fp_org_")));
  assert.ok(routed.some((item) => item.id === "member_fp_role"));
  assert.ok(!routed.some((item) => item.id === "member_email"));
});

test("member contribution questions never receive organization-wide evidence", () => {
  const routed = routeFuturePhysiciansEvidence({ label: "What was your contribution to FuturePhysicians.org?" }, memberEvidence, futurePhysiciansEvidence);
  assert.deepEqual(routed.map((item) => item.id), ["member_email", "member_fp_role"]);
  assert.ok(!routed.some((item) => item.id.startsWith("fp_org_")));
});

test("approved grant presets keep unresolved details visible", () => {
  const useOfFunds = futurePhysiciansTemplates.find((item) => item.id === "use_of_funds");
  assert.match(useOfFunds?.template || "", /\[\[LOCATION\]\]/);
  assert.match(useOfFunds?.template || "", /\[\[REQUESTED_AMOUNT\]\]/);
  assert.match(useOfFunds?.template || "", /\[\[MEASURABLE_OUTCOME\]\]/);
});

test("Drive-verified Future Physicians knowledge includes grant-ready impact and compliance facts", () => {
  assert.equal(futurePhysiciansEvidence.some((item) => /3,000 students/i.test(item.statement)), true);
  assert.equal(futurePhysiciansEvidence.some((item) => /825 registrations/i.test(item.statement)), true);
  assert.equal(futurePhysiciansEvidence.some((item) => /\$17,700/i.test(item.statement)), true);
  assert.equal(futurePhysiciansEvidence.some((item) => /fiscal sponsorship through Hack Club Bank/i.test(item.statement)), true);
  assert.equal(futurePhysiciansEvidence.some((item) => /not unrestricted Future Physicians operating revenue/i.test(item.statement)), true);
});

test("organization evidence selection brings funding facts to grant prompts and event facts to event prompts", () => {
  const funding = selectFuturePhysiciansOrganizationEvidence({ label: "What will grant funding be used for?" });
  assert.ok(funding.some((item) => item.id === "fp_org_funding_1"));
  assert.ok(funding.some((item) => item.id === "fp_org_fiscal_sponsorship"));
  const event = selectFuturePhysiciansOrganizationEvidence({ label: "Describe the impact of your most recent event." });
  assert.ok(event.some((item) => item.id === "fp_org_event"));
  assert.ok(event.some((item) => item.id === "fp_org_students_served"));
});

test("grant plans keep the $500k workforce support distinct from proposed events and recognition-only awards", () => {
  const workforce = futurePhysiciansEvidence.find((item) => item.id === "fp_org_public_workforce_support");
  const plan = futurePhysiciansEvidence.find((item) => item.id === "fp_org_grant_tier_plan");
  const recognition = futurePhysiciansTemplates.find((item) => item.id === "award_recognition");
  assert.match(workforce?.statement || "", /not unrestricted Future Physicians operating revenue/i);
  assert.match(plan?.statement || "", /\$3,000 or more/i);
  assert.match(plan?.statement || "", /future/i);
  assert.match(recognition?.template || "", /documented recognition/i);
  assert.match(recognition?.template || "", /not a request for grant funding/i);
});

test("extension defaults to the FuturePhysicians organization scope while keeping member contributions separate", () => {
  const sidepanel = readFileSync(new URL("../extension/sidepanel.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../extension/sidepanel.js", import.meta.url), "utf8");
  assert.match(sidepanel, /id="organizationMode"[^>]*checked/);
  assert.match(sidepanel, /FuturePhysicians grant or award application/);
  assert.match(script, /organizationApplication: true/);
  assert.match(script, /organizationApplication: state\.organizationApplication/);
});
