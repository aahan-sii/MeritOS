import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractCriticalResumeFacts, extractResumeEvidence, extractResumeProfile } from "../lib/resume-intelligence.js";
import { textSimilarity } from "../lib/ai-drafting-core.js";

await import("../extension/form-core.js");
await import("../extension/intelligence.js");

const corpusPath = resolve(process.argv[2] || ".meritos-private-eval/consented-resume-pairs.json");
const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const digits = (value) => String(value || "").replace(/\D+/g, "");
const nameTokens = (value) => String(value || "").toLowerCase().match(/[a-z]+/g) || [];
const contactEqual = (field, actual, expected) => {
  if (field === "phone") {
    const actualDigits = digits(actual);
    const expectedDigits = digits(expected);
    return actualDigits.length >= 10
      && expectedDigits.length >= 10
      && actualDigits.slice(-10) === expectedDigits.slice(-10);
  }
  if (field === "name") {
    const actualTokens = nameTokens(actual);
    const expectedTokens = nameTokens(expected);
    if (actualTokens.length < 2 || expectedTokens.length < 2) return false;
    const actualSet = new Set(actualTokens);
    const expectedSet = new Set(expectedTokens);
    return expectedTokens.every((token) => actualSet.has(token))
      || actualTokens.every((token) => expectedSet.has(token));
  }
  return normalize(actual) === normalize(expected);
};
const contactFields = ["name", "email", "phone"];
const failures = [];
const contact = Object.fromEntries(contactFields.map((field) => [field, { correct: 0, total: 0, present: 0, correctWhenPresent: 0 }]));
let experienceAligned = 0;
let experienceTotal = 0;
let evidenceRecords = 0;

for (const record of corpus.records || []) {
  const profile = extractResumeProfile(record.resumeText);
  const evidence = [...extractCriticalResumeFacts(record.resumeText), ...extractResumeEvidence(record.resumeText)];
  if (evidence.length) evidenceRecords += 1;
  for (const field of contactFields) {
    if (!record.expected?.[field]) continue;
    contact[field].total += 1;
    const isPresent = field === "phone"
      ? digits(record.resumeText).includes(digits(record.expected[field]).slice(-10))
      : normalize(record.resumeText).includes(normalize(record.expected[field]));
    const isCorrect = contactEqual(field, profile[field], record.expected[field]);
    if (isPresent) contact[field].present += 1;
    if (isCorrect) contact[field].correct += 1;
    if (isPresent && isCorrect) contact[field].correctWhenPresent += 1;
    else if (isPresent) failures.push({ id: record.id, metric: field });
  }

  const submittedExperience = record.submitted?.relatedExperience || "";
  if (submittedExperience.length >= 30) {
    experienceTotal += 1;
    const best = evidence.reduce((score, item) => Math.max(score, textSimilarity(submittedExperience, item.statement)), 0);
    if (best >= 0.18) experienceAligned += 1;
    else failures.push({ id: record.id, metric: "experience_alignment" });
  }
}

const sum = Object.values(contact).reduce((acc, item) => ({
  correctWhenPresent: acc.correctWhenPresent + item.correctWhenPresent,
  present: acc.present + item.present,
  total: acc.total + item.total,
}), { correctWhenPresent: 0, present: 0, total: 0 });
const percentage = (correct, total) => total ? Number((correct / total * 100).toFixed(2)) : null;
const report = {
  consentedDeidentifiedRecords: corpus.records?.length || 0,
  contactExtraction: Object.fromEntries(Object.entries(contact).map(([field, value]) => [field, {
    ...value,
    rawResumeCoverage: percentage(value.present, value.total),
    accuracyWhenPresent: percentage(value.correctWhenPresent, value.present),
  }])),
  resumeOnlyContactCoverage: percentage(sum.present, sum.total),
  extractorAccuracyWhenPresent: percentage(sum.correctWhenPresent, sum.present),
  evidenceRecordCoverage: percentage(evidenceRecords, corpus.records?.length || 0),
  submittedExperienceAlignment: { correct: experienceAligned, total: experienceTotal, accuracy: percentage(experienceAligned, experienceTotal) },
  failureCounts: failures.reduce((counts, failure) => ({ ...counts, [failure.metric]: (counts[failure.metric] || 0) + 1 }), {}),
  failingRecordIds: [...new Set(failures.map((failure) => failure.id))],
};

console.log(JSON.stringify(report, null, 2));
