import assert from "node:assert/strict";
import test from "node:test";
import { bestInstitution, extractResumeEvidence } from "../lib/resume-intelligence.js";

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
