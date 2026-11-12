"use client";

import { useEffect } from "react";
import { installTapHaptics } from "@/lib/client/haptics";
import { installMusic } from "@/lib/client/music";
import { installZoomLock } from "@/lib/client/zoom-lock";

/** App-wide behaviours: 100% zoom, a haptic on every button, background music. */
export function AppRuntime() {
  useEffect(() => {
    const cleanups = [installZoomLock(), installTapHaptics(), installMusic()];
    return () => cleanups.forEach((c) => c());
  }, []);
  return null;
}
