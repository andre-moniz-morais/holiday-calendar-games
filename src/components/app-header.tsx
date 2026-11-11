"use client";

import { useState } from "react";
import { LogOut, Settings, Vibrate, VibrateOff, Volume2, VolumeX } from "lucide-react";
import { Head } from "./head";
import { Sheet } from "./sheet";
import { haptic } from "@/lib/client/haptics";
import { setSettings, useSettings } from "@/lib/client/settings";
import { clearState, useAppState } from "@/lib/client/store";
import { PLAYERS } from "@/lib/players";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const settings = useSettings();

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    clearState();
    location.replace("/login");
  }

  return (
    <header className="flex items-center gap-3 px-5 pb-4 pt-[calc(14px+var(--safe-top))]">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-muted">{subtitle ?? (state ? <>Olá, <span style={{ color: PLAYERS[state.me].color }}>{PLAYERS[state.me].name}</span></> : " ")}</p>
        <h1 className="truncate text-[1.9rem] font-semibold leading-tight">{title}</h1>
      </div>
      <button
        onClick={() => {
          haptic("select");
          setOpen(true);
        }}
        aria-label="Definições"
        className="relative grid size-12 shrink-0 place-items-center rounded-full border border-line bg-white/5 active:scale-95"
      >
        {state ? <Head player={state.me} size={40} /> : <Settings className="size-5 text-muted" />}
        <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-panel-2 ring-2 ring-night">
          <Settings className="size-3 text-muted" />
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={<h2 className="text-xl font-semibold">Definições</h2>}>
        <div className="space-y-2">
          <Toggle
            label="Sons"
            on={settings.sound}
            icon={settings.sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            onChange={(v) => setSettings({ sound: v })}
          />
          <Toggle
            label="Vibração"
            on={settings.haptics}
            icon={settings.haptics ? <Vibrate className="size-5" /> : <VibrateOff className="size-5" />}
            onChange={(v) => {
              setSettings({ haptics: v });
              if (v) haptic("success");
            }}
          />
          <button onClick={logout} className="mt-3 flex h-14 w-full items-center gap-3 rounded-2xl bg-white/5 px-4 font-bold text-berry active:bg-white/10">
            <LogOut className="size-5" /> Terminar sessão
          </button>
        </div>
      </Sheet>
    </header>
  );
}

function Toggle({ label, on, icon, onChange }: { label: string; on: boolean; icon: React.ReactNode; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => {
        onChange(!on);
        haptic("select");
      }}
      role="switch"
      aria-checked={on}
      className="flex h-14 w-full items-center gap-3 rounded-2xl bg-white/5 px-4 text-left font-bold active:bg-white/10"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-pine-2" : "bg-white/15"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}
