import { Disposer, hash, loop, pick, rand, setupCanvas } from "./engine";
import { PAL, Particles, Shake, Snowfall, Stars, displayFont, drawHead, drawHills, drawMoon, drawPine, drawSky } from "./kit";
import type { GameApi, GameModule } from "./types";

type ObstacleKind = "gift" | "gifts" | "snowman" | "pine" | "wide";
interface Obstacle {
  kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
  color: string;
  color2: string;
}

const GIFT_COLORS = [PAL.berry, "#3b82c4", PAL.gold, "#8e4ec6", "#2a9d8f"];

/** Endless runner: jump over gifts and snowmen. Score = seconds survived. */
function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const { view, dispose } = setupCanvas(canvas);
  d.add(dispose);

  const stars = new Stars(45);
  const snow = new Snowfall(60);
  const fx = new Particles();
  const shake = new Shake();

  let phase: "ready" | "play" | "dead" = "ready";
  let time = 0;
  let alive = 0;
  let dist = 0;
  let nextIn = 0;
  let holding = false;
  let deadT = 0;
  let hudT = 0;
  let obstacles: Obstacle[] = [];
  const p = { y: 0, vy: 0, rot: 0, onGround: true, sx: 1, sy: 1 };

  const S = () => Math.min(view.h / 780, view.w / 390);
  const groundY = () => view.h * 0.76;
  const size = () => 70 * S();
  const px = () => Math.max(view.w * 0.22, 70 * S());
  const speed = () => (340 + Math.min(alive, 100) * 4.2) * S();

  p.y = groundY() - size() / 2;

  function press() {
    holding = true;
    if (phase === "dead") return;
    if (phase === "ready") {
      phase = "play";
      nextIn = 0.8;
    }
    if (p.onGround) {
      p.vy = -820 * S();
      p.onGround = false;
      p.sx = 0.8;
      p.sy = 1.2;
      api.sfx("jump");
      api.haptic("select");
      fx.burst(px(), groundY(), { count: 8, colors: [PAL.snow, PAL.snowShade], speed: 160, size: 4, life: 0.5, angle: -Math.PI / 2, spread: 1.2 });
    }
  }
  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    press();
  });
  d.on(window, "pointerup", () => (holding = false));
  d.on(window, "pointercancel", () => (holding = false));
  d.on(window, "keydown", (e) => {
    if ((e.code === "Space" || e.code === "ArrowUp") && !e.repeat) {
      e.preventDefault();
      press();
    }
  });
  d.on(window, "keyup", () => (holding = false));

  function spawn() {
    const s = S();
    const difficulty = Math.min(1, alive / 60);
    const pool: ObstacleKind[] = ["gift", "gift", "pine", "snowman"];
    if (difficulty > 0.25) pool.push("gifts", "wide");
    if (difficulty > 0.6) pool.push("gifts", "snowman");
    const kind = pick(pool);
    const dims: Record<ObstacleKind, [number, number]> = {
      gift: [rand(40, 50), rand(38, 48)],
      gifts: [52, 82],
      snowman: [50, 86],
      pine: [52, 78],
      wide: [100, 40],
    };
    const [w, h] = dims[kind];
    obstacles.push({ kind, x: view.w + 40 * s, w: w * s, h: h * s, color: pick(GIFT_COLORS), color2: pick([PAL.gold, PAL.berry, PAL.cream]) });
    const minGap = 0.42 + (1 - difficulty) * 0.35;
    nextIn = rand(minGap, minGap + 0.8 - difficulty * 0.3);
  }

  function die() {
    phase = "dead";
    deadT = 0;
    shake.kick(12 * S());
    api.sfx("hit");
    api.haptic("heavy");
    fx.burst(px(), p.y, { count: 30, speed: 360, shape: "star", size: 6 });
    p.vy = -500 * S();
  }

  function update(dt: number) {
    time += dt;
    const s = S();
    snow.update(dt, view.w, view.h, -60);
    fx.update(dt, 900 * s);
    p.sx += (1 - p.sx) * Math.min(1, dt * 10);
    p.sy += (1 - p.sy) * Math.min(1, dt * 10);

    if (phase === "ready") {
      dist += speed() * 0.35 * dt;
      p.rot += (speed() * 0.35 * dt) / (size() / 2);
      return;
    }

    if (phase === "dead") {
      deadT += dt;
      p.vy += 2400 * s * dt;
      p.y += p.vy * dt;
      p.rot += dt * 10;
      if (deadT > 0.8) {
        phase = "ready";
        api.end(Math.round(alive * 10) / 10);
        stop();
      }
      return;
    }

    alive += dt;
    hudT += dt;
    if (hudT > 0.1) {
      hudT = 0;
      api.setScore(Math.floor(alive * 10) / 10);
    }

    const v = speed();
    dist += v * dt;
    p.rot += (v * dt) / (size() / 2);

    // variable-height jump
    const g = p.vy < 0 && holding ? 1900 : 3400;
    p.vy += g * s * dt;
    p.y += p.vy * dt;
    const floor = groundY() - size() / 2;
    if (p.y >= floor) {
      if (!p.onGround) {
        p.sx = 1.25;
        p.sy = 0.78;
        fx.burst(px(), groundY(), { count: 6, colors: [PAL.snow], speed: 120, size: 3, life: 0.4, angle: -Math.PI / 2, spread: 1.3 });
      }
      p.y = floor;
      p.vy = 0;
      p.onGround = true;
    }

    nextIn -= dt;
    if (nextIn <= 0) spawn();
    const r = size() * 0.4;
    for (const o of obstacles) {
      o.x -= v * dt;
      const inset = 5 * s;
      const x1 = o.x + inset;
      const x2 = o.x + o.w - inset;
      const y1 = groundY() - o.h + inset;
      const cx = Math.max(x1, Math.min(px(), x2));
      const cy = Math.max(y1, Math.min(p.y, groundY()));
      if ((cx - px()) ** 2 + (cy - p.y) ** 2 < r * r) {
        die();
        break;
      }
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -20);
  }

  function drawGift(x: number, y: number, w: number, h: number, color: string) {
    const { ctx } = view;
    const s = S();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5 * s);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.fillRect(x + w * 0.62, y, w * 0.38, h);
    ctx.fillStyle = PAL.cream;
    ctx.fillRect(x + w / 2 - 4 * s, y, 8 * s, h);
    ctx.fillRect(x, y + h * 0.35, w, 7 * s);
    // bow
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.ellipse(x + w / 2 - 8 * s, y - 4 * s, 9 * s, 6 * s, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + w / 2 + 8 * s, y - 4 * s, 9 * s, 6 * s, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnowman(x: number, w: number, h: number) {
    const { ctx } = view;
    const s = S();
    const gy = groundY();
    const cx = x + w / 2;
    ctx.fillStyle = PAL.snow;
    ctx.beginPath();
    ctx.arc(cx, gy - h * 0.25, w * 0.5, 0, Math.PI * 2);
    ctx.arc(cx, gy - h * 0.66, w * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(160,185,210,.5)";
    ctx.beginPath();
    ctx.arc(cx + w * 0.12, gy - h * 0.22, w * 0.4, -0.6, 1.4);
    ctx.fill();
    // hat
    ctx.fillStyle = "#1d2a33";
    ctx.fillRect(cx - w * 0.3, gy - h * 0.9, w * 0.6, 5 * s);
    ctx.fillRect(cx - w * 0.2, gy - h * 1.06, w * 0.4, h * 0.17);
    ctx.fillStyle = PAL.berry;
    ctx.fillRect(cx - w * 0.2, gy - h * 0.94, w * 0.4, 4 * s);
    // face
    ctx.fillStyle = "#1d2a33";
    ctx.beginPath();
    ctx.arc(cx - w * 0.12, gy - h * 0.7, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.12, gy - h * 0.7, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f08a24";
    ctx.beginPath();
    ctx.moveTo(cx, gy - h * 0.65);
    ctx.lineTo(cx - w * 0.36, gy - h * 0.62);
    ctx.lineTo(cx, gy - h * 0.6);
    ctx.fill();
    // scarf
    ctx.fillStyle = PAL.berry;
    ctx.fillRect(cx - w * 0.34, gy - h * 0.5, w * 0.68, 6 * s);
    ctx.fillRect(cx + w * 0.12, gy - h * 0.5, 7 * s, h * 0.2);
  }

  function drawHouses(offset: number, baseY: number) {
    const { ctx, w } = view;
    const s = S();
    const spacing = 170 * s;
    const first = Math.floor(offset / spacing) - 1;
    for (let i = first; i < first + w / spacing + 3; i++) {
      if (hash(i * 7.3) < 0.45) continue;
      const x = i * spacing - offset;
      const hw = (60 + hash(i) * 30) * s;
      const hh = (44 + hash(i * 2) * 20) * s;
      ctx.fillStyle = "#3b2a2a";
      ctx.fillRect(x, baseY - hh, hw, hh);
      ctx.fillStyle = PAL.snow;
      ctx.beginPath();
      ctx.moveTo(x - 8 * s, baseY - hh);
      ctx.lineTo(x + hw / 2, baseY - hh - 30 * s);
      ctx.lineTo(x + hw + 8 * s, baseY - hh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffd479";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + hw * 0.2, baseY - hh * 0.7, hw * 0.22, hh * 0.28);
      ctx.fillRect(x + hw * 0.58, baseY - hh * 0.7, hw * 0.22, hh * 0.28);
      ctx.globalAlpha = 1;
    }
  }

  function render(dt: number) {
    const { ctx, w, h } = view;
    const s = S();
    const gy = groundY();
    ctx.save();
    shake.apply(ctx, dt);
    drawSky(ctx, w, h);
    stars.draw(ctx, w, h, time, dist * 0.01);
    drawMoon(ctx, w * 0.8, h * 0.14, 24 * s);
    drawHills(ctx, w, gy - 70 * s, 110 * s, dist * 0.1, { color: "#174538", cap: "rgba(244,248,252,.3)", trees: 8, treeColor: "#0f3a2c", seed: 3 });
    drawHouses(dist * 0.3, gy - 6 * s);
    drawHills(ctx, w, gy + 6 * s, 30 * s, dist * 0.5, { color: "#dde8f3", seed: 7 });

    // ground
    ctx.fillStyle = PAL.snow;
    ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = PAL.snowShade;
    ctx.fillRect(0, gy, w, 5 * s);
    const step = 60 * s;
    for (let x = -(dist % step); x < w + step; x += step) {
      ctx.fillStyle = "rgba(160,185,210,.45)";
      ctx.beginPath();
      ctx.ellipse(x, gy + 30 * s, 20 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + step / 2, gy + 60 * s, 26 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const o of obstacles) {
      if (o.kind === "gift") drawGift(o.x, gy - o.h, o.w, o.h, o.color);
      else if (o.kind === "gifts") {
        drawGift(o.x, gy - o.h * 0.5, o.w, o.h * 0.5, o.color);
        drawGift(o.x + o.w * 0.12, gy - o.h, o.w * 0.76, o.h * 0.45, o.color2);
      } else if (o.kind === "wide") {
        drawGift(o.x, gy - o.h, o.w * 0.48, o.h, o.color);
        drawGift(o.x + o.w * 0.52, gy - o.h * 0.85, o.w * 0.48, o.h * 0.85, PAL.gold);
      } else if (o.kind === "snowman") drawSnowman(o.x, o.w, o.h);
      else drawPine(ctx, o.x + o.w / 2, gy + 2 * s, o.h, PAL.pine);
    }

    // shadow + head
    const lift = Math.max(0, gy - size() / 2 - p.y);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(px(), gy + 2 * s, size() * 0.34 * Math.max(0.4, 1 - lift / (300 * s)), 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    drawHead(ctx, api.me.head, px(), p.y + (size() * (1 - p.sy)) / 2, size(), p.rot * 0.35, p.sx, p.sy, false);

    fx.draw(ctx);
    snow.draw(ctx);

    if (phase === "ready") {
      ctx.textAlign = "center";
      ctx.fillStyle = PAL.cream;
      ctx.font = `600 ${22 * s}px ${displayFont()}`;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
      ctx.fillText("Toca para saltar", w / 2, h * 0.4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  const stop = loop((dt) => {
    update(dt);
    render(dt);
  });
  d.add(stop);
  api.setScore(0);
  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, hudScore: "seconds" };
export default mod;
