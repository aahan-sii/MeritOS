import type { DraftEvidence, DraftField } from "./ai-drafting";

export const futurePhysiciansKnowledge = {
  organizationName: "FuturePhysicians.org",
  status: "drive_verified" as const,
  summary:
    "Future Physicians is a student-led nonprofit founded in July 2024. Its mission is to make healthcare education and experiences accessible so that students are not blocked from medicine by money or connections.",
  sourceDocuments: [
    { title: "Overall Stats", updated: "2026-08-18", url: "https://docs.google.com/document/d/16Wh9phu0m6mmgyE9dzgDA3ww6yzocfi58e5e6nZTcpI/edit" },
    { title: "Everything About FP", updated: "2026-02-07", url: "https://docs.google.com/document/d/1vEeVCoLU4_Z151t649te1uwvhStDoj7d1VhDdZJcXuA/edit" },
    { title: "Award Applications", updated: "2026-07-15", url: "https://docs.google.com/document/d/1nIAC5fyHHFDyZIZw36kpVvG3znDv2XAusrxsNgaDCLc/edit" },
  ],
  fundingUses: [
    "For eligible grant awards of $3,000 or more, plan a virtual healthcare seminar modeled on Future Physicians' prior online summit, with the final scope determined by the award terms and budget.",
    "Where grant rules and available funding allow, plan a local in-person healthcare event with speakers, school representatives, and student presentations.",
    "Support event planning, outreach, and marketing.",
    "Pay for software, services, and subscriptions used to launch and stabilize chapters.",
    "Launch or strengthen chapters, including school-based leadership and student presentation opportunities, where the funding rules allow it.",
    "Use confirmed partner contributions, free services, or event participation only after the partner has agreed; potential partners must not be presented as confirmed.",
  ],
  awardPurpose:
    "Award applications should seek recognition for Future Physicians' documented accomplishments without inventing impact, reach, outcomes, or unconfirmed partnerships.",
};

export const futurePhysiciansEvidence: DraftEvidence[] = [
  {
    id: "fp_org_identity",
    category: "FuturePhysicians organization",
    statement: futurePhysiciansKnowledge.summary,
  },
  {
    id: "fp_org_audience",
    category: "FuturePhysicians audience",
    statement: "Future Physicians connects high school and college students, especially students from underserved and underrepresented backgrounds, to healthcare opportunities.",
  },
  {
    id: "fp_org_programs",
    category: "FuturePhysicians programs",
    statement: "Future Physicians provides pathways through clinical shadowing, research, volunteering, internships, mentorship, workshops, healthcare fairs, symposiums, and application guidance.",
  },
  {
    id: "fp_org_access_model",
    category: "FuturePhysicians program model",
    statement: "Future Physicians' model is free to students and combines planning, tailored opportunity matches, hands-on experience, and mentorship.",
  },
  {
    id: "fp_org_students_served",
    category: "FuturePhysicians impact",
    statement: "Future Physicians' current impact record reports serving more than 3,000 students across more than 40 countries.",
  },
  {
    id: "fp_org_interns",
    category: "FuturePhysicians impact",
    statement: "Future Physicians' current impact record reports managing hundreds of youth interns.",
  },
  {
    id: "fp_org_event",
    category: "FuturePhysicians events",
    statement: "The Future Physicians Global Health Summit recorded 825 registrations, 475 attendees, and representation from 47 countries.",
  },
  {
    id: "fp_org_chapters",
    category: "FuturePhysicians chapters",
    statement: "Future Physicians has documented an earlier network of approximately 16 chapters and approximately 40 ambassadors supporting outreach and recruitment.",
  },
  {
    id: "fp_org_reach",
    category: "FuturePhysicians outreach",
    statement: "Future Physicians' current impact record reports more than 12,000 TikTok followers, more than 15 million TikTok views, and more than 3,200 newsletter subscribers.",
  },
  {
    id: "fp_org_funding_history",
    category: "FuturePhysicians funding history",
    statement: "Future Physicians' current impact record reports more than $17,700 in direct grants and organizational funding, separate from documented or approved intern wage funding.",
  },
  {
    id: "fp_org_public_workforce_support",
    category: "FuturePhysicians funding history",
    statement: "Future Physicians has experience supporting a New York youth-workforce initiative with documented or approved intern wage funding exceeding $500,000; this is not unrestricted Future Physicians operating revenue.",
  },
  {
    id: "fp_org_fiscal_sponsorship",
    category: "FuturePhysicians compliance",
    statement: "Future Physicians operates with fiscal sponsorship through Hack Club Bank. Grant applications must use the fiscal sponsor's required legal wording and must not claim that Future Physicians is independently tax-exempt.",
  },
  {
    id: "fp_org_navigation_need",
    category: "FuturePhysicians program need",
    statement: "Future Physicians is developing a student-facing opportunity-navigation system to help students find credible opportunities, understand eligibility, prepare applications, and identify next steps.",
  },
  {
    id: "fp_org_grant_tier_plan",
    category: "FuturePhysicians grant plan",
    statement: "For eligible awards of $3,000 or more, Future Physicians plans to use a virtual healthcare seminar as a scalable default program format, with any in-person component dependent on the award terms, final budget, and location.",
  },
  {
    id: "fp_org_local_event_plan",
    category: "FuturePhysicians grant plan",
    statement: "A future local in-person event may include healthcare speakers, school representatives, and student presentations; these are planned program elements, not completed-event claims.",
  },
  {
    id: "fp_org_partner_contributions",
    category: "FuturePhysicians grant plan",
    statement: "Future Physicians may seek free event services, participation, or partnership support from organizations such as SkillUp only when those contributions are confirmed; unconfirmed partners must be described as prospective.",
  },
  ...futurePhysiciansKnowledge.fundingUses.map((statement, index) => ({
    id: `fp_org_funding_${index + 1}`,
    category: "FuturePhysicians use of funds",
    statement,
  })),
  {
    id: "fp_org_award_purpose",
    category: "FuturePhysicians award purpose",
    statement: futurePhysiciansKnowledge.awardPurpose,
  },
];

