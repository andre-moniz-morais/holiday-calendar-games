export type PlayerId = "duda" | "filipino";

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  /** Accent colour used for this player everywhere (scores, bars, wrapped). */
  color: string;
  colorSoft: string;
}

export const PLAYERS: Record<PlayerId, PlayerInfo> = {
  duda: { id: "duda", name: "Duda", color: "#ff7d8e", colorSoft: "rgba(255,125,142,.16)" },
  filipino: { id: "filipino", name: "Filipino", color: "#6cc6ff", colorSoft: "rgba(108,198,255,.16)" },
};

export const PLAYER_IDS: PlayerId[] = ["duda", "filipino"];

export const otherPlayer = (id: PlayerId): PlayerId => (id === "duda" ? "filipino" : "duda");

export const headSrc = (id: PlayerId, size: 128 | 256 | 512 = 256) => `/heads/${id}-${size}.webp`;
export const headModel = (id: PlayerId) => `/heads/${id}.glb`;

export const isPlayerId = (v: unknown): v is PlayerId => v === "duda" || v === "filipino";
