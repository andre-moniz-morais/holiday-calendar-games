"use client";

import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { GameShell } from "./game-shell";
import { useAppState } from "@/lib/client/store";
import type { GameId } from "@/lib/games";

export function FreePlay({ gameId }: { gameId: GameId }) {
  const { state } = useAppState();
  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-muted" />
      </div>
    );
  }
  if (state.today < 25) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="card max-w-sm p-6 text-center">
          <Lock className="mx-auto size-8 text-gold" />
          <h1 className="mt-3 text-2xl font-semibold">Ainda não!</h1>
          <p className="mt-2 text-sm text-muted">Os jogos livres abrem no dia de Natal.</p>
          <Link href="/" replace className="btn btn-primary mt-5 w-full">
            Ir para o calendário
          </Link>
        </div>
      </div>
    );
  }
  return <GameShell gameId={gameId} day={null} />;
}
