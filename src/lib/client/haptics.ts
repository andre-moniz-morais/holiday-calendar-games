"use client";

import { getSettings } from "./settings";

export type HapticKind = "light" | "medium" | "heavy" | "success" | "error" | "select";

const VIBRATE: Record<HapticKind, number | number[]> = {
  select: 8,
  light: 12,
  medium: 22,
  heavy: 40,
  success: [16, 60, 22],
  error: [40, 50, 40, 50, 60],
};

// iOS Safari has no Vibration API, but since iOS 17.4 toggling an
// `<input type="checkbox" switch>` plays the system "selection" haptic. Clicking its
// <label> programmatically triggers it too — that's the workaround used here.
// Works best when called from (or shortly after) a user gesture.
const IOS_TICKS: Record<HapticKind, number> = { select: 1, light: 1, medium: 1, heavy: 2, success: 2, error: 3 };

let label: HTMLLabelElement | null = null;

function iosLabel(): HTMLLabelElement {
  if (label && label.isConnected) return label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.id = "__haptic_switch";
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  label = document.createElement("label");
  label.htmlFor = input.id;
  label.setAttribute("aria-hidden", "true");
  Object.assign(label.style, {
    position: "fixed",
    left: "-100px",
    top: "0",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: "0",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function haptic(kind: HapticKind = "light") {
  if (typeof window === "undefined" || !getSettings().haptics) return;
  try {
    if (typeof navigator.vibrate === "function" && !isIOS()) {
      navigator.vibrate(VIBRATE[kind]);
      return;
    }
    if (!isIOS()) return;
    const el = iosLabel();
    const ticks = IOS_TICKS[kind];
    el.click();
    for (let i = 1; i < ticks; i++) setTimeout(() => el.click(), i * 90);
  } catch {
    /* haptics are best effort */
  }
}
