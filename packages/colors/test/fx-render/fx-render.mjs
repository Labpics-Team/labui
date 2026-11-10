// Проверка реального FX-render: PNG читается после браузерной композиции.
// Прогрессия — один, два и три накопленных слоя одной авторской краски.
// Цветовые значения не вычисляются здесь: их отдаёт контракт Colors.
import zlib from 'node:zlib';

/** Семьи focus-ring сохраняют семантику сильного Label. */
export const SENTIMENTS = ['neutral', 'brand', 'danger', 'warning', 'success', 'info'];
/** Авторские краски, для которых проверяется накапливаемое свечение. */
export const GLOW_FAMILIES = ['neutral', 'brand', 'danger', 'warning'];
export const GLOW_STEPS = ['single', 'double', 'triple'];
export const SKELETON_LAYERS = ['base', 'highlight'];

// Область проверки фиксирована до сравнения: тёмный однородный фон,
// Chromium sRGB, deviceScaleFactor 1, без движения во время снимка.
const BACKDROP = '#0d0d12';
const TILE = 128;

/** Стенд использует тот же Paint повторно; каждый следующий слой сохраняет предыдущие. */
export function buildHarnessHtml(contractCss, opts = {}) {
  const { flatten = false, dropGlow = null, dropFocus = null, skeletonBite = null } = opts;
  if (dropGlow !== null && !GLOW_FAMILIES.includes(dropGlow)) {
    throw new Error(`неизвестная glow-семья ${dropGlow}`);
  }
  if (dropFocus !== null && !SENTIMENTS.includes(dropFocus)) {
    throw new Error(`неизвестная focus-семья ${dropFocus}`);
  }
  if (skeletonBite !== null && skeletonBite !== 'flatten' && skeletonBite !== 'invert') {
    throw new Error(`неизвестная мутация skeleton ${skeletonBite}`);
  }
  const mutations = [];
  if (dropGlow) mutations.push(`--lab-fx-glow-${dropGlow}: initial;`);
  if (dropFocus) mutations.push(`--lab-fx-focus-ring-${dropFocus}: initial;`);
  if (skeletonBite === 'flatten') {
    mutations.push('--lab-fx-skeleton-highlight: var(--lab-fill-quaternary);');
  }
  if (skeletonBite === 'invert') {
    // Контрпример из прежнего reference: в dark этот блик темнее базы.
    mutations.push('--lab-fx-skeleton-highlight: rgb(120 120 128 / 0.039);');
  }
  const mutationCss = mutations.length ? `[data-theme="dark"]{${mutations.join('')}}` : '';
  const glowCell = (family, step, index) => {
    const count = flatten ? 1 : index + 1;
    const layers = Array.from(
      { length: count },
      (_, layer) => `<div class="glow-layer" data-glow-layer="${layer + 1}"></div>`,
    ).join('');
    return `<div class="tile" data-swatch="${family}:${step}">
      <div class="glow-stack" data-glow-stack="${family}:${step}" style="--glow:var(--lab-fx-glow-${family})">${layers}</div>
    </div>`;
  };
  const glowRows = GLOW_FAMILIES.map(
    (family) => `<div class="row">
    <div class="label">${family}</div>${GLOW_STEPS.map((step, index) => glowCell(family, step, index)).join('')}
  </div>`,
  ).join('');
  const focusCells = SENTIMENTS.map(
    (family) => `<div class="focus-cell"><div>${family}</div>
    <div class="tile" data-swatch="${family}:focus"><div class="focus" style="background:var(--lab-fx-focus-ring-${family})"></div></div>
  </div>`,
  ).join('');
  const skeletonTokens = {
    base: '--lab-fill-quaternary',
    highlight: '--lab-fx-skeleton-highlight',
  };
  const skeletonCells = SKELETON_LAYERS.map(
    (layer) => `<div class="tile" data-swatch="skeleton:${layer}">
    <div class="skel" style="background:var(${skeletonTokens[layer]})"></div>
  </div>`,
  ).join('');
  return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<style>
${contractCss}
${mutationCss}
*{transition:none!important;animation:none!important;box-sizing:border-box}
body{margin:0;padding:24px;background:${BACKDROP};font:12px system-ui,sans-serif;color:#cfcfe0}
.grid{display:inline-block}
.head,.row,.focus-row{display:flex;align-items:center;gap:12px}
.row{margin-top:12px}
.head>div,.label{width:96px;text-align:right}
.head>div:not(:first-child){width:${TILE}px;text-align:center}
.tile{width:${TILE}px;height:${TILE}px;background:${BACKDROP};position:relative;overflow:hidden;border-radius:8px;isolation:isolate}
.glow-stack,.glow-layer,.skel{position:absolute;inset:0}
.glow-layer{mix-blend-mode:screen;background:radial-gradient(circle at 50% 50%,var(--glow) 0%,var(--glow) 40%,transparent 72%)}
.focus{position:absolute;inset:24px;border-radius:6px}
.focus-row{margin:24px 0}
.focus-cell>div:first-child{margin-bottom:8px;text-align:center}
.bg{width:${TILE}px;height:${TILE}px;background:${BACKDROP};border-radius:8px}
</style></head><body>
<div class="grid">
  <div class="head"><div>Glow</div><div>Один слой</div><div>Два слоя</div><div>Три слоя</div></div>
  ${glowRows}
  <div class="focus-row">${focusCells}</div>
  <div class="row"><div class="label">Skeleton</div>${skeletonCells}</div>
  <div class="row"><div class="label">Фон</div><div class="tile" data-swatch="ref:backdrop"><div class="bg"></div></div></div>
</div>
</body></html>`;
}

// ─── PNG-декодер (встроенный zlib, без внешних зависимостей) ───
// Поддержка: 8-bit, colorType 2 (RGB) / 6 (RGBA), non-interlaced — формат
// скриншотов Chromium. Возвращает { width, height, rgb: Uint8Array(w*h*3) }.
export function decodePng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error('не PNG (сигнатура)');
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} не поддержан`);
      if (interlace !== 0) throw new Error('interlaced PNG не поддержан');
      if (colorType !== 2 && colorType !== 6) {
        throw new Error(`colorType ${colorType} не поддержан`);
      }
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const rgb = new Uint8Array(width * height * 3);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) cur[x] = raw[p + x];
    p += stride;
    // Unfilter (спецификация PNG §9).
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0; // левый
      const b = prev[x]; // верхний
      const c = x >= bpp ? prev[x - bpp] : 0; // верх-левый
      let v = cur[x];
      switch (filter) {
        case 0:
          break;
        case 1:
          v = (v + a) & 0xff;
          break;
        case 2:
          v = (v + b) & 0xff;
          break;
        case 3:
          v = (v + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pred) & 0xff;
          break;
        }
        default:
          throw new Error(`неизвестный фильтр ${filter}`);
      }
      cur[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 3;
      rgb[d] = cur[s];
      rgb[d + 1] = cur[s + 1];
      rgb[d + 2] = cur[s + 2];
    }
    prev.set(cur);
  }
  return { width, height, rgb };
}

