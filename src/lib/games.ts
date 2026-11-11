export const GAME_IDS = [
  "fly",
  "run",
  "whack",
  "slice",
  "memory",
  "snake",
  "puzzle",
  "invaders",
  "jump",
  "cross",
] as const;

export type GameId = (typeof GAME_IDS)[number];

export const isGameId = (v: unknown): v is GameId => typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  /** Short how-to-play lines shown before starting. */
  how: string[];
  /** Is a higher or a lower score better? */
  better: "high" | "low";
  unit: "pts" | "s" | "tentativas";
  /** Card accent colour. */
  color: string;
}

export const GAMES: Record<GameId, GameMeta> = {
  fly: {
    id: "fly",
    name: "Voo de Natal",
    tagline: "Voa entre os bastões de doce",
    how: ["Toca no ecrã para subir.", "Passa entre os bastões sem lhes tocar.", "Cada par de bastões vale 1 ponto."],
    better: "high",
    unit: "pts",
    color: "#e0464e",
  },
  run: {
    id: "run",
    name: "Corrida na Neve",
    tagline: "Salta os obstáculos o máximo de tempo",
    how: ["Toca para saltar — mantém o dedo para saltar mais alto.", "Evita prendas e bonecos de neve.", "Pontuação: tempo que aguentas."],
    better: "high",
    unit: "s",
    color: "#3fa7d6",
  },
  whack: {
    id: "whack",
    name: "Chaminés",
    tagline: "Acerta no teu amor, nunca em ti",
    how: ["Toca na cabeça do teu amor quando sair da chaminé (+1).", "Se tocares na tua cabeça, perdes logo.", "Se o teu amor fugir 3 vezes, perdes."],
    better: "high",
    unit: "pts",
    color: "#c77d14",
  },
  slice: {
    id: "slice",
    name: "Fruta Fatiada",
    tagline: "Corta a fruta, poupa as cabeças",
    how: ["Arrasta o dedo para cortar a fruta (+1 cada).", "Não deixes cair 3 frutas.", "Se cortares uma cabeça, perdes."],
    better: "high",
    unit: "pts",
    color: "#2a9d8f",
  },
  memory: {
    id: "memory",
    name: "Memórias",
    tagline: "Encontra os pares das nossas fotos",
    how: ["Vira duas cartas de cada vez.", "Encontra todos os pares de fotos.", "Menos tentativas = melhor pontuação."],
    better: "low",
    unit: "tentativas",
    color: "#8e4ec6",
  },
  snake: {
    id: "snake",
    name: "Serpentina",
    tagline: "Come cabeças, cresce, não batas",
    how: ["Desliza o dedo para mudar de direção.", "Come a cabeça do teu amor (+1).", "Não batas nas paredes nem em ti."],
    better: "high",
    unit: "pts",
    color: "#1f9e5a",
  },
  puzzle: {
    id: "puzzle",
    name: "Puzzle",
    tagline: "Monta a nossa fotografia",
    how: ["Arrasta as peças para o sítio certo.", "Quando estão perto, encaixam sozinhas.", "Quanto mais rápido, melhor."],
    better: "low",
    unit: "s",
    color: "#d4568c",
  },
  invaders: {
    id: "invaders",
    name: "Invasão de Beijinhos",
    tagline: "Trava a invasão de cabeças",
    how: ["Arrasta para mover — disparas sozinho(a).", "Aguentas 3 bolas de Natal na cabeça.", "Nenhuma cabeça pode chegar lá abaixo."],
    better: "high",
    unit: "pts",
    color: "#5b6ee1",
  },
  jump: {
    id: "jump",
    name: "Até à Estrela",
    tagline: "Salta de plataforma em plataforma",
    how: ["Inclina o telemóvel (ou toca nos lados) para te mexeres.", "Saltas sozinho(a) quando cais numa plataforma.", "Cada andar novo vale 1 ponto."],
    better: "high",
    unit: "pts",
    color: "#f5bf4f",
  },
  cross: {
    id: "cross",
    name: "Atravessa a Aldeia",
    tagline: "Estradas, trenós e rios gelados",
    how: ["Toca para avançar, desliza para os lados ou para trás.", "Cuidado com os carros e não caias à água.", "Cada fila nova vale 1 ponto."],
    better: "high",
    unit: "pts",
    color: "#e76f51",
  },
};

export function formatScore(game: GameId, score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  const meta = GAMES[game];
  if (meta.unit === "s") return `${score.toFixed(1)}s`;
  return String(Math.round(score));
}

export function scoreUnitLabel(game: GameId, score?: number | null): string {
  const meta = GAMES[game];
  if (meta.unit === "s") return "";
  if (meta.unit === "tentativas") return score === 1 ? "tentativa" : "tentativas";
  return score === 1 ? "ponto" : "pontos";
}

/** Returns true if `a` beats `b` for this game. */
export function isBetter(game: GameId, a: number, b: number): boolean {
  return GAMES[game].better === "high" ? a > b : a < b;
}

export function bestOf(game: GameId, scores: number[]): number | null {
  if (!scores.length) return null;
  return GAMES[game].better === "high" ? Math.max(...scores) : Math.min(...scores);
}
