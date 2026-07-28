import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is unavailable. Connect a Postgres database in Vercel and add its DATABASE_URL environment variable."
    );
  }

  return drizzle(neon(connectionString), { schema });
}
