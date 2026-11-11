"use client";

import { getSettings } from "./settings";

/** Tiny synthesized sound effects (no audio files to download). */
export type SfxKind =
  | "tap"
  | "flap"
  | "jump"
  | "point"
  | "hit"
  | "over"
  | "record"
  | "flip"
  | "match"
  | "slice"
  | "shoot"
  | "pop"
  | "spring"
  | "hop"
  | "splash"
  | "unlock";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture so iOS lets us play sound later. */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const b = a.createBuffer(1, 1, 22050);
  const s = a.createBufferSource();
  s.buffer = b;
  s.connect(a.destination);
  s.start(0);
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; to?: number; vol?: number; delay?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { vol?: number; freq?: number; delay?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = opts.freq ?? 1800;
  const g = a.createGain();
  g.gain.value = opts.vol ?? 0.5;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const bell = (f: number, delay = 0, vol = 0.35) => {
  tone(f, 0.5, { type: "sine", vol, delay });
  tone(f * 2.01, 0.3, { type: "sine", vol: vol * 0.35, delay });
};

export function sfx(kind: SfxKind) {
  if (!getSettings().sound) return;
  switch (kind) {
    case "tap":
      return tone(660, 0.06, { type: "triangle", vol: 0.25 });
    case "flap":
      return tone(420, 0.09, { type: "triangle", to: 720, vol: 0.3 });
    case "jump":
      return tone(300, 0.16, { type: "square", to: 620, vol: 0.12 });
    case "hop":
      return tone(520, 0.08, { type: "triangle", to: 780, vol: 0.22 });
    case "spring":
      return tone(260, 0.3, { type: "square", to: 1100, vol: 0.12 });
    case "point":
      return bell(1318.5, 0, 0.22);
    case "pop":
      tone(880, 0.07, { type: "triangle", to: 1500, vol: 0.3 });
      return noise(0.08, { vol: 0.15, freq: 3000 });
    case "slice":
      return noise(0.12, { vol: 0.35, freq: 4200 });
    case "shoot":
      return tone(900, 0.07, { type: "square", to: 400, vol: 0.08 });
    case "flip":
      return noise(0.05, { vol: 0.25, freq: 2500 });
    case "match":
      bell(1046.5, 0, 0.25);
      return bell(1568, 0.09, 0.25);
    case "splash":
      return noise(0.4, { vol: 0.5, freq: 900 });
    case "hit":
      tone(160, 0.25, { type: "sawtooth", to: 60, vol: 0.25 });
      return noise(0.18, { vol: 0.4, freq: 700 });
    case "over":
      tone(523, 0.18, { type: "triangle", vol: 0.25 });
      tone(392, 0.18, { type: "triangle", vol: 0.25, delay: 0.16 });
      return tone(262, 0.4, { type: "triangle", vol: 0.25, delay: 0.32 });
    case "record":
    case "unlock":
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, i * 0.09, 0.22));
      return;
  }
}
