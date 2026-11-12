"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, CloudOff, Crown, Eye, Heart, Home, Loader2, Play, RotateCcw, X } from "lucide-react";
import { GameIcon } from "./game-icon";
import { Head } from "./head";
import { Confetti } from "./confetti";
import { GAMES, formatScore, scoreUnitLabel, type GameId } from "@/lib/games";
import { PLAYERS, headSrc, otherPlayer, type PlayerId } from "@/lib/players";
import { haptic } from "@/lib/client/haptics";
import { sfx, unlockAudio } from "@/lib/client/sfx";
import { submitPlay, useAppState, type SubmitOutcome } from "@/lib/client/store";
import { PHOTOS } from "@/data/photos.generated";
import { GAME_LOADERS, loadImage } from "@/games/registry";
import type { GameApi, GameModule } from "@/games/types";

type Phase = "loading" | "intro" | "playing" | "over";

interface Assets {
  module: GameModule;
  heads: Record<PlayerId, HTMLImageElement>;
  photos: HTMLImageElement[];
}

/** `preview`: a locked door opened early — playable, but nothing is saved. */
export function GameShell({ gameId, day, preview = false }: { gameId: GameId; day: number | null; preview?: boolean }) {
  const router = useRouter();
  const { state } = useAppState();
  const me = state?.me ?? null;
  const game = GAMES[gameId];

  const [phase, setPhase] = useState<Phase>("loading");
  const [assets, setAssets] = useState<Assets | null>(null);
  const [run, setRun] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<{ n: number; max: number } | null>(null);
  const [final, setFinal] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<SubmitOutcome | "saving" | null>(null);
  const startedAt = useRef(0);
  const ended = useRef(false);

  // Load the game code + images once.
  useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      const [{ default: module }, mine, theirs] = await Promise.all([
        GAME_LOADERS[gameId](),
        loadImage(headSrc(me, 512)),
        loadImage(headSrc(otherPlayer(me), 512)),
      ]);
      const photos = module.needsPhotos ? await Promise.all(PHOTOS.map((p) => loadImage(p.src))) : [];
      if (!alive) return;
      setAssets({ module, heads: { [me]: mine, [otherPlayer(me)]: theirs } as Record<PlayerId, HTMLImageElement>, photos });
      setPhase((p) => (p === "loading" ? "intro" : p));
    })().catch(() => alive && setPhase("intro"));
    return () => {
      alive = false;
    };
  }, [gameId, me]);

  const finish = useCallback(
    (value: number) => {
      if (ended.current) return;
      ended.current = true;
      const durationMs = Math.round(performance.now() - startedAt.current);
      setFinal(value);
      setTimeout(() => setPhase("over"), 450);
      if (preview) return;
      setOutcome("saving");
      submitPlay({ gameId, day, score: value, durationMs }).then((o) => {
        setOutcome(o);
        if (o.kind === "saved" && o.result.isRecord && o.result.plays > 1) {
          sfx("record");
          haptic("success");
        }
      });
    },
    [gameId, day, preview],
  );

  async function start() {
    unlockAudio();
    haptic("medium");
    try {
      await assets?.module.prepare?.();
    } catch {
      /* permission denied → game falls back to touch */
    }
    ended.current = false;
    startedAt.current = performance.now();
    setScore(0);
    setLives(null);
    setFinal(null);
    setOutcome(null);
    setRun((r) => r + 1);
    setPhase("playing");
  }

  function quit() {
    haptic("select");
    ended.current = true;
    setPhase("intro");
  }

  const back = () => {
    haptic("select");
    if (history.length > 1) router.back();
    else router.replace("/");
  };

  // Stable API object handed to the game (only changes when assets load).
  const api = useMemo<GameApi | null>(() => {
    if (!assets || !me) return null;
    const them = otherPlayer(me);
    return {
      me: { id: me, name: PLAYERS[me].name, color: PLAYERS[me].color, head: assets.heads[me] },
      them: { id: them, name: PLAYERS[them].name, color: PLAYERS[them].color, head: assets.heads[them] },
      photos: assets.photos,
      day,
      setScore,
      setLives: (n, max) => setLives({ n, max }),
      end: finish,
      haptic,
      sfx,
    };
  }, [assets, me, day, finish]);

  if (!me || !state) {
    return (
      <div className="game-stage grid place-items-center bg-night">
        <Loader2 className="size-8 animate-spin text-muted" />
      </div>
    );
  }

  const them = otherPlayer(me);
  const dayState = day && !preview ? state.days[day - 1] : null;


  return (
    <div className="game-stage bg-night">
      {/* The game itself. Its API callbacks touch refs, but games only call them from input handlers / rAF, never during render. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {(phase === "playing" || phase === "over") && api && assets && <GameSurface key={run} module={assets.module} api={api} />}

      {/* HUD */}
      {phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-4 pt-[calc(10px+var(--safe-top))]">
          <button onClick={quit} aria-label="Sair do jogo" className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/30 text-cream backdrop-blur-md active:scale-95">
            <X className="size-5" />
          </button>
          {assets?.module.hudScore !== "none" && (
            <div className="rounded-full bg-black/30 px-5 py-1.5 font-display text-3xl font-semibold text-cream tabular backdrop-blur-md [text-shadow:0_2px_0_rgba(0,0,0,.25)]">
              {assets?.module.hudScore === "seconds" ? `${score.toFixed(1)}s` : score}
            </div>
          )}
          <div className="flex h-11 min-w-11 items-center justify-end gap-0.5 rounded-full bg-black/30 px-3 backdrop-blur-md" style={{ visibility: lives ? "visible" : "hidden" }}>
            {lives &&
              Array.from({ length: lives.max }, (_, i) => (
                <Heart key={i} className={`size-4 transition-all ${i < lives.n ? "text-berry" : "scale-75 text-white/25"}`} fill="currentColor" />
              ))}
          </div>
        </div>
      )}

      {/* Intro */}
      {(phase === "intro" || phase === "loading") && (
        <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto">
          <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(90% 55% at 50% 15%, ${game.color}55, transparent 70%), var(--color-night)` }} />
          <div className="flex items-center px-4 pt-[calc(10px+var(--safe-top))]">
            <button onClick={back} aria-label="Voltar" className="grid size-11 place-items-center rounded-full bg-white/8 active:scale-95">
              <ChevronLeft className="size-6" />
            </button>
            <p className="flex-1 pr-11 text-center text-sm font-bold text-muted">{day ? `Dia ${day}${preview ? " · espreitadela" : ""}` : "Modo livre"}</p>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-6">
            <div className="relative mx-auto mb-6 flex items-end">
              <Head player={me} size={96} className="relative z-10 -mr-3 -rotate-6 animate-float drop-shadow-[0_12px_20px_rgba(0,0,0,.45)]" />
              <span className="relative z-20 mb-1 grid size-16 place-items-center rounded-[22px] text-white shadow-xl ring-4 ring-night" style={{ background: game.color }}>
                <GameIcon gameId={gameId} className="size-8" />
              </span>
            </div>
            <h1 className="text-center text-4xl font-semibold leading-tight">{game.name}</h1>
            <p className="mt-1 text-center text-muted">{game.tagline}</p>

            <ul className="card mt-6 space-y-2.5 p-5">
              {game.how.map((line, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-snug">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-black text-night">{i + 1}</span>
                  {line}
                </li>
              ))}
            </ul>

            {preview && (
              <p className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/5 p-3 text-sm font-semibold text-muted">
                <Eye className="size-4 shrink-0 text-gold" /> Espreitadela antes de dezembro — os resultados não ficam guardados.
              </p>
            )}

            {dayState && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {[me, them].map((p) => (
                  <div key={p} className="flex items-center gap-2.5 rounded-2xl bg-white/5 p-2.5">
                    <span className="relative">
                      <Head player={p} size={34} />
                      {dayState.winner === p && <Crown className="absolute -right-1 -top-2 size-3.5 rotate-12 text-gold" fill="currentColor" />}
                    </span>
                    <div>
                      <p className="text-[11px] font-bold text-muted">{p === me ? "O teu melhor" : PLAYERS[p].name}</p>
                      <p className="font-display text-lg font-semibold leading-none tabular">{formatScore(gameId, dayState.best[p])}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-md px-6 pb-[calc(20px+var(--safe-bottom))]">
            <button onClick={start} disabled={phase === "loading"} className="btn btn-primary h-14 w-full text-lg disabled:opacity-60">
              {phase === "loading" ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5" fill="currentColor" />}
              {phase === "loading" ? "A preparar…" : "Jogar"}
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === "over" && final !== null && (
        <GameOver
          gameId={gameId}
          score={final}
          outcome={outcome}
          me={me}
          them={them}
          preview={preview}
          theirBest={dayState?.best[them] ?? null}
          myBest={dayState?.best[me] ?? null}
          onAgain={start}
          onHome={() => router.replace(day ? "/" : "/games")}
        />
      )}
    </div>
  );
}

function GameSurface({ module, api }: { module: GameModule; api: GameApi }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!module.create || !canvasRef.current) return;
    const inst = module.create(canvasRef.current, api);
    return () => inst.destroy();
  }, [module, api]);

  if (module.Component) {
    const C = module.Component;
    return <C api={api} />;
  }
  return <canvas ref={canvasRef} />;
}

function GameOver({
  gameId,
  score,
  outcome,
  me,
  them,
  myBest,
  theirBest,
  onAgain,
  onHome,
  preview,
}: {
  gameId: GameId;
  score: number;
  preview: boolean;
  outcome: SubmitOutcome | "saving" | null;
  me: PlayerId;
  them: PlayerId;
  myBest: number | null;
  theirBest: number | null;
  onAgain: () => void;
  onHome: () => void;
}) {
  const saved = outcome && outcome !== "saving" && outcome.kind === "saved" ? outcome.result : null;
  // A "record" only counts once you've something to beat.
  const isRecord = !!saved?.isRecord && saved.plays > 1;
  const best = saved?.best ?? myBest;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-night/70 px-5 pb-[calc(20px+var(--safe-bottom))] backdrop-blur-sm sm:items-center">
      {isRecord && <Confetti />}
      <div className="card w-full max-w-md animate-pop-in bg-[#12301f]/95 p-6 text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-muted">{isRecord ? "Novo recorde!" : "Fim de jogo"}</p>
        <p className="mt-1 font-display text-7xl font-semibold leading-none tabular" style={{ color: isRecord ? "var(--color-gold)" : undefined }}>
          {formatScore(gameId, score)}
        </p>
        <p className="mt-1 text-sm text-muted">{scoreUnitLabel(gameId, score)}</p>

        <div className={`mt-5 grid grid-cols-2 gap-2.5 text-left ${preview ? "hidden" : ""}`}>
          {[
            { p: me, label: "O teu melhor", v: best },
            { p: them, label: `Melhor ${PLAYERS[them].name}`, v: theirBest },
          ].map(({ p, label, v }) => (
            <div key={p} className="flex items-center gap-2.5 rounded-2xl bg-black/20 p-2.5">
              <Head player={p} size={34} />
              <div>
                <p className="text-[11px] font-bold text-muted">{label}</p>
                <p className="font-display text-lg font-semibold leading-none tabular">{formatScore(gameId, v)}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 flex min-h-5 items-center justify-center gap-1.5 text-xs font-semibold text-muted">
          {outcome === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin" /> A guardar…
            </>
          )}
          {outcome && outcome !== "saving" && outcome.kind === "queued" && (
            <>
              <CloudOff className="size-3.5" /> Sem rede — guardo quando voltares a ter ligação.
            </>
          )}
          {outcome && outcome !== "saving" && outcome.kind === "rejected" && <span className="text-berry">{outcome.message}</span>}
          {saved && `Jogo nº ${saved.plays} guardado`}
          {preview && (
            <>
              <Eye className="size-3.5" /> Espreitadela — este resultado não fica guardado.
            </>
          )}
        </p>

        <div className="mt-4 flex gap-2.5">
          <button onClick={onHome} aria-label="Voltar" className="btn btn-ghost w-14 shrink-0 p-0">
            <Home className="size-5" />
          </button>
          <button onClick={onAgain} className="btn btn-primary flex-1">
            <RotateCcw className="size-5" /> Jogar outra vez
          </button>
        </div>
      </div>
    </div>
  );
}
