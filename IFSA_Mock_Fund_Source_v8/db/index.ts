import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeEnv = { DB?: D1Database };

function runtimeEnv(): RuntimeEnv {
  return (globalThis as typeof globalThis & { __IFSA_RUNTIME_ENV__?: RuntimeEnv }).__IFSA_RUNTIME_ENV__ ?? {};
}

export function getDb() {
  const env = runtimeEnv();
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1() {
  const env = runtimeEnv();
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  return env.DB;
}
