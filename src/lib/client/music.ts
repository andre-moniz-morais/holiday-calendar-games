"use client";

import { audio as audioContext } from "./sfx";
import { getSettings, subscribeSettings } from "./settings";

/**
 * Quiet background music. Tracks live in `public/music/` and are listed by `/api/music`.
 *
 * Order: random, and a song never repeats until every song has played — the history is kept in
 * localStorage, so each time the app is opened it carries on with a song not heard yet.
 */
const KEY = "natal.music";
const VOLUME = 0.18;
const FADE = 0.6; // seconds

interface Memory {
  /** Songs already played in the current round. */
  played: string[];
  last?: string;
}

let tracks: string[] | null = null;
let listing: Promise<string[] | null> | null = null;
let el: HTMLAudioElement | null = null;
let gain: GainNode | null = null;
let failures = 0;
let wantPlaying = false;

function readMemory(): Memory {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (m && Array.isArray(m.played)) return m;
  } catch {
    /* ignore */
  }
  return { played: [] };
}

function writeMemory(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Pick a random song not played in this round; start a new round when all have played. */
function pickNext(list: string[]): string {
  const mem = readMemory();
  let played = mem.played.filter((t) => list.includes(t));
  let candidates = list.filter((t) => !played.includes(t));
  if (!candidates.length) {
    played = [];
    candidates = list.length > 1 ? list.filter((t) => t !== mem.last) : list;
  }
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  writeMemory({ played: [...played, next], last: next });
  return next;
}

function loadTracks(): Promise<string[] | null> {
  if (tracks) return Promise.resolve(tracks);
  listing ??= fetch("/api/music", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ tracks: string[] }>) : null))
    .then((body) => {
      const probe = document.createElement("audio");
      tracks = body ? body.tracks.filter((t) => probe.canPlayType(mimeOf(t)) !== "") : null;
      return tracks;
    })
    .catch(() => null)
    .finally(() => {
      listing = null;
    });
  return listing;
}

function mimeOf(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "m4a":
    case "mp4":
    case "aac":
      return "audio/mp4";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "opus":
      return "audio/ogg; codecs=opus";
    case "webm":
      return "audio/webm";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    default:
      return "audio/mpeg";
  }
}

function element(): HTMLAudioElement {
  if (el) return el;
  el = new Audio();
  el.preload = "auto";
  el.setAttribute("playsinline", "");
  el.addEventListener("ended", () => {
    failures = 0;
    playNext();
  });
  el.addEventListener("playing", () => {
    failures = 0;
  });
  el.addEventListener("error", () => {
    // Broken file → skip it (but don't spin forever if every file fails).
    if (tracks && ++failures < tracks.length) playNext();
  });

  // iOS ignores `audio.volume`, so route the element through a Web Audio gain node.
  const ctx = audioContext();
  if (ctx) {
    try {
      gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    } catch {
      gain = null;
    }
  }
  if (!gain) el.volume = VOLUME;
  return el;
}

function fadeTo(v: number) {
  const ctx = audioContext();
  if (gain && ctx) {
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(v, ctx.currentTime, FADE / 3);
  }
}

function playNext() {
  if (!tracks?.length || !wantPlaying) return;
  const a = element();
  a.src = pickNext(tracks);
  void a.play().catch(() => {});
  fadeTo(VOLUME);
}

/** Start (or resume) the music. Call it from a user gesture — iOS won't play audio otherwise. */
function start() {
  if (!getSettings().music) return;
  wantPlaying = true;
  if (!tracks) {
    void loadTracks().then((t) => {
      if (t?.length && wantPlaying && (!el || el.paused)) {
        // Outside the gesture now; if the browser refuses, the next tap tries again.
        if (el?.src) resume();
        else playNext();
      }
    });
    return;
  }
  if (!tracks.length) return;
  if (el?.src) resume();
  else playNext();
}

function resume() {
  if (!el) return;
  audioContext(); // resumes a suspended context
  if (el.paused) void el.play().catch(() => {});
  fadeTo(VOLUME);
}

function stop() {
  wantPlaying = false;
  if (!el || el.paused) return;
  fadeTo(0);
  const a = el;
  if (gain) setTimeout(() => !wantPlaying && a.pause(), FADE * 1000);
  else a.pause();
}

export function installMusic(): () => void {
  // Mix with other apps (e.g. the user's own music) and respect the silent switch on iOS.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "ambient";

  void loadTracks();

  // Start on a tap; keep checking on later taps in case playback was refused or the list failed.
  const onGesture = () => {
    if (!getSettings().music) return;
    if (gain) audioContext(); // a context suspended outside a gesture would keep the music silent
    if (!el || el.paused || !wantPlaying) start();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      el?.pause();
    } else if (wantPlaying && getSettings().music) {
      resume();
    }
  };
  let wasOn = getSettings().music;
  const unsubscribe = subscribeSettings(() => {
    const on = getSettings().music;
    if (on === wasOn) return;
    wasOn = on;
    if (on) start(); // the toggle tap is the user gesture
    else stop();
  });

  window.addEventListener("click", onGesture, true);
  window.addEventListener("touchend", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("click", onGesture, true);
    window.removeEventListener("touchend", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    document.removeEventListener("visibilitychange", onVisibility);
    unsubscribe();
    stop();
  };
}
