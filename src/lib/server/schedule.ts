import "server-only";
import type { GameId } from "@/lib/games";

/**
 * Which game belongs to which door. Day 25 is the "Wrapped" door.
 * Kept server-side so future games stay a surprise.
 * Days 1–10 introduce every game once; the rest repeat them in a different order.
 */
export const SCHEDULE: Record<number, GameId> = {
  1: "fly",
  2: "memory",
  3: "whack",
  4: "run",
  5: "snake",
  6: "slice",
  7: "puzzle",
  8: "invaders",
  9: "jump",
  10: "cross",
  11: "run",
  12: "slice",
  13: "fly",
  14: "cross",
  15: "memory",
  16: "jump",
  17: "whack",
  18: "invaders",
  19: "puzzle",
  20: "snake",
  21: "slice",
  22: "cross",
  23: "invaders",
  24: "fly",
};

export const GAME_DAYS = 24;
