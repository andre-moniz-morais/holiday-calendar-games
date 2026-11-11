"use client";

import { useMemo } from "react";

const COLORS = ["#e0464e", "#f5bf4f", "#fff7ea", "#6cc6ff", "#ff7d8e", "#7ee0a6"];

/** CSS-only confetti burst. */
export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 53) % 40) / 100,
        dur: 1.6 + ((i * 29) % 12) / 10,
        color: COLORS[i % COLORS.length],
        rot: (i * 47) % 360,
        drift: ((i * 31) % 60) - 30,
        w: 6 + (i % 3) * 2,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-20px] block rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 0.5,
            background: p.color,
            animation: `confetti-fall ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.4,1) forwards`,
            ["--rot" as string]: `${p.rot}deg`,
            ["--drift" as string]: `${p.drift}vw`,
          }}
        />
      ))}
      <style>{`@keyframes confetti-fall{0%{transform:translate(0,0) rotate(var(--rot));opacity:1}100%{transform:translate(var(--drift),110vh) rotate(calc(var(--rot) + 720deg));opacity:.9}}`}</style>
    </div>
  );
}
