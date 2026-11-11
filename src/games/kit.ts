/** Shared visual language for every canvas game: palette, sky, hills, snow, particles, heads. */
import { hash, rand } from "./engine";

export const PAL = {
  skyTop: "#0a1f2c",
  skyMid: "#123a3a",
  skyBottom: "#1d5a45",
  night: "#0b1d16",
  snow: "#f4f8fc",
  snowShade: "#cddbea",
  pine: "#1f6b4a",
  pineDark: "#134a33",
  pineDeep: "#0e3527",
  berry: "#e0464e",
  berryDark: "#b92f38",
  gold: "#f5bf4f",
  goldDark: "#d99a22",
  cream: "#fff7ea",
  wood: "#8a5a3c",
  woodDark: "#5e3b26",
  ice: "#9fd3ff",
  iceDark: "#5a9fd6",
  white: "#ffffff",
};

export const CONFETTI = [PAL.berry, PAL.gold, PAL.snow, "#6cc6ff", "#ff7d8e", "#7ee0a6"];

// ───────────── sky ─────────────
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, top = PAL.skyTop, bottom = PAL.skyBottom) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.55, PAL.skyMid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export class Stars {
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  constructor(count = 60) {
    for (let i = 0; i < count; i++) this.stars.push({ x: Math.random(), y: Math.random() * 0.6, r: rand(0.6, 1.8), p: Math.random() * Math.PI * 2 });
  }
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, offsetX = 0) {
    ctx.fillStyle = PAL.white;
    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p));
      const x = (((s.x * w - offsetX) % w) + w) % w;
      ctx.beginPath();
      ctx.arc(x, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3);
  glow.addColorStop(0, "rgba(255,247,234,.25)");
  glow.addColorStop(1, "rgba(255,247,234,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.cream;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(205,219,234,.55)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

// ───────────── hills & trees ─────────────
export function drawPine(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number, color = PAL.pineDark, snow = true) {
  const w = height * 0.62;
  ctx.fillStyle = PAL.woodDark;
  ctx.fillRect(x - height * 0.05, baseY - height * 0.14, height * 0.1, height * 0.16);
  for (let i = 0; i < 3; i++) {
    const tierTop = baseY - height + i * height * 0.26;
    const tierBottom = baseY - height * 0.1 - (2 - i) * height * 0.2;
    const tw = w * (0.55 + i * 0.22);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, tierTop);
    ctx.lineTo(x + tw / 2, tierBottom);
    ctx.lineTo(x - tw / 2, tierBottom);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.fillStyle = "rgba(244,248,252,.85)";
      ctx.beginPath();
      ctx.moveTo(x, tierTop);
      ctx.lineTo(x + tw * 0.18, tierTop + (tierBottom - tierTop) * 0.36);
      ctx.lineTo(x, tierTop + (tierBottom - tierTop) * 0.3);
      ctx.lineTo(x - tw * 0.18, tierTop + (tierBottom - tierTop) * 0.36);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** A seamless, scrolling layer of snowy hills with pine trees. */
export function drawHills(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  offset: number,
  opts: { color: string; cap?: string; trees?: number; treeColor?: string; seed?: number; bottom?: number },
) {
  const seed = opts.seed ?? 1;
  const yAt = (x: number) => {
    const u = (x + offset) / w;
    return baseY - amp * (0.55 + 0.25 * Math.sin(u * 6.283 * 1 + seed) + 0.2 * Math.sin(u * 6.283 * 2.3 + seed * 2));
  };
  ctx.fillStyle = opts.color;
  ctx.beginPath();
  ctx.moveTo(0, opts.bottom ?? baseY + 2000);
  for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, yAt(x));
  ctx.lineTo(w, opts.bottom ?? baseY + 2000);
  ctx.closePath();
  ctx.fill();
  if (opts.cap) {
    ctx.strokeStyle = opts.cap;
    ctx.lineWidth = Math.max(2, amp * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = 0; x <= w + 8; x += 8) (x === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, yAt(x) + ctx.lineWidth / 2);
    ctx.stroke();
  }
  if (opts.trees) {
    const spacing = w / opts.trees;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i < first + opts.trees + 3; i++) {
      const r = hash(i * 13.7 + seed);
      if (r < 0.35) continue;
      const x = i * spacing - offset + r * spacing * 0.6;
      const th = amp * (0.5 + hash(i * 3.1 + seed) * 0.6);
      drawPine(ctx, x, yAt(x) + th * 0.08, th, opts.treeColor ?? PAL.pineDeep);
    }
  }
}

