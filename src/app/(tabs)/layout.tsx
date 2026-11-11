import { BottomNav } from "@/components/bottom-nav";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md pb-[calc(var(--nav-h)+var(--safe-bottom)+28px)]">{children}</main>
      <BottomNav />
    </>
  );
}
