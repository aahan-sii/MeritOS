import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

async function getRuntimeEnv() {
  // Keep the Cloudflare-only module out of the Node test graph. It is resolved
  // lazily inside deployed API requests, where the Workers runtime provides it.
  const moduleName = "cloudflare:workers";
  return (await import(/* @vite-ignore */ moduleName)) as {
    env: { DB?: D1Database };
  };
}

export async function getDb() {
  const { env } = await getRuntimeEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
