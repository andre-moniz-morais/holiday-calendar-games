"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Gift, Loader2, Lock, RotateCcw, X } from "lucide-react";
import { Confetti } from "./confetti";
import { GameIcon } from "./game-icon";
import { Head } from "./head";
import { CALENDAR_YEAR } from "@/lib/calendar";
import { GAMES, formatScore, scoreUnitLabel } from "@/lib/games";
import { PLAYERS, PLAYER_IDS, type PlayerId } from "@/lib/players";
import { haptic } from "@/lib/client/haptics";
import { sfx } from "@/lib/client/sfx";
import { useAppState } from "@/lib/client/store";
import type { WrappedStats } from "@/lib/api-types";

const SLIDE_MS = 6500;

interface Slide {
  key: string;
  bg: string;
  render: () => React.ReactNode;
  confetti?: boolean;
}

export function WrappedView() {
  const router = useRouter();
  const { state } = useAppState();
  const [data, setData] = useState<WrappedStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/wrapped", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Erro");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const slides = useMemo(() => (data ? buildSlides(data) : []), [data]);
  const n = slides.length;

  const go = useCallback(
    (to: number) => {
      if (to < 0) return;
      if (to >= n) return;
      setI(to);
      setProgress(0);
      haptic("select");
      if (slides[to]?.confetti) sfx("record");
    },
    [n, slides],
  );

  // auto-advance
  useEffect(() => {
    if (!n || paused || i >= n - 1) return;
    const start = performance.now() - progress * SLIDE_MS;
    let raf = 0;
    const tick = () => {
      const p = (performance.now() - start) / SLIDE_MS;
      if (p >= 1) {
        go(i + 1);
        return;
      }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n, paused]);

  if (state && state.today < 25) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="card max-w-sm p-6 text-center">
          <Lock className="mx-auto size-8 text-gold" />
          <h1 className="mt-3 text-2xl font-semibold">Só no dia de Natal!</h1>
          <button onClick={() => router.replace("/")} className="btn btn-primary mt-5 w-full">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        {error ? <p className="text-muted">{error}</p> : <Loader2 className="size-8 animate-spin text-gold" />}
      </div>
    );
  }

  const slide = slides[i];

  return (
    <div
      className="game-stage select-none overflow-hidden text-cream transition-[background] duration-700"
      style={{ background: slide.bg }}
      onPointerDown={() => {
        holdRef.current = window.setTimeout(() => setPaused(true), 220);
      }}
      onPointerUp={(e) => {
        if (holdRef.current) clearTimeout(holdRef.current);
        if (paused) {
          setPaused(false);
          return;
        }
        const x = e.clientX / window.innerWidth;
        if (x < 0.3) go(i - 1);
        else go(i + 1);
      }}
    >
      <div className="snow-layer" aria-hidden />
      {slide.confetti && <Confetti key={`confetti-${slide.key}`} count={60} />}

      {/* progress */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-[calc(8px+var(--safe-top))]">
        {slides.map((s, k) => (
          <div key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-white" style={{ width: k < i ? "100%" : k === i ? `${(i === n - 1 ? 1 : progress) * 100}%` : "0%" }} />
          </div>
        ))}
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={() => router.replace("/")}
        aria-label="Fechar"
        className="absolute right-3 top-[calc(18px+var(--safe-top))] z-30 grid size-10 place-items-center rounded-full bg-black/20"
      >
        <X className="size-5" />
      </button>

      <div key={slide.key} className="relative z-10 flex h-full flex-col items-center justify-center px-7 pb-[calc(30px+var(--safe-bottom))] pt-[calc(50px+var(--safe-top))] text-center">
        {slide.render()}
      </div>

      {i === n - 1 && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center gap-2 px-6 pb-[calc(20px+var(--safe-bottom))]" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
          <button onClick={() => go(0)} className="btn btn-ghost bg-black/25">
            <RotateCcw className="size-5" /> Ver de novo
          </button>
          <button onClick={() => router.replace("/")} className="btn btn-gold">
            <Gift className="size-5" /> Feliz Natal
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── slides ─────────────────────────

const up = (delay: number) => ({ className: "animate-fade-up", style: { animationDelay: `${delay}ms` } });

function Big({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <p {...up(delay)} className="animate-fade-up font-display text-[4.5rem] font-semibold leading-none tabular [text-shadow:0_4px_0_rgba(0,0,0,.15)]">
      {children}
    </p>
  );
}

function Title({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <h2 {...up(delay)} className="animate-fade-up text-[2.2rem] font-semibold leading-[1.05]">
      {children}
    </h2>
  );
}

function Duel({ data, values, gameId }: { data: WrappedStats; values: Record<PlayerId, number | null>; gameId?: keyof typeof GAMES }) {
  void data;
  return (
    <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
      {PLAYER_IDS.map((p, k) => (
        <div key={p} {...up(300 + k * 200)} className="animate-fade-up rounded-[24px] bg-black/20 p-4">
          <Head player={p} size={72} className="mx-auto" />
          <p className="mt-2 text-sm font-bold opacity-80">{PLAYERS[p].name}</p>
          <p className="font-display text-4xl font-semibold tabular">{gameId ? formatScore(gameId, values[p]) : (values[p] ?? 0)}</p>
          {gameId && values[p] !== null && <p className="text-xs opacity-70">{scoreUnitLabel(gameId, values[p])}</p>}
        </div>
      ))}
    </div>
  );
}

function buildSlides(data: WrappedStats): Slide[] {
  const slides: Slide[] = [];
  const pp = data.perPlayer;
  const totalPlays = pp.duda.plays + pp.filipino.plays;
  const minutes = pp.duda.minutes + pp.filipino.minutes;

  slides.push({
    key: "intro",
    bg: "linear-gradient(170deg,#e0464e,#7d1d26)",
    render: () => (
      <>
        <div {...up(0)} className="relative flex animate-fade-up items-end">
          <Head player="filipino" size={120} className="-mr-4 -rotate-6 animate-float" />
          <Head player="duda" size={120} className="rotate-6 animate-float [animation-delay:-2s]" />
        </div>
        <p {...up(200)} className="mt-6 animate-fade-up text-sm font-bold uppercase tracking-[.2em] opacity-80">
          Natal a Dois
        </p>
        <Title delay={300}>O vosso Natal em jogos</Title>
        <p {...up(600)} className="mt-6 animate-fade-up text-sm opacity-70">
          Toca para avançar
        </p>
      </>
    ),
  });

  slides.push({
    key: "plays",
    bg: "linear-gradient(170deg,#1f6b4a,#0b2a1e)",
    render: () => (
      <>
        <Title>Ao todo jogaram</Title>
        <Big delay={200}>{totalPlays}</Big>
        <p {...up(300)} className="animate-fade-up text-xl font-bold">
          vezes{minutes > 0 ? `, durante ${minutes} minutos` : ""}
        </p>
        <Duel data={data} values={{ duda: pp.duda.plays, filipino: pp.filipino.plays }} />
      </>
    ),
  });

  slides.push({
    key: "days",
    bg: "linear-gradient(170deg,#3b6ea8,#1b365a)",
    render: () => (
      <>
        <Title>24 dias de desafios.</Title>
        <p {...up(250)} className="mt-2 animate-fade-up text-xl font-bold opacity-90">
          Dias ganhos por cada um:
        </p>
        <Duel data={data} values={{ duda: pp.duda.daysWon, filipino: pp.filipino.daysWon }} />
        {data.ties > 0 && (
          <p {...up(800)} className="mt-5 animate-fade-up text-sm font-bold opacity-80">
            + {data.ties} empate{data.ties > 1 ? "s" : ""}
          </p>
        )}
      </>
    ),
  });

  data.games.forEach((g, k) => {
    const meta = GAMES[g.gameId];
    slides.push({
      key: `game-${g.gameId}`,
      bg: `linear-gradient(170deg, ${meta.color}, #0b1d16 120%)`,
      render: () => (
        <>
          <p {...up(0)} className="animate-fade-up text-sm font-bold uppercase tracking-[.2em] opacity-80">
            Jogo {k + 1} de {data.games.length}
          </p>
          <span {...up(100)} className="mt-4 grid size-20 animate-fade-up place-items-center rounded-[26px] bg-white/20 shadow-lg">
            <GameIcon gameId={g.gameId} className="size-10" />
          </span>
          <Title delay={200}>{meta.name}</Title>
          <p {...up(260)} className="mt-1 animate-fade-up text-sm opacity-80">
            Melhor resultado de cada um
          </p>
          <Duel data={data} values={g.best} gameId={g.gameId} />
          <div {...up(900)} className="mt-6 flex animate-fade-up items-center gap-2 rounded-full bg-black/25 px-4 py-2 font-bold">
            {g.winner === "tie" ? (
              "Empate perfeito!"
            ) : g.winner ? (
              <>
                <Crown className="size-5 text-gold" fill="currentColor" /> {PLAYERS[g.winner].name} domina este jogo
              </>
            ) : (
              "Ninguém jogou este jogo"
            )}
          </div>
        </>
      ),
    });
  });

  slides.push({
    key: "favs",
    bg: "linear-gradient(170deg,#8e4ec6,#3a1d5a)",
    render: () => (
      <>
        <Title>Os jogos preferidos</Title>
        <div className="mt-8 w-full max-w-sm space-y-3">
          {PLAYER_IDS.map((p, k) => {
            const fav = pp[p].favorite;
            return (
              <div key={p} {...up(250 + k * 200)} className="flex animate-fade-up items-center gap-4 rounded-[24px] bg-black/20 p-4 text-left">
                <Head player={p} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold opacity-80">{PLAYERS[p].name}</p>
                  <p className="truncate font-display text-2xl font-semibold leading-tight">{fav ? GAMES[fav.gameId].name : "—"}</p>
                  {fav && <p className="text-xs opacity-75">jogado {fav.plays} vezes</p>}
                </div>
              </div>
            );
          })}
        </div>
        {data.busiestDay && (
          <p {...up(800)} className="mt-6 animate-fade-up text-sm font-bold opacity-85">
            O dia com mais jogos foi o dia {data.busiestDay.day} ({GAMES[data.busiestDay.gameId].name}): {data.busiestDay.plays} jogos.
          </p>
        )}
      </>
    ),
  });

  const champ = data.champion;
  slides.push({
    key: "champion",
    bg: "linear-gradient(170deg,#ffd479,#d99a22)",
    confetti: true,
    render: () => (
      <div className="text-night">
        <p {...up(0)} className="animate-fade-up text-sm font-black uppercase tracking-[.2em] opacity-70">
          E o Natal {CALENDAR_YEAR} é de…
        </p>
        {champ === "tie" ? (
          <>
            <div {...up(500)} className="mt-6 flex animate-fade-up justify-center">
              <Head player="filipino" size={120} className="-mr-3" />
              <Head player="duda" size={120} />
            </div>
            <Title delay={800}>Empate! Os dois!</Title>
          </>
        ) : (
          <>
            <div {...up(500)} className="relative mx-auto mt-16 w-fit animate-fade-up">
              <Crown className="absolute -top-11 left-1/2 z-10 size-16 -translate-x-1/2 rotate-[-8deg] text-berry drop-shadow" fill="currentColor" />
              <Head player={champ} size={170} className="animate-float" />
            </div>
            <Title delay={900}>{PLAYERS[champ].name}!</Title>
            <p {...up(1100)} className="mt-2 animate-fade-up font-bold opacity-75">
              {pp[champ].daysWon} dias ganhos · {pp[champ].gamesWon} recordes de jogo
            </p>
          </>
        )}
      </div>
    ),
  });

  slides.push({
    key: "summary",
    bg: "linear-gradient(170deg,#163f35,#0b1d16)",
    render: () => (
      <>
        <Title>Recordes finais</Title>
        <div className="mt-5 w-full max-w-sm overflow-hidden rounded-[22px] bg-black/25 text-left">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs font-bold opacity-80">
            <span className="flex-1">Jogo</span>
            {PLAYER_IDS.map((p) => (
              <span key={p} className="flex w-16 justify-end">
                <Head player={p} size={22} />
              </span>
            ))}
          </div>
          {data.games.map((g, k) => (
            <div key={g.gameId} {...up(k * 60)} className="flex animate-fade-up items-center gap-2 px-4 py-2 text-sm">
              <GameIcon gameId={g.gameId} className="size-4 shrink-0 opacity-80" />
              <span className="min-w-0 flex-1 truncate font-bold">{GAMES[g.gameId].name}</span>
              {PLAYER_IDS.map((p) => (
                <span key={p} className="w-16 text-right font-display font-semibold tabular" style={{ color: g.winner === p ? PLAYERS[p].color : undefined, opacity: g.winner === p ? 1 : 0.75 }}>
                  {formatScore(g.gameId, g.best[p])}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="h-20" />
      </>
    ),
  });

  return slides;
}
