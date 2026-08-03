import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateSyntheticApplicationCases } from "./synthetic-form-corpus.mjs";

const countArg = process.argv.find((arg) => arg.startsWith("--count="));
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const count = Math.max(100, Math.min(100_000, Number(countArg?.split("=")[1] || 10_000)));
const output = resolve(outputArg?.split("=")[1] || "training/form-answering-10000.jsonl");
const cases = generateSyntheticApplicationCases(count);
const system = "Answer the application field using only the verified applicant profile. Select the evidence that matches the exact question. Never substitute applicant contact details for a third party and never invent unsupported facts. Return JSON only.";
const lines = [];
for (const fixture of cases) {
  for (const field of fixture.fields) {
    const answer = field.expected || fixture.claims.find((claim) => claim.statement.includes(field.expectedContains || "__never__"))?.statement || "";
    lines.push(JSON.stringify({ messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ field, verifiedProfile: fixture.claims }) },
      { role: "assistant", content: JSON.stringify({ answer, supported: Boolean(answer) }) },
    ] }));
  }
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${lines.join("\n")}\n`, "utf8");
console.log(`Created ${lines.length.toLocaleString()} synthetic form-answering examples at ${output}`);