export const futurePhysiciansTemplates = [
  {
    id: "organization_overview",
    title: "Organization overview",
    purpose: "Describe FuturePhysicians.org and its work.",
    template:
      "FuturePhysicians.org is a nonprofit organization that [[PROGRAM_SUMMARY]]. We serve [[AUDIENCE]] through [[PROGRAMS_OR_SERVICES]]. During [[DATE_RANGE]], we [[VERIFIED_ACCOMPLISHMENT]], resulting in [[MEASURABLE_OUTCOME]].",
  },
  {
    id: "use_of_funds",
    title: "Grant use of funds",
    purpose: "Explain how requested funding will be used.",
    template:
      "FuturePhysicians.org will use the requested $[[REQUESTED_AMOUNT]] to [[GRANT_PLAN]]. For eligible awards of $3,000 or more, our default scalable format is a virtual healthcare seminar, informed by our prior Global Health Summit. If the award terms and budget allow, we may also deliver a local in-person event in [[LOCATION]] with speakers, school representatives, and student presentations. Funding will support event planning, outreach and marketing, required software or service subscriptions, and eligible chapter support. Success will be measured by [[MEASURABLE_OUTCOME]].",
  },
  {
    id: "event_plan",
    title: "Virtual or in-person event plan",
    purpose: "Adapt the event format to the funding available.",
    template:
      "Based on the available funding, FuturePhysicians.org will deliver a [[VIRTUAL_OR_IN_PERSON]] event in [[LOCATION_OR_PLATFORM]] during [[DATE_RANGE]]. The event will serve [[AUDIENCE]] and focus on [[EVENT_GOAL]]. A local format may include speakers, school representatives, and student presentations. Confirmed partners may provide services or participate at no cost; prospective partners will be labeled as prospective. Funds will cover [[ALLOWABLE_COSTS]], and we will evaluate the event using [[MEASURABLE_OUTCOME]].",
  },
  {
    id: "chapter_support",
    title: "Chapter launch and stabilization",
    purpose: "Describe support for a new or developing chapter.",
    template:
      "FuturePhysicians.org will use the funding to launch or stabilize a chapter in [[LOCATION]]. Support will include [[CHAPTER_RESOURCES]], software or service subscriptions, outreach, and [[OTHER_ALLOWABLE_SUPPORT]]. The chapter will aim to [[CHAPTER_GOAL]] by [[DATE]].",
  },
  {
    id: "award_recognition",
    title: "Award recognition statement",
    purpose: "Present documented organizational accomplishments for an award.",
    template:
      "FuturePhysicians.org is seeking recognition for [[VERIFIED_ACCOMPLISHMENT]]. Through [[PROGRAM_OR_INITIATIVE]], the organization [[VERIFIED_ACTION]] and achieved [[VERIFIED_OUTCOME]]. This award response is about documented recognition, not a request for grant funding or a promise of a future program.",
  },
];

