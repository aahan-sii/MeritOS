import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Run `npx vercel env pull .env.local --environment=production` first.",
  );
}

export default defineConfig({
  out: "./drizzle-postgres",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
