/** Minimal canvas game helpers: DPR-aware sizing, a frame loop and listener cleanup. */

export interface View {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
}

export function setupCanvas(canvas: HTMLCanvasElement, onResize?: (v: View) => void) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const view: View = { ctx, w: 1, h: 1, dpr: 1 };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    view.w = Math.max(1, r.width);
    view.h = Math.max(1, r.height);
    view.dpr = dpr;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    onResize?.(view);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  return { view, dispose: () => ro.disconnect() };
}

/** requestAnimationFrame loop with a clamped delta (seconds). */
export function loop(fn: (dt: number, time: number) => void) {
  let raf = 0;
  let last = performance.now();
  let running = true;
  const tick = (t: number) => {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 1 / 20);
    last = t;
    fn(dt, t / 1000);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}

/** Collects cleanup callbacks. */
export class Disposer {
  private fns: (() => void)[] = [];
  add(fn: () => void) {
    this.fns.push(fn);
  }
  on<K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  on<K extends keyof WindowEventMap>(el: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  on(el: HTMLElement | Window, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) {
    el.addEventListener(type, fn, opts);
    this.fns.push(() => el.removeEventListener(type, fn, opts));
  }
  timeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    this.fns.push(() => clearTimeout(id));
  }
  dispose() {
    this.fns.splice(0).reverse().forEach((f) => f());
  }
}

export function pointerPos(e: PointerEvent | MouseEvent, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Deterministic pseudo random (for scenery that must not flicker). */
export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
