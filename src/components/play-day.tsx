"use client";

import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { GameShell } from "./game-shell";
import { useAppState } from "@/lib/client/store";

export function PlayDay({ day }: { day: number }) {
  const { state } = useAppState();
  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-muted" />
      </div>
    );
  }
  const d = state.days[day - 1];
  if (!d || d.status !== "today" || !d.gameId) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="card max-w-sm p-6 text-center">
          <Lock className="mx-auto size-8 text-gold" />
          <h1 className="mt-3 text-2xl font-semibold">{d?.status === "past" ? "Este dia já fechou" : "Ainda não abriu"}</h1>
          <p className="mt-2 text-sm text-muted">Só podes jogar o desafio de hoje.</p>
          <Link href="/" replace className="btn btn-primary mt-5 w-full">
            Ir para o calendário
          </Link>
        </div>
      </div>
    );
  }
  return <GameShell gameId={d.gameId} day={day} />;
}
