import { extractCriticalResumeFacts, extractResumeEvidence } from "../lib/resume-intelligence.js";
import { generateSyntheticResumeCases } from "./synthetic-resume-corpus.mjs";

function narrativePrompt(fixture) {
  const persona = fixture.metadata.persona;
  if (/RESEARCH|PUBLICATION/.test(persona)) return "Describe your most relevant research experience.";
  if (/ENTREPRENEUR/.test(persona)) return "Describe a startup or venture you founded.";
  if (/NONPROFIT/.test(persona)) return "Describe your nonprofit experience and contribution.";
  if (/TEACHING/.test(persona)) return "Describe your teaching experience.";
  if (/CREATIVE/.test(persona)) return "Discuss a creative portfolio piece.";
  if (/PROJECT/.test(persona)) return "Describe a project and the impact it created.";
  if (/LEADERSHIP|ATHLETICS/.test(persona)) return "Give an example of leadership or initiative.";
  if (/COMMUNITY/.test(persona)) return "How have you contributed to your community?";
  if (/AWARD/.test(persona)) return "List an award, achievement, or distinction.";
  return "Summarize your most relevant professional work experience.";
}

export function generateSyntheticApplicationCases(count = 10_000) {
  return generateSyntheticResumeCases(count).map((fixture) => {
    const claims = [...extractCriticalResumeFacts(fixture.text), ...extractResumeEvidence(fixture.text)].map((fact, index) => ({
      id: `${fixture.id}-claim-${index}`,
      category: fact.category,
      statement: fact.statement,
    }));
    return {
      id: fixture.id.replace("resume", "application"),
      identity: { displayName: "", email: "" },
      claims,
      fields: [
        { label: "Full legal name", type: "text", expected: fixture.expected.name },
        { label: "Applicant email address", type: "email", expected: fixture.expected.email },
        { label: "Mobile phone number", type: "tel", expected: fixture.expected.phone },
        { label: "Current school, institution, or organization", type: "text", expected: fixture.expected.school },
        { label: "Expected graduation year", type: "select", options: ["2027", "2028", "2029"].map((label) => ({ label })), expected: fixture.expected.graduationYear },
        { label: "Current grade level", type: "select", options: ["9th grade", "10th grade", "11th grade", "12th grade"].map((label) => ({ label })), expected: fixture.expected.gradeLevel },
        { label: narrativePrompt(fixture), type: "textarea", expectedContains: fixture.expected.experience.split(" ")[0] },
      ],
      metadata: fixture.metadata,
    };
  });
}
