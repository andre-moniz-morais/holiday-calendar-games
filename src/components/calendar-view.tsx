"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Gift, Lock, Play, Sparkles, Timer } from "lucide-react";
import { AppHeader } from "./app-header";
import { GameIcon } from "./game-icon";
import { Head } from "./head";
import { Sheet } from "./sheet";
import { Scoreline } from "./scoreline";
import { formatCountdown } from "@/lib/calendar";
import { GAMES, formatScore, scoreUnitLabel } from "@/lib/games";
import { PLAYERS, otherPlayer, type PlayerId } from "@/lib/players";
import { haptic } from "@/lib/client/haptics";
import { sfx } from "@/lib/client/sfx";
import { refreshState, useAppState } from "@/lib/client/store";
import { useNextDoorCountdown } from "@/lib/client/use-countdown";
import type { AppState, DayState } from "@/lib/api-types";

/** Doors are shuffled like a real advent calendar. */
const DOOR_ORDER = [7, 18, 3, 22, 12, 1, 15, 9, 24, 5, 20, 11, 2, 17, 8, 14, 23, 4, 10, 19, 6, 13, 21, 16];
const STYLES = ["door-berry", "door-pine", "door-cream", "door-ice"];
const doorStyle = (day: number) => STYLES[(day * 7 + Math.floor(day / 3)) % STYLES.length];

export function CalendarView() {
  const { state, clockOffset } = useAppState();
  const router = useRouter();
  const [sheetDay, setSheetDay] = useState<DayState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const onZero = useCallback(() => void refreshState(), []);
  const countdown = useNextDoorCountdown(clockOffset, onZero);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  };

  function openDoor(d: DayState) {
    if (d.status === "locked") {
      haptic("error");
      const tomorrow = state && d.day === state.today + 1;
      showToast(tomorrow && countdown !== null ? `Abre daqui a ${formatCountdown(countdown)}` : `Abre a ${d.day} de dezembro`);
      return;
    }
    if (d.day === 25) {
      haptic("success");
      sfx("unlock");
      setOpening(25);
      setTimeout(() => router.push("/wrapped"), 520);
      return;
    }
    if (d.status === "today") {
      haptic("medium");
      sfx("unlock");
      setOpening(d.day);
      setTimeout(() => router.push(`/play/${d.day}`), 520);
      return;
    }
    haptic("select");
    setSheetDay(d);
  }

  return (
    <>
      <AppHeader title="Calendário" />
      <div className="space-y-5 px-5">
        {!state ? <HeroSkeleton /> : <Hero state={state} countdown={countdown} onPlay={(d) => openDoor(d)} />}

        {state && state.today > 1 && <Scoreline state={state} label="Dias ganhos" />}

        <section aria-label="Portas do calendário">
          <div className="grid grid-cols-4 gap-2.5">
            {DOOR_ORDER.map((day, i) => {
              const d = state?.days[day - 1];
              return <Door key={day} day={day} d={d} me={state?.me} opening={opening === day} index={i} onClick={() => d && openDoor(d)} />;
            })}
          </div>
          <BigDoor d={state?.days[24]} opening={opening === 25} onClick={() => state && openDoor(state.days[24])} />
        </section>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+var(--safe-bottom)+24px)] z-50 flex justify-center px-6">
          <div className="animate-pop-in flex items-center gap-2 rounded-full bg-cream px-4 py-2.5 text-sm font-bold text-night shadow-xl">
            <Lock className="size-4" /> {toast}
          </div>
        </div>
      )}

      <Sheet
        open={!!sheetDay}
        onClose={() => setSheetDay(null)}
        title={
          sheetDay?.gameId && (
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: GAMES[sheetDay.gameId].color }}>
                <GameIcon gameId={sheetDay.gameId} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Dia {sheetDay.day}</p>
                <h2 className="text-xl font-semibold leading-tight">{GAMES[sheetDay.gameId].name}</h2>
              </div>
            </div>
          )
        }
      >
        {sheetDay && state && <DayResults d={sheetDay} me={state.me} />}
      </Sheet>
    </>
  );
}

