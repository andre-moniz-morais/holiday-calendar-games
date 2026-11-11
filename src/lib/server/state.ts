import "server-only";
import { cookies } from "next/headers";
import { CALENDAR_YEAR, calendarDay, lisbonParts } from "@/lib/calendar";
import { bestOf, isBetter, GAMES, type GameId } from "@/lib/games";
import { PLAYER_IDS, type PlayerId } from "@/lib/players";
import type { AppState, DayState, GameBoard, WrappedStats, PerPlayer } from "@/lib/api-types";
import { sql } from "./db";
import { SCHEDULE, GAME_DAYS } from "./schedule";
import { SESSION_COOKIE, verifySession } from "./session";

export async function currentPlayer(): Promise<PlayerId | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Today's calendar day. DEV_TODAY lets you preview any day before December. */
export function today(now = new Date()): number {
  const dev = process.env.DEV_TODAY;
  if (dev && /^\d+$/.test(dev)) return Math.max(0, Math.min(26, Number(dev)));
  return calendarDay(now);
}

/** With DEV_TODAY, pretend the clock is on that December day (keeps countdowns realistic). */
function devNow(): number | null {
  const dev = Number(process.env.DEV_TODAY);
  if (!process.env.DEV_TODAY || !(dev >= 1 && dev <= 25)) return null;
  const now = new Date();
  return Date.UTC(CALENDAR_YEAR, 11, dev, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
}

/** A game finished a few minutes after midnight still counts for the day it started. */
export function canSubmitForDay(day: number, now = new Date()): boolean {
  const t = today(now);
  if (day === t) return true;
  if (process.env.DEV_TODAY) return false;
  const p = lisbonParts(now);
  return day === t - 1 && p.hour === 0 && p.minute < 10;
}

interface PlayRow {
  player_id: PlayerId;
  day: number | null;
  game_id: GameId;
  score: number;
  duration_ms: number | null;
}

async function loadPlays(): Promise<PlayRow[]> {
  return sql()<PlayRow[]>`select player_id, day, game_id, score, duration_ms from plays where day is not null`;
}

const perPlayer = <T>(fn: (p: PlayerId) => T): PerPlayer<T> => ({ duda: fn("duda"), filipino: fn("filipino") });

function winnerOf(gameId: GameId, best: PerPlayer<number | null>): PlayerId | "tie" | null {
  const { duda, filipino } = best;
  if (duda === null && filipino === null) return null;
  if (duda === null) return "filipino";
  if (filipino === null) return "duda";
  if (duda === filipino) return "tie";
  return isBetter(gameId, duda, filipino) ? "duda" : "filipino";
}

export async function buildState(me: PlayerId): Promise<AppState> {
  const t = today();
  const rows = await loadPlays();

  const days: DayState[] = [];
  for (let day = 1; day <= 25; day++) {
    const status: DayState["status"] = day < t ? "past" : day === t ? "today" : "locked";
    const gameId = day <= GAME_DAYS && status !== "locked" ? SCHEDULE[day] : null;
    const dayRows = gameId ? rows.filter((r) => r.day === day && r.game_id === gameId) : [];
    const best = perPlayer((p) => (gameId ? bestOf(gameId, dayRows.filter((r) => r.player_id === p).map((r) => r.score)) : null));
    const plays = perPlayer((p) => dayRows.filter((r) => r.player_id === p).length);
    days.push({ day, status, gameId, best, plays, winner: gameId ? winnerOf(gameId, best) : null });
  }

  const games: GameBoard[] = [];
  for (const d of days) {
    if (!d.gameId) continue;
    let board = games.find((g) => g.gameId === d.gameId);
    if (!board) {
      board = { gameId: d.gameId, firstDay: d.day, days: [], best: { duda: null, filipino: null } };
      games.push(board);
    }
    board.days.push(d.day);
    for (const p of PLAYER_IDS) {
      const s = d.best[p];
      const cur = board.best[p];
      if (s !== null && (cur === null || isBetter(d.gameId, s, cur.score))) board.best[p] = { score: s, day: d.day };
    }
  }

  const wins = { duda: 0, filipino: 0, tie: 0 };
  for (const d of days) if (d.status === "past" && d.winner) wins[d.winner]++;

  return {
    me,
    today: t,
    serverNow: devNow() ?? Date.now(),
    days,
    games,
    hiddenGames: Object.keys(GAMES).length - games.length,
    wins,
  };
}

export async function buildWrapped(): Promise<WrappedStats> {
  const rows = await loadPlays();
  const scheduleDays = Object.entries(SCHEDULE).map(([d, g]) => ({ day: Number(d), gameId: g }));
  const valid = rows.filter((r) => r.day !== null && SCHEDULE[r.day] === r.game_id);

  const dayWinners = scheduleDays.map(({ day, gameId }) => {
    const best = perPlayer((p) => bestOf(gameId, valid.filter((r) => r.day === day && r.player_id === p).map((r) => r.score)));
    return winnerOf(gameId, best);
  });

  const gameIds = [...new Set(scheduleDays.map((d) => d.gameId))];
  const games = gameIds.map((gameId) => {
    const gRows = valid.filter((r) => r.game_id === gameId);
    const best = perPlayer((p) => bestOf(gameId, gRows.filter((r) => r.player_id === p).map((r) => r.score)));
    return { gameId, best, plays: perPlayer((p) => gRows.filter((r) => r.player_id === p).length), winner: winnerOf(gameId, best) };
  });

  const perPlayerStats = perPlayer((p) => {
    const mine = valid.filter((r) => r.player_id === p);
    const counts = new Map<GameId, number>();
    for (const r of mine) counts.set(r.game_id, (counts.get(r.game_id) ?? 0) + 1);
    const fav = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      plays: mine.length,
      minutes: Math.round(mine.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / 60000),
      daysPlayed: new Set(mine.map((r) => r.day)).size,
      daysWon: dayWinners.filter((w) => w === p).length,
      gamesWon: games.filter((g) => g.winner === p).length,
      favorite: fav ? { gameId: fav[0], plays: fav[1] } : null,
    };
  });

  const dayCounts = scheduleDays
    .map(({ day, gameId }) => ({ day, gameId, plays: valid.filter((r) => r.day === day).length }))
    .sort((a, b) => b.plays - a.plays);

  const d = perPlayerStats.duda;
  const f = perPlayerStats.filipino;
  const champion: PlayerId | "tie" =
    d.daysWon !== f.daysWon ? (d.daysWon > f.daysWon ? "duda" : "filipino") : d.gamesWon !== f.gamesWon ? (d.gamesWon > f.gamesWon ? "duda" : "filipino") : "tie";

  return {
    perPlayer: perPlayerStats,
    games,
    busiestDay: dayCounts[0]?.plays ? dayCounts[0] : null,
    ties: dayWinners.filter((w) => w === "tie").length,
    champion,
  };
}
