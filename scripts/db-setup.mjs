// Creates the tables and (re)seeds the two players.
// Usage: npm run db:setup   (reads DATABASE_URL from the environment / .env.local)
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { prepare: false, onnotice: () => {} });

const ROOT = path.resolve(import.meta.dirname, "..");
await sql.unsafe(await fs.readFile(path.join(ROOT, "db/schema.sql"), "utf8"));

// Passwords are case-insensitive (phones love to auto-capitalise).
function hash(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password.trim().toLowerCase(), salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

const players = [
  { id: "duda", name: "Duda", password: process.env.PASSWORD_DUDA ?? "Duda" },
  { id: "filipino", name: "Filipino", password: process.env.PASSWORD_FILIPINO ?? "Filipino" },
];
for (const p of players) {
  await sql`
    insert into players (id, display_name, password_hash) values (${p.id}, ${p.name}, ${hash(p.password)})
    on conflict (id) do update set display_name = excluded.display_name, password_hash = excluded.password_hash`;
}
console.log("✓ schema applied, players seeded:", players.map((p) => p.id).join(", "));
await sql.end();
