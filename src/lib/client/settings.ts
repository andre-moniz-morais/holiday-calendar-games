"use client";

import { useSyncExternalStore } from "react";

export interface Settings {
  sound: boolean;
  haptics: boolean;
  music: boolean;
}

const KEY = "natal.settings";
const DEFAULTS: Settings = { sound: true, haptics: true, music: true };
let current: Settings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}

export function getSettings(): Settings {
  load();
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  load();
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    subscribeSettings,
    getSettings,
    () => DEFAULTS,
  );
}
