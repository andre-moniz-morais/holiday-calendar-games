"use client";

/**
 * Keep the app at 100% zoom. The viewport meta (`maximum-scale=1, user-scalable=no`) is
 * ignored by iOS Safari, so pinch, double-tap and keyboard/trackpad zoom are blocked here.
 */
export function installZoomLock(): () => void {
  // iOS Safari pinch gestures.
  const onGesture = (e: Event) => e.preventDefault();
  // Any multi-finger move would start a pinch.
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  // Double-tap zoom is disabled with `touch-action: manipulation` in globals.css (blocking it
  // here would also swallow fast repeated taps).
  // Desktop: trackpad pinch / ctrl+wheel and ctrl/cmd + "+", "-", "0".
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "_", "0"].includes(e.key)) e.preventDefault();
  };

  const opts = { passive: false } as const;
  document.addEventListener("gesturestart", onGesture, opts);
  document.addEventListener("gesturechange", onGesture, opts);
  document.addEventListener("gestureend", onGesture, opts);
  document.addEventListener("touchmove", onTouchMove, opts);
  document.addEventListener("wheel", onWheel, opts);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("gesturestart", onGesture);
    document.removeEventListener("gesturechange", onGesture);
    document.removeEventListener("gestureend", onGesture);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("wheel", onWheel);
    document.removeEventListener("keydown", onKey);
  };
}
