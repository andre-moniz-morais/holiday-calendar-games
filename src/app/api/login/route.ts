import crypto from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/server/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/server/session";
import type { PlayerId } from "@/lib/players";

function check(password: string, stored: string): boolean {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = crypto.scryptSync(password.trim().toLowerCase(), Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password.trim()) return Response.json({ error: "Escreve a palavra-passe." }, { status: 400 });

  const players = await sql()<{ id: PlayerId; password_hash: string }[]>`select id, password_hash from players`;
  const match = players.find((p) => check(password, p.password_hash));
  if (!match) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "Palavra-passe errada. Tenta outra vez!" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(match.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json({ ok: true, player: match.id });
}
