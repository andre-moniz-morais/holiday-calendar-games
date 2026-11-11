import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Disposer, pick, pointerPos, rand } from "./engine";
import { headModel } from "@/lib/players";
import type { GameApi, GameModule } from "./types";

type RowType = "snow" | "road" | "river";
interface Mover {
  mesh: THREE.Object3D;
  x: number;
  len: number;
}
interface Row {
  index: number;
  type: RowType;
  group: THREE.Group;
  movers: Mover[];
  speed: number; // units/s, signed
  blocked: Set<number>;
}

const HALF = 4; // playable columns: -4..4
const HOP_TIME = 0.13;
const C = {
  snowA: 0xf4f8fc,
  snowB: 0xe6eef7,
  road: 0x3a4250,
  line: 0xfff7ea,
  water: 0x4f9fd8,
  log: 0x8a5a3c,
  logEnd: 0xc8956a,
  pine: 0x1f6b4a,
  pineDark: 0x134a33,
  trunk: 0x5e3b26,
  berry: 0xe0464e,
  gold: 0xf5bf4f,
  ice: 0x9fd3ff,
  dark: 0x1d2a33,
};
const CAR_COLORS = [0xe0464e, 0xf5bf4f, 0x3b82c4, 0x2a9d8f, 0x8e4ec6, 0xfff7ea];

