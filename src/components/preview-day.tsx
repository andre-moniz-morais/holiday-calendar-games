"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { GameShell } from "./game-shell";
import type { GameId } from "@/lib/games";

/** A locked door opened early (triple tap, only before 1 Dec 2026). Nothing gets saved. */
export function PreviewDay({ day }: { day: number }) {
  const [gameId, setGameId] = useState<GameId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/peek?day=${day}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "Não foi possível abrir esta porta.");
        return body as { gameId: GameId };
      })
      .then((b) => alive && setGameId(b.gameId))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [day]);

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="card max-w-sm p-6 text-center">
          <Lock className="mx-auto size-8 text-gold" />
          <h1 className="mt-3 text-2xl font-semibold">Porta fechada</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Link href="/" replace className="btn btn-primary mt-5 w-full">
            Ir para o calendário
          </Link>
        </div>
      </div>
    );
  }
  if (!gameId) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-muted" />
      </div>
    );
  }
  return <GameShell gameId={gameId} day={day} preview />;
}
