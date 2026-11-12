import { Suspense } from "react";
import { PreviewDay } from "@/components/preview-day";

export function generateStaticParams() {
  return Array.from({ length: 24 }, (_, i) => ({ day: String(i + 1) }));
}

export const metadata = { title: "Espreitadela · Natal a Dois" };

export default function PreviewPage({ params }: PageProps<"/preview/[day]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-night" />}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: PageProps<"/preview/[day]">["params"] }) {
  const { day } = await params;
  return <PreviewDay day={Number(day)} />;
}