function Door({ day, d, me, opening, index, onClick }: { day: number; d?: DayState; me?: PlayerId; opening: boolean; index: number; onClick: () => void }) {
  const status = d?.status ?? "locked";
  const style = doorStyle(day);
  return (
    <button
      onClick={onClick}
      aria-label={`Dia ${day}${status === "locked" ? ", fechado" : status === "today" ? ", hoje" : ""}`}
      className={`door aspect-square animate-pop-in ${status === "today" ? "door-today" : ""} ${status === "locked" ? "door-locked" : ""} ${opening ? "opening" : ""}`}
      style={{ animationDelay: `${index * 18}ms` }}
    >
      <div className="door-inner grid place-items-center">
        {d?.gameId && (
          <div className="flex flex-col items-center gap-1">
            <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: GAMES[d.gameId].color }}>
              <GameIcon gameId={d.gameId} className="size-[18px]" />
            </span>
            {status === "past" && <WinnerBadge winner={d.winner} me={me} />}
          </div>
        )}
        <span className="absolute left-2 top-1.5 font-display text-xs font-semibold text-white/50">{day}</span>
      </div>

      {status !== "past" && (
        <div className={`door-panel ${style} grid place-items-center ${style === "door-cream" ? "" : "text-white"}`}>
          <span className="door-number text-[1.9rem]">{day}</span>
          {status === "today" && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2 py-[1px] text-[9px] font-black uppercase tracking-wider text-night">Hoje</span>}
          {status === "locked" && <Lock className="absolute right-1.5 top-1.5 size-3 opacity-50" strokeWidth={3} />}
        </div>
      )}
    </button>
  );
}

function WinnerBadge({ winner, me }: { winner: DayState["winner"]; me?: PlayerId }) {
  if (!winner) return <span className="text-[10px] font-bold text-faint">sem jogos</span>;
  if (winner === "tie") return <span className="text-[10px] font-bold text-muted">empate</span>;
  return (
    <span className="relative">
      <Head player={winner} size={22} />
      <Crown className="absolute -right-1.5 -top-2 size-3 rotate-12 text-gold" fill="currentColor" />
      <span className="sr-only">{winner === me ? "Ganhaste" : "Perdeste"}</span>
    </span>
  );
}

function BigDoor({ d, opening, onClick }: { d?: DayState; opening: boolean; onClick: () => void }) {
  const unlocked = d && d.status !== "locked";
  return (
    <button onClick={onClick} className={`door mt-2.5 block h-28 w-full ${unlocked ? "door-today" : "door-locked"} ${opening ? "opening" : ""}`} aria-label="Dia 25, a grande prenda">
      <div className="door-inner grid place-items-center">
        <Sparkles className="size-8 text-gold" />
      </div>
      <div className="door-panel door-gold flex items-center justify-between px-5">
        <span className="door-number text-5xl">25</span>
        <div className="rounded-2xl bg-cream/90 px-3 py-2 text-right text-night shadow">
          <p className="font-display text-base font-semibold leading-tight">A Grande Prenda</p>
          <p className="text-xs font-bold text-night/60">{unlocked ? "O vosso resumo do Natal" : "Abre no dia de Natal"}</p>
        </div>
      </div>
    </button>
  );
}

