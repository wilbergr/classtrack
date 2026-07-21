#!/usr/bin/env node
// Regenerates every branding asset in assets/ from the app's own companion
// rig: Wisp (stage 4, bright) in its signature Ember palette. Deterministic
// and offline — the rig model is pure TS, so we transpile it standalone,
// serialize the shape layers to SVG (the shape union maps 1:1 onto SVG
// elements) and rasterize with resvg. Re-run after changing the rig model
// or the Ember palette:  npm run branding
//
// Outputs: icon.png (dark ember, full-bleed), android-icon-{foreground,
// background,monochrome}.png (adaptive layers; art inside the ~66% safe
// zone), notification-icon.png (white silhouette, tinted by the
// expo-notifications `color`), splash-icon.png (transparent, composited on
// the splash backgroundColor), favicon.png.

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const { Resvg } = require('@resvg/resvg-js');
const { PNG } = require('pngjs');

const REPO = path.join(__dirname, '..');
const ASSETS = path.join(REPO, 'assets');

// ---------- transpile the pure model modules to CJS ----------
// All their cross-module imports are `import type`, so the only runtime
// edge that survives is model -> ./color.

const rigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classtrack-rig-'));
for (const [out, src] of Object.entries({
  'color.js': 'src/components/companion/color.ts',
  'model.js': 'src/components/companion/model.ts',
  'palettes.js': 'src/theme/palettes.ts',
})) {
  const code = fs.readFileSync(path.join(REPO, src), 'utf8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  fs.writeFileSync(path.join(rigDir, out), js);
}
const { buildRig } = require(path.join(rigDir, 'model.js'));
const { PALETTES } = require(path.join(rigDir, 'palettes.js'));

// ---------- RigModel -> SVG ----------

let gradCounter = 0;
const esc = (n) => (typeof n === 'number' ? +n.toFixed(3) : n);

function fillAttr(fill, defs) {
  if (fill == null) return 'none';
  if (typeof fill === 'string') return fill;
  const id = `g${gradCounter++}`;
  const stops = fill.stops
    .map(
      (s) =>
        `<stop offset="${esc(s.offset)}" stop-color="${s.color}"` +
        (s.opacity != null ? ` stop-opacity="${esc(s.opacity)}"` : '') +
        '/>',
    )
    .join('');
  defs.push(
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${esc(fill.cx)}" cy="${esc(fill.cy)}" r="${esc(fill.r)}">${stops}</radialGradient>`,
  );
  return `url(#${id})`;
}

function shapeToSvg(s, defs, override) {
  const fill = override ? (s.fill != null && s.fill !== 'none' ? override : 'none') : fillAttr(s.fill, defs);
  const stroke = override ? (s.stroke ? override : null) : s.stroke;
  let attrs = ` fill="${fill}"`;
  if (stroke) attrs += ` stroke="${stroke}"`;
  if (s.strokeWidth != null) attrs += ` stroke-width="${esc(s.strokeWidth)}"`;
  if (s.strokeLinecap) attrs += ` stroke-linecap="${s.strokeLinecap}"`;
  if (s.opacity != null && !override) attrs += ` opacity="${esc(s.opacity)}"`;
  switch (s.kind) {
    case 'path':
      return `<path d="${s.d}"${attrs}/>`;
    case 'circle':
      return `<circle cx="${esc(s.cx)}" cy="${esc(s.cy)}" r="${esc(s.r)}"${attrs}/>`;
    case 'ellipse':
      return `<ellipse cx="${esc(s.cx)}" cy="${esc(s.cy)}" rx="${esc(s.rx)}" ry="${esc(s.ry)}"${attrs}/>`;
    case 'rect':
      return `<rect x="${esc(s.x)}" y="${esc(s.y)}" width="${esc(s.width)}" height="${esc(s.height)}"${
        s.rx != null ? ` rx="${esc(s.rx)}"` : ''
      }${attrs}/>`;
    case 'line':
      return `<line x1="${esc(s.x1)}" y1="${esc(s.y1)}" x2="${esc(s.x2)}" y2="${esc(s.y2)}"${attrs}/>`;
  }
}

/**
 * Serialize a rig into { defs, body, baseScale } SVG fragments.
 * opts.skipLayers: layer ids to omit ('pupils' skips the eye group);
 * opts.override: force every fill/stroke to one color (silhouette mode).
 */
function rigToSvg(model, opts = {}) {
  const { skipLayers = new Set(), override = null } = opts;
  const defs = [];
  const body = [];
  for (const layer of model.layers) {
    if (skipLayers.has(layer.id)) continue;
    for (const s of layer.shapes) body.push(shapeToSvg(s, defs, override));
    // Pupils render on top of the face layer's sclera, at rest position.
    if (layer.id === 'face' && model.pupils && !skipLayers.has('pupils')) {
      for (const s of model.pupils.shapes) body.push(shapeToSvg(s, defs, override));
    }
  }
  return { defs: defs.join('\n'), body: body.join('\n'), baseScale: model.baseScale };
}

/** Wrap rig markup in a square <svg>, centered, at rigScale of the canvas. */
function svgDoc({ size, background, rig, rigScale }) {
  const s = (size / 100) * rigScale * rig.baseScale;
  const tx = size / 2 - 50 * s;
  const ty = size / 2 - 52 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>${rig.defs}</defs>
${background || ''}
<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
${rig.body}
</g>
</svg>`;
}

// ---------- compose the asset set ----------

const colors = PALETTES.ember.light;
const dark = PALETTES.ember.dark;

const wisp = (opts) =>
  rigToSvg(
    buildRig({ species: 'wisp', stage: 4, mood: 'bright', eyesClosed: false, colors, accessories: [] }),
    opts,
  );

/** Warm ember radial: highlight glow fading into bg — all palette tokens. */
function warmBg(size, inner, outer) {
  return (
    `<defs><radialGradient id="bgGrad" gradientUnits="userSpaceOnUse" cx="${size / 2}" cy="${size * 0.46}" r="${size * 0.72}">` +
    `<stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}"/></radialGradient></defs>` +
    `<rect width="${size}" height="${size}" fill="url(#bgGrad)"/>`
  );
}
const darkBg = warmBg(1024, dark.highlight, dark.bg);