// ───────────── snow ─────────────
export class Snowfall {
  private flakes: { x: number; y: number; r: number; v: number; d: number }[] = [];
  constructor(private count = 70) {}
  update(dt: number, w: number, h: number, windX = 0) {
    while (this.flakes.length < this.count) this.flakes.push({ x: Math.random() * w, y: Math.random() * h, r: rand(0.8, 2.6), v: rand(18, 55), d: Math.random() * 6 });
    for (const f of this.flakes) {
      f.y += f.v * dt;
      f.d += dt;
      f.x += (Math.sin(f.d) * 12 + windX) * dt;
      if (f.y > h + 4) {
        f.y = -4;
        f.x = Math.random() * w;
      }
      if (f.x < -4) f.x = w + 4;
      if (f.x > w + 4) f.x = -4;
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.beginPath();
    for (const f of this.flakes) {
      ctx.moveTo(f.x + f.r, f.y);
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

// ───────────── particles ─────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  shape: "circle" | "rect" | "star";
}

export class Particles {
  list: Particle[] = [];
  burst(
    x: number,
    y: number,
    opts: { count?: number; colors?: string[]; speed?: number; size?: number; life?: number; shape?: Particle["shape"]; spread?: number; angle?: number } = {},
  ) {
    const n = opts.count ?? 16;
    for (let i = 0; i < n; i++) {
      const a = opts.angle !== undefined ? opts.angle + rand(-(opts.spread ?? Math.PI), opts.spread ?? Math.PI) : Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 220) * rand(0.35, 1);
      const life = (opts.life ?? 0.8) * rand(0.6, 1.1);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        size: (opts.size ?? 5) * rand(0.6, 1.3),
        color: (opts.colors ?? CONFETTI)[Math.floor(Math.random() * (opts.colors ?? CONFETTI).length)],
        rot: Math.random() * 6,
        vr: rand(-8, 8),
        shape: opts.shape ?? "circle",
      });
    }
  }
  update(dt: number, gravity = 600) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += gravity * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "rect") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else {
        drawStar(ctx, p.x, p.y, p.size, p.rot);
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Floating "+1" style labels. */
export class FloatTexts {
  list: { x: number; y: number; text: string; color: string; life: number; size: number }[] = [];
  add(x: number, y: number, text: string, color: string = PAL.cream, size = 24) {
    this.list.push({ x, y, text, color, life: 0.9, size });
  }
  update(dt: number) {
    for (const t of this.list) {
      t.life -= dt;
      t.y -= 50 * dt;
    }
    this.list = this.list.filter((t) => t.life > 0);
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const t of this.list) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `700 ${t.size}px ${displayFont()}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(11,29,22,.6)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

let fontCache: string | null = null;
export function displayFont() {
  if (fontCache) return fontCache;
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-fredoka").trim();
  fontCache = v ? `${v}, ui-rounded, system-ui, sans-serif` : "ui-rounded, system-ui, sans-serif";
  return fontCache;
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

// ───────────── heads ─────────────
/** Draws a head sprite centred at (x, y). */
export function drawHead(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, rot = 0, sx = 1, sy = 1, shadow = true) {
  ctx.save();
  ctx.translate(x, y);
  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(0, size * 0.48, size * 0.32 * sx, size * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Screen shake helper. */
export class Shake {
  private t = 0;
  private mag = 0;
  kick(mag: number, time = 0.3) {
    this.mag = Math.max(this.mag, mag);
    this.t = Math.max(this.t, time);
  }
  apply(ctx: CanvasRenderingContext2D, dt: number) {
    if (this.t <= 0) return;
    this.t -= dt;
    const m = this.mag * Math.max(0, this.t / 0.3);
    ctx.translate(rand(-m, m), rand(-m, m));
    if (this.t <= 0) this.mag = 0;
  }
}

/** Candy-cane stripe pattern (cached per scale). */
const stripeCache = new Map<string, CanvasPattern | null>();
export function candyPattern(ctx: CanvasRenderingContext2D, size: number, a = PAL.berry, b = PAL.snow): CanvasPattern | string {
  const key = `${Math.round(size)}-${a}-${b}`;
  if (!stripeCache.has(key)) {
    const c = document.createElement("canvas");
    const s = Math.max(8, Math.round(size));
    c.width = s;
    c.height = s;
    const g = c.getContext("2d")!;
    g.fillStyle = b;
    g.fillRect(0, 0, s, s);
    g.fillStyle = a;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s * 0.5, 0);
    g.lineTo(0, s * 0.5);
    g.closePath();
    g.moveTo(s, 0);
    g.lineTo(s, s * 0.5);
    g.lineTo(s * 0.5, s);
    g.lineTo(0, s);
    g.closePath();
    g.fill();
    stripeCache.set(key, ctx.createPattern(c, "repeat"));
  }
  return stripeCache.get(key) ?? a;
}

/** Reads the CSS safe-area insets (notch / home indicator) in px. */
export function safeAreaInsets() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return v;
}