function create(canvas: HTMLCanvasElement, api: GameApi) {
  const d = new Disposer();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x173b46);
  scene.fog = new THREE.Fog(0x173b46, 22, 38);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
  const CAM_OFFSET = new THREE.Vector3(2.2, 10.5, 10.5);

  const hemi = new THREE.HemisphereLight(0xdfefff, 0x35584a, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  // ───────── shared geometry & materials ─────────
  const geo = {
    tile: new THREE.BoxGeometry(31, 0.3, 1),
    water: new THREE.BoxGeometry(31, 0.1, 1),
    line: new THREE.BoxGeometry(0.5, 0.02, 0.06),
    trunk: new THREE.CylinderGeometry(0.1, 0.12, 0.3, 6),
    cone1: new THREE.ConeGeometry(0.42, 0.6, 7),
    cone2: new THREE.ConeGeometry(0.32, 0.5, 7),
    cone3: new THREE.ConeGeometry(0.2, 0.36, 7),
    ball: new THREE.SphereGeometry(1, 12, 10),
    box: new THREE.BoxGeometry(1, 1, 1),
    wheel: new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10),
    log: new THREE.CylinderGeometry(0.28, 0.28, 1, 10),
    shade: new THREE.BoxGeometry(12, 0.02, 1),
  };
  const mat = {
    snowA: new THREE.MeshLambertMaterial({ color: C.snowA }),
    snowB: new THREE.MeshLambertMaterial({ color: C.snowB }),
    road: new THREE.MeshLambertMaterial({ color: C.road }),
    line: new THREE.MeshBasicMaterial({ color: C.line }),
    water: new THREE.MeshLambertMaterial({ color: C.water, emissive: 0x0b2a44 }),
    pine: new THREE.MeshLambertMaterial({ color: C.pine, flatShading: true }),
    pineDark: new THREE.MeshLambertMaterial({ color: C.pineDark, flatShading: true }),
    snow: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    trunk: new THREE.MeshLambertMaterial({ color: C.trunk }),
    log: new THREE.MeshLambertMaterial({ color: C.log }),
    dark: new THREE.MeshLambertMaterial({ color: C.dark }),
    glass: new THREE.MeshLambertMaterial({ color: 0xbfe3ff, emissive: 0x223344 }),
    carrot: new THREE.MeshLambertMaterial({ color: 0xf08a24 }),
    shade: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    light: new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  };
  const carMats = CAR_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c }));

  const shadowed = <T extends THREE.Object3D>(o: T, cast = true, receive = false) => {
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = cast;
        m.receiveShadow = receive;
      }
    });
    return o;
  };

  function tree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(geo.trunk, mat.trunk);
    trunk.position.y = 0.3;
    const c1 = new THREE.Mesh(geo.cone1, mat.pine);
    c1.position.y = 0.7;
    const c2 = new THREE.Mesh(geo.cone2, mat.pineDark);
    c2.position.y = 1.05;
    const c3 = new THREE.Mesh(geo.cone3, mat.snow);
    c3.position.y = 1.35;
    g.add(trunk, c1, c2, c3);
    g.scale.setScalar(rand(0.85, 1.15));
    g.rotation.y = rand(0, Math.PI);
    return shadowed(g);
  }

  function snowman() {
    const g = new THREE.Group();
    const b1 = new THREE.Mesh(geo.ball, mat.snow);
    b1.scale.setScalar(0.32);
    b1.position.y = 0.42;
    const b2 = new THREE.Mesh(geo.ball, mat.snow);
    b2.scale.setScalar(0.22);
    b2.position.y = 0.86;
    const nose = new THREE.Mesh(geo.box, mat.carrot);
    nose.scale.set(0.05, 0.05, 0.2);
    nose.position.set(0, 0.88, 0.25);
    const hat = new THREE.Mesh(geo.box, mat.dark);
    hat.scale.set(0.24, 0.2, 0.24);
    hat.position.y = 1.12;
    const scarf = new THREE.Mesh(geo.box, carMats[0]);
    scarf.scale.set(0.42, 0.07, 0.42);
    scarf.position.y = 0.68;
    g.add(b1, b2, nose, hat, scarf);
    return shadowed(g);
  }

  function car(len: number, dir: number) {
    const g = new THREE.Group();
    const m = pick(carMats);
    const body = new THREE.Mesh(geo.box, m);
    body.scale.set(len, 0.42, 0.72);
    body.position.y = 0.38;
    const cabin = new THREE.Mesh(geo.box, mat.glass);
    const truck = len > 1.6;
    cabin.scale.set(truck ? 0.6 : len * 0.55, 0.32, 0.62);
    cabin.position.set(truck ? (dir > 0 ? len / 2 - 0.35 : -len / 2 + 0.35) : 0, 0.74, 0);
    const roof = new THREE.Mesh(geo.box, truck ? mat.snow : m);
    roof.scale.set(truck ? len - 0.75 : len * 0.5, truck ? 0.5 : 0.06, truck ? 0.7 : 0.6);
    roof.position.set(truck ? (dir > 0 ? -0.35 : 0.35) : 0, truck ? 0.84 : 0.92, 0);
    g.add(body, cabin, roof);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(geo.wheel, mat.dark);
        w.rotation.x = Math.PI / 2;
        w.position.set(sx * (len / 2 - 0.25), 0.18, sz * 0.36);
        g.add(w);
      }
    const lamp = new THREE.Mesh(geo.box, mat.light);
    lamp.scale.set(0.06, 0.1, 0.5);
    lamp.position.set((dir * len) / 2, 0.42, 0);
    g.add(lamp);
    return shadowed(g);
  }

  function log(len: number) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(geo.log, mat.log);
    l.rotation.z = Math.PI / 2;
    l.scale.set(1, len, 1);
    const top = new THREE.Mesh(geo.box, mat.snow);
    top.scale.set(len * 0.85, 0.08, 0.32);
    top.position.y = 0.26;
    g.add(l, top);
    g.position.y = -0.05;
    return shadowed(g, true, true);
  }

  // ───────── world ─────────
  const rows = new Map<number, Row>();
  let lastType: RowType = "snow";
  let streak = 0;
  let generated = -1;

  function nextType(i: number): RowType {
    if (i < 4) return "snow";
    const difficulty = Math.min(1, i / 120);
    if (lastType === "snow" && streak >= 1) {
      const r = Math.random();
      if (r < 0.5 + difficulty * 0.1) return "road";
      if (r < 0.82) return "river";
      return "snow";
    }
    if (lastType === "road" && streak < 1 + Math.floor(rand(0, 2 + difficulty * 2))) return "road";
    if (lastType === "river" && streak < 1 + Math.floor(rand(0, 2))) return "river";
    return "snow";
  }

  function makeRow(i: number) {
    const type = nextType(i);
    streak = type === lastType ? streak + 1 : 1;
    const prevType = lastType;
    lastType = type;
    const group = new THREE.Group();
    group.position.z = -i;
    const row: Row = { index: i, type, group, movers: [], speed: 0, blocked: new Set() };
    const difficulty = Math.min(1, i / 120);

    if (type === "snow") {
      const tile = new THREE.Mesh(geo.tile, i % 2 ? mat.snowA : mat.snowB);
      tile.position.y = -0.15;
      tile.receiveShadow = true;
      group.add(tile);
      const count = i < 4 ? 0 : Math.floor(rand(0, 3.5));
      for (let k = 0; k < count; k++) {
        const x = Math.round(rand(-HALF, HALF));
        if (row.blocked.has(x)) continue;
        row.blocked.add(x);
        const o = Math.random() < 0.85 ? tree() : snowman();
        o.position.x = x;
        group.add(o);
      }
      // scenery outside the playable area
      for (const side of [-1, 1])
        for (let x = HALF + 1; x <= HALF + 6; x++) {
          if (Math.random() < 0.5) continue;
          const t = tree();
          t.position.x = side * x;
          group.add(t);
        }
      if (i === 0) for (let x = -HALF; x <= HALF; x++) if (Math.abs(x) > 1 && Math.random() < 0.4) row.blocked.add(x);
    } else if (type === "road") {
      const tile = new THREE.Mesh(geo.tile, mat.road);
      tile.position.y = -0.17;
      tile.receiveShadow = true;
      group.add(tile);
      if (prevType === "road") {
        for (let x = -15; x <= 15; x += 1.2) {
          const ln = new THREE.Mesh(geo.line, mat.line);
          ln.position.set(x, 0.0, 0.5);
          group.add(ln);
        }
      }
      const dir = Math.random() < 0.5 ? -1 : 1;
      row.speed = dir * rand(1.6, 2.6 + difficulty * 2.8);
      const len = Math.random() < 0.25 ? 2.2 : 1.2;
      const n = len > 2 ? 2 : Math.floor(rand(2, 4));
      const spacing = 18 / n;
      const offset = rand(0, spacing);
      for (let k = 0; k < n; k++) {
        const m = car(len, dir);
        const x = -9 + offset + k * spacing + rand(-0.6, 0.6);
        m.position.x = x;
        group.add(m);
        row.movers.push({ mesh: m, x, len });
      }
    } else {
      const water = new THREE.Mesh(geo.water, mat.water);
      water.position.y = -0.3;
      water.receiveShadow = true;
      group.add(water);
      const dir = prevType === "river" && rows.get(i - 1) ? -Math.sign(rows.get(i - 1)!.speed) : Math.random() < 0.5 ? -1 : 1;
      row.speed = dir * rand(1.0, 1.8 + difficulty * 1.4);
      const len = Math.round(rand(2, 3.6 - difficulty));
      const n = Math.floor(rand(3, 5));
      const spacing = 18 / n;
      const offset = rand(0, spacing);
      for (let k = 0; k < n; k++) {
        const m = log(len);
        const x = -9 + offset + k * spacing;
        m.position.x = x;
        group.add(m);
        row.movers.push({ mesh: m, x, len });
      }
    }
    // darken the non-playable sides
    for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(geo.shade, mat.shade);
      sh.position.set(side * (HALF + 0.5 + 6), 0.02, 0);
      group.add(sh);
    }
    scene.add(group);
    rows.set(i, row);
  }

  function ensureRows(upTo: number, from: number) {
    while (generated < upTo) makeRow(++generated);
    for (const [i, r] of rows) {
      if (i < from) {
        scene.remove(r.group);
        rows.delete(i);
      }
    }
  }
  ensureRows(22, -6);
  for (let i = -6; i < 0; i++) {
    // snowy start area behind the player
    const g = new THREE.Group();
    g.position.z = -i;
    const tile = new THREE.Mesh(geo.tile, i % 2 ? mat.snowA : mat.snowB);
    tile.position.y = -0.15;
    tile.receiveShadow = true;
    g.add(tile);
    for (let x = -HALF - 6; x <= HALF + 6; x++) {
      if (Math.random() < 0.55) continue;
      const t = tree();
      t.position.x = x;
      g.add(t);
    }
    scene.add(g);
    rows.set(i, { index: i, type: "snow", group: g, movers: [], speed: 0, blocked: new Set(Array.from({ length: 9 }, (_, k) => k - HALF)) });
  }

  // snowfall
  const flakes = 500;
  const snowGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(flakes * 3);
  for (let i = 0; i < flakes; i++) {
    pos[i * 3] = rand(-12, 12);
    pos[i * 3 + 1] = rand(0, 12);
    pos[i * 3 + 2] = rand(-20, 8);
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const flakeCanvas = document.createElement("canvas");
  flakeCanvas.width = flakeCanvas.height = 32;
  const fc = flakeCanvas.getContext("2d")!;
  const fg = fc.createRadialGradient(16, 16, 0, 16, 16, 16);
  fg.addColorStop(0, "rgba(255,255,255,1)");
  fg.addColorStop(0.5, "rgba(255,255,255,.8)");
  fg.addColorStop(1, "rgba(255,255,255,0)");
  fc.fillStyle = fg;
  fc.fillRect(0, 0, 32, 32);
  const flakeTex = new THREE.CanvasTexture(flakeCanvas);
  const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: flakeTex, color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(snowPts);

  // ───────── player ─────────
  const player = new THREE.Group();
  const body = new THREE.Group(); // squash/rotation container
  player.add(body);
  scene.add(player);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  player.add(blob);

  // 2D fallback until (or if) the 3D head loads
  const tex = new THREE.Texture(api.me.head);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(0.95, 0.95, 1);
  sprite.position.y = 0.5;
  body.add(sprite);

  let ready = false;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    headModel(api.me.id),
    (gltf) => {
      const head = gltf.scene;
      const box = new THREE.Box3().setFromObject(head);
      const size = box.getSize(new THREE.Vector3());
      const s = 1.1 / Math.max(size.x, size.y, size.z);
      head.scale.setScalar(s);
      const center = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
      head.position.set(-center.x, -center.y + 0.56, -center.z);
      head.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) {
          m.castShadow = true;
          const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mm) {
            mm.roughness = 0.7;
            mm.metalness = 0;
          }
        }
      });
      body.remove(sprite);
      body.add(head);
      ready = true;
    },
    undefined,
    () => {
      ready = true; // keep the sprite
    },
  );
  // Don't wait forever on a slow network.
  d.timeout(() => (ready = true), 4000);

  const state = {
    col: 0 as number, // logical x (can be fractional on logs)
    row: 0,
    hopping: false,
    hopT: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    yaw: 0,
    targetYaw: 0,
    dead: false,
    deadT: 0,
    deathKind: "" as "" | "car" | "water" | "behind" | "edge",
    best: 0,
    started: false,
    camZ: 0,
    pushZ: 1,
    queued: null as null | [number, number],
  };
  player.position.set(0, 0, 0);

  function rowAt(i: number) {
    return rows.get(i);
  }

  function tryMove(dx: number, dz: number) {
    if (state.dead || !ready) return;
    if (state.hopping) {
      state.queued = [dx, dz];
      return;
    }
    const targetRow = state.row + dz;
    let targetCol = Math.round(state.col) + dx;
    if (dz !== 0) targetCol = Math.round(state.col);
    if (targetCol < -HALF || targetCol > HALF) return;
    if (targetRow < -3) return;
    const r = rowAt(targetRow);
    if (r && r.type === "snow" && r.blocked.has(targetCol)) {
      // bump
      api.haptic("light");
      body.position.x = dx * 0.08;
      body.position.z = -dz * 0.08;
      return;
    }
    state.started = true;
    state.hopping = true;
    state.hopT = 0;
    state.from.copy(player.position);
    state.to.set(targetCol, 0, -targetRow);
    state.row = targetRow;
    state.col = targetCol;
    state.targetYaw = dx * 0.7 + (dz < 0 ? Math.PI : 0) * 0;
    api.sfx("hop");
    api.haptic("select");
  }

  function land() {
    const r = rowAt(state.row);
    if (state.row > state.best) {
      state.best = state.row;
      api.setScore(state.best);
    }
    if (!r) return;
    if (r.type === "river") {
      const m = r.movers.find((mv) => Math.abs(mv.x - player.position.x) < mv.len / 2 + 0.15);
      if (!m) die("water");
      else state.col = player.position.x;
    } else {
      state.col = Math.round(player.position.x);
    }
  }

  function die(kind: typeof state.deathKind) {
    if (state.dead) return;
    state.dead = true;
    state.deadT = 0;
    state.deathKind = kind;
    api.sfx(kind === "water" ? "splash" : "hit");
    api.haptic("heavy");
  }

  // ───────── input ─────────
  let start: { x: number; y: number; t: number } | null = null;
  d.on(canvas, "pointerdown", (e) => {
    e.preventDefault();
    start = { ...pointerPos(e, canvas), t: performance.now() };
  });
  d.on(canvas, "pointerup", (e) => {
    if (!start) return;
    const p = pointerPos(e, canvas);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    start = null;
    if (Math.hypot(dx, dy) < 24) return tryMove(0, 1);
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
    else tryMove(0, dy < 0 ? 1 : -1);
  });
  d.on(window, "keydown", (e) => {
    const map: Record<string, [number, number]> = { ArrowUp: [0, 1], KeyW: [0, 1], Space: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
    const m = map[e.code];
    if (m && !e.repeat) {
      e.preventDefault();
      tryMove(m[0], m[1]);
    }
  });

  // ───────── resize ─────────
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the playable width visible on narrow phones
    camera.fov = w / h < 0.6 ? 42 : 36;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  d.add(() => ro.disconnect());

  // ───────── loop ─────────
  let last = performance.now();
  let t = 0;
  let raf = 0;
  let ended = false;
  const camTarget = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    t += dt;

    // movers
    for (const r of rows.values()) {
      if (!r.movers.length) continue;
      for (const m of r.movers) {
        m.x += r.speed * dt;
        if (r.speed > 0 && m.x - m.len / 2 > 10) m.x -= 20;
        if (r.speed < 0 && m.x + m.len / 2 < -10) m.x += 20;
        m.mesh.position.x = m.x;
        if (r.type === "river") m.mesh.position.y = -0.05 + Math.sin(t * 2 + m.x) * 0.02;
      }
    }

    if (!state.dead) {
      if (state.hopping) {
        state.hopT += dt / HOP_TIME;
        const k = Math.min(1, state.hopT);
        player.position.lerpVectors(state.from, state.to, k);
        // ride the log we're hopping from/to
        player.position.y = Math.sin(k * Math.PI) * 0.45;
        body.scale.set(1 - Math.sin(k * Math.PI) * 0.08, 1 + Math.sin(k * Math.PI) * 0.15, 1);
        if (k >= 1) {
          state.hopping = false;
          player.position.y = 0;
          body.scale.set(1.15, 0.82, 1.15);
          land();
          if (state.queued && !state.dead) {
            const [qx, qz] = state.queued;
            state.queued = null;
            tryMove(qx, qz);
          }
        }
      } else {
        body.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12));
        body.position.multiplyScalar(1 - Math.min(1, dt * 15));
        // idle breathing
        body.scale.y += Math.sin(t * 4) * 0.004;
        const r = rowAt(state.row);
        if (r?.type === "river") {
          player.position.x += r.speed * dt;
          state.col = player.position.x;
          if (Math.abs(player.position.x) > HALF + 0.6) die("edge");
        }
      }

      // car collisions
      const r = rowAt(state.row);
      if (r?.type === "road" && (!state.hopping || state.hopT > 0.5)) {
        for (const m of r.movers) if (Math.abs(m.x - player.position.x) < m.len / 2 + 0.28) die("car");
      }

      // camera auto-advance once the game started
      if (state.started) state.pushZ += dt * (0.32 + Math.min(state.best, 100) * 0.006);
      if (state.row < state.pushZ - 3.2) die("behind");
    } else {
      state.deadT += dt;
      if (state.deathKind === "car") body.scale.lerp(new THREE.Vector3(1.5, 0.12, 1.5), Math.min(1, dt * 20));
      else if (state.deathKind === "water" || state.deathKind === "edge") {
        player.position.y -= dt * 1.6;
        body.rotation.z += dt * 3;
      } else body.rotation.y += dt * 12;
      if (state.deadT > 1.0 && !ended) {
        ended = true;
        api.end(state.best);
      }
    }

    state.yaw += (state.targetYaw - state.yaw) * Math.min(1, dt * 12);
    body.rotation.y = state.deathKind === "behind" ? body.rotation.y : state.yaw;

    // camera follows (only forward), slightly ahead of the player
    const followZ = Math.max(state.row, state.pushZ);
    state.camZ += (followZ - state.camZ) * Math.min(1, dt * 4);
    camTarget.set(player.position.x * 0.3, 0, -state.camZ - 2.6);
    camera.position.copy(camTarget).add(CAM_OFFSET);
    camera.lookAt(camTarget);
    sun.position.set(camTarget.x + 4, 10, camTarget.z + 5);
    sun.target.position.copy(camTarget);

    // rows in front / behind
    ensureRows(Math.ceil(state.camZ) + 22, Math.floor(state.camZ) - 8);

    // snow
    const a = snowGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < flakes; i++) {
      let y = a.getY(i) - dt * 1.2;
      if (y < 0) y += 12;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t + i) * dt * 0.2);
    }
    a.needsUpdate = true;
    snowPts.position.set(camTarget.x, 0, camTarget.z);

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  d.add(() => cancelAnimationFrame(raf));
  api.setScore(0);

  d.add(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !Object.values(geo).includes(m.geometry as never)) m.geometry.dispose();
    });
    Object.values(geo).forEach((g) => g.dispose());
    Object.values(mat).forEach((m) => m.dispose());
    carMats.forEach((m) => m.dispose());
    tex.dispose();
    flakeTex.dispose();
    snowGeo.dispose();
    renderer.dispose();
  });

  return { destroy: () => d.dispose() };
}

const mod: GameModule = { create, hudScore: "points" };
export default mod;
