import { Suspense } from "react";
import { PlayDay } from "@/components/play-day";

export function generateStaticParams() {
  return Array.from({ length: 24 }, (_, i) => ({ day: String(i + 1) }));
}

export const metadata = { title: "Desafio do dia · Natal a Dois" };

export default function PlayPage({ params }: PageProps<"/play/[day]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-night" />}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: PageProps<"/play/[day]">["params"] }) {
  const { day } = await params;
  return <PlayDay day={Number(day)} />;
}
