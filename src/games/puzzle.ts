import { Disposer, loop, pointerPos, rand, setupCanvas, shuffle } from "./engine";
import { PAL, Particles, drawSky, safeAreaInsets } from "./kit";
import type { GameApi, GameModule } from "./types";

const COLS = 3;
const ROWS = 4;
const TRAY_SCALE = 0.62;

interface Piece {
  r: number;
  c: number;
  sprite: HTMLCanvasElement;
  x: number; // centre position (CSS px)
  y: number;
  scale: number;
  targetScale: number;
  placed: boolean;
  homeX: number;
  homeY: number;
}

/** Classic jigsaw tab on one side: template in (t along side, o outward) units. */
function edgePath(p: Path2D, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, sign: number, L: number) {
  const pt = (t: number, o: number): [number, number] => [ax + (bx - ax) * t + nx * o * L * sign, ay + (by - ay) * t + ny * o * L * sign];
  if (sign === 0) {
    p.lineTo(bx, by);
    return;
  }
  p.lineTo(...pt(0.38, 0));
  p.bezierCurveTo(...pt(0.43, 0), ...pt(0.43, 0.07), ...pt(0.38, 0.12));
  p.bezierCurveTo(...pt(0.32, 0.27), ...pt(0.68, 0.27), ...pt(0.62, 0.12));
  p.bezierCurveTo(...pt(0.57, 0.07), ...pt(0.57, 0), ...pt(0.62, 0));
  p.lineTo(bx, by);
}