function write(svg, width, file) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  fs.writeFileSync(path.join(ASSETS, file), r.render().asPng());
  console.log('wrote', file);
}

// App icon + favicon: campfire-at-night — full rig with aura on dark ember.
write(svgDoc({ size: 1024, background: darkBg, rig: wisp(), rigScale: 0.84 }), 1024, 'icon.png');
write(svgDoc({ size: 1024, background: darkBg, rig: wisp(), rigScale: 0.84 }), 48, 'favicon.png');

// Adaptive icon: transparent foreground inside the ~66% safe zone (no ground
// shadow — the launcher adds its own elevation), dark radial background.
const fg = wisp({ skipLayers: new Set(['shadow']) });
write(svgDoc({ size: 1024, background: '', rig: fg, rigScale: 0.6 }), 1024, 'android-icon-foreground.png');
write(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${darkBg}</svg>`,
  1024,
  'android-icon-background.png',
);

// Monochrome layer + status-bar notification icon: flat white body silhouette.
const sil = wisp({
  skipLayers: new Set(['shadow', 'aura', 'shimmer', 'markings', 'face', 'pupils']),
  override: '#FFFFFF',
});
write(svgDoc({ size: 1024, background: '', rig: sil, rigScale: 0.6 }), 1024, 'android-icon-monochrome.png');
write(svgDoc({ size: 1024, background: '', rig: sil, rigScale: 0.92 }), 96, 'notification-icon.png');

// Splash: transparent full rig, shown at the plugin's imageWidth over the
// light ember bg (userInterfaceStyle is light).
write(svgDoc({ size: 1024, background: '', rig: wisp(), rigScale: 0.92 }), 1024, 'splash-icon.png');

// ---------- Google Play store-listing assets (app-store-assets/) ----------
// These live OUTSIDE assets/ (they are not bundled into the app): the Play
// Console listing images. The owner drops screenshots into this same folder
// by hand alongside these generated ones.

const STORE = path.join(REPO, 'app-store-assets');
fs.mkdirSync(STORE, { recursive: true });

// Hi-res app icon (Play's 512×512): the same campfire-at-night icon as
// assets/icon.png, just rasterized at the store's required size.
{
  const svg = svgDoc({ size: 1024, background: darkBg, rig: wisp(), rigScale: 0.84 });
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
  fs.writeFileSync(path.join(STORE, 'icon-512.png'), r.render().asPng());
  console.log('wrote app-store-assets/icon-512.png');
}

// Feature graphic (1024×500 landscape): same Wisp rig + Ember wordmark on the
// light ember bg, laid out landscape so it reads at Play's small thumbnail
// size. Play Console REJECTS any alpha channel on this asset, so it is
// flattened to a 24-bit RGB PNG (color type 2) via pngjs — every pixel is
// already opaque over the bg.

/** Compose the 1024×500 banner SVG: warm bg + halo + wordmark + Wisp. */
function featureGraphicSvg() {
  const W = 1024;
  const H = 500;
  const rig = wisp(); // full rig incl. shadow
  const s = 4.1; // rig display scale (model is 0–100 units)
  const cx = 796; // rig horizontal center (right third)
  const cyCenter = 252; // rig vertical center → model point (50,50)
  const tx = cx - 50 * s;
  const ty = cyCenter - 50 * s;

  // Soft warm sun-glow behind the companion (fades into the bg; flattened out).
  const haloR = 250;
  const halo =
    `<radialGradient id="haloGrad" gradientUnits="userSpaceOnUse" cx="${cx}" cy="236" r="${haloR}">` +
    `<stop offset="0" stop-color="${colors.highlight}" stop-opacity="1"/>` +
    `<stop offset="0.55" stop-color="#FFE6C4" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="${colors.bg}" stop-opacity="0"/></radialGradient>`;

  const tf = 'font-family="DejaVu Sans, sans-serif"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${halo}
${rig.defs}</defs>
<rect width="${W}" height="${H}" fill="${colors.bg}"/>
<circle cx="${cx}" cy="236" r="${haloR}" fill="url(#haloGrad)"/>
<text x="64" y="238" ${tf} font-weight="bold" font-size="104" fill="${colors.primary}" letter-spacing="-1">ClassTrack</text>
<text x="68" y="300" ${tf} font-weight="bold" font-size="35" fill="${colors.text}">Stay on top of homework</text>
<text x="68" y="344" ${tf} font-size="27" fill="${colors.textMuted}">Subject-organized. All on your device.</text>
<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
${rig.body}
</g>
</svg>`;
}

/**
 * Rasterize an SVG to an alpha-free 24-bit RGB PNG (Play-Console-safe). resvg
 * always renders RGBA; pngjs re-encodes as color type 2, dropping the (fully
 * opaque) alpha channel.
 */
function writeOpaquePng(svg, width, file) {
  const img = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  }).render();
  const png = new PNG({ width: img.width, height: img.height });
  Buffer.from(img.pixels).copy(png.data); // RGBA in
  const out = PNG.sync.write(png, { colorType: 2, inputColorType: 6, inputHasAlpha: true });
  fs.writeFileSync(path.join(STORE, file), out);
  console.log('wrote', `app-store-assets/${file}`, `(${img.width}×${img.height}, no alpha)`);
}

writeOpaquePng(featureGraphicSvg(), 1024, 'feature-graphic.png');
