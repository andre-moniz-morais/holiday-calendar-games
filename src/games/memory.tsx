"use client";

import { useEffect, useRef, useState } from "react";
import { shuffle } from "./engine";
import type { GameApi, GameModule } from "./types";

interface Card {
  key: number;
  pair: number;
  src: string;
}

const PAIRS = 8;

function Memory({ api }: { api: GameApi }) {
  const [cards] = useState<Card[]>(() => {
    const photos = shuffle(api.photos.map((p) => p.src)).slice(0, PAIRS);
    // If fewer photos than pairs exist, reuse them.
    while (photos.length < PAIRS && photos.length) photos.push(photos[photos.length % api.photos.length]);
    return shuffle(photos.flatMap((src, pair) => [0, 1].map((k) => ({ key: pair * 2 + k, pair, src }))));
  });
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const lock = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    api.setScore(0);
  }, [api]);

  function flip(i: number) {
    if (lock.current || open.includes(i) || matched.has(cards[i].pair) || doneRef.current) return;
    const a = api;
    a.sfx("flip");
    a.haptic("select");
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;

    const n = attempts + 1;
    setAttempts(n);
    a.setScore(n);
    const [x, y] = next;
    if (cards[x].pair === cards[y].pair) {
      const m = new Set(matched).add(cards[x].pair);
      setMatched(m);
      setOpen([]);
      setTimeout(() => {
        a.sfx("match");
        a.haptic("success");
      }, 250);
      if (m.size === PAIRS) {
        doneRef.current = true;
        setTimeout(() => api.end(n), 1100);
      }
    } else {
      lock.current = true;
      setTimeout(() => {
        setWrong(next);
        a.haptic("light");
      }, 380);
      setTimeout(() => {
        setOpen([]);
        setWrong([]);
        lock.current = false;
      }, 950);
    }
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "radial-gradient(100% 60% at 50% 0%, #2a1f4a 0%, transparent 70%), linear-gradient(180deg,#0a1f2c,#123a3a 60%,#1d5a45)" }}>
      <div className="snow-layer" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-center px-4 pb-[calc(16px+var(--safe-bottom))] pt-[calc(72px+var(--safe-top))]">
        <div
          className="grid grid-cols-4 gap-2.5"
          style={{ width: "min(100%, calc((100dvh - var(--safe-top) - var(--safe-bottom) - 110px) / 4 * 0.75 * 4 + 30px))" }}
        >
          {cards.map((c, i) => {
            const isOpen = open.includes(i) || matched.has(c.pair);
            const isMatched = matched.has(c.pair);
            return (
              <button
                key={c.key}
                onClick={() => flip(i)}
                aria-label={isOpen ? "Carta virada" : "Carta escondida"}
                className="relative aspect-[3/4] [perspective:800px]"
                style={{ animation: `pop-in .4s ${i * 25}ms cubic-bezier(.2,1.4,.4,1) both` }}
              >
                <div
                  className={`absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ${wrong.includes(i) ? "animate-shake" : ""}`}
                  style={{ transform: isOpen ? "rotateY(180deg)" : "none", transitionTimingFunction: "cubic-bezier(.3,1.3,.5,1)" }}
                >
                  {/* back */}
                  <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-[14px] shadow-[var(--shadow-pop)] [backface-visibility:hidden]"
                    style={{ background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,.18) 0 2px, transparent 2.5px) 0 0/13px 13px, linear-gradient(160deg,#ec5a60,#b92f38)" }}>
                    <div className="grid aspect-square w-[52%] place-items-center rounded-full border-2 border-white/30 bg-white/10">
                      <svg viewBox="0 0 24 24" className="size-[62%] text-gold drop-shadow" fill="currentColor"><path d="M12 2l2.9 6.26 6.86.74-5.1 4.64 1.43 6.76L12 17.02 5.91 20.4l1.43-6.76L2.24 9l6.86-.74z" /></svg>
                    </div>
                  </div>
                  {/* face */}
                  <div
                    className={`absolute inset-0 overflow-hidden rounded-[14px] bg-cream p-1 shadow-[var(--shadow-pop)] [backface-visibility:hidden] [transform:rotateY(180deg)] ${isMatched ? "ring-[3px] ring-gold" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.src} alt="" draggable={false} className="h-full w-full rounded-[10px] object-cover" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm font-bold text-white/70">
          {matched.size}/{PAIRS} pares encontrados
        </p>
      </div>
    </div>
  );
}

const mod: GameModule = { Component: Memory, needsPhotos: true, hudScore: "attempts" };
export default mod;
