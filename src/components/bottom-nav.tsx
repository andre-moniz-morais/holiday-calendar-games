"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gamepad2, Lock, Trophy } from "lucide-react";
import { haptic } from "@/lib/client/haptics";
import { useAppState } from "@/lib/client/store";

const TABS = [
  { href: "/", label: "Calendário", Icon: CalendarDays },
  { href: "/games", label: "Jogos", Icon: Gamepad2 },
  { href: "/leaderboard", label: "Classificação", Icon: Trophy },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { state } = useAppState();
  const gamesLocked = !state || state.today < 25;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(10px+var(--safe-bottom))] pt-2" aria-label="Navegação principal">
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-[26px] border border-line bg-[#0f271d]/85 p-1.5 shadow-[0_12px_40px_-10px_rgba(0,0,0,.8)] backdrop-blur-xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => haptic("select")}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-bold transition-colors ${
                active ? "bg-cream text-night" : "text-muted active:bg-white/5"
              }`}
            >
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                {href === "/games" && gamesLocked && (
                  <span className={`absolute -right-2 -top-1.5 grid size-4 place-items-center rounded-full ${active ? "bg-night text-cream" : "bg-panel-2 text-gold"}`}>
                    <Lock className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
