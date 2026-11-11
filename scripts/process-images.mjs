// Generates web-ready images: heads (webp), PWA icons, and photos for the memory/puzzle games.
// Usage: `npm run assets:images`
//  - Heads come from assets-src/heads/{filipino,duda}.png
//  - Photos: drop .jpg/.jpeg/.png/.webp files into assets-src/photos/ (at least 8 for the memory game).
//    If the folder is empty, festive placeholder photos are generated instead.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const out = (...p) => path.join(ROOT, "public", ...p);
await fs.mkdir(out("heads"), { recursive: true });
await fs.mkdir(out("icons"), { recursive: true });
await fs.mkdir(out("photos"), { recursive: true });

// ---------- heads ----------
const heads = {};
for (const p of ["filipino", "duda"]) {
  const trimmed = await sharp(path.join(ROOT, "assets-src/heads", `${p}.png`)).trim({ threshold: 5 }).toBuffer();
  // pad to square so every game can treat a head as a circle-ish square sprite
  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width, meta.height);
  const square = await sharp(trimmed)
    .extend({
      top: Math.floor((side - meta.height) / 2), bottom: Math.ceil((side - meta.height) / 2),
      left: Math.floor((side - meta.width) / 2), right: Math.ceil((side - meta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  heads[p] = square;
  for (const size of [512, 256, 128]) {
    await sharp(square).resize(size, size).webp({ quality: 88, alphaQuality: 95 }).toFile(out("heads", `${p}-${size}.webp`));
  }
  console.log(`✓ heads/${p}-{512,256,128}.webp`);
}

// ---------- icons ----------
const bg = (size, radius) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="75%">
      <stop offset="0" stop-color="#21543f"/><stop offset="1" stop-color="#0d2a20"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#g)"/>
  <g fill="#fff" opacity=".85">
    <circle cx="70" cy="80" r="6"/><circle cx="430" cy="60" r="5"/><circle cx="450" cy="170" r="4"/>
    <circle cx="60" cy="200" r="4"/><circle cx="120" cy="40" r="3"/><circle cx="380" cy="110" r="3"/>
  </g>
  <path d="M256 34 l14 30 33 4 -24 22 6 33 -29 -16 -29 16 6 -33 -24 -22 33 -4z" fill="#f4b942"/>
</svg>`);

async function icon(size, { maskable = false, radius = 112 } = {}) {
  const scale = maskable ? 0.72 : 0.84;
  const headSize = Math.round(size * 0.46 * scale / 0.84);
  const a = await sharp(heads.filipino).resize(headSize, headSize).png().toBuffer();
  const b = await sharp(heads.duda).resize(headSize, headSize).png().toBuffer();
  const cy = Math.round(size * (maskable ? 0.36 : 0.33));
  const gap = Math.round(headSize * 0.78);
  return sharp(bg(size, maskable ? 0 : radius))
    .composite([
      { input: a, top: cy, left: Math.round(size / 2 - gap / 2 - headSize / 2) },
      { input: b, top: cy, left: Math.round(size / 2 + gap / 2 - headSize / 2) },
    ])
    .png();
}
await (await icon(512)).toFile(out("icons", "icon-512.png"));
await (await icon(192)).toFile(out("icons", "icon-192.png"));
await (await icon(512, { maskable: true })).toFile(out("icons", "maskable-512.png"));
await (await icon(180, { radius: 0 })).toFile(out("icons", "apple-touch-icon.png"));
await (await icon(64)).toFile(out("icons", "favicon-64.png"));
console.log("✓ icons");

// ---------- photos ----------
const srcDir = path.join(ROOT, "assets-src/photos");
const files = (await fs.readdir(srcDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
for (const f of await fs.readdir(out("photos"))) await fs.rm(out("photos", f));
const photos = [];
if (files.length) {
  for (const [i, f] of files.entries()) {
    const name = `photo-${String(i + 1).padStart(2, "0")}.webp`;
    const info = await sharp(path.join(srcDir, f)).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(out("photos", name));
    photos.push({ src: `/photos/${name}`, w: info.width, h: info.height });
  }
  console.log(`✓ ${files.length} photos`);
} else {
  const palettes = [["#c8323c", "#7d1d26"], ["#21543f", "#0d2a20"], ["#f4b942", "#c77d14"], ["#3b6ea8", "#1b365a"], ["#8e4ec6", "#4b2470"], ["#e76f51", "#9c3b22"], ["#2a9d8f", "#145049"], ["#d4568c", "#7a2049"]];
  for (let i = 0; i < 8; i++) {
    const [c1, c2] = palettes[i];
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
      <rect width="900" height="1200" fill="url(#g)"/>
      ${Array.from({ length: 40 }, (_, k) => `<circle cx="${(k * 197) % 900}" cy="${(k * 331) % 1200}" r="${3 + (k % 5) * 2}" fill="#fff" opacity="${0.15 + (k % 4) * 0.1}"/>`).join("")}
      <text x="450" y="1080" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="64" font-weight="700" fill="#fff" text-anchor="middle" opacity=".9">Foto ${i + 1}</text>
    </svg>`);
    const head = await sharp(i % 2 ? heads.duda : heads.filipino).resize(560, 560).png().toBuffer();
    const other = await sharp(i % 2 ? heads.filipino : heads.duda).resize(300, 300).png().toBuffer();
    const name = `photo-${String(i + 1).padStart(2, "0")}.webp`;
    await sharp(svg).composite([{ input: head, top: 260 + (i % 3) * 30, left: 120 + (i % 4) * 20 }, { input: other, top: 160, left: 560 - (i % 3) * 20 }]).webp({ quality: 80 }).toFile(out("photos", name));
    photos.push({ src: `/photos/${name}`, w: 900, h: 1200 });
  }
  console.log("✓ 8 placeholder photos (add real ones to assets-src/photos/ and rerun)");
}
await fs.writeFile(
  path.join(ROOT, "src/data/photos.generated.ts"),
  `// Generated by scripts/process-images.mjs — do not edit by hand.\nexport const PHOTOS: { src: string; w: number; h: number }[] = ${JSON.stringify(photos, null, 2)};\n`,
);
