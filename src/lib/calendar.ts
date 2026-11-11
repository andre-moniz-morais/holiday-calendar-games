/** Calendar helpers shared by client and server. All dates are evaluated in Lisbon time. */

export const CALENDAR_YEAR = Number(process.env.NEXT_PUBLIC_CALENDAR_YEAR ?? 2026);
export const LAST_DAY = 25;
export const TIME_ZONE = "Europe/Lisbon";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function lisbonParts(d: Date) {
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Which calendar day is it?
 *  0      → before 1 December
 *  1..25  → that December day
 *  26     → after Christmas (everything open)
 */
export function calendarDay(now: Date): number {
  const p = lisbonParts(now);
  if (p.year < CALENDAR_YEAR || (p.year === CALENDAR_YEAR && p.month < 12)) return 0;
  if (p.year === CALENDAR_YEAR && p.month === 12) return Math.min(p.day, 26);
  return 26;
}

/** Milliseconds until the next Lisbon midnight (or until 1 Dec if before the calendar). */
export function msUntilNextDoor(now: Date): number {
  const day = calendarDay(now);
  if (day === 0) {
    // Lisbon is on UTC+0 in December, so 1 Dec 00:00 Lisbon == 1 Dec 00:00 UTC.
    return Math.max(0, Date.UTC(CALENDAR_YEAR, 11, 1) - now.getTime());
  }
  const p = lisbonParts(now);
  const secs = p.hour * 3600 + p.minute * 60 + p.second;
  return (86400 - secs) * 1000 - now.getMilliseconds();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