function fieldText(field: DraftField) {
  return [field.label, field.description, field.name].filter(Boolean).join(" ").toLowerCase();
}

export function isFuturePhysiciansOrganizationQuestion(field: DraftField) {
  const text = fieldText(field);
  return /(?:organization|nonprofit|non-profit|mission|programs?|services?|community served|population served|organizational|use of (?:the )?funds|funding|grant money|budget|requested amount|chapter|event plan|award|accomplishments?|impact of (?:your|the) organization|futurephysicians)/i.test(text)
    && !isMemberContributionQuestion(field);
}

export function isMemberContributionQuestion(field: DraftField) {
  const text = fieldText(field);
  return /(?:your (?:role|contribution|experience|background|email|phone|name)|about yourself|tell us about you|applicant|personal statement|how (?:have|did) you contribute|what did you do)/i.test(text);
}

export function routeFuturePhysiciansEvidence(field: DraftField, memberEvidence: DraftEvidence[], organizationEvidence = futurePhysiciansEvidence) {
  if (isMemberContributionQuestion(field)) return memberEvidence.filter((item) => !item.id.startsWith("fp_org_"));
  if (isFuturePhysiciansOrganizationQuestion(field)) return [...organizationEvidence, ...memberEvidence.filter((item) => /futurephysicians/i.test(item.statement))];
  return memberEvidence.filter((item) => !item.id.startsWith("fp_org_"));
}

export function selectFuturePhysiciansOrganizationEvidence(field: DraftField, organizationEvidence = futurePhysiciansEvidence) {
  const text = fieldText(field);
  const ids = new Set<string>(["fp_org_identity", "fp_org_audience", "fp_org_programs"]);
  if (/fund|budget|cost|spend|money|financial|grant|sponsor|resource/i.test(text)) {
    ["fp_org_funding_history", "fp_org_funding_1", "fp_org_funding_2", "fp_org_funding_3", "fp_org_funding_4", "fp_org_funding_5", "fp_org_funding_6", "fp_org_grant_tier_plan", "fp_org_local_event_plan", "fp_org_partner_contributions", "fp_org_navigation_need", "fp_org_fiscal_sponsorship"].forEach((id) => ids.add(id));
  }
  if (/event|summit|conference|workshop|attend|registration/i.test(text)) {
    ["fp_org_event", "fp_org_students_served", "fp_org_funding_1", "fp_org_funding_2", "fp_org_grant_tier_plan", "fp_org_local_event_plan", "fp_org_partner_contributions"].forEach((id) => ids.add(id));
  }
  if (/award|impact|accomplish|recognition|outcome|reach|success/i.test(text)) {
    ["fp_org_students_served", "fp_org_interns", "fp_org_event", "fp_org_chapters", "fp_org_reach", "fp_org_funding_history"].forEach((id) => ids.add(id));
  }
  if (/chapter|ambassador/i.test(text)) {
    ["fp_org_chapters", "fp_org_funding_4", "fp_org_funding_5"].forEach((id) => ids.add(id));
  }
  return organizationEvidence.filter((item) => ids.has(item.id)).slice(0, 14);
}
