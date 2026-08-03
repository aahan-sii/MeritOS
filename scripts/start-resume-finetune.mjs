import { createReadStream, existsSync } from "node:fs";
import OpenAI from "openai";

const confirmed = process.argv.includes("--confirm-cost");
const dataset = process.argv.find((arg) => arg.startsWith("--dataset="))?.split("=")[1] || "training/resume-extraction-10000.jsonl";
if (!confirmed) throw new Error("Fine-tuning may incur API charges. Re-run with --confirm-cost after reviewing the generated JSONL dataset.");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
if (!existsSync(dataset)) throw new Error(`Dataset not found: ${dataset}. Run npm run training:build first.`);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const uploaded = await client.files.create({ file: createReadStream(dataset), purpose: "fine-tune" });
const job = await client.fineTuning.jobs.create({
  training_file: uploaded.id,
  model: process.env.OPENAI_FINE_TUNE_BASE_MODEL || "gpt-4o-mini-2024-07-18",
  suffix: "meritos-resume-extractor",
});
console.log(JSON.stringify({ jobId: job.id, status: job.status, trainingFile: uploaded.id }, null, 2));
console.log("When the job succeeds, set OPENAI_EXTRACTION_FINE_TUNED_MODEL to the returned fine_tuned_model ID and redeploy.");
