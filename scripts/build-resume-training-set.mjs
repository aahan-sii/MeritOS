import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateSyntheticResumeCases } from "./synthetic-resume-corpus.mjs";

const countArg = process.argv.find((arg) => arg.startsWith("--count="));
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const count = Math.max(100, Math.min(100_000, Number(countArg?.split("=")[1] || 10_000)));
const output = resolve(outputArg?.split("=")[1] || "training/resume-extraction-10000.jsonl");
const cases = generateSyntheticResumeCases(count);
const system = [
  "Extract a truthful structured applicant profile from resume text.",
  "Preserve exact identity, email, phone, institution, education level, graduation year, and experience evidence.",
  "Group each role or project with its bullets. Support research, employment, startups, nonprofit work, teaching, service, trades, athletics, and creative work equally.",
  "Return JSON only. Never invent missing facts.",
].join(" ");
const lines = cases.map((item) => JSON.stringify({
  messages: [
    { role: "system", content: system },
    { role: "user", content: item.text },
    { role: "assistant", content: JSON.stringify({
      identity: { name: item.expected.name, email: item.expected.email, phone: item.expected.phone },
      education: { institution: item.expected.school, gradeLevel: item.expected.gradeLevel, graduationYear: item.expected.graduationYear },
      experiences: [{ category: item.expected.category, statement: item.expected.experience }],
    }) },
  ],
}));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${lines.join("\n")}\n`, "utf8");
console.log(`Created ${lines.length.toLocaleString()} synthetic training examples at ${output}`);
