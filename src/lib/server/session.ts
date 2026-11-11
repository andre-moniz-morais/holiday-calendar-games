import { SignJWT, jwtVerify } from "jose";
import { isPlayerId, type PlayerId } from "@/lib/players";

export const SESSION_COOKIE = "natal_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 120; // 120 days — log in once, play all December

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing or too short");
  return new TextEncoder().encode(secret);
}

export async function signSession(player: PlayerId): Promise<string> {
  return new SignJWT({ p: player })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined | null): Promise<PlayerId | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return isPlayerId(payload.p) ? payload.p : null;
  } catch {
    return null;
  }
}
