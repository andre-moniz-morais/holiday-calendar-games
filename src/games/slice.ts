import { Disposer, loop, pick, pointerPos, rand, setupCanvas } from "./engine";
import { FloatTexts, PAL, Particles, Shake, Stars, drawHead, drawHills, drawSky, safeAreaInsets } from "./kit";
import type { GameApi, GameModule } from "./types";

type FruitType = "orange" | "apple" | "kiwi" | "pomegranate" | "lemon" | "melon" | "pear";
interface FruitStyle {
  skin: string;
  skinDark: string;
  flesh: string;
  rim: string;
  juice: string;
  size: number;
  seeds?: string;
}
const FRUITS: Record<FruitType, FruitStyle> = {
  orange: { skin: "#f59a23", skinDark: "#d9771a", flesh: "#ffc75a", rim: "#fff0c4", juice: "#ffb43a", size: 1 },
  apple: { skin: "#df3b3f", skinDark: "#a8262f", flesh: "#fff3cf", rim: "#ffe9a8", juice: "#ffe7a0", size: 0.95, seeds: "#5e3b26" },
  kiwi: { skin: "#8b6a3a", skinDark: "#6b4f2a", flesh: "#9fd36b", rim: "#d9f2b0", juice: "#9fd36b", size: 0.85, seeds: "#1d2a1a" },
  pomegranate: { skin: "#b0213a", skinDark: "#7d1426", flesh: "#ff7b8d", rim: "#ffd1d8", juice: "#e0465e", size: 1, seeds: "#c8102e" },
  lemon: { skin: "#f6dc3c", skinDark: "#d8b51f", flesh: "#fff39a", rim: "#fffbe0", juice: "#fff07a", size: 0.9 },
  melon: { skin: "#2f8f3a", skinDark: "#1f6b2a", flesh: "#ff5a6a", rim: "#d8f5c0", juice: "#ff5a6a", size: 1.3, seeds: "#1d1d1d" },
  pear: { skin: "#c6d84a", skinDark: "#9fb22c", flesh: "#fbf6d8", rim: "#eef3b8", juice: "#eef3b8", size: 0.95, seeds: "#5e3b26" },
};
const TYPES = Object.keys(FRUITS) as FruitType[];

interface Item {
  kind: "fruit" | "head";
  type: FruitType;
  who: "me" | "them";
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
  dead: boolean;
  hit?: boolean;
}
interface Half {
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
  cut: number;
  side: 1 | -1;
}
interface Splat {
  x: number;
  y: number;
  r: number;
  color: string;
  life: number;
}

const MAX_DROPS = 3;

