import { bestOf, isGameId } from "@/lib/games";
import { sql } from "@/lib/server/db";
import { SCHEDULE } from "@/lib/server/schedule";
import { canSubmitForDay, currentPlayer, today } from "@/lib/server/state";
import type { PlayResult } from "@/lib/api-types";

const MAX_SCORE = 100_000;

export async function POST(request: Request) {
  const me = await currentPlayer();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const gameId = body?.gameId;
  const day = body?.day === null ? null : Number(body?.day);
  const score = Number(body?.score);
  const durationMs = Math.max(0, Math.min(3_600_000, Math.round(Number(body?.durationMs) || 0)));

  if (!isGameId(gameId)) return Response.json({ error: "Jogo desconhecido." }, { status: 400 });
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return Response.json({ error: "Pontuação inválida." }, { status: 400 });

  if (day === null) {
    // Free play — only after the calendar is over; stored but never counts for a day.
    if (today() < 25) return Response.json({ error: "Os jogos livres só abrem no dia 25." }, { status: 403 });
  } else {
    if (!Number.isInteger(day) || !SCHEDULE[day]) return Response.json({ error: "Dia inválido." }, { status: 400 });
    if (SCHEDULE[day] !== gameId) return Response.json({ error: "Este não é o jogo deste dia." }, { status: 400 });
    if (!canSubmitForDay(day)) return Response.json({ error: "Este dia já fechou — a pontuação não conta." }, { status: 403 });
  }

  const db = sql();
  const previous = await db<{ score: number }[]>`
    select score from plays where player_id = ${me} and game_id = ${gameId} and day is not distinct from ${day}`;
  const prevBest = bestOf(gameId, previous.map((r) => r.score));

  await db`insert into plays (player_id, day, game_id, score, duration_ms) values (${me}, ${day}, ${gameId}, ${score}, ${durationMs})`;

  const best = bestOf(gameId, [...previous.map((r) => r.score), score])!;
  const result: PlayResult = {
    ok: true,
    best,
    isRecord: prevBest === null || best !== prevBest,
    plays: previous.length + 1,
  };
  return Response.json(result);
}
