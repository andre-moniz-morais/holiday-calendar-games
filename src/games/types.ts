import type { ComponentType } from "react";
import type { HapticKind } from "@/lib/client/haptics";
import type { SfxKind } from "@/lib/client/sfx";
import type { PlayerId } from "@/lib/players";

export interface GamePlayer {
  id: PlayerId;
  name: string;
  color: string;
  /** Head sprite (square, transparent background). */
  head: HTMLImageElement;
}

export interface GameApi {
  me: GamePlayer;
  them: GamePlayer;
  /** Loaded only for games with `needsPhotos`. */
  photos: HTMLImageElement[];
  /** Calendar day being played (null = free play). */
  day: number | null;
  /** Update the score shown in the HUD. */
  setScore(score: number): void;
  /** Update the hearts shown in the HUD. */
  setLives(remaining: number, max: number): void;
  /** Finish the run with the final score. Call once. */
  end(score: number): void;
  haptic(kind: HapticKind): void;
  sfx(kind: SfxKind): void;
}

export interface GameInstance {
  destroy(): void;
}

export interface GameModule {
  needsPhotos?: boolean;
  /** How the HUD shows the score while playing. */
  hudScore?: "points" | "seconds" | "attempts" | "none";
  /** Runs inside the "Jogar" tap (e.g. ask for motion-sensor permission on iOS). */
  prepare?: () => Promise<void> | void;
  /** Canvas games */
  create?: (canvas: HTMLCanvasElement, api: GameApi) => GameInstance;
  /** DOM/React games */
  Component?: ComponentType<{ api: GameApi }>;
}
