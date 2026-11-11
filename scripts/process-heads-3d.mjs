// Converts the raw 3D heads (OBJ, ~1M triangles, 2K textures) into small GLBs for the web.
// Usage: unzip each head zip into assets-src/heads3d/<player>/ and run `npm run assets:3d`.
import fs from "node:fs/promises";
import path from "node:path";
import obj2gltf from "obj2gltf";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { weld, simplify, dedup, prune, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";
import { getBounds } from "@gltf-transform/core";

const ROOT = path.resolve(import.meta.dirname, "..");
const PLAYERS = ["filipino", "duda"];
const TARGET_TRIANGLES = 14000;

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

for (const player of PLAYERS) {
  const dir = path.join(ROOT, "assets-src/heads3d", player);
  console.log(`→ ${player}: converting OBJ…`);
  const glb = await obj2gltf(path.join(dir, "base.obj"), { binary: true });

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  const doc = await io.readBinary(new Uint8Array(glb));

  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const tris = prims.reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0);

  // Texture first (diffuse only, 1024px webp) so prune() keeps the UVs.
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const webp = await sharp(path.join(dir, "texture_diffuse.png")).resize(1024, 1024).webp({ quality: 85 }).toBuffer();
  const tex = doc.createTexture("diffuse").setImage(new Uint8Array(webp)).setMimeType("image/webp");
  const mat = doc.createMaterial("head").setBaseColorTexture(tex).setRoughnessFactor(0.7).setMetallicFactor(0);
  for (const p of prims) p.setMaterial(mat);

  console.log(`  ${Math.round(tris)} triangles → simplifying to ~${TARGET_TRIANGLES}`);
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: TARGET_TRIANGLES / tris, error: 0.002, lockBorder: true }),
    dedup(),
    prune({ keepAttributes: true }),
  );

  // Normalize: centre at origin, largest dimension = 1 unit (baked into the vertices).
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  const c = [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2);
  const size = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
  const done = new Set();
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const pos = prim.getAttribute("POSITION");
    if (done.has(pos)) continue;
    done.add(pos);
    for (let i = 0; i < pos.getCount(); i++) {
      const v = pos.getElement(i, []);
      pos.setElement(i, [(v[0] - c[0]) / size, (v[1] - c[1]) / size, (v[2] - c[2]) / size]);
    }
  }
  for (const node of doc.getRoot().listNodes()) node.setTranslation([0, 0, 0]).setScale([1, 1, 1]);

  await doc.transform(prune({ keepAttributes: true }), quantize(), meshopt({ encoder: MeshoptEncoder, level: "high" }));

  const out = path.join(ROOT, "public/heads", `${player}.glb`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await io.write(out, doc);
  const stat = await fs.stat(out);
  console.log(`  ✓ ${path.relative(ROOT, out)} (${(stat.size / 1024).toFixed(0)} KB)`);
}
