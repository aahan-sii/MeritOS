import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Run `npx vercel env pull .env.local --environment=production` first.",
  );
}

const database = drizzle(neon(process.env.DATABASE_URL));
await migrate(database, { migrationsFolder: "./drizzle-postgres" });
console.log("MeritOS database migrations applied successfully.");