function Hero({ state, countdown, onPlay }: { state: AppState; countdown: number | null; onPlay: (d: DayState) => void }) {
  const { today, me } = state;
  const them = otherPlayer(me);

  if (today === 0) {
    return (
      <section className="card relative overflow-hidden p-5">
        <Gift className="absolute -right-4 -top-4 size-28 rotate-12 text-berry/25" />
        <p className="text-sm font-bold uppercase tracking-wider text-gold">Quase a começar</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight">A primeira porta abre a 1 de dezembro</h2>
        <p className="mt-4 font-display text-4xl font-semibold tabular">{countdown !== null ? formatCountdown(countdown) : "…"}</p>
        <p className="mt-3 text-sm text-muted">Todos os dias um jogo novo. Joga quantas vezes quiseres — conta o teu melhor resultado do dia.</p>
      </section>
    );
  }

  if (today >= 25) {
    return (
      <section className="card relative overflow-hidden p-5">
        <div className="absolute -right-6 -top-6 size-32 rounded-full bg-gold/20 blur-2xl" />
        <p className="text-sm font-bold uppercase tracking-wider text-gold">Feliz Natal!</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight">O vosso Natal em jogos está pronto</h2>
        <p className="mt-2 text-sm text-muted">Recordes, vitórias e o grande vencedor do calendário.</p>
        <button onClick={() => onPlay(state.days[24])} className="btn btn-gold mt-5 w-full">
          <Gift className="size-5" /> Abrir a prenda
        </button>
      </section>
    );
  }

  const d = state.days[today - 1];
  const game = GAMES[d.gameId!];
  const mine = d.best[me];
  const theirs = d.best[them];

  return (
    <section className="card relative overflow-hidden p-5">
      <div className="absolute -right-10 -top-10 size-40 rounded-full opacity-30 blur-2xl" style={{ background: game.color }} />
      <div className="relative flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-[18px] text-white shadow-lg" style={{ background: game.color }}>
          <GameIcon gameId={game.id} className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-gold">Dia {today} · Desafio de hoje</p>
          <h2 className="text-2xl font-semibold leading-tight">{game.name}</h2>
          <p className="text-sm text-muted">{game.tagline}</p>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2.5">
        <ScoreChip player={me} label="Tu" value={mine} gameId={game.id} lead={d.winner === me} />
        <ScoreChip player={them} label={PLAYERS[them].name} value={theirs} gameId={game.id} lead={d.winner === them} />
      </div>

      <button onClick={() => onPlay(d)} className="btn btn-primary relative mt-4 w-full">
        <Play className="size-5" fill="currentColor" /> {d.plays[me] ? "Jogar outra vez" : "Jogar"}
      </button>
      <p className="relative mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted">
        <Timer className="size-3.5" /> Fecha em <span className="tabular">{countdown !== null ? formatCountdown(countdown) : "…"}</span>
      </p>
    </section>
  );
}

function ScoreChip({ player, label, value, gameId, lead }: { player: PlayerId; label: string; value: number | null; gameId: DayState["gameId"]; lead: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-black/20 p-2.5 pr-3" style={{ boxShadow: lead ? `inset 0 0 0 1.5px ${PLAYERS[player].color}` : undefined }}>
      <div className="relative">
        <Head player={player} size={36} />
        {lead && <Crown className="absolute -right-1 -top-2 size-3.5 rotate-12 text-gold" fill="currentColor" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-muted">{label}</p>
        <p className="font-display text-xl font-semibold leading-none tabular">{gameId ? formatScore(gameId, value) : "—"}</p>
      </div>
    </div>
  );
}

function DayResults({ d, me }: { d: DayState; me: PlayerId }) {
  const them = otherPlayer(me);
  const gameId = d.gameId!;
  return (
    <div className="space-y-3 pb-1">
      <div className="grid grid-cols-2 gap-2.5">
        {[me, them].map((p) => (
          <div key={p} className="relative rounded-2xl bg-black/20 p-4 text-center" style={{ boxShadow: d.winner === p ? `inset 0 0 0 2px ${PLAYERS[p].color}` : undefined }}>
            {d.winner === p && <Crown className="absolute right-3 top-3 size-5 text-gold" fill="currentColor" />}
            <Head player={p} size={56} className="mx-auto" />
            <p className="mt-2 text-xs font-bold text-muted">{p === me ? "Tu" : PLAYERS[p].name}</p>
            <p className="font-display text-3xl font-semibold tabular">{formatScore(gameId, d.best[p])}</p>
            <p className="text-xs text-faint">
              {d.best[p] !== null ? scoreUnitLabel(gameId, d.best[p]) : "não jogou"} · {d.plays[p]} {d.plays[p] === 1 ? "jogo" : "jogos"}
            </p>
          </div>
        ))}
      </div>
      <p className="text-center text-sm font-bold text-muted">
        {d.winner === "tie" ? "Empate!" : d.winner ? (d.winner === me ? "Ganhaste este dia 🎉" : `${PLAYERS[d.winner].name} ganhou este dia`) : "Ninguém jogou neste dia."}
      </p>
    </div>
  );
}

function HeroSkeleton() {
  return <div className="card h-[264px] animate-pulse" />;
}
