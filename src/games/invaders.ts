import { Disposer, clamp, loop, pointerPos, rand, setupCanvas } from "./engine";
import { FloatTexts, PAL, Particles, Shake, Stars, displayFont, drawHead, drawHills, drawMoon, drawSky, safeAreaInsets } from "./kit";
import type { GameApi, GameModule } from "./types";

interface Enemy {
  col: number;
  row: number;
  alive: boolean;
  wob: number;
}
interface Bullet {
  x: number;
  y: number;
  vy: number;
  color?: string;
}

const LIVES = 3;

/** Your love's heads invade in formation. Shoot them down; take max 3 ornaments; none may reach you. */
function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const { view, dispose } = setupCanvas(canvas);
  d.add(dispose);
  const safe = safeAreaInsets();

  const stars = new Stars(70);
  const fx = new Particles();
  const texts = new FloatTexts();
  const shake = new Shake();

  const S = () => Math.min(view.w / 390, view.h / 800);
  const playerY = () => view.h - safe.bottom - 80 * S();

  const player = { x: 0, invuln: 0, tilt: 0 };
  player.x = view.w / 2;
  let enemies: Enemy[] = [];
  let shots: Bullet[] = [];
  let bombs: Bullet[] = [];
  let fx0 = 0; // formation offset x
  let fy0 = 0; // formation offset y
  let fdir = 1;
  let wave = 0;
  let waveBanner = 0;
  let fireT = 0;
  let bombT = 1.5;
  let lives = LIVES;
  let score = 0;
  let time = 0;
  let over = false;
  let overT = 0;
  let betweenWaves = 0;
  let keys = 0;

  const COLS = 5;
  const gap = () => Math.min(64 * S(), (view.w - 40) / COLS);
  const size = () => gap() * 0.78;

  function nextWave() {
    wave++;
    const rows = Math.min(5, 2 + Math.ceil(wave / 2));
    enemies = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) enemies.push({ col: c, row: r, alive: true, wob: Math.random() * 6 });
    fx0 = 0;
    fy0 = safe.top + 80 * S() - (rows - 2) * 4 * S() + Math.min(wave - 1, 4) * 12 * S();
    fdir = 1;
    waveBanner = 1.6;
    bombT = 1.2;
  }
  nextWave();

  const enemyPos = (e: Enemy) => {
    const formationW = gap() * (COLS - 1);
    return { x: view.w / 2 - formationW / 2 + e.col * gap() + fx0, y: fy0 + e.row * gap() * 0.9 };
  };

  let lastX: number | null = null;
  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    lastX = pointerPos(e, canvas).x;
  });
  d.on(canvas, "pointermove", (e) => {
    if (lastX === null) return;
    const x = pointerPos(e, canvas).x;
    const dx = (x - lastX) * 1.25;
    player.x = clamp(player.x + dx, 30 * S(), view.w - 30 * S());
    player.tilt = clamp(dx * 0.03, -0.35, 0.35);
    lastX = x;
  });
  const up = () => (lastX = null);
  d.on(canvas, "pointerup", up);
  d.on(canvas, "pointercancel", up);
  d.on(window, "keydown", (e) => {
    if (e.code === "ArrowLeft") keys = -1;
    if (e.code === "ArrowRight") keys = 1;
  });
  d.on(window, "keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") keys = 0;
  });

  function gameOver() {
    if (over) return;
    over = true;
    overT = 0;
    shake.kick(16 * S(), 0.6);
    api.sfx("over");
    api.haptic("error");
  }

  function update(dt: number) {
    time += dt;
    const s = S();
    fx.update(dt, 500 * s);
    texts.update(dt);
    waveBanner = Math.max(0, waveBanner - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.tilt *= 1 - Math.min(1, dt * 8);
    if (keys) player.x = clamp(player.x + keys * 380 * s * dt, 30 * s, view.w - 30 * s);

    for (const b of shots) b.y += b.vy * dt;
    for (const b of bombs) b.y += b.vy * dt;
    shots = shots.filter((b) => b.y > -20);
    bombs = bombs.filter((b) => b.y < view.h + 20);

    if (over) {
      overT += dt;
      if (overT > 1.2) {
        over = false;
        api.end(score);
        stop();
      }
      return;
    }

    // auto-fire
    fireT -= dt;
    if (fireT <= 0) {
      fireT = 0.3;
      shots.push({ x: player.x, y: playerY() - 34 * s, vy: -680 * s });
      api.sfx("shoot");
    }

    const alive = enemies.filter((e) => e.alive);
    if (!alive.length) {
      betweenWaves += dt;
      if (betweenWaves > 0.9) {
        betweenWaves = 0;
        nextWave();
      }
      return;
    }

    // formation movement
    const total = enemies.length;
    const speed = (38 + wave * 10) * s * (1 + (1 - alive.length / total) * 1.6);
    fx0 += fdir * speed * dt;
    const xs = alive.map((e) => enemyPos(e).x);
    const minX = Math.min(...xs) - size() / 2;
    const maxX = Math.max(...xs) + size() / 2;
    if ((fdir > 0 && maxX > view.w - 8) || (fdir < 0 && minX < 8)) {
      fdir *= -1;
      fy0 += 20 * s;
    }

    // enemy fire
    bombT -= dt;
    if (bombT <= 0) {
      bombT = Math.max(0.45, 1.35 - wave * 0.12) * rand(0.6, 1.3);
      const cols = [...new Set(alive.map((e) => e.col))];
      const col = cols[Math.floor(Math.random() * cols.length)];
      const shooter = alive.filter((e) => e.col === col).sort((a, b) => b.row - a.row)[0];
      const p = enemyPos(shooter);
      bombs.push({ x: p.x, y: p.y + size() * 0.4, vy: (230 + wave * 15) * s, color: Math.random() < 0.5 ? PAL.berry : PAL.gold });
    }

    // collisions: shots vs enemies
    for (const b of shots) {
      for (const e of alive) {
        if (!e.alive) continue;
        const p = enemyPos(e);
        if (Math.abs(b.x - p.x) < size() * 0.42 && Math.abs(b.y - p.y) < size() * 0.45) {
          e.alive = false;
          b.y = -100;
          score++;
          api.setScore(score);
          api.sfx("pop");
          api.haptic("light");
          fx.burst(p.x, p.y, { count: 16, colors: [api.them.color, PAL.cream, PAL.gold], speed: 260, shape: "star", size: 5 });
          texts.add(p.x, p.y - size() * 0.4, "+1", PAL.gold, 20 * s);
          break;
        }
      }
    }

    // bombs vs player
    const py = playerY();
    for (const b of bombs) {
      if (player.invuln <= 0 && Math.abs(b.x - player.x) < 26 * s && Math.abs(b.y - (py - 6 * s)) < 30 * s) {
        b.y = view.h + 100;
        lives--;
        api.setLives(lives, LIVES);
        player.invuln = 1.3;
        shake.kick(10 * s);
        api.sfx("hit");
        api.haptic("heavy");
        fx.burst(player.x, py, { count: 20, colors: [b.color ?? PAL.berry, PAL.cream], speed: 280, shape: "rect" });
        if (lives <= 0) gameOver();
      }
    }

    // a head got through
    for (const e of alive) {
      if (enemyPos(e).y + size() / 2 >= py - 34 * s) {
        texts.add(view.w / 2, py - 90 * s, "Passou uma cabeça!", PAL.berry, 24 * s);
        gameOver();
        break;
      }
    }
  }

  function drawOrnament(x: number, y: number, r: number, color: string) {
    const { ctx } = view;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9d6e4";
    ctx.fillRect(x - r * 0.35, y - r * 1.35, r * 0.7, r * 0.45);
  }

  function render(dt: number) {
    const { ctx, w, h } = view;
    const s = S();
    ctx.save();
    shake.apply(ctx, dt);
    drawSky(ctx, w, h, "#071722", "#16343f");
    stars.draw(ctx, w, h * 1.6, time, time * 4);
    drawMoon(ctx, w * 0.85, h * 0.2, 20 * s);
    drawHills(ctx, w, h - safe.bottom - 20 * s, 60 * s, 0, { color: "#174538", cap: "rgba(244,248,252,.3)", trees: 6, treeColor: "#0f3a2c", seed: 6 });
    ctx.fillStyle = PAL.snow;
    ctx.fillRect(0, h - safe.bottom - 22 * s, w, safe.bottom + 30 * s);

    // enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      const p = enemyPos(e);
      const bob = Math.sin(time * 5 + e.wob) * 3 * s;
      drawHead(ctx, api.them.head, p.x, p.y + bob, size(), Math.sin(time * 3 + e.wob) * 0.12, 1, 1, false);
    }

    // shots: snowballs
    ctx.fillStyle = PAL.snow;
    for (const b of shots) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of bombs) drawOrnament(b.x, b.y, 7 * s, b.color ?? PAL.berry);

    // player: head on a little sleigh
    const py = playerY();
    if (!(player.invuln > 0 && Math.floor(time * 12) % 2 === 0)) {
      ctx.save();
      ctx.translate(player.x, py);
      ctx.rotate(player.tilt);
      ctx.fillStyle = PAL.berry;
      ctx.beginPath();
      ctx.roundRect(-30 * s, 2 * s, 60 * s, 18 * s, 8 * s);
      ctx.fill();
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(-30 * s, 8 * s, 60 * s, 4 * s);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 3 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-34 * s, 26 * s);
      ctx.lineTo(30 * s, 26 * s);
      ctx.quadraticCurveTo(42 * s, 26 * s, 40 * s, 16 * s);
      ctx.stroke();
      ctx.restore();
      drawHead(ctx, api.me.head, player.x, py - 18 * s, 58 * s, player.tilt, 1, 1, false);
    }

    fx.draw(ctx);
    texts.draw(ctx);

    if (waveBanner > 0) {
      ctx.globalAlpha = Math.min(1, waveBanner * 2);
      ctx.fillStyle = PAL.cream;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${34 * s}px ${displayFont()}`;
      ctx.fillText(`Vaga ${wave}`, w / 2, h * 0.5);
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
  api.setLives(LIVES, LIVES);
  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, hudScore: "points" };
export default mod;
