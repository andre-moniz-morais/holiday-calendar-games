"use client";

import { Crown, HelpCircle } from "lucide-react";
import { AppHeader } from "./app-header";
import { GameIcon } from "./game-icon";
import { Head } from "./head";
import { Scoreline } from "./scoreline";
import { GAMES, formatScore, isBetter, scoreUnitLabel } from "@/lib/games";
import { PLAYERS, otherPlayer, type PlayerId } from "@/lib/players";
import { useAppState } from "@/lib/client/store";
import type { GameBoard } from "@/lib/api-types";

export function LeaderboardView() {
  const { state } = useAppState();

  return (
    <>
      <AppHeader title="Classificação" />
      <div className="space-y-6 px-5">
        {!state ? (
          <div className="card h-28 animate-pulse" />
        ) : (
          <>
            <Scoreline state={state} label="Dias ganhos" big />

            <section>
              <h2 className="mb-3 px-1 text-lg font-semibold">Recordes por jogo</h2>
              <div className="space-y-2.5">
                {state.games.map((g, i) => (
                  <GameRecord key={g.gameId} board={g} me={state.me} index={i} />
                ))}
                {Array.from({ length: state.hiddenGames }, (_, i) => (
                  <MysteryCard key={i} index={state.games.length + i} />
                ))}
              </div>
            </section>

            {state.days.some((d) => d.status === "past" && d.gameId) && (
              <section>
                <h2 className="mb-3 px-1 text-lg font-semibold">Dia a dia</h2>
                <div className="card divide-y divide-line overflow-hidden">
                  {state.days
                    .filter((d) => d.gameId && d.status !== "locked")
                    .reverse()
                    .map((d) => (
                      <div key={d.day} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-7 font-display text-lg font-semibold text-muted tabular">{d.day}</span>
                        <span className="grid size-8 place-items-center rounded-xl text-white" style={{ background: GAMES[d.gameId!].color }}>
                          <GameIcon gameId={d.gameId!} className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{GAMES[d.gameId!].name}</p>
                          <p className="text-xs text-muted tabular">
                            <span style={{ color: PLAYERS[state.me].color }}>{formatScore(d.gameId!, d.best[state.me])}</span>
                            {"  vs  "}
                            <span style={{ color: PLAYERS[otherPlayer(state.me)].color }}>{formatScore(d.gameId!, d.best[otherPlayer(state.me)])}</span>
                          </p>
                        </div>
                        {d.status === "today" ? (
                          <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase text-night">Hoje</span>
                        ) : d.winner && d.winner !== "tie" ? (
                          <span className="relative">
                            <Head player={d.winner} size={30} />
                            <Crown className="absolute -right-1 -top-1.5 size-3.5 rotate-12 text-gold" fill="currentColor" />
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-faint">{d.winner === "tie" ? "empate" : "—"}</span>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function GameRecord({ board, me, index }: { board: GameBoard; me: PlayerId; index: number }) {
  const game = GAMES[board.gameId];
  const them = otherPlayer(me);
  const a = board.best[me]?.score ?? null;
  const b = board.best[them]?.score ?? null;
  const leader: PlayerId | null = a === null && b === null ? null : a === null ? them : b === null ? me : a === b ? null : isBetter(game.id, a, b) ? me : them;

  return (
    <article className="card animate-fade-up p-4" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: game.color }}>
          <GameIcon gameId={game.id} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight">{game.name}</h3>
          <p className="text-xs text-muted">
            {game.better === "low" ? "Menos é melhor" : "Mais é melhor"} · Dia{board.days.length > 1 ? "s" : ""} {board.days.join(", ")}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[me, them].map((p) => {
          const v = board.best[p];
          return (
            <div key={p} className="flex items-center gap-2 rounded-xl bg-black/20 px-2.5 py-2" style={{ boxShadow: leader === p ? `inset 0 0 0 1.5px ${PLAYERS[p].color}` : undefined }}>
              <span className="relative">
                <Head player={p} size={30} />
                {leader === p && <Crown className="absolute -right-1 -top-1.5 size-3 rotate-12 text-gold" fill="currentColor" />}
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold leading-none tabular">{formatScore(game.id, v?.score)}</p>
                <p className="truncate text-[10px] font-bold text-faint">{v ? `${scoreUnitLabel(game.id, v.score)} · dia ${v.day}`.replace(/^ · /, "") : "sem recorde"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function MysteryCard({ index }: { index: number }) {
  return (
    <article className="card flex animate-fade-up items-center gap-3 border-dashed p-4 opacity-70" style={{ animationDelay: `${index * 40}ms` }}>
      <span className="grid size-11 place-items-center rounded-2xl bg-white/8 font-display text-2xl font-semibold text-muted">?</span>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-muted">???</h3>
        <p className="text-xs text-faint">Ainda por descobrir</p>
      </div>
      <HelpCircle className="size-5 text-faint" />
    </article>
  );
}
