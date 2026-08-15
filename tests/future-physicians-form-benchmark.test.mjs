import assert from "node:assert/strict";
import test from "node:test";

await import("../extension/form-core.js");
await import("../extension/intelligence.js");

const { questionIntent } = globalThis.MeritOSIntelligence;

// Applicant-facing question schemas from four Future Physicians response forms.
// Response rows and uploaded files are deliberately excluded: this benchmark contains no applicant PII.
const cases = [
  ["Full Name", "name"],
  ["Email", "email", "email"],
  ["Grade Level", "grade_level"],
  ["Position (Can select multiple)", "role_preference"],
  ["What is your maximum time commitment weekly? (In Hours)", "time_commitment"],
  ["Where are you based?", "location"],
  ["What will you bring to Future Physicians?", "contribution"],
  ["What ideas do you have for Future Physicians to grow and how will you execute them?", "growth_ideas"],
  ["Describe your top 3 extracurriculars", "extracurriculars"],
  ["What relevant experience do you have to this role(s)?", "experience"],
  ["List dates and times you are available for an interview", "availability"],
  ["Submit Your Resume", "resume_upload", "file"],
  ["How Did You Find Us?", "referral_source"],
  ["Ranked Your Position Choices in Order", "role_preference"],
  ["Who referred you?", "referral_source"],

  ["Full Name ", "name"],
  ["Email Address", "email", "email"],
  ["Phone Number (optional)", "phone", "tel"],
  ["Grade and Age", "grade_and_age"],
  ["School or Organization Name", "institution"],
  ["Location (City, State)", "location"],
  ["Social Media Handles", "social_profile"],
  ["Why do you want to be an ambassador? Tell us why you’re interested and what motivates you to join.", "motivation"],
  ["What outreach methods do you plan to use to get students signed up?", "outreach_strategy"],
  ["How many students do you think you can help sign up per week?", "signup_estimate"],
  ["What skills or experiences do you have that would help you as an ambassador?", "skills"],
  ["Are you interested in starting your own club or chapter?", "club_interest"],
  ["How many hours per week can you commit?", "time_commitment"],
  ["Describe a previous leadership experience you've had before", "leadership"],
  ["What ideas do you have for promoting our mission or growing the ambassador program?", "growth_ideas"],
  ["Do you have any questions or concerns?", "other_questions"],
  ["Where did you find this opportunity?", "referral_source"],

  ["Email Address", "email", "email"],
  ["Full Name", "name"],
  ["Email", "email", "email"],
  ["City, State, Country", "location"],
  ["High School or College", "institution"],
  ["Grade Level", "grade_level"],
  ["Do you have any previous experience in fundraising? If you do, describe the experience.", "community"],
  ["What ideas do you have to bring to Future Physicians' fundraising department or the organization in general?", "growth_ideas"],
  ["How many hours can you contribute per week?", "time_commitment"],
  ["Resume", "resume_upload", "file"],
  ["Please include a list of dates and times when you would be available for an interview, including your timezone.", "availability"],
  ["Any questions?", "other_questions"],
  ["What experience do you have in writing in response to prompts? (essays, etc.)", "writing_experience"],
  ["Previous Writing Work", "writing_sample"],
  ["Phone Number", "phone", "tel"],
  ["Who is interviewing?", "third_party_name"],

  ["What is you name?", "name"],
  ["What is your email?", "email", "email"],
  ["What type of intern did you sign up to be?", "role_preference"],
  ["Who is your provider?", "provider"],
];

test("routes at least 98% of privacy-safe Future Physicians form schemas correctly", () => {
  const results = cases.map(([label, expected, type = "text"]) => ({ label, expected, actual: questionIntent({ label, type, name: "" }) }));
  const failures = results.filter((item) => item.actual !== item.expected);
  const accuracy = (results.length - failures.length) / results.length;
  assert.ok(accuracy >= 0.98, `intent accuracy ${(accuracy * 100).toFixed(1)}%; failures: ${JSON.stringify(failures)}`);
});

test("uses verified evidence for high-recall fields but preserves explicit-decision boundaries", () => {
  const claims = [
    { category: "Identity", statement: "Maya Patel" },
    { category: "Contact details", statement: "Email: maya@example.test" },
    { category: "Contact details", statement: "Phone: (480) 555-0199" },
    { category: "Education", statement: "Desert Vista High School, Phoenix, AZ | 11th grade | expected graduation 2027" },
    { category: "Skills or certification", statement: "Python, public speaking, event planning, and social media outreach" },
    { category: "Leadership", statement: "Led a health careers club and recruited 40 students through school presentations." },
    { category: "Location & availability", statement: "Availability: Tuesday and Thursday after 4 PM; 6 hours per week" },
  ];
  const identity = { displayName: "Maya Patel", email: "maya@example.test" };
  const suggest = (label, type = "text") => globalThis.MeritOSIntelligence.suggest({ label, type, maxLength: 1200 }, claims, identity);

  assert.match(suggest("What skills or experiences do you have that would help you as an ambassador?", "textarea").text, /Python|public speaking|event planning/i);
  assert.match(suggest("How many hours per week can you commit?").text, /6 hours per week/i);
  assert.match(suggest("List dates and times you are available for an interview").text, /Tuesday and Thursday/i);
  assert.equal(suggest("Who referred you?").text, "");
  assert.equal(suggest("Position (Can select multiple)").text, "");
  assert.equal(suggest("Submit Your Resume", "file").text, "");
});
