import { readdir } from "node:fs/promises";
import path from "node:path";
import { currentPlayer } from "@/lib/server/state";

const AUDIO = /\.(mp3|m4a|mp4|aac|ogg|oga|opus|webm|wav|flac)$/i;

/** Lists the background music in `public/music/` (drop files there and redeploy). */
export async function GET() {
  const me = await currentPlayer();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "music");
  const files = await readdir(dir).catch(() => [] as string[]);
  const tracks = files
    .filter((f) => AUDIO.test(f) && !f.startsWith("."))
    .sort()
    .map((f) => `/music/${encodeURIComponent(f)}`);
  return Response.json({ tracks }, { headers: { "Cache-Control": "no-store" } });
}
