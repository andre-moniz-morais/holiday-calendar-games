"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { AppState, PlayResult } from "@/lib/api-types";
import type { GameId } from "@/lib/games";

/**
 * Tiny client store for the app state. Cached in memory + localStorage so the
 * PWA opens instantly (and works offline with the last known state).
 */
const KEY = "natal.state";
const OUTBOX = "natal.outbox";

type Snapshot = { state: AppState | null; loading: boolean; error: string | null; clockOffset: number };

let snap: Snapshot = { state: null, loading: false, error: null, clockOffset: 0 };
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER_SNAP: Snapshot = { state: null, loading: true, error: null, clockOffset: 0 };

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) snap = { ...snap, state: JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}

let inflight: Promise<void> | null = null;

export function refreshState(): Promise<void> {
  if (inflight) return inflight;
  snap = { ...snap, loading: true };
  emit();
  inflight = (async () => {
    try {
      await flushOutbox();
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const state = (await res.json()) as AppState;
      snap = { state, loading: false, error: null, clockOffset: state.serverNow - Date.now() };
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    } catch (e) {
      snap = { ...snap, loading: false, error: e instanceof Error ? e.message : "offline" };
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

export function useAppState() {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      hydrate();
      return snap;
    },
    () => SERVER_SNAP,
  );
  useEffect(() => {
    void refreshState();
    const onFocus = () => document.visibilityState === "visible" && void refreshState();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, []);
  return s;
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OUTBOX);
  } catch {
    /* ignore */
  }
  snap = { state: null, loading: false, error: null, clockOffset: 0 };
  emit();
}

// ---------- score submission with an offline outbox ----------

interface PendingPlay {
  gameId: GameId;
  day: number | null;
  score: number;
  durationMs: number;
}

function readOutbox(): PendingPlay[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? "[]");
  } catch {
    return [];
  }
}
function writeOutbox(list: PendingPlay[]) {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

async function post(play: PendingPlay): Promise<Response> {
  return fetch("/api/plays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(play) });
}

async function flushOutbox() {
  const list = readOutbox();
  if (!list.length) return;
  const remaining: PendingPlay[] = [];
  for (const p of list) {
    try {
      const res = await post(p);
      if (res.status >= 500) remaining.push(p);
    } catch {
      remaining.push(p);
    }
  }
  writeOutbox(remaining);
}

export type SubmitOutcome = { kind: "saved"; result: PlayResult } | { kind: "queued" } | { kind: "rejected"; message: string };

export async function submitPlay(play: PendingPlay): Promise<SubmitOutcome> {
  try {
    const res = await post(play);
    if (res.ok) {
      const result = (await res.json()) as PlayResult;
      void refreshState();
      return { kind: "saved", result };
    }
    if (res.status >= 500) throw new Error("server");
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { kind: "rejected", message: body.error ?? "Não foi possível guardar." };
  } catch {
    writeOutbox([...readOutbox(), play]);
    return { kind: "queued" };
  }
}
