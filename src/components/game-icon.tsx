import { ArrowBigUpDash, Bird, Car, Footprints, Hammer, Images, Puzzle, Rocket, Slice, Worm, type LucideIcon } from "lucide-react";
import type { GameId } from "@/lib/games";

const ICONS: Record<GameId, LucideIcon> = {
  fly: Bird,
  run: Footprints,
  whack: Hammer,
  slice: Slice,
  memory: Images,
  snake: Worm,
  puzzle: Puzzle,
  invaders: Rocket,
  jump: ArrowBigUpDash,
  cross: Car,
};

export function GameIcon({ gameId, className = "size-5", strokeWidth = 2.2 }: { gameId: GameId; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[gameId];
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
