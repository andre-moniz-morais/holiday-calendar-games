import "server-only";
import postgres from "postgres";

declare global {
  var __natalSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    // Works with poolers in transaction mode (Neon, Supabase, PgBouncer).
    prepare: false,
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });
}

/** Lazily-created singleton (survives hot reloads in dev). */
export function sql() {
  if (!globalThis.__natalSql) globalThis.__natalSql = create();
  return globalThis.__natalSql;
}
