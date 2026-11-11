import { Disposer, loop, rand, setupCanvas } from "./engine";
import { PAL, Particles, Shake, Snowfall, Stars, FloatTexts, candyPattern, displayFont, drawHead, drawHills, drawMoon, drawSky } from "./kit";
import type { GameApi, GameModule } from "./types";

/** Fly the head between candy-cane columns. 1 point per pair. */
function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const { view, dispose } = setupCanvas(canvas);
  d.add(dispose);

  const stars = new Stars(50);
  const snow = new Snowfall(50);
  const fx = new Particles();
  const texts = new FloatTexts();
  const shake = new Shake();

  type Pipe = { x: number; gapY: number; passed: boolean };
  let pipes: Pipe[] = [];
  let phase: "ready" | "play" | "dead" = "ready";
  let score = 0;
  let scroll = 0;
  let spawnIn = 0;
  let time = 0;
  let deadTimer = 0;
  const bird = { x: 0, y: 0, vy: 0, rot: 0, squash: 1 };

  const S = () => view.h / 780; // world scale
  const ground = () => view.h - 86 * S();
  const headSize = () => 66 * S();
  const radius = () => 25 * S();
  const pipeW = () => 74 * S();
  const speed = () => (170 + Math.min(score, 40) * 2.2) * S();
  const gap = () => Math.max(168, 215 - score * 1.4) * S();

  function reset() {
    bird.x = view.w * 0.3;
    bird.y = view.h * 0.42;
    bird.vy = 0;
  }
  reset();

  function flap() {
    if (phase === "dead") return;
    if (phase === "ready") {
      phase = "play";
      spawnIn = 0.6;
    }
    bird.vy = -545 * S();
    bird.squash = 0.8;
    api.sfx("flap");
    api.haptic("select");
    fx.burst(bird.x - headSize() * 0.3, bird.y + headSize() * 0.2, { count: 5, colors: [PAL.snow], speed: 120, size: 3, life: 0.4, angle: Math.PI * 0.8, spread: 0.6 });
  }

  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    flap();
  });
  d.on(window, "keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      flap();
    }
  });

  function die() {
    if (phase === "dead") return;
    phase = "dead";
    deadTimer = 0;
    shake.kick(10 * S());
    api.sfx("hit");
    api.haptic("heavy");
    fx.burst(bird.x, bird.y, { count: 26, speed: 320, size: 5, shape: "star" });
    bird.vy = -300 * S();
  }

  function update(dt: number) {
    time += dt;
    const s = S();
    snow.update(dt, view.w, view.h, -30);
    fx.update(dt, 700 * s);
    texts.update(dt);
    bird.squash += (1 - bird.squash) * Math.min(1, dt * 10);

    if (phase === "ready") {
      bird.y = view.h * 0.42 + Math.sin(time * 3) * 10 * s;
      bird.rot = Math.sin(time * 3) * 0.08;
      scroll += speed() * 0.5 * dt;
      return;
    }

    if (phase === "play") scroll += speed() * dt;

    bird.vy += 1650 * s * dt;
    bird.y += bird.vy * dt;
    const targetRot = Math.max(-0.45, Math.min(1.2, bird.vy / (900 * s)));
    bird.rot += (targetRot - bird.rot) * Math.min(1, dt * 8);

    if (phase === "dead") {
      deadTimer += dt;
      bird.rot += dt * 8;
      if (bird.y > ground() - radius()) {
        bird.y = ground() - radius();
        bird.vy = 0;
      }
      if (deadTimer > 0.7) {
        api.end(score);
        phase = "ready"; // stop calling end
        stop();
      }
      return;
    }

    // pipes
    spawnIn -= dt;
    if (spawnIn <= 0) {
      const g = gap();
      const top = 70 * s + g / 2;
      const bottom = ground() - 60 * s - g / 2;
      const prev = pipes.at(-1)?.gapY ?? view.h * 0.45;
      const gapY = Math.max(top, Math.min(bottom, prev + rand(-1, 1) * 190 * s));
      pipes.push({ x: view.w + pipeW(), gapY, passed: false });
      spawnIn = (265 * s) / speed();
    }
    for (const p of pipes) {
      p.x -= speed() * dt;
      if (!p.passed && p.x + pipeW() / 2 < bird.x) {
        p.passed = true;
        score++;
        api.setScore(score);
        api.sfx("point");
        texts.add(bird.x, bird.y - headSize() * 0.7, "+1", PAL.gold, 26 * s);
      }
      // collision (circle vs two rects)
      const r = radius();
      const g = gap();
      const left = p.x - pipeW() / 2;
      const right = p.x + pipeW() / 2;
      const rects = [
        [left, -1000, right, p.gapY - g / 2],
        [left, p.gapY + g / 2, right, view.h + 1000],
      ];
      for (const [x1, y1, x2, y2] of rects) {
        const cx = Math.max(x1, Math.min(bird.x, x2));
        const cy = Math.max(y1, Math.min(bird.y, y2));
        if ((cx - bird.x) ** 2 + (cy - bird.y) ** 2 < r * r) die();
      }
    }
    pipes = pipes.filter((p) => p.x > -pipeW() * 2);

    if (bird.y + radius() > ground()) {
      bird.y = ground() - radius();
      die();
    }
    if (bird.y < -headSize()) bird.y = -headSize();
  }

  function drawCane(x: number, yFrom: number, yTo: number, capAtBottom: boolean) {
    const { ctx } = view;
    const s = S();
    const w = pipeW();
    const top = Math.min(yFrom, yTo);
    const h = Math.abs(yTo - yFrom);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2, top, w, h);
    ctx.clip();
    ctx.translate(x - w / 2, 0);
    ctx.fillStyle = candyPattern(ctx, 26 * s);
    ctx.fillRect(0, top, w, h);
    // shading
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(0,0,0,.18)");
    g.addColorStop(0.35, "rgba(255,255,255,.18)");
    g.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, h);
    ctx.restore();
    // cap
    const capH = 26 * s;
    const capY = capAtBottom ? yTo - capH : yTo;
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 6 * s, capY, w + 12 * s, capH, 8 * s);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(x - w / 2, capY + 4 * s, w, 4 * s);
    ctx.fillStyle = PAL.goldDark;
    ctx.fillRect(x - w / 2 - 6 * s, capY + capH - 5 * s, w + 12 * s, 5 * s);
    // snow on top caps
    if (capAtBottom) {
      ctx.fillStyle = PAL.snow;
      ctx.beginPath();
      ctx.ellipse(x, capY + 1 * s, w / 2 + 4 * s, 7 * s, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  function render(dt: number) {
    const { ctx, w, h } = view;
    const s = S();
    ctx.save();
    shake.apply(ctx, dt);
    drawSky(ctx, w, h);
    stars.draw(ctx, w, h, time, scroll * 0.02);
    drawMoon(ctx, w * 0.78, h * 0.13, 26 * s);
    drawHills(ctx, w, h * 0.72, 120 * s, scroll * 0.15, { color: "#174538", cap: "rgba(244,248,252,.35)", trees: 7, treeColor: "#0f3a2c", seed: 2 });
    drawHills(ctx, w, h * 0.84, 90 * s, scroll * 0.35, { color: "#d9e6f2", trees: 5, treeColor: PAL.pineDark, seed: 5 });

    for (const p of pipes) {
      const g = gap();
      drawCane(p.x, -10, p.gapY - g / 2, true);
      drawCane(p.x, h + 10, p.gapY + g / 2, false);
    }

    // ground
    const gy = ground();
    ctx.fillStyle = PAL.snow;
    ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = PAL.snowShade;
    const step = 46 * s;
    for (let x = -(scroll % step); x < w + step; x += step) {
      ctx.beginPath();
      ctx.ellipse(x, gy + 22 * s, 16 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,.08)";
    ctx.fillRect(0, gy, w, 4 * s);

    drawHead(ctx, api.me.head, bird.x, bird.y, headSize(), bird.rot, 2 - bird.squash, bird.squash, false);
    fx.draw(ctx);
    texts.draw(ctx);
    snow.draw(ctx);

    if (phase === "ready") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,247,234,.92)";
      ctx.font = `600 ${22 * s}px ${displayFont()}`;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
      ctx.fillText("Toca para voar", w / 2, h * 0.62);
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

const mod: GameModule = { create, hudScore: "points" };
export default mod;
