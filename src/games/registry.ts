import type { GameId } from "@/lib/games";
import type { GameModule } from "./types";

/** Each game is code-split and only downloaded when opened. */
export const GAME_LOADERS: Record<GameId, () => Promise<{ default: GameModule }>> = {
  fly: () => import("./fly"),
  run: () => import("./run"),
  whack: () => import("./whack"),
  slice: () => import("./slice"),
  memory: () => import("./memory"),
  snake: () => import("./snake"),
  puzzle: () => import("./puzzle"),
  invaders: () => import("./invaders"),
  jump: () => import("./jump"),
  cross: () => import("./cross"),
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => {
          imageCache.delete(src);
          reject(new Error(`Failed to load ${src}`));
        };
        img.src = src;
      }),
    );
  }
  return imageCache.get(src)!;
}
