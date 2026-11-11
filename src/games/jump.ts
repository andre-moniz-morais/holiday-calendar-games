import { Disposer, clamp, loop, pointerPos, rand, setupCanvas } from "./engine";
import { FloatTexts, PAL, Particles, Stars, displayFont, drawHead, drawHills, drawMoon, drawPine, drawStar } from "./kit";
import type { GameApi, GameModule } from "./types";

type PlatKind = "normal" | "moving" | "fragile" | "spring";
interface Plat {
  floor: number;
  x: number;
  y: number; // world y (grows downward)
  w: number;
  kind: PlatKind;
  vx: number;
  broken: boolean;
  fall: number;
  springT: number;
}

/** Ask for motion-sensor permission (iOS needs this inside a tap). */
async function prepare() {
  const DOE = (globalThis as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (DOE?.requestPermission) await DOE.requestPermission();
}

function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const { view, dispose } = setupCanvas(canvas);
  d.add(dispose);

  const stars = new Stars(90);
  const fx = new Particles();
  const texts = new FloatTexts();

  const S = () => Math.min(view.w / 390, view.h / 800);
  const JUMP = () => 880 * S();
  const GRAV = () => 1550 * S();

  let plats: Plat[] = [];
  let nextFloor = 0;
  let topY = 0;
  let camY = 0;
  let score = 0;
  let time = 0;
  let over = false;
  let overT = 0;
  let tilt = 0;
  let hasTilt = false;
  let touchDir = 0;
  let keyDir = 0;
  const p = { x: 0, y: 0, vx: 0, vy: 0, sx: 1, sy: 1, face: 1 };

  function addPlat(y: number) {
    const s = S();
    const floor = nextFloor++;
    const difficulty = Math.min(1, floor / 160);
    let kind: PlatKind = "normal";
    const r = Math.random();
    if (floor > 5) {
      if (r < 0.08) kind = "spring";
      else if (r < 0.08 + 0.12 + difficulty * 0.18) kind = "moving";
      else if (r < 0.2 + difficulty * 0.18 + 0.1 + difficulty * 0.12) kind = "fragile";
    }
    const w = (floor === 0 ? view.w : rand(70, 86) * (1 - difficulty * 0.18)) * s * (floor === 0 ? 1 / s : 1);
    plats.push({
      floor,
      x: floor === 0 ? view.w / 2 : rand(w / 2 + 6, view.w - w / 2 - 6),
      y,
      w,
      kind,
      vx: kind === "moving" ? (Math.random() < 0.5 ? -1 : 1) * rand(50, 90 + difficulty * 80) * s : 0,
      broken: false,
      fall: 0,
      springT: 0,
    });
    topY = y;
  }

  function fill() {
    const s = S();
    while (topY > camY - view.h * 0.6) {
      const difficulty = Math.min(1, nextFloor / 160);
      const gapY = rand(62, 100 + difficulty * 95) * s;
      addPlat(topY - gapY);
      // Never stack two fragile platforms with nothing else to stand on
      const last = plats[plats.length - 1];
      const prev = plats[plats.length - 2];
      if (last.kind === "fragile" && prev?.kind === "fragile") last.kind = "normal";
    }
  }

  // start
  addPlat(view.h - 40 * S());
  p.x = view.w / 2;
  p.y = view.h - 40 * S() - 40 * S();
  p.vy = -JUMP();
  fill();

  d.on(window, "deviceorientation", (e) => {
    if (e.gamma === null) return;
    hasTilt = true;
    tilt = clamp(e.gamma / 22, -1, 1);
  });
  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    touchDir = pointerPos(e, canvas).x < view.w / 2 ? -1 : 1;
  });
  d.on(canvas, "pointermove", (e) => {
    if (touchDir) touchDir = pointerPos(e, canvas).x < view.w / 2 ? -1 : 1;
  });
  d.on(window, "pointerup", () => (touchDir = 0));
  d.on(window, "pointercancel", () => (touchDir = 0));
  d.on(window, "keydown", (e) => {
    if (e.code === "ArrowLeft") keyDir = -1;
    if (e.code === "ArrowRight") keyDir = 1;
  });
  d.on(window, "keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") keyDir = 0;
  });

  const size = () => 60 * S();

  function update(dt: number) {
    time += dt;
    const s = S();
    fx.update(dt, 600 * s);
    texts.update(dt);
    p.sx += (1 - p.sx) * Math.min(1, dt * 10);
    p.sy += (1 - p.sy) * Math.min(1, dt * 10);

    for (const pl of plats) {
      if (pl.kind === "moving" && !pl.broken) {
        pl.x += pl.vx * dt;
        if (pl.x < pl.w / 2 || pl.x > view.w - pl.w / 2) pl.vx *= -1;
      }
      if (pl.broken) {
        pl.fall += dt;
        pl.y += 600 * s * dt * pl.fall * 3;
      }
      pl.springT = Math.max(0, pl.springT - dt);
    }

    if (over) {
      overT += dt;
      p.vy += GRAV() * dt;
      p.y += p.vy * dt;
      if (overT > 1.0) {
        over = false;
        api.end(score);
        stop();
      }
      return;
    }

    // horizontal control
    const dir = touchDir || keyDir || (hasTilt ? tilt : 0);
    const maxV = 420 * s;
    p.vx += (dir * maxV - p.vx) * Math.min(1, dt * (hasTilt && !touchDir ? 10 : 7));
    if (Math.abs(dir) > 0.1) p.face = Math.sign(dir);
    p.x += p.vx * dt;
    if (p.x < -size() / 2) p.x = view.w + size() / 2;
    if (p.x > view.w + size() / 2) p.x = -size() / 2;

    // vertical
    const prevBottom = p.y + size() * 0.42;
    p.vy += GRAV() * dt;
    p.y += p.vy * dt;
    const bottom = p.y + size() * 0.42;

    if (p.vy > 0) {
      for (const pl of plats) {
        if (pl.broken) continue;
        const within = Math.abs(p.x - pl.x) < pl.w / 2 + size() * 0.25;
        if (within && prevBottom <= pl.y + 2 && bottom >= pl.y) {
          p.y = pl.y - size() * 0.42;
          const spring = pl.kind === "spring";
          p.vy = -JUMP() * (spring ? 1.65 : 1);
          p.sx = 1.3;
          p.sy = 0.72;
          if (spring) pl.springT = 0.3;
          api.sfx(spring ? "spring" : "hop");
          api.haptic(spring ? "medium" : "select");
          fx.burst(p.x, pl.y, { count: 6, colors: [PAL.snow], speed: 120, size: 3, life: 0.4, angle: -Math.PI / 2, spread: 1.2 });
          if (pl.kind === "fragile") {
            pl.broken = true;
            api.sfx("flip");
          }
          if (pl.floor > score) {
            const gained = pl.floor - score;
            score = pl.floor;
            api.setScore(score);
            if (gained > 0 && score % 25 === 0) {
              texts.add(view.w / 2, pl.y - camY - 60 * s, `${score} andares!`, PAL.gold, 26 * s);
              api.sfx("point");
            }
          }
          break;
        }
      }
    }

    // camera follows upward only
    camY = Math.min(camY, p.y - view.h * 0.42);
    fill();
    plats = plats.filter((pl) => pl.y < camY + view.h + 200);

    if (p.y - camY > view.h + size()) {
      over = true;
      overT = 0;
      api.sfx("over");
      api.haptic("error");
    }
  }

  function drawPlat(pl: Plat, y: number) {
    const { ctx } = view;
    const s = S();
    const x = pl.x - pl.w / 2;
    const h = 14 * s;
    ctx.save();
    if (pl.broken) {
      ctx.globalAlpha = Math.max(0, 1 - pl.fall * 1.5);
      ctx.translate(pl.x, y);
      ctx.rotate(pl.fall * 1.2);
      ctx.translate(-pl.x, -y);
    }
    const base = pl.kind === "moving" ? PAL.iceDark : pl.kind === "fragile" ? "#9a6a48" : PAL.wood;
    ctx.fillStyle = "rgba(0,0,0,.2)";
    ctx.beginPath();
    ctx.roundRect(x + 2 * s, y + 4 * s, pl.w, h, 7 * s);
    ctx.fill();
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.roundRect(x, y, pl.w, h, 7 * s);
    ctx.fill();
    if (pl.kind === "fragile") {
      ctx.strokeStyle = "rgba(60,30,15,.6)";
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(pl.x - 6 * s, y);
      ctx.lineTo(pl.x + 2 * s, y + h * 0.5);
      ctx.lineTo(pl.x - 3 * s, y + h);
      ctx.stroke();
    }
    // snow cap
    if (pl.kind !== "fragile") {
      ctx.fillStyle = pl.kind === "moving" ? "#e6f4ff" : PAL.snow;
      ctx.beginPath();
      ctx.roundRect(x - 2 * s, y - 4 * s, pl.w + 4 * s, 8 * s, 5 * s);
      ctx.fill();
      // icicles
      ctx.fillStyle = "rgba(207,232,255,.9)";
      for (let i = 1; i < 4; i++) {
        const ix = x + (pl.w * i) / 4;
        ctx.beginPath();
        ctx.moveTo(ix - 3 * s, y + h);
        ctx.lineTo(ix + 3 * s, y + h);
        ctx.lineTo(ix, y + h + (5 + (i % 2) * 4) * s);
        ctx.fill();
      }
    }
    if (pl.kind === "spring") {
      const gx = pl.x;
      const sq = pl.springT > 0 ? 0.6 : 1;
      ctx.fillStyle = PAL.berry;
      ctx.beginPath();
      ctx.roundRect(gx - 13 * s, y - 24 * s * sq, 26 * s, 22 * s * sq, 4 * s);
      ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(gx - 2.5 * s, y - 24 * s * sq, 5 * s, 22 * s * sq);
      ctx.beginPath();
      ctx.ellipse(gx - 6 * s, y - 27 * s * sq, 6 * s, 4 * s, -0.5, 0, Math.PI * 2);
      ctx.ellipse(gx + 6 * s, y - 27 * s * sq, 6 * s, 4 * s, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    const { ctx, w, h } = view;
    const s = S();
    const height = -camY / (1000 * s); // 0 at start, grows as you climb
    const k = Math.min(1, height / 12);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, k > 0.5 ? "#050b1a" : "#0a1f2c");
    g.addColorStop(1, k > 0.5 ? "#0e2140" : "#1d5a45");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(5,11,26," + (k * 0.7).toFixed(3) + ")";
    ctx.fillRect(0, 0, w, h);
    stars.draw(ctx, w, h, time, 0);
    drawMoon(ctx, w * 0.8, h * 0.15 + (-camY * 0.02) % h, 22 * s);

    // the guiding star far above
    ctx.fillStyle = PAL.gold;
    drawStar(ctx, w * 0.5, 40 * s + Math.sin(time * 2) * 4 * s, 14 * s, time * 0.3);

    // village at the start
    const groundY = view.h - 40 * S() - camY;
    if (groundY < h + 200 * s) {
      drawHills(ctx, w, groundY - 10 * s, 70 * s, 0, { color: "#174538", cap: "rgba(244,248,252,.3)", trees: 5, treeColor: "#0f3a2c", seed: 8, bottom: groundY + 400 * s });
      drawPine(ctx, w * 0.15, groundY, 90 * s, PAL.pine);
      drawPine(ctx, w * 0.86, groundY, 120 * s, PAL.pine);
    }

    for (const pl of plats) {
      const y = pl.y - camY;
      if (y < -40 || y > h + 40) continue;
      if (pl.floor === 0) {
        ctx.fillStyle = PAL.snow;
        ctx.fillRect(0, y - 4 * s, w, h);
        continue;
      }
      drawPlat(pl, y);
    }

    drawHead(ctx, api.me.head, p.x, p.y - camY, size(), p.vx / (420 * s) * 0.2, p.sx, p.sy, false);
    fx.draw(ctx);
    ctx.save();
    ctx.translate(0, 0);
    texts.draw(ctx);
    ctx.restore();

    if (time < 3 && !hasTilt) {
      ctx.globalAlpha = Math.max(0, 1 - time / 3);
      ctx.fillStyle = PAL.cream;
      ctx.textAlign = "center";
      ctx.font = `600 ${18 * s}px ${displayFont()}`;
      ctx.fillText("Inclina o telemóvel ou toca nos lados", w / 2, h * 0.3);
      ctx.globalAlpha = 1;
    }
  }

  // particles are spawned in world space → draw them relative to the camera
  const fxDraw = fx.draw.bind(fx);
  fx.draw = (ctx) => {
    ctx.save();
    ctx.translate(0, -camY);
    fxDraw(ctx);
    ctx.restore();
  };

  const stop = loop((dt) => {
    update(dt);
    render();
  });
  d.add(stop);
  api.setScore(0);
  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, prepare, hudScore: "points" };
export default mod;
