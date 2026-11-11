import { headSrc, type PlayerId } from "@/lib/players";

/** A player's cartoon head. */
export function Head({ player, size = 40, className = "", style }: { player: PlayerId; size?: number; className?: string; style?: React.CSSProperties }) {
  const src = headSrc(player, size > 140 ? 512 : size > 64 ? 256 : 128);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} draggable={false} className={`select-none ${className}`} style={{ width: size, height: size, ...style }} />
  );
}
