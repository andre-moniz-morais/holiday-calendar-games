import { Head } from "./head";
import { PLAYERS, otherPlayer } from "@/lib/players";
import type { AppState } from "@/lib/api-types";

/** "Dias ganhos" tug-of-war bar between the two players. */
export function Scoreline({ state, label, big = false }: { state: AppState; label: string; big?: boolean }) {
  const me = state.me;
  const them = otherPlayer(me);
  const a = state.wins[me];
  const b = state.wins[them];
  const total = a + b;
  const pct = total ? (a / total) * 100 : 50;

  return (
    <section className={`card ${big ? "p-5" : "px-4 py-3.5"}`}>
      <div className="flex items-center gap-3">
        <Head player={me} size={big ? 52 : 36} />
        <span className={`font-display font-semibold tabular ${big ? "text-4xl" : "text-2xl"}`} style={{ color: PLAYERS[me].color }}>
          {a}
        </span>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
          {state.wins.tie > 0 && <p className="text-[11px] text-faint">{state.wins.tie} empate{state.wins.tie > 1 ? "s" : ""}</p>}
        </div>
        <span className={`font-display font-semibold tabular ${big ? "text-4xl" : "text-2xl"}`} style={{ color: PLAYERS[them].color }}>
          {b}
        </span>
        <Head player={them} size={big ? 52 : 36} />
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full transition-[width] duration-700" style={{ width: `${pct}%`, background: PLAYERS[me].color }} />
        <div className="h-full flex-1" style={{ background: PLAYERS[them].color }} />
      </div>
    </section>
  );
}
