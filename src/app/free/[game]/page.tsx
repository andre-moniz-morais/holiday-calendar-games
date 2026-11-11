import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FreePlay } from "@/components/free-play";
import { GAME_IDS, isGameId } from "@/lib/games";

export function generateStaticParams() {
  return GAME_IDS.map((game) => ({ game }));
}

export const metadata = { title: "Modo livre · Natal a Dois" };

export default function FreePage({ params }: PageProps<"/free/[game]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-night" />}>
      <Game params={params} />
    </Suspense>
  );
}

async function Game({ params }: { params: PageProps<"/free/[game]">["params"] }) {
  const { game } = await params;
  if (!isGameId(game)) notFound();
  return <FreePlay gameId={game} />;
}
