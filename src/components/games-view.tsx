"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Lock, Play } from "lucide-react";
import { AppHeader } from "./app-header";
import { GameIcon } from "./game-icon";
import { formatCountdown } from "@/lib/calendar";
import { GAMES, GAME_IDS } from "@/lib/games";
import { haptic } from "@/lib/client/haptics";
import { refreshState, useAppState } from "@/lib/client/store";
import { useNextDoorCountdown } from "@/lib/client/use-countdown";

export function GamesView() {
  const { state, clockOffset } = useAppState();
  const onZero = useCallback(() => void refreshState(), []);
  const countdown = useNextDoorCountdown(clockOffset, onZero);
  const locked = !state || state.today < 25;

  if (locked) {
    const daysLeft = state ? Math.max(1, 25 - Math.max(state.today, 0)) : null;
    return (
      <>
        <AppHeader title="Jogos" />
        <div className="px-5">
          <section className="card relative overflow-hidden px-6 py-10 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-[26px] bg-gradient-to-b from-[#ffd479] to-gold-2 text-night shadow-[var(--shadow-pop)]">
              <Lock className="size-9" strokeWidth={2.4} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Abre no dia de Natal</h2>
            <p className="mx-auto mt-2 max-w-[17rem] text-sm text-muted">
              No dia 25 todos os jogos ficam livres para jogarem sempre que quiserem.
            </p>
            {state && (
              <p className="mt-6 font-display text-3xl font-semibold tabular">
                {state.today === 24 && countdown !== null ? formatCountdown(countdown) : `${daysLeft} dias`}
              </p>
            )}
          </section>

          <div className="mt-5 grid grid-cols-5 gap-2 opacity-60">
            {GAME_IDS.map((id) => {
              const known = state?.games.some((g) => g.gameId === id);
              return (
                <div key={id} className="grid aspect-square place-items-center rounded-2xl border border-line bg-white/5 text-muted">
                  {known ? <GameIcon gameId={id} /> : <span className="font-display text-xl font-semibold">?</span>}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Jogos" subtitle="Joga à vontade — modo livre" />
      <div className="grid grid-cols-2 gap-3 px-5">
        {GAME_IDS.map((id, i) => {
          const g = GAMES[id];
          return (
            <Link
              key={id}
              href={`/free/${id}`}
              onClick={() => haptic("select")}
              className="card group relative flex aspect-[4/5] animate-fade-up flex-col justify-between overflow-hidden p-4 active:scale-[.97]"
              style={{ animationDelay: `${i * 35}ms` }}
            >
              <div className="absolute -right-8 -top-8 size-28 rounded-full opacity-40 blur-2xl" style={{ background: g.color }} />
              <span className="relative grid size-12 place-items-center rounded-2xl text-white shadow-lg" style={{ background: g.color }}>
                <GameIcon gameId={id} className="size-6" />
              </span>
              <div className="relative">
                <h3 className="text-lg font-semibold leading-tight">{g.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{g.tagline}</p>
              </div>
              <span className="absolute bottom-4 right-4 grid size-8 place-items-center rounded-full bg-cream text-night">
                <Play className="size-3.5" fill="currentColor" />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
