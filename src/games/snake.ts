import { Disposer, loop, pointerPos, setupCanvas } from "./engine";
import { FloatTexts, PAL, Particles, Shake, displayFont, drawHead, drawSky, safeAreaInsets } from "./kit";
import type { GameApi, GameModule } from "./types";

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const COLS = 13;

/** Candy-cane snake with your head; eat your love's head. */
function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const fx = new Particles();
  const texts = new FloatTexts();
  const shake = new Shake();
  const safe = safeAreaInsets();

  let cell = 20;
  let rows = 20;
  let ox = 0;
  let oy = 0;

  const { view, dispose } = setupCanvas(canvas, (v) => {
    const top = safe.top + 72;
    const bottom = safe.bottom + 24;
    cell = Math.floor(Math.min((v.w - 24) / COLS, 44));
    rows = Math.max(12, Math.floor((v.h - top - bottom) / cell));
    ox = Math.round((v.w - cell * COLS) / 2);
    oy = Math.round(top + (v.h - top - bottom - rows * cell) / 2);
  });
  d.add(dispose);

  let snake: { x: number; y: number }[] = [];
  let prev: { x: number; y: number }[] = [];
  let dir: Dir = DIRS.right;
  const queue: Dir[] = [];
  let food = { x: 0, y: 0 };
  let grow = 0;
  let acc = 0;
  let time = 0;
  let score = 0;
  let phase: "ready" | "play" | "dead" = "ready";
  let deadT = 0;

  function reset() {
    const cy = Math.floor(rows / 2);
    snake = [
      { x: 4, y: cy },
      { x: 3, y: cy },
      { x: 2, y: cy },
    ];
    prev = snake.map((s) => ({ ...s }));
    placeFood();
  }
  function placeFood() {
    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < COLS; x++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    food = free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
    if (snake.length && food.y === snake[0].y && Math.abs(food.x - snake[0].x) < 3 && score === 0) food.x = Math.min(COLS - 1, food.x + 4);
  }
  reset();

  const stepTime = () => Math.max(0.075, 0.17 - score * 0.0045);

  function turn(nd: Dir) {
    if (phase === "dead") return;
    const last = queue.at(-1) ?? dir;
    if (nd.x === -last.x && nd.y === -last.y) return;
    if (nd.x === last.x && nd.y === last.y) return;
    if (queue.length < 2) queue.push(nd);
    if (phase === "ready") phase = "play";
    api.haptic("select");
  }

  let start: { x: number; y: number } | null = null;
  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    start = pointerPos(e, canvas);
    if (phase === "ready") {
      phase = "play";
    }
  });
  d.on(canvas, "pointermove", (e) => {
    if (!start) return;
    const p = pointerPos(e, canvas);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (Math.hypot(dx, dy) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : dy > 0 ? DIRS.down : DIRS.up);
    start = p;
  });
  d.on(window, "pointerup", () => (start = null));
  d.on(window, "keydown", (e) => {
    const map: Record<string, Dir> = { ArrowUp: DIRS.up, ArrowDown: DIRS.down, ArrowLeft: DIRS.left, ArrowRight: DIRS.right, KeyW: DIRS.up, KeyS: DIRS.down, KeyA: DIRS.left, KeyD: DIRS.right };
    if (map[e.code]) {
      e.preventDefault();
      turn(map[e.code]);
    }
  });

  function step() {
    if (queue.length) dir = queue.shift()!;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitsWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= rows;
    const body = grow > 0 ? snake : snake.slice(0, -1);
    const hitsSelf = body.some((s) => s.x === head.x && s.y === head.y);
    if (hitsWall || hitsSelf) {
      phase = "dead";
      deadT = 0;
      shake.kick(10, 0.4);
      api.sfx("hit");
      api.haptic("heavy");
      const c = center(snake[0]);
      fx.burst(c.x, c.y, { count: 28, speed: 300, shape: "star" });
      return;
    }
    const old = snake.map((s) => ({ ...s }));
    snake.unshift(head);
    if (grow > 0) grow--;
    else snake.pop();
    // Each segment slides from where it was to its new cell (new tail segments stay put).
    prev = snake.map((_, i) => old[i] ?? old[old.length - 1]);

    if (head.x === food.x && head.y === food.y) {
      score++;
      grow += 1;
      api.setScore(score);
      api.sfx("point");
      api.haptic("medium");
      const c = center(food);
      fx.burst(c.x, c.y, { count: 18, colors: [api.them.color, PAL.gold, PAL.cream], speed: 240, shape: "star", size: 5 });
      texts.add(c.x, c.y - cell, "+1", PAL.gold, 24);
      placeFood();
    }
  }

  const center = (p: { x: number; y: number }) => ({ x: ox + p.x * cell + cell / 2, y: oy + p.y * cell + cell / 2 });

  function update(dt: number) {
    time += dt;
    fx.update(dt, 500);
    texts.update(dt);
    if (phase === "play") {
      acc += dt;
      while (acc >= stepTime() && phase === "play") {
        acc -= stepTime();
        step();
      }
    } else if (phase === "dead") {
      deadT += dt;
      if (deadT > 0.9) {
        phase = "ready";
        api.end(score);
        stop();
      }
    }
  }

  function render(dt: number) {
    const { ctx, w, h } = view;
    ctx.save();
    shake.apply(ctx, dt);
    drawSky(ctx, w, h);

    // board
    const bw = COLS * cell;
    const bh = rows * cell;
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.roundRect(ox - 4, oy + 2, bw + 8, bh + 10, 18);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ox, oy, bw, bh, 14);
    ctx.clip();
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#eef4fa" : "#e2ebf5";
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    ctx.restore();
    ctx.strokeStyle = PAL.berry;
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 10;
    ctx.beginPath();
    ctx.roundRect(ox - 3, oy - 3, bw + 6, bh + 6, 16);
    ctx.stroke();
    ctx.setLineDash([]);

    // food: partner's head
    const fc = center(food);
    const bob = 1 + Math.sin(time * 6) * 0.06;
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.beginPath();
    ctx.ellipse(fc.x, fc.y + cell * 0.55, cell * 0.5, cell * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    drawHead(ctx, api.them.head, fc.x, fc.y, cell * 1.55 * bob, Math.sin(time * 3) * 0.12, 1, 1, false);

    // snake body (interpolated)
    const t = phase === "play" ? Math.min(1, acc / stepTime()) : 1;
    const pts = snake.map((s, i) => {
      const a = center(prev[i] ?? s);
      const b = center(s);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
    for (let i = pts.length - 1; i >= 1; i--) {
      const p = pts[i];
      const r = cell * (0.44 - Math.min(0.12, (i / pts.length) * 0.12));
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.beginPath();
      ctx.arc(p.x, p.y + 3, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 2 ? PAL.berry : PAL.snow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = i % 2 ? PAL.berryDark : "#c9d6e4";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // head
    const hp = pts[0];
    const tilt = dir.x * 0.18;
    drawHead(ctx, api.me.head, hp.x, hp.y, cell * 1.75, tilt, 1, 1, false);

    fx.draw(ctx);
    texts.draw(ctx);

    if (phase === "ready") {
      ctx.fillStyle = "rgba(11,29,22,.55)";
      ctx.beginPath();
      ctx.roundRect(w / 2 - 130, oy + bh * 0.68 - 26, 260, 52, 26);
      ctx.fill();
      ctx.fillStyle = PAL.cream;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 20px ${displayFont()}`;
      ctx.fillText("Desliza para começar", w / 2, oy + bh * 0.68);
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
