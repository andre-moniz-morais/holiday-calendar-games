"use client";

import { useEffect, useState } from "react";
import { msUntilNextDoor } from "@/lib/calendar";

/** Live countdown to the next door opening (uses the server clock offset). */
export function useNextDoorCountdown(clockOffset: number, onZero?: () => void): number | null {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const left = msUntilNextDoor(new Date(Date.now() + clockOffset));
      setMs(left);
      if (left <= 1000 && !fired) {
        fired = true;
        setTimeout(() => onZero?.(), 1500);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockOffset, onZero]);
  return ms;
}