function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const { view, dispose } = setupCanvas(canvas);
  d.add(dispose);

  const stars = new Stars(40);
  const fx = new Particles();
  const texts = new FloatTexts();
  const shake = new Shake();

  let items: Item[] = [];
  let halves: Half[] = [];
  let splats: Splat[] = [];
  let blade: { x: number; y: number; t: number }[] = [];
  let down = false;
  let last: { x: number; y: number } | null = null;
  let time = 0;
  let score = 0;
  let drops = 0;
  let waveIn = 0.8;
  let queue: { at: number; item: Item }[] = [];
  let over = false;
  let overT = 0;
  let flash = 0;
  let elapsed = 0;

  const S = () => Math.min(view.h / 800, view.w / 390);
  const safeTop = safeAreaInsets().top;
  const G = () => 980 * (view.h / 800);

  function throwItem(kind: Item["kind"], delay: number) {
    const s = S();
    const type = pick(TYPES);
    const r = (kind === "head" ? 46 : 38 * FRUITS[type].size) * s;
    const x = rand(view.w * 0.15, view.w * 0.85);
    const apex = rand(view.h * 0.12, view.h * 0.42);
    const vy = -Math.sqrt(2 * G() * (view.h + r - apex));
    const flight = (2 * -vy) / G();
    const targetX = rand(view.w * 0.2, view.w * 0.8);
    const vx = (targetX - x) / flight;
    queue.push({
      at: time + delay,
      item: { kind, type, who: Math.random() < 0.5 ? "me" : "them", x, y: view.h + r, vx, vy, rot: rand(0, 6), vr: rand(-4, 4), r, dead: false },
    });
  }

  function wave() {
    const difficulty = Math.min(1, elapsed / 90);
    const n = Math.floor(rand(1, 2.6 + difficulty * 2.8));
    const headChance = 0.12 + difficulty * 0.14;
    let heads = 0;
    for (let i = 0; i < n; i++) {
      const isHead = heads < 1 + Math.floor(difficulty * 2) && Math.random() < headChance;
      if (isHead) heads++;
      throwItem(isHead ? "head" : "fruit", i * rand(0.12, 0.35));
    }
    waveIn = Math.max(0.9, 2.1 - difficulty * 1.1) + rand(0, 0.4);
  }

  function sliceItem(it: Item, ax: number, ay: number, bx: number, by: number) {
    it.dead = true;
    const angle = Math.atan2(by - ay, bx - ax);
    if (it.kind === "head") {
      it.dead = false;
      it.hit = true;
      it.vy = -380 * S();
      it.vx *= 0.3;
      it.vr = 9;
      over = true;
      overT = 0;
      flash = 1;
      shake.kick(18 * S(), 0.6);
      api.sfx("hit");
      api.haptic("error");
      fx.burst(it.x, it.y, { count: 40, speed: 500, shape: "star", size: 7 });
      return;
    }
    const f = FRUITS[it.type];
    score++;
    api.setScore(score);
    api.sfx("slice");
    api.haptic("light");
    const nx = Math.cos(angle + Math.PI / 2);
    const ny = Math.sin(angle + Math.PI / 2);
    const sp = 120 * S();
    halves.push({ type: it.type, x: it.x, y: it.y, vx: it.vx + nx * sp, vy: it.vy + ny * sp, rot: angle, vr: rand(-3, 3), r: it.r, cut: 0, side: 1 });
    halves.push({ type: it.type, x: it.x, y: it.y, vx: it.vx - nx * sp, vy: it.vy - ny * sp, rot: angle, vr: rand(-3, 3), r: it.r, cut: 0, side: -1 });
    fx.burst(it.x, it.y, { count: 14, colors: [f.juice, f.flesh], speed: 300, size: 4, life: 0.6 });
    splats.push({ x: it.x, y: it.y, r: it.r * rand(1, 1.4), color: f.juice, life: 1 });
    texts.add(it.x, it.y - it.r, "+1", PAL.cream, 24 * S());
  }

  function segmentHits(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2));
    const px = ax + t * dx - cx;
    const py = ay + t * dy - cy;
    return px * px + py * py < r * r;
  }

  function move(x: number, y: number) {
    blade.push({ x, y, t: time });
    if (last && !over) {
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist > 3) {
        for (const it of items) {
          if (it.dead || it.hit) continue;
          if (segmentHits(last.x, last.y, x, y, it.x, it.y, it.r * 0.92)) sliceItem(it, last.x, last.y, x, y);
        }
      }
    }
    last = { x, y };
  }

  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    down = true;
    last = null;
    blade = [];
    const p = pointerPos(e, canvas);
    move(p.x, p.y);
  });
  d.on(canvas, "pointermove", (e) => {
    if (!down) return;
    const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const p = pointerPos(ev, canvas);
      move(p.x, p.y);
    }
  });
  const up = () => {
    down = false;
    last = null;
  };
  d.on(canvas, "pointerup", up);
  d.on(canvas, "pointercancel", up);

  function update(dt: number) {
    time += dt;
    flash = Math.max(0, flash - dt * 2);
    fx.update(dt, 900 * S());
    texts.update(dt);
    blade = blade.filter((b) => time - b.t < 0.12);
    splats.forEach((s) => (s.life -= dt * 0.5));
    splats = splats.filter((s) => s.life > 0);

    const g = G();
    for (const it of items) {
      it.vy += g * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
    }
    for (const h of halves) {
      h.vy += g * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.vr * dt;
    }
    halves = halves.filter((h) => h.y < view.h + h.r * 2);

    if (over) {
      overT += dt;
      if (overT > 1.2) {
        over = false;
        api.end(score);
        stop();
      }
      return;
    }

    elapsed += dt;
    waveIn -= dt;
    if (waveIn <= 0 && items.filter((i) => !i.dead).length < 4) wave();
    queue = queue.filter((q) => {
      if (time >= q.at) {
        items.push(q.item);
        api.sfx("flap");
        return false;
      }
      return true;
    });

    for (const it of items) {
      if (!it.dead && !it.hit && it.vy > 0 && it.y > view.h + it.r) {
        it.dead = true;
        if (it.kind === "fruit") {
          drops++;
          api.setLives(MAX_DROPS - drops, MAX_DROPS);
          api.haptic("medium");
          texts.add(Math.max(30, Math.min(view.w - 30, it.x)), view.h - 40 * S(), "✕", PAL.berry, 34 * S());
          if (drops >= MAX_DROPS) {
            over = true;
            overT = 0;
            api.sfx("over");
          }
        }
      }
    }
    items = items.filter((it) => !it.dead || it.y < view.h + it.r * 2);
  }

  function drawFruit(type: FruitType, x: number, y: number, r: number, rot: number) {
    const { ctx } = view;
    const f = FRUITS[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const rx = type === "lemon" ? r * 1.15 : type === "melon" ? r * 1.1 : r;
    const ry = type === "pear" ? r * 1.1 : r;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, f.skin);
    g.addColorStop(1, f.skinDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    if (type === "pear") {
      ctx.ellipse(0, r * 0.2, r * 0.9, r * 0.85, 0, 0, Math.PI * 2);
      ctx.ellipse(0, -r * 0.45, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
    } else ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    if (type === "melon") {
      ctx.strokeStyle = "#1a5a24";
      ctx.lineWidth = r * 0.12;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * Math.abs(i) * 0.38 + 1, ry, 0, -Math.PI / 2, Math.PI / 2, i < 0);
        ctx.stroke();
      }
    }
    if (type === "pomegranate") {
      ctx.fillStyle = f.skinDark;
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 0.85);
      ctx.lineTo(-r * 0.15, -r * 1.2);
      ctx.lineTo(0, -r * 0.95);
      ctx.lineTo(r * 0.15, -r * 1.2);
      ctx.lineTo(r * 0.25, -r * 0.85);
      ctx.fill();
    }
    if (type === "apple" || type === "pear" || type === "orange") {
      ctx.strokeStyle = PAL.woodDark;
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -ry * (type === "pear" ? 1.0 : 0.85));
      ctx.lineTo(r * 0.08, -ry * (type === "pear" ? 1.3 : 1.15));
      ctx.stroke();
      ctx.fillStyle = "#3aa35a";
      ctx.beginPath();
      ctx.ellipse(r * 0.3, -ry * (type === "pear" ? 1.15 : 1.0), r * 0.28, r * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // highlight
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.4, r * 0.22, r * 0.13, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHalf(h: Half) {
    const { ctx } = view;
    const f = FRUITS[h.type];
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    ctx.beginPath();
    ctx.rect(-h.r * 1.5, h.side > 0 ? 0 : -h.r * 1.5, h.r * 3, h.r * 1.5);
    ctx.clip();
    ctx.rotate(-h.rot);
    ctx.translate(-h.x, -h.y);
    drawFruit(h.type, h.x, h.y, h.r, 0);
    ctx.restore();
    // cut face
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    ctx.fillStyle = f.rim;
    ctx.beginPath();
    ctx.ellipse(0, 0, h.r * 0.98, h.r * 0.3, 0, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = f.flesh;
    ctx.beginPath();
    ctx.ellipse(0, 0, h.r * 0.85, h.r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    if (f.seeds) {
      ctx.fillStyle = f.seeds;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.ellipse(i * h.r * 0.25, 0, h.r * 0.05, h.r * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawLights() {
    const { ctx, w } = view;
    const s = S();
    const sag = 34 * s;
    const y0 = safeTop + 64 * s;
    ctx.strokeStyle = "#0e3527";
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(w / 2, y0 + sag * 2, w, y0);
    ctx.stroke();
    const colors = [PAL.berry, PAL.gold, PAL.ice, "#7ee0a6"];
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const x = w * t;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const on = Math.sin(time * 3 + i * 1.7) > -0.3;
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = on ? 1 : 0.4;
      ctx.beginPath();
      ctx.ellipse(x, y + 9 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(x, y + 9 * s, 14 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }


  function render(dt: number) {
    const { ctx, w, h } = view;
    const s = S();
    ctx.save();
    shake.apply(ctx, dt);
    drawSky(ctx, w, h, "#0a1f2c", "#163f37");
    stars.draw(ctx, w, h, time);
    drawHills(ctx, w, h * 0.92, 90 * s, 0, { color: "#174538", cap: "rgba(244,248,252,.3)", trees: 6, treeColor: "#0f3a2c", seed: 4 });
    drawHills(ctx, w, h * 1.0, 50 * s, 120, { color: "#dfe9f4", seed: 9 });

    for (const sp of splats) {
      ctx.globalAlpha = sp.life * 0.45;
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.arc(sp.x + sp.r * 0.8, sp.y + sp.r * 0.4, sp.r * 0.35, 0, Math.PI * 2);
      ctx.arc(sp.x - sp.r * 0.6, sp.y + sp.r * 0.7, sp.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawLights();

    for (const hf of halves) drawHalf(hf);
    for (const it of items) {
      if (it.dead && it.kind === "fruit") continue;
      if (it.kind === "head") {
        // warning glow so heads read as "don't touch"
        ctx.fillStyle = "rgba(224,70,78,.25)";
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r * 1.25, 0, Math.PI * 2);
        ctx.fill();
        drawHead(ctx, it.who === "me" ? api.me.head : api.them.head, it.x, it.y, it.r * 2.2, it.rot * 0.3, 1, 1, false);
      } else drawFruit(it.type, it.x, it.y, it.r, it.rot);
    }

    // blade trail
    if (blade.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [width, color] of [
        [16 * s, "rgba(159,211,255,.25)"],
        [6 * s, "rgba(255,255,255,.95)"],
      ] as const) {
        for (let i = 1; i < blade.length; i++) {
          const k = i / blade.length;
          ctx.strokeStyle = color;
          ctx.lineWidth = width * k;
          ctx.beginPath();
          ctx.moveTo(blade[i - 1].x, blade[i - 1].y);
          ctx.lineTo(blade[i].x, blade[i].y);
          ctx.stroke();
        }
      }
    }

    fx.draw(ctx);
    texts.draw(ctx);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.8})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  const stop = loop((dt) => {
    update(dt);
    render(dt);
  });
  d.add(stop);
  api.setScore(0);
  api.setLives(MAX_DROPS, MAX_DROPS);
  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, hudScore: "points" };
export default mod;
