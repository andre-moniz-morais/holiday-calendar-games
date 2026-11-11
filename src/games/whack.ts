import { Disposer, loop, pointerPos, rand, setupCanvas } from "./engine";
import { FloatTexts, PAL, Particles, Shake, Snowfall, Stars, drawHead, drawMoon, drawSky, drawStar } from "./kit";
import type { GameApi, GameModule } from "./types";

interface Hole {
  row: number;
  col: number;
  who: "them" | "me" | null;
  pop: number; // 0 hidden … 1 fully out
  state: "idle" | "up" | "stay" | "down" | "bonk";
  t: number;
  stay: number;
  smoke: number;
}

const MAX_MISSES = 3;

/** Heads pop out of chimneys: tap your love, never yourself. */
function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const { view, dispose } = setupCanvas(canvas);
  d.add(dispose);

  const stars = new Stars(40);
  const snow = new Snowfall(45);
  const fx = new Particles();
  const texts = new FloatTexts();
  const shake = new Shake();

  const holes: Hole[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) holes.push({ row: r, col: c, who: null, pop: 0, state: "idle", t: 0, stay: 1, smoke: Math.random() * 3 });

  let score = 0;
  let misses = 0;
  let time = 0;
  let spawnIn = 0.8;
  let over = false;
  let overT = 0;
  let wrong: Hole | null = null;

  const S = () => Math.min(view.w / 390, view.h / 800);
  const rowScale = (r: number) => 0.86 + r * 0.07;
  function layout(h: Hole) {
    const s = S() * rowScale(h.row);
    const top = view.h * 0.32;
    const bottom = view.h * 0.86;
    const y = top + ((bottom - top) * h.row) / 2;
    const spread = Math.min(view.w * 0.31, 128 * S());
    const x = view.w / 2 + (h.col - 1) * spread;
    return { x, y, s, cw: 82 * s, ch: 62 * s, head: 92 * s };
  }

  function spawn() {
    const free = holes.filter((h) => h.state === "idle");
    if (!free.length) return;
    const active = holes.filter((h) => h.state !== "idle").length;
    const maxActive = 1 + Math.min(2, Math.floor(score / 8));
    if (active >= maxActive) return;
    const h = free[Math.floor(Math.random() * free.length)];
    const ownChance = Math.min(0.4, 0.2 + score * 0.005);
    h.who = Math.random() < ownChance ? "me" : "them";
    h.state = "up";
    h.t = 0;
    h.stay = Math.max(0.5, 1.2 - score * 0.017) * rand(0.85, 1.15);
    api.sfx("pop");
  }

  function lose(hit: Hole | null) {
    if (over) return;
    over = true;
    overT = 0;
    wrong = hit;
    shake.kick(14 * S(), 0.5);
    api.sfx("hit");
    api.haptic("error");
  }

  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    if (over) return;
    const { x, y } = pointerPos(e, canvas);
    // Front rows first (they're drawn on top).
    for (const h of [...holes].reverse()) {
      if (h.state === "idle" || h.state === "bonk" || h.pop < 0.35) continue;
      const L = layout(h);
      const headY = L.y - L.head * 0.42 * h.pop;
      if (Math.abs(x - L.x) < L.head * 0.55 && y > headY - L.head * 0.55 && y < L.y + L.ch * 0.2) {
        if (h.who === "me") {
          lose(h);
          fx.burst(L.x, headY, { count: 20, colors: [PAL.berry, PAL.cream], speed: 300, shape: "rect" });
        } else {
          score++;
          api.setScore(score);
          api.sfx("point");
          api.haptic("medium");
          h.state = "bonk";
          h.t = 0;
          fx.burst(L.x, headY - L.head * 0.2, { count: 14, colors: [PAL.gold, PAL.cream], speed: 260, shape: "star", size: 6 });
          texts.add(L.x, headY - L.head * 0.6, "+1", PAL.gold, 30 * S());
          shake.kick(4 * S(), 0.15);
        }
        return;
      }
    }
  });

  function update(dt: number) {
    time += dt;
    snow.update(dt, view.w, view.h, 10);
    fx.update(dt, 700 * S());
    texts.update(dt);

    if (over) {
      overT += dt;
      if (overT > 1.1) {
        over = false; // prevent repeat
        api.end(score);
        stop();
      }
      return;
    }

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = Math.max(0.28, 0.85 - score * 0.014) * rand(0.7, 1.2);
    }

    for (const h of holes) {
      h.smoke += dt;
      h.t += dt;
      if (h.state === "up") {
        h.pop = Math.min(1, h.pop + dt / 0.13);
        if (h.pop >= 1) {
          h.state = "stay";
          h.t = 0;
        }
      } else if (h.state === "stay") {
        if (h.t > h.stay) {
          h.state = "down";
          h.t = 0;
        }
      } else if (h.state === "down" || h.state === "bonk") {
        h.pop = Math.max(0, h.pop - dt / (h.state === "bonk" ? 0.18 : 0.16));
        if (h.pop <= 0) {
          if (h.state === "down" && h.who === "them") {
            misses++;
            api.setLives(MAX_MISSES - misses, MAX_MISSES);
            api.haptic("light");
            const L = layout(h);
            texts.add(L.x, L.y - L.head * 0.5, "fugiu!", PAL.berry, 20 * S());
            if (misses >= MAX_MISSES) lose(null);
          }
          h.state = "idle";
          h.who = null;
        }
      }
    }
  }

  function drawRoof(row: number) {
    const { ctx, w } = view;
    const L = layout(holes[row * 3]);
    const s = L.s;
    const y = L.y + L.ch * 0.55;
    const colors = ["#5a2a2a", "#6b3030", "#7a3535"];
    ctx.fillStyle = colors[row];
    ctx.beginPath();
    ctx.moveTo(-20, view.h + 20);
    ctx.lineTo(-20, y);
    ctx.lineTo(w + 20, y);
    ctx.lineTo(w + 20, view.h + 20);
    ctx.closePath();
    ctx.fill();
    // tiles
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 2 * s;
    for (let ty = y + 18 * s; ty < view.h; ty += 18 * s) {
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(w, ty);
      ctx.stroke();
    }
    // snow edge
    ctx.fillStyle = PAL.snow;
    ctx.beginPath();
    ctx.moveTo(-20, y + 8 * s);
    for (let x = -20; x <= w + 20; x += 24 * s) ctx.quadraticCurveTo(x + 12 * s, y + 16 * s + Math.sin(x) * 3 * s, x + 24 * s, y + 8 * s);
    ctx.lineTo(w + 20, y - 4 * s);
    ctx.lineTo(-20, y - 4 * s);
    ctx.closePath();
    ctx.fill();
  }

  function drawHole(h: Hole) {
    const { ctx } = view;
    const L = layout(h);
    const { x, y, cw, ch, s } = L;
    const topY = y - ch * 0.5;

    // smoke from idle chimneys
    if (h.state === "idle") {
      for (let i = 0; i < 3; i++) {
        const k = (h.smoke * 0.5 + i / 3) % 1;
        ctx.fillStyle = `rgba(230,236,245,${0.25 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(k * 6 + i) * 8 * s, topY - 10 * s - k * 60 * s, (8 + k * 14) * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // head (clipped so it rises out of the chimney)
    if (h.who && h.pop > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - L.head, topY - L.head * 2, L.head * 2, L.head * 2 + 6 * s);
      ctx.clip();
      const bonk = h.state === "bonk";
      const img = h.who === "me" ? api.me.head : api.them.head;
      const wob = h.state === "stay" ? Math.sin(h.t * 14) * 0.05 : 0;
      drawHead(ctx, img, x, topY + L.head * 0.5 - h.pop * L.head * 0.92, L.head, wob, bonk ? 1.2 : 1, bonk ? 0.75 : 1, false);
      if (h === wrong) {
        ctx.strokeStyle = PAL.berry;
        ctx.lineWidth = 8 * s;
        ctx.lineCap = "round";
        const cy = topY - L.head * 0.42;
        const r = L.head * 0.32;
        ctx.beginPath();
        ctx.moveTo(x - r, cy - r);
        ctx.lineTo(x + r, cy + r);
        ctx.moveTo(x + r, cy - r);
        ctx.lineTo(x - r, cy + r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // chimney body
    ctx.fillStyle = "#a8473a";
    ctx.fillRect(x - cw / 2, topY, cw, ch);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(x + cw * 0.2, topY, cw * 0.3, ch);
    ctx.strokeStyle = "rgba(60,20,15,.5)";
    ctx.lineWidth = 1.5 * s;
    for (let r = 0; r < 4; r++) {
      const by = topY + 12 * s + r * 13 * s;
      ctx.beginPath();
      ctx.moveTo(x - cw / 2, by);
      ctx.lineTo(x + cw / 2, by);
      ctx.stroke();
      for (let c = 0; c < 4; c++) {
        const bx = x - cw / 2 + ((c + (r % 2) * 0.5) * cw) / 3.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by + 13 * s);
        ctx.stroke();
      }
    }
    // lip + snow
    ctx.fillStyle = "#8a3a30";
    ctx.fillRect(x - cw / 2 - 6 * s, topY - 4 * s, cw + 12 * s, 14 * s);
    ctx.fillStyle = PAL.snow;
    ctx.beginPath();
    ctx.roundRect(x - cw / 2 - 8 * s, topY - 10 * s, cw * 0.45, 10 * s, 6 * s);
    ctx.roundRect(x + cw * 0.05, topY - 8 * s, cw * 0.5, 8 * s, 6 * s);
    ctx.fill();
  }

  function render(dt: number) {
    const { ctx, w, h } = view;
    ctx.save();
    shake.apply(ctx, dt);
    drawSky(ctx, w, h, PAL.skyTop, "#1a3b4a");
    stars.draw(ctx, w, h, time);
    drawMoon(ctx, w * 0.2, h * 0.12, 24 * S());
    // a star twinkling on the right
    ctx.fillStyle = PAL.gold;
    drawStar(ctx, w * 0.82, h * 0.1, (12 + Math.sin(time * 3) * 2) * S(), 0);

    for (let r = 0; r < 3; r++) {
      drawRoof(r);
      for (let c = 0; c < 3; c++) drawHole(holes[r * 3 + c]);
    }
    fx.draw(ctx);
    texts.draw(ctx);
    snow.draw(ctx);
    ctx.restore();
  }

  const stop = loop((dt) => {
    update(dt);
    render(dt);
  });
  d.add(stop);
  api.setScore(0);
  api.setLives(MAX_MISSES, MAX_MISSES);
  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, hudScore: "points" };
export default mod;
