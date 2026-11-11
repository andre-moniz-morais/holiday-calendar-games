"use client";

import { useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Head } from "./head";
import { haptic } from "@/lib/client/haptics";
import { sfx } from "@/lib/client/sfx";
import { clearState } from "@/lib/client/store";
import { PLAYERS, type PlayerId } from "@/lib/players";

export function LoginScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState<PlayerId | null>(null);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    haptic("select");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Algo correu mal.");
        setShake((s) => s + 1);
        haptic("error");
        inputRef.current?.select();
        return;
      }
      clearState();
      setWelcome(body.player);
      haptic("success");
      sfx("unlock");
      setTimeout(() => location.replace("/"), 1300);
    } catch {
      setError("Sem ligação. Tenta outra vez.");
    } finally {
      setBusy(false);
    }
  }

  if (welcome) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="animate-pop-in">
          <Head player={welcome} size={160} className="mx-auto animate-float drop-shadow-[0_18px_30px_rgba(0,0,0,.5)]" />
        </div>
        <h1 className="mt-6 animate-fade-up text-4xl font-semibold" style={{ animationDelay: "120ms" }}>
          Olá, <span style={{ color: PLAYERS[welcome].color }}>{PLAYERS[welcome].name}</span>!
        </h1>
        <p className="mt-2 animate-fade-up text-muted" style={{ animationDelay: "220ms" }}>
          A abrir o calendário…
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[calc(24px+var(--safe-bottom))] pt-[calc(24px+var(--safe-top))]">
      <div className="relative mb-8 flex h-40 items-end justify-center">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-gold">
          <StarIcon />
        </div>
        <Head player="filipino" size={118} className="relative z-10 -mr-4 -rotate-6 animate-float drop-shadow-[0_14px_24px_rgba(0,0,0,.45)]" />
        <Head player="duda" size={118} className="relative rotate-6 animate-float drop-shadow-[0_14px_24px_rgba(0,0,0,.45)] [animation-delay:-2s]" />
      </div>

      <h1 className="text-center text-[2.6rem] font-semibold leading-none">Natal a Dois</h1>
      <p className="mt-3 max-w-[18rem] text-center text-muted">Um desafio por dia até ao Natal. Quem ganha mais dias?</p>

      <form onSubmit={submit} className="mt-10 w-full max-w-sm">
        <label htmlFor="pw" className="mb-2 block pl-1 text-sm font-semibold text-muted">
          Palavra-passe
        </label>
        <div key={shake} className={`card flex items-center gap-2 p-1.5 pl-5 ${shake ? "animate-shake" : ""}`}>
          <input
            ref={inputRef}
            id="pw"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Quem és tu?"
            className="h-12 min-w-0 flex-1 bg-transparent text-lg text-cream outline-none placeholder:text-faint"
          />
          <button type="submit" disabled={busy || !password} aria-label="Entrar" className="btn btn-primary h-12 w-12 shrink-0 p-0 disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
          </button>
        </div>
        <p role="alert" className="mt-3 min-h-6 pl-1 text-sm font-semibold text-berry">
          {error}
        </p>
      </form>
    </main>
  );
}

function StarIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-[0_0_12px_rgba(245,191,79,.8)]">
      <path d="M12 2l2.9 6.26 6.86.74-5.1 4.64 1.43 6.76L12 17.02 5.91 20.4l1.43-6.76L2.24 9l6.86-.74z" />
    </svg>
  );
}
