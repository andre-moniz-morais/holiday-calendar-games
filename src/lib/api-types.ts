import type { GameId } from "./games";
import type { PlayerId } from "./players";

export type PerPlayer<T> = Record<PlayerId, T>;

export interface DayState {
  day: number;
  status: "locked" | "today" | "past";
  /** null while locked (future games stay secret). Day 25 is always null — it's the Wrapped door. */
  gameId: GameId | null;
  best: PerPlayer<number | null>;
  plays: PerPlayer<number>;
  /** Final winner for past days, current leader for today. */
  winner: PlayerId | "tie" | null;
}

export interface GameBoard {
  gameId: GameId;
  firstDay: number;
  days: number[];
  best: PerPlayer<{ score: number; day: number } | null>;
}

export interface AppState {
  me: PlayerId;
  /** 0 = before Dec 1, 1..25, 26 = after Christmas */
  today: number;
  serverNow: number;
  days: DayState[];
  /** Games revealed so far, in order of first appearance. */
  games: GameBoard[];
  hiddenGames: number;
  wins: PerPlayer<number> & { tie: number };
}

export interface PlayResult {
  ok: true;
  best: number;
  isRecord: boolean;
  plays: number;
}

export interface WrappedStats {
  perPlayer: PerPlayer<{
    plays: number;
    minutes: number;
    daysPlayed: number;
    daysWon: number;
    gamesWon: number;
    favorite: { gameId: GameId; plays: number } | null;
  }>;
  games: {
    gameId: GameId;
    best: PerPlayer<number | null>;
    plays: PerPlayer<number>;
    winner: PlayerId | "tie" | null;
  }[];
  busiestDay: { day: number; gameId: GameId; plays: number } | null;
  ties: number;
  champion: PlayerId | "tie";
}