function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const fx = new Particles();
  const safe = safeAreaInsets();

  // Pick the photo for this day (different photo each time the puzzle comes up).
  const photo = api.photos.length ? api.photos[(api.day ?? Math.floor(Math.random() * 99)) % api.photos.length] : api.me.head;

  // Random tab directions for interior edges.
  const hz = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => (Math.random() < 0.5 ? 1 : -1)));
  const vt = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => (Math.random() < 0.5 ? 1 : -1)));

  let pieces: Piece[] = [];
  let bx = 0,
    by = 0,
    bw = 0,
    bh = 0,
    pw = 0,
    ph = 0,
    margin = 0;
  let trayTop = 0;
  let boardImg: HTMLCanvasElement | null = null;
  let dragging: { piece: Piece; dx: number; dy: number; id: number } | null = null;
  let elapsed = 0;
  let hudT = 0;
  let done = false;
  let doneT = 0;

  function piecePath(r: number, c: number) {
    const p = new Path2D();
    const L = Math.min(pw, ph);
    const top = r === 0 ? 0 : -hz[r - 1][c];
    const right = c === COLS - 1 ? 0 : vt[r][c];
    const bottom = r === ROWS - 1 ? 0 : hz[r][c];
    const left = c === 0 ? 0 : -vt[r][c - 1];
    p.moveTo(0, 0);
    edgePath(p, 0, 0, pw, 0, 0, -1, top, L);
    edgePath(p, pw, 0, pw, ph, 1, 0, right, L);
    edgePath(p, pw, ph, 0, ph, 0, 1, bottom, L);
    edgePath(p, 0, ph, 0, 0, -1, 0, left, L);
    p.closePath();
    return p;
  }

  function build(v: { w: number; h: number; dpr: number }) {
    const top = safe.top + 74;
    const bottom = safe.bottom + 14;
    const avail = v.h - top - bottom;
    bw = Math.min(v.w * 0.8, avail * 0.6 * 0.75);
    bw = Math.floor(bw / COLS) * COLS;
    bh = (bw / 3) * 4;
    pw = bw / COLS;
    ph = bh / ROWS;
    margin = Math.ceil(Math.min(pw, ph) * 0.3);
    bx = Math.round((v.w - bw) / 2);
    by = Math.round(top);
    trayTop = by + bh + 14;

    // photo cropped to 3:4 ("cover")
    const dpr = v.dpr;
    boardImg = document.createElement("canvas");
    boardImg.width = Math.round(bw * dpr);
    boardImg.height = Math.round(bh * dpr);
    const g = boardImg.getContext("2d")!;
    const iw = photo.naturalWidth || 1;
    const ih = photo.naturalHeight || 1;
    const k = Math.max(boardImg.width / iw, boardImg.height / ih);
    g.drawImage(photo, (boardImg.width - iw * k) / 2, (boardImg.height - ih * k) / 2, iw * k, ih * k);

    const old = pieces;
    pieces = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const sprite = document.createElement("canvas");
        sprite.width = Math.round((pw + margin * 2) * dpr);
        sprite.height = Math.round((ph + margin * 2) * dpr);
        const s = sprite.getContext("2d")!;
        s.scale(dpr, dpr);
        s.translate(margin, margin);
        const path = piecePath(r, c);
        s.save();
        s.clip(path);
        s.drawImage(boardImg, -c * pw, -r * ph, bw, bh);
        // soft inner bevel
        s.lineWidth = 4;
        s.strokeStyle = "rgba(0,0,0,.22)";
        s.translate(1.5, 1.5);
        s.stroke(path);
        s.translate(-3, -3);
        s.strokeStyle = "rgba(255,255,255,.35)";
        s.stroke(path);
        s.restore();
        s.lineWidth = 1;
        s.strokeStyle = "rgba(255,255,255,.55)";
        s.stroke(path);
        const prev = old.find((o) => o.r === r && o.c === c);
        pieces.push({ r, c, sprite, x: 0, y: 0, scale: TRAY_SCALE, targetScale: TRAY_SCALE, placed: prev?.placed ?? false, homeX: 0, homeY: 0 });
      }

    // Scatter loose pieces on a jittered grid inside the tray.
    const loose = shuffle(pieces.filter((p) => !p.placed));
    const trayH = v.h - bottom - trayTop;
    const cols = 4;
    const rowsN = Math.ceil(loose.length / cols) || 1;
    const cw = v.w / cols;
    const rh = trayH / rowsN;
    loose.forEach((p, i) => {
      const cx = (i % cols) * cw + cw / 2 + rand(-cw * 0.12, cw * 0.12);
      const cy = trayTop + Math.floor(i / cols) * rh + rh / 2 + rand(-rh * 0.1, rh * 0.1);
      p.homeX = p.x = cx;
      p.homeY = p.y = cy;
    });
    for (const p of pieces) if (p.placed) Object.assign(p, targetOf(p), { scale: 1, targetScale: 1 });
  }

  const targetOf = (p: Piece) => ({ x: bx + p.c * pw + pw / 2, y: by + p.r * ph + ph / 2 });

  const { view, dispose } = setupCanvas(canvas, (v) => build(v));
  d.add(dispose);

  function hit(x: number, y: number): Piece | null {
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.placed) continue;
      const hw = (pw / 2 + margin * 0.5) * p.scale;
      const hh = (ph / 2 + margin * 0.5) * p.scale;
      if (Math.abs(x - p.x) < hw && Math.abs(y - p.y) < hh) return p;
    }
    return null;
  }

  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    if (done || dragging) return;
    const { x, y } = pointerPos(e, canvas);
    const p = hit(x, y);
    if (!p) return;
    canvas.setPointerCapture(e.pointerId);
    pieces = pieces.filter((q) => q !== p).concat(p);
    p.targetScale = 1;
    dragging = { piece: p, dx: p.x - x, dy: p.y - y, id: e.pointerId };
    api.haptic("select");
    api.sfx("tap");
  });
  d.on(canvas, "pointermove", (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const { x, y } = pointerPos(e, canvas);
    // Lift the piece slightly above the finger so it stays visible.
    dragging.piece.x = x + dragging.dx * 0.6;
    dragging.piece.y = y + dragging.dy * 0.6 - 18;
  });
  const release = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const p = dragging.piece;
    dragging = null;
    const t = targetOf(p);
    if (Math.hypot(p.x - t.x, p.y - t.y) < Math.min(pw, ph) * 0.36) {
      p.placed = true;
      p.x = t.x;
      p.y = t.y;
      p.scale = p.targetScale = 1;
      // placed pieces go to the bottom of the stack
      pieces = [p, ...pieces.filter((q) => q !== p)];
      api.sfx("match");
      api.haptic("medium");
      fx.burst(t.x, t.y, { count: 10, colors: [PAL.gold, PAL.cream], speed: 160, shape: "star", size: 4, life: 0.5 });
      if (pieces.every((q) => q.placed)) {
        done = true;
        doneT = 0;
        api.setScore(Math.round(elapsed * 10) / 10);
        api.sfx("record");
        api.haptic("success");
        fx.burst(bx + bw / 2, by + bh / 2, { count: 60, speed: 500, shape: "rect", size: 6, life: 1.4 });
      }
    } else {
      p.targetScale = p.y > trayTop - ph * 0.2 ? TRAY_SCALE : 1;
      api.sfx("flip");
    }
  };
  d.on(canvas, "pointerup", release);
  d.on(canvas, "pointercancel", release);

  function update(dt: number) {
    fx.update(dt, 500);
    for (const p of pieces) p.scale += (p.targetScale - p.scale) * Math.min(1, dt * 14);
    if (done) {
      doneT += dt;
      if (doneT > 1.3) {
        done = false;
        api.end(Math.round(elapsed * 10) / 10);
        stop();
      }
      return;
    }
    elapsed += dt;
    hudT += dt;
    if (hudT > 0.1) {
      hudT = 0;
      api.setScore(Math.floor(elapsed * 10) / 10);
    }
  }

  function render() {
    const { ctx, w, h } = view;
    drawSky(ctx, w, h, "#0a1f2c", "#173f35");

    // table / tray
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.roundRect(8, trayTop - 4, w - 16, h - trayTop - safe.bottom - 6, 22);
    ctx.fill();

    // board
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 16);
    ctx.fill();
    ctx.fillStyle = PAL.night;
    ctx.fillRect(bx, by, bw, bh);
    if (boardImg) {
      ctx.globalAlpha = 0.14;
      ctx.drawImage(boardImg, bx, by, bw, bh);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(bx + c * pw, by);
      ctx.lineTo(bx + c * pw, by + bh);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(bx, by + r * ph);
      ctx.lineTo(bx + bw, by + r * ph);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);

    for (const p of pieces) {
      const sw = (pw + margin * 2) * p.scale;
      const sh = (ph + margin * 2) * p.scale;
      const lifted = dragging?.piece === p;
      if (!p.placed) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.45)";
        ctx.shadowBlur = lifted ? 18 : 6;
        ctx.shadowOffsetY = lifted ? 10 : 3;
        ctx.drawImage(p.sprite, p.x - sw / 2, p.y - sh / 2, sw, sh);
        ctx.restore();
      } else ctx.drawImage(p.sprite, p.x - sw / 2, p.y - sh / 2, sw, sh);
    }

    if (done) {
      ctx.globalAlpha = Math.min(1, doneT * 2);
      if (boardImg) ctx.drawImage(boardImg, bx, by, bw, bh);
      ctx.globalAlpha = 1;
    }
    fx.draw(ctx);
  }

  const stop = loop((dt) => {
    update(dt);
    render();
  });
  d.add(stop);
  api.setScore(0);
  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, needsPhotos: true, hudScore: "seconds" };
export default mod;