/** Взвешенный сигнал encoded RGB из PNG; это не WCAG-яркость или модель восприятия. */
function lum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Средние L и RGB по прямоугольнику bbox (device px) внутри декодированного PNG.
 * Центральная суб-выборка (60%) — уходим от AA-кромок плитки.
 */
export function sampleRegion(png, bbox) {
  const inset = 0.2;
  const x0 = Math.max(0, Math.round(bbox.x + bbox.width * inset));
  const y0 = Math.max(0, Math.round(bbox.y + bbox.height * inset));
  const x1 = Math.min(png.width, Math.round(bbox.x + bbox.width * (1 - inset)));
  const y1 = Math.min(png.height, Math.round(bbox.y + bbox.height * (1 - inset)));
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const d = (y * png.width + x) * 3;
      sr += png.rgb[d];
      sg += png.rgb[d + 1];
      sb += png.rgb[d + 2];
      n++;
    }
  }
  if (n === 0) throw new Error(`пустой bbox: ${JSON.stringify(bbox)}`);
  const r = sr / n;
  const g = sg / n;
  const b = sb / n;
  return { r, g, b, L: lum(r, g, b), n };
}

/**
 * ОБЪЕКТИВНЫЕ инварианты на замерах. Кидает Error при нарушении (RED).
 * measurements: { backdropL, glow: {s:{single,double,triple}}, focus: {s:{r,g,b,L}} }
 *
 * ПОЧЕМУ focus-ring НЕ проверяется на попарную «различимость» цветов: по паспорту
 * labui (EC4, см. packages/colors/test/fx-family.test.mjs) focus-ring НЕ несёт
 * собственного сентимент-цвета — он алиасит СИЛЬНЫЙ штрих Label
 * (label-{sentiment}-primary). Этот пиксельный гейт проверяет присутствие focus.
 * Его доступность и контраст проверяются отдельно на конечной поверхности.
 *
 * @returns {{glow: Record<string,object>, focus: Record<string,object>}} нормализованные дельты
 */
