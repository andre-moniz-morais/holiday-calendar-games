import { SCHEDULE } from "@/lib/server/schedule";
import { canPeek, currentPlayer } from "@/lib/server/state";

/** Sneak peek at a locked door's game — only before 1 Dec 2026. */
export async function GET(request: Request) {
  const me = await currentPlayer();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!canPeek()) return Response.json({ error: "A espreitadela acabou — agora só dia a dia!" }, { status: 403 });
  const day = Number(new URL(request.url).searchParams.get("day"));
  const gameId = SCHEDULE[day];
  if (!gameId) return Response.json({ error: "Dia inválido." }, { status: 400 });
  return Response.json({ day, gameId }, { headers: { "Cache-Control": "no-store" } });
}
