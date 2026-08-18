import assert from "node:assert/strict";
import test from "node:test";
import { bestInstitution, extractCriticalResumeFacts, extractResumeEvidence, extractResumeProfile } from "../lib/resume-intelligence.js";

const resumes = [
  {
    name: "high-school researcher",
    text: `Avery Patel\navery@example.edu\nEDUCATION\nAmerican Leadership Academy, Queen Creek, AZ | Expected May 2027\n2026–27 Coursework: AP Calculus BC, AP Physics C: Mechanics, AP Statistics\nRESEARCH EXPERIENCE\nResearch Intern | Computational Genomics & Bioinformatics\nAnalyzed DNA methylation datasets to study immune-cell signatures in autoimmune disease.\nLEADERSHIP\nFounded a five-student Bioinformatics Club and coordinated weekly research workshops.\nAWARDS & HONORS\nNCWIT Aspirations in Computing Honorable Mention\nUSACO Silver`,
    expectedInstitution: "American Leadership Academy",
    expectedCategories: ["Research experience", "Leadership", "Award or distinction"],
  },
  {
    name: "college engineer",
    text: `Jordan Kim\nEDUCATION\nUniversity of Washington, B.S. Computer Science, 2026\nEXPERIENCE\nSoftware Engineering Intern at City Transit Lab\nPROJECTS\nBuilt an accessible route-planning application used in a pilot with 120 riders.\nCOMMUNITY SERVICE\nVolunteered weekly as a coding mentor for first-generation high-school students.`,
    expectedInstitution: "University of Washington",
    expectedCategories: ["Project or impact", "Community contribution"],
  },
  {
    name: "community organizer",
    text: `Maya Torres\nEDUCATION\nMesa Community College, A.A. Public Policy\nLEADERSHIP\nOrganized a tenant-rights clinic with 24 volunteers and coordinated monthly outreach.\nAWARDS\nCommunity Changemaker Award, 2025`,
    expectedInstitution: "Mesa Community College",
    expectedCategories: ["Leadership", "Award or distinction"],
  },
  {
    name: "creative portfolio",
    text: `Noah Williams\nEDUCATION\nSchool of the Art Institute of Chicago, BFA, 2024\nPROJECTS\nDesigned and produced an interactive installation on neighborhood memory.\nHONORS\n2024 Emerging Artist Finalist`,
    expectedInstitution: "School of the Art Institute of Chicago",
    expectedCategories: ["Project or impact", "Award or distinction"],
  },
  {
    name: "early career scientist",
    text: `Priya Raman\nEDUCATION\nArizona State University, B.S. Biological Sciences, 2023\nPROFESSIONAL EXPERIENCE\nLaboratory Assistant, Desert Health Institute\nRESEARCH\nPresented a poster on wastewater surveillance at the 2025 Public Health Symposium.`,
    expectedInstitution: "Arizona State University",
    expectedCategories: ["Professional experience", "Research experience"],
  },
];

for (const resume of resumes) {
  test(`extracts usable structured evidence from ${resume.name}`, () => {
    const evidence = extractResumeEvidence(resume.text);
    assert.match(bestInstitution(evidence), new RegExp(resume.expectedInstitution));
    for (const category of resume.expectedCategories) {
      assert.ok(evidence.some((item) => item.category === category), `expected ${category}`);
    }
  });
}

test("never treats coursework as the primary institution", () => {
  const evidence = extractResumeEvidence(resumes[0].text);
  assert.doesNotMatch(bestInstitution(evidence), /Coursework/i);
});

test("preserves short identity and contact lines that experience parsing used to drop", () => {
  const text = `Maya Patel\nmaya.patel@example.test | +1 (480) 555-0188 | https://linkedin.com/in/mayapatel\nEDUCATION\nNorth Valley High School | 11th grade | Expected May 2027`;
  const profile = extractResumeProfile(text);
  assert.equal(profile.name, "Maya Patel");
  assert.equal(profile.email, "maya.patel@example.test");
  assert.equal(profile.phone, "+1 (480) 555-0188");
  assert.equal(profile.gradeLevel, "11th grade");
  assert.equal(profile.graduationYear, "2027");
  const facts = extractCriticalResumeFacts(text);
  assert.ok(facts.some((fact) => fact.category === "Identity"));
  assert.ok(facts.some((fact) => fact.category === "Contact details" && /maya\.patel/.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Contact details" && /555-0188/.test(fact.statement)));
  assert.ok(facts.some((fact) => fact.category === "Links & profiles"));
});

test("recovers narrative categories when a PDF keeps education active across columns", () => {
  const evidence = extractResumeEvidence(`EDUCATION\nNorth Valley High School\n\nResearch Intern\nConducted laboratory research in computational biology and analyzed genomic data.\n\nPresident\nLed a student organization and organized community workshops.`);
  assert.ok(evidence.some((item) => item.category === "Research experience"));
  assert.ok(evidence.some((item) => item.category === "Leadership"));
});

test("reconstructs sections from flattened PDF text", () => {
  const evidence = extractResumeEvidence("Jordan Lee EDUCATION North Valley High School RESEARCH EXPERIENCE Research Intern Conducted laboratory research in computational biology and analyzed genomic data. LEADERSHIP President Led a student organization and organized community workshops.");
  assert.ok(evidence.some((item) => item.category === "Research experience"));
  assert.ok(evidence.some((item) => item.category === "Leadership"));
});

test("uses section context over misleading school and award keywords", () => {
  const evidence = extractResumeEvidence(`AMERICAN LEADERSHIP ACADEMY\nAWARDS & HONORS\nHigh School Innovation Award, 2026\nRESEARCH EXPERIENCE\nIndependent research project: built a methylation analysis workflow and validated results across two cohorts.\nLEADERSHIP\nPresident, FuturePhysicians.org: scaled funding to $400,000 and coordinated 3,000 shadowing opportunities.`);
  assert.ok(evidence.some((item) => item.category === "Education" && /Leadership Academy/i.test(item.statement)));
  assert.ok(evidence.some((item) => item.category === "Award or distinction" && /Innovation Award/.test(item.statement)));
  const research = evidence.find((item) => item.category === "Research experience");
  const leadership = evidence.find((item) => item.category === "Leadership");
  assert.match(research?.statement || "", /methylation analysis workflow/);
  assert.match(leadership?.statement || "", /400,000/);
});

test("keeps research methods, results, and leadership impact through broken PDF line wraps", () => {
  const evidence = extractResumeEvidence(`RESEARCH EXPERIENCE
Research Intern | Genomics Lab
Developed ancestry inference pipelines across large-scale genomic datasets.
Independent Research
Auto-Methyl Project
Built a multi-stage methylation workflow using Gate
A and disease-specific classifiers. Achieved Gate-A AUC 0.813.
Pneumonia Methylation Project
Improved classification performance from AUC 0.53 to 0.83.
LEADERSHIP
President | Student Health Network
Scaled funding to $400,000, distributed 3,000 opportunities, and onboarded 400 interns.`);
  const research = evidence.filter((item) => item.category === "Research experience").map((item) => item.statement).join(" ");
  const leadership = evidence.find((item) => item.category === "Leadership")?.statement || "";
  assert.match(research, /ancestry inference pipelines/);
  assert.match(research, /Gate-A AUC 0.813/);
  assert.match(research, /Pneumonia Methylation Project/);
  assert.match(leadership, /400,000/);
  assert.match(leadership, /3,000 opportunities/);
});
