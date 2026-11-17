import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { decodePng } from '../../../packages/colors/test/fx-render/fx-render.mjs';
import { materialContour } from '../../../packages/materials/src/engine/contour.ts';

const { chromium } = createRequire(new URL('../../../apps/docs/package.json', import.meta.url))(
  '@playwright/test',
);
const source = JSON.parse(await readFile(new URL('figma-dock-holdout.json', import.meta.url)));
const details = JSON.parse(
  await readFile(new URL('figma-dock-details.json', import.meta.url)),
).result;
const css = await readFile(
  new URL('../../../packages/materials/dist/material.css', import.meta.url),
  'utf8',
);
const runtime = await readFile(
  new URL('../../../packages/materials/dist/index.js', import.meta.url),
  'utf8',
);
const colors = await readFile(
  new URL('../../../packages/colors/contract.css', import.meta.url),
  'utf8',
);
const reference = decodePng(await readFile(new URL('figma-dock-holdout.png', import.meta.url)));
const data = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const rgb = (c) => `rgb(${c.r * 255} ${c.g * 255} ${c.b * 255})`;
const smooth = process.env.DOCK_SMOOTH === '1';
const order = process.env.DOCK_FILTER_ORDER ?? 'default';
const paintIsolation = process.env.DOCK_PAINT_ISOLATION ?? 'none';
const lightGain = Number(process.env.DOCK_LIGHT_GAIN ?? 1);
const softLight = process.env.DOCK_SOFT_LIGHT ?? 'svg';
const plateOnly = process.env.DOCK_ONLY_BACKPLATE === '1';
const rimGain = Number(process.env.DOCK_RIM_GAIN ?? 1);
const productionContour = process.env.DOCK_CONTOUR === '1';
const refractionScale = Number(process.env.DOCK_REFRACTION_SCALE ?? 1);
const output = `${smooth ? 'shape' : 'before'}${order === 'default' ? '' : `-${order}`}${paintIsolation === 'none' ? '' : `-${paintIsolation}`}${lightGain === 1 ? '' : `-light-${lightGain}`}${softLight === 'svg' ? '' : `-${softLight}`}${plateOnly ? '-plate' : ''}${rimGain === 1 ? '' : `-rim-${rimGain}`}${productionContour ? '-contour' : ''}${refractionScale === 1 ? '' : `-refraction-${refractionScale}`}`;
const mode = (value) => value.toLowerCase().replaceAll('_', '-');
const svgBox = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
function inverse([[a, c, e], [b, d, f]]) {
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det].join(
    ' ',
  );
}
const outline = (w, h, r, s) => materialContour(w, h, r, s).path;
function gradient(paint, w, h) {
  const stops = paint.gradientStops
    .map(
      (s) =>
        `<stop offset="${s.position}" stop-color="${rgb(s.color)}" stop-opacity="${s.color.a * paint.opacity}"/>`,
    )
    .join('');
  const kind = paint.type === 'GRADIENT_LINEAR' ? 'linearGradient' : 'radialGradient';
  const attrs =
    kind === 'linearGradient' ? 'x1="0" y1=".5" x2="1" y2=".5"' : 'cx=".5" cy=".5" r=".5"';
  return data(
    svgBox(
      w,
      h,
      `<defs><${kind} id="p" ${attrs} gradientTransform="matrix(${inverse(paint.gradientTransform)})">${stops}</${kind}></defs><rect width="100%" height="100%" fill="url(#p)"/>`,
    ),
  );
}
function paints(node, index) {
  const w = node.width;
  const h = node.height;
  let previous = 'SourceGraphic';
  let body = '';
  if (paintIsolation === 'all') {
    body = '<feFlood flood-opacity="0" result="clear"/>';
    previous = 'clear';
  }
  const blend = (input, background, blendMode, id, whiteSource) => {
    if (blendMode !== 'SOFT_LIGHT' || softLight !== 'pegtop')
      return `<feBlend in="${input}" in2="${background}" mode="${mode(blendMode)}" result="${id}"/>`;
    assert(whiteSource, 'The measured soft-light transfer applies only to white source paints');
    const table = Array.from({ length: 256 }, (_, i) => {
      const v = i / 255;
      return 2 * v - v * v;
    }).join(' ');
    return `<feComponentTransfer in="${background}" result="${id}-light">${['R', 'G', 'B'].map((c) => `<feFunc${c} type="table" tableValues="${table}"/>`).join('')}</feComponentTransfer><feComposite in="${id}-light" in2="${input}" operator="in"/><feBlend in2="${background}" mode="normal" result="${id}"/>`;
  };
  // Figma's fill array is bottom to top, as exported SVG paint order confirms.
  for (const [i, fill] of node.fills.entries()) {
    const id = `paint-${i}`;
    const white = fill.gradientStops.every(({ color: c }) => c.r === 1 && c.g === 1 && c.b === 1);
    body += `<feImage href="${gradient(fill, w, h)}" x="0" y="0" width="${w}" height="${h}" result="fill-${i}"/>${blend(`fill-${i}`, previous, fill.blendMode, id, white)}`;
    previous = id;
  }
  if (paintIsolation === 'all') {
    body += `<feBlend in="${previous}" in2="SourceGraphic" mode="normal" result="painted"/>`;
    previous = 'painted';
  }
  const shape = data(
    svgBox(
      w,
      h,
      smooth
        ? `<path d="${outline(w, h, node.cornerRadius, 0.6)}" fill="white"/>`
        : `<rect width="${w}" height="${h}" rx="${Math.min(node.cornerRadius, w / 2, h / 2)}" fill="white"/>`,
    ),
  );
  body += `<feImage href="${shape}" x="0" y="0" width="${w}" height="${h}" result="shape-alpha"/>`;
  for (const [i, effect] of node.effects.entries()) {
    if (effect.type !== 'INNER_SHADOW' || effect.visible === false) continue;
    const c = effect.color;
    const id = `inner-${i}`;
    body += `<feOffset in="shape-alpha" dx="${effect.offset.x}" dy="${effect.offset.y}"/><feGaussianBlur stdDeviation="${effect.radius / 2}"/><feComposite in2="shape-alpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 ${c.r} 0 0 0 0 ${c.g} 0 0 0 0 ${c.b} 0 0 0 ${c.a} 0" result="${id}-mask"/>${blend(`${id}-mask`, previous, effect.blendMode, id, c.r === 1 && c.g === 1 && c.b === 1)}`;
    previous = id;
  }
  body += `<feComposite in="${previous}" in2="shape-alpha" operator="in"/>`;
  return `<filter id="source-paints-${index}" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">${body}</filter>`;
}
function sceneHtml() {
  const { scene } = source;
  const pattern = details.pattern;
  const scale = scene.fills[1].scalingFactor;
  const tw = pattern.width * scale;
  const th = pattern.height * scale;
  const tile = pattern.children
    .map(
      (n) =>
        `<g transform="translate(${n.x} ${n.y})">${n.vectorPaths.map((p) => `<path d="${p.data}" fill="${rgb(n.fills[0].color)}" fill-opacity="${n.fills[0].opacity}"/>`).join('')}</g>`,
    )
    .join('');
  const bg = svgBox(
    scene.width,
    scene.height,
    `<defs><pattern id="grid" width="${tw}" height="${th}" x="${(scene.width - tw) / 2}" y="${(scene.height - th) / 2}" patternUnits="userSpaceOnUse"><g transform="scale(${scale})">${tile}</g></pattern></defs><rect width="100%" height="100%" fill="${rgb(scene.fills[0].color)}"/><rect width="100%" height="100%" fill="url(#grid)" style="mix-blend-mode:color-dodge"/>`,
  );
  const defs = scene.children.map(paints).join('');
  const nodes = scene.children
    .filter((_, i) => !plateOnly || i === 0)
    .map((n, index) => {
      const glass = n.effects.find((e) => e.type === 'GLASS');
      const blur = n.effects.find((e) => e.type === 'BACKGROUND_BLUR');
      const shadows = n.effects
        .filter((e) => e.type === 'DROP_SHADOW' && e.visible !== false && e.color.a > 0)
        .map(
          (e) =>
            `${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread}px rgb(${e.color.r * 255} ${e.color.g * 255} ${e.color.b * 255} / ${e.color.a})`,
        )
        .join(',');
      const frost = 'blur(var(--_glass-frost))';
      const lens = glass ? 'var(--_material-lens-filter)' : '';
      const fill = `url(#source-paints-${index})`;
      const light = glass ? `brightness(${1 + (lightGain - 1) * glass.lightIntensity})` : '';
      const chain =
        order === 'paint-before-lens'
          ? [frost, fill, lens]
          : order === 'blur-after-lens'
            ? [lens, frost, light, fill]
            : [frost, lens, light, fill];
      const style = `left:${n.x}px;top:${n.y}px;width:${n.width}px;height:${n.height}px;border-radius:${n.cornerRadius}px;box-shadow:${shadows || 'none'};--_glass-frost:${(glass?.radius ?? blur?.radius ?? 0) / 2}px;--_lg-depth:${glass?.depth ?? 0};--_lg-refraction:${(glass?.refraction ?? 0) * refractionScale};--_lg-dispersion:${glass?.dispersion ?? 0};--_rim:${glass ? `linear-gradient(${180 + glass.lightAngle}deg,rgb(255 255 255 / ${glass.lightIntensity * rimGain}),transparent)` : 'none'};backdrop-filter:${chain.join(' ')};`;
      const usedStyle = productionContour
        ? style
            .replace(
              `box-shadow:${shadows || 'none'};`,
              `--lab-material-shadow:${shadows || 'none'};--lab-corner-smoothing:.6;`,
            )
            .replace('backdrop-filter:', '--_material-filter:')
        : style;
      return `<div data-node="${n.id}" class="node ${glass || productionContour ? 'lab-material lab-material--subtle' : ''}" style="${usedStyle}"></div>`;
    })
    .join('');
  return `<html data-theme="light" data-material="glass"><style>${colors}${css}body{margin:0;width:${scene.width}px;height:${scene.height}px;overflow:hidden;background-image:url('${data(bg)}')}.node{position:absolute;--_tint:rgb(0 0 0 / 0);--_blend:rgb(0 0 0 / 0)}</style><svg width="0" height="0" style="position:absolute"><defs>${defs}</defs></svg>${nodes}</html>`;
}
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const page = await browser.newPage({
    viewport: { width: 600, height: 452 },
    deviceScaleFactor: 1,
  });
  await page.setContent(sceneHtml());
  await page.evaluate(async (runtime) => {
    const api = await import(URL.createObjectURL(new Blob([runtime], { type: 'text/javascript' })));
    window.disposeMaterials = api.mountMaterialRuntime();
  }, runtime);
  if (!plateOnly)
    await page.waitForFunction(
      () => document.querySelectorAll('.lab-lg-defs feDisplacementMap').length === 5,
    );
  await page.waitForTimeout(100);
  const png = await page.screenshot();
  await writeFile(new URL(`web-dock-${output}.png`, import.meta.url), png);
  const actual = decodePng(png);
  const rows = [];
  for (const n of source.scene.children.filter(
    (n) => n.effects.some((e) => e.type === 'GLASS') && n.x >= 0 && n.x + n.width <= 600,
  )) {
    let error = 0;
    let count = 0;
    let max = 0;
    for (let y = Math.ceil(n.y + 2); y < n.y + n.height - 2; y++)
      for (let x = Math.ceil(n.x + 2); x < n.x + n.width - 2; x++) {
        const rx = Math.max(n.cornerRadius - (x - n.x), 0, x - n.x - (n.width - n.cornerRadius));
        const ry = Math.max(n.cornerRadius - (y - n.y), 0, y - n.y - (n.height - n.cornerRadius));
        if (rx * rx + ry * ry > (n.cornerRadius - 2) ** 2) continue;
        for (let ch = 0; ch < 3; ch++) {
          const k = (y * 600 + x) * 3 + ch;
          const d = Math.abs(actual.rgb[k] - reference.rgb[k]);
          error += d;
          max = Math.max(max, d);
          count++;
        }
      }
    rows.push({ id: n.id, mae: error / count, max });
  }
  let exterior = 0;
  let exteriorCount = 0;
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < 600; x++)
      for (let ch = 0; ch < 3; ch++) {
        const k = (y * 600 + x) * 3 + ch;
        exterior += Math.abs(actual.rgb[k] - reference.rgb[k]);
        exteriorCount++;
      }
  const report = {
    date: new Date().toISOString(),
    browser: browser.version(),
    source: source.fileKey,
    model: output,
    exteriorMae: exterior / exteriorCount,
    rows,
  };
  await writeFile(
    new URL(`dock-holdout-${output}.json`, import.meta.url),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await page.evaluate(() => window.disposeMaterials());
} finally {
  await browser.close();
}