export function assertFxRender(m) {
  const NONBLANK = 1.0; // прежний минимальный сигнал над фоном, encoded pixel units
  const MONO_MARGIN = 0.3; // строгий шаг между ступенями

  const problems = [];
  const deltas = {};

  // Первый слой видим; каждый следующий слой усиливает накопленный эффект.
  for (const s of GLOW_FAMILIES) {
    const g = m.glow[s];
    if (!g?.single || !g.double || !g.triple) {
      problems.push(`glow отсутствует у сентимента ${s}`);
      continue;
    }
    const single = g.single.L - m.backdropL;
    const double = g.double.L - m.backdropL;
    const triple = g.triple.L - m.backdropL;
    deltas[s] = { single, double, triple };
    if (single <= NONBLANK) {
      problems.push(`${s}: первый glow-слой пустой (delta ${single.toFixed(2)} ≤ ${NONBLANK})`);
    }
    if (!(single + MONO_MARGIN < double)) {
      problems.push(`${s}: один≮два слоя (${single.toFixed(2)} vs ${double.toFixed(2)})`);
    }
    if (!(double + MONO_MARGIN < triple)) {
      problems.push(`${s}: два≮три слоя (${double.toFixed(2)} vs ${triple.toFixed(2)})`);
    }
  }

  // (a') focus-ring каждого сентимента non-blank: реально отрисован над фоном.
  // Ловит «токен не дошёл до рендера» (var() пуст → свотч прозрачен → L≈фон).
  for (const s of SENTIMENTS) {
    const f = m.focus[s];
    if (!f) {
      problems.push(`focus-ring отсутствует у ${s}`);
      continue;
    }
    if (Math.abs(f.L - m.backdropL) <= NONBLANK) {
      problems.push(
        `${s}: focus-ring пустой (L ${f.L.toFixed(2)} ≈ фон ${m.backdropL.toFixed(2)})`,
      );
    }
  }

  // (a'') шиммер скелетона: highlight (блик) СВЕТЛЕЕ base (resting) — закон
  // осветления. Пиксельная проверка ловит Figma-инверсию dark (highlight темнее
  // base) и flatten (highlight==base). Замер над тёмным фоном плитки.
  const SKEL_MARGIN = 2.0; // пикс. luminance-запас блика над resting
  if (!m.skeleton) {
    problems.push('замеры скелетона отсутствуют');
  } else {
    const { base, highlight } = m.skeleton;
    const lift = highlight.L - base.L;
    if (!(lift > SKEL_MARGIN)) {
      problems.push(
        `skeleton: блик НЕ светлее resting (highlight ${highlight.L.toFixed(2)} − base ${base.L.toFixed(2)} = ${lift.toFixed(2)} ≤ ${SKEL_MARGIN})`,
      );
    }
  }

  if (problems.length) {
    throw new Error(`FX-render: нарушены условия проверки:\n  - ${problems.join('\n  - ')}`);
  }
  return { deltas, focus: m.focus, skeleton: m.skeleton };
}

/**
 * Прогон в браузере: рендер харнесса, скриншот в PNG-буфер, замер регионов.
 * chromium — BrowserType из playwright (@playwright/test). Драйвер решает,
 * куда сохранить png (артефакт) — этот код только возвращает буфер и замеры.
 *
 * @returns {Promise<{png: Buffer, measurements: object}>}
 */
export async function renderAndMeasure(chromium, contractCss, opts = {}) {
  const html = buildHarnessHtml(contractCss, opts);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts?.ready);

    // bbox всех свотчей + референса фона — В device px (scale 1).
    const boxes = {};
    for (const s of GLOW_FAMILIES) {
      for (const step of GLOW_STEPS) {
        boxes[`${s}:${step}`] = await page.locator(`[data-swatch="${s}:${step}"]`).boundingBox();
      }
    }
    for (const s of SENTIMENTS)
      boxes[`${s}:focus`] = await page.locator(`[data-swatch="${s}:focus"]`).boundingBox();
    for (const layer of SKELETON_LAYERS) {
      boxes[`skeleton:${layer}`] = await page
        .locator(`[data-swatch="skeleton:${layer}"]`)
        .boundingBox();
    }
    boxes['ref:backdrop'] = await page.locator('[data-swatch="ref:backdrop"]').boundingBox();

    const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
    const decoded = decodePng(png);

    const backdropL = sampleRegion(decoded, boxes['ref:backdrop']).L;
    const glow = {};
    const focus = {};
    for (const s of GLOW_FAMILIES) {
      glow[s] = {
        single: sampleRegion(decoded, boxes[`${s}:single`]),
        double: sampleRegion(decoded, boxes[`${s}:double`]),
        triple: sampleRegion(decoded, boxes[`${s}:triple`]),
      };
    }
    for (const s of SENTIMENTS) focus[s] = sampleRegion(decoded, boxes[`${s}:focus`]);
    const skeleton = {
      base: sampleRegion(decoded, boxes['skeleton:base']),
      highlight: sampleRegion(decoded, boxes['skeleton:highlight']),
    };
    return { png, measurements: { backdropL, glow, focus, skeleton } };
  } finally {
    await browser.close();
  }
}
