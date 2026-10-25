// Измерение и проверка отрендеренных FX-токенов.
//
// Класс А (e2e-рендер на живом браузере) + Д (bite-мутация: flatten/drop → RED).
// Провенанс интенсивности — ПИКСЕЛИ скриншота (Rec.709 luminance), НЕ CSS-alpha
// и НЕ canvas-readback (ловушка e2e-color-interaction-measurement-traps: canvas
// врёт, glow над белым невидим из-за mix-blend-mode:screen). Потому:
//   • каждый glow-свотч рендерится над ТЁМНЫМ фоном (screen-блендинг горит);
//   • интенсивность = mean-luminance-свотча − mean-luminance-фона (delta);
//   • transitions/animations выключены до замера.
//
// Модуль ЧИСТЫЙ (без импортов браузера): строит HTML-харнесс, декодирует PNG
// встроенным zlib и держит инварианты. Драйвер (render-fx.mjs / spec) передаёт
// сюда contractCss и Buffer скриншота — так один код кормит и standalone-скрипт,
// и apps/docs playwright-спеку (DRY, единый источник истины гейта).
import zlib from 'node:zlib';

/** Канон LabUI §FX: нейтраль + бренд + 4 сентимента. Отсутствие любого = RED. */
export const SENTIMENTS = ['neutral', 'brand', 'danger', 'warning', 'success', 'info'];
/** Ступени GlowStep. base — без суффикса роли. */
export const GLOW_STEPS = ['subtle', 'base', 'bloom'];

/** Тёмный фон плитки: screen-блендинг glow физически горит только над тёмным. */
const BACKDROP = '#0d0d12';
const TILE = 128; // px, deviceScaleFactor:1 → CSS px == device px

/** Слои шиммера скелетона: resting-блок (base) и блик (highlight). */
export const SKELETON_LAYERS = ['base', 'highlight'];

/** Имя glow-роли (color/core/alpha) для сентимента и ступени. */
function glowVar(sentiment, step, suffix = '') {
  const stepSeg = step === 'base' ? '' : `-${step}`;
  return `--lab-fx-glow-${sentiment}${stepSeg}${suffix}`;
}

/**
 * HTML-харнесс: сетка 6 сентиментов × [subtle, base, bloom, focus-ring] + столбец
 * чистого фона (референс backdrop-люминанса). Потребляет ЖИВЫЕ custom-props из
 * inline-контракта под [data-theme="dark"].
 *
 * @param {string} contractCss  содержимое colors/contract.css
 * @param {{flatten?: boolean, dropGlow?: string, dropFocus?: string}} [opts]
 *   flatten   — сплющить ступени (subtle=base=bloom): монотонность РУШИТСЯ (bite).
 *   dropGlow  — убрать glow-токены сентимента (эмуляция «токен не дошёл»): свотч
 *               пустой → glow non-blank РУШИТСЯ (bite инварианта §a).
 *   dropFocus — убрать focus-ring-токен сентимента: свотч пуст → focus-ring
 *               non-blank РУШИТСЯ (bite инварианта §a'). Доказывает, что §a'
 *               реально кусается, а не no-op.
 */
export function buildHarnessHtml(contractCss, opts = {}) {
  const { flatten = false, dropGlow = null, dropFocus = null, skeletonBite = null } = opts;

  // Мутации-биты как override-слой (не трогаем сам контракт).
  const mutations = [];
  if (flatten) {
    for (const s of SENTIMENTS) {
      // Все три ступени → alpha базовой: строгое возрастание исчезает.
      mutations.push(`${glowVar(s, 'subtle', '-alpha')}: var(${glowVar(s, 'base', '-alpha')});`);
      mutations.push(`${glowVar(s, 'bloom', '-alpha')}: var(${glowVar(s, 'base', '-alpha')});`);
    }
  }
  if (skeletonBite === 'flatten') {
    // highlight := base (fill-quaternary): блик исчезает (равная светлота) → инвариант осветления РУШИТСЯ.
    mutations.push('--lab-fx-skeleton-highlight: var(--lab-fill-quaternary);');
  }
  if (skeletonBite === 'invert') {
    // Старый Figma-highlight (mid@0.039): в dark ТЕМНЕЕ base → инвариант РУШИТСЯ.
    // Литерал живёт ТОЛЬКО в bite-мутации (эмуляция до-законного значения),
    // не в контракте — доказывает, что гейт ловит регресс к Figma-инверсии.
    mutations.push('--lab-fx-skeleton-highlight: oklch(57.53363% 0.012136 286.012 / 0.039);');
  }
  if (dropGlow) {
    // initial → custom-prop становится guaranteed-invalid → var() пуст →
    // color-mix невалиден → фон свотча прозрачен (как отсутствующий токен).
    for (const step of GLOW_STEPS) {
      mutations.push(`${glowVar(dropGlow, step)}: initial;`);
      mutations.push(`${glowVar(dropGlow, step, '-core')}: initial;`);
      mutations.push(`${glowVar(dropGlow, step, '-alpha')}: initial;`);
    }
  }
  if (dropFocus) {
    // initial → var(--lab-fx-focus-ring-<s>) пуст → background свотча невалиден
    // → прозрачно → L≈фон: эмуляция «focus-ring-токен не дошёл до рендера».
    mutations.push(`--lab-fx-focus-ring-${dropFocus}: initial;`);
  }
  const mutationCss = mutations.length ? `[data-theme="dark"]{${mutations.join('')}}` : '';

  const cell = (s, kind) => {
    if (kind === 'focus') {
      // focus-ring: сплошная заливка токеном семьи. Геометрия рамки отделена от
      // цвета — гейт судит ТОЛЬКО факт отрисовки (non-blank над фоном), см.
      // assertFxRender: попарная хроматическая различимость НЕ проверяется (EC4).
      return `<div class="tile" data-swatch="${s}:focus">
        <div class="focus" style="background:var(--lab-fx-focus-ring-${s})"></div>
      </div>`;
    }
    const halo = glowVar(s, kind);
    const core = glowVar(s, kind, '-core');
    const a = glowVar(s, kind, '-alpha');
    return `<div class="tile" data-swatch="${s}:${kind}">
      <div class="glow" style="--halo:var(${halo});--core:var(${core});--a:var(${a})"></div>
    </div>`;
  };

  const rows = SENTIMENTS.map(
    (s) => `<div class="row">
      <div class="label">${s}</div>
      ${cell(s, 'subtle')}${cell(s, 'base')}${cell(s, 'bloom')}${cell(s, 'focus')}
    </div>`,
  ).join('');

  // Ряд шиммера скелетона: base (resting) и highlight (блик) — сплошная заливка
  // translucent-токеном над тёмным фоном плитки. Инвариант: highlight СВЕТЛЕЕ base.
  // База-заглушка — Fill (fill-quaternary, #100); шиммер — FX (fx-skeleton-highlight).
  const skelToken = { base: '--lab-fill-quaternary', highlight: '--lab-fx-skeleton-highlight' };
  const skelCell = (layer) => `<div class="tile" data-swatch="skeleton:${layer}">
      <div class="skel" style="background:var(${skelToken[layer]})"></div>
    </div>`;
  const skeletonRow = `<div class="row">
      <div class="label">skeleton</div>
      ${skelCell('base')}${skelCell('highlight')}
    </div>`;

  return `<!doctype html><html data-theme="dark"><head><meta charset="utf-8">
<style>
${contractCss}
${mutationCss}
*{transition:none!important;animation:none!important;box-sizing:border-box}
body{margin:0;padding:24px;background:${BACKDROP};font:12px system-ui,sans-serif;color:#cfcfe0}
.grid{display:inline-block}
.head,.row{display:flex;align-items:center;gap:12px}
.head>div,.label{width:96px;text-align:right;opacity:.8}
.tile{width:${TILE}px;height:${TILE}px;background:${BACKDROP};position:relative;overflow:hidden;border-radius:8px}
.glow{position:absolute;inset:0;mix-blend-mode:screen;
  background:radial-gradient(circle at 50% 50%,
    color-mix(in srgb, var(--core) calc(var(--a)*100%), transparent) 0%,
    color-mix(in srgb, var(--halo) calc(var(--a)*100%), transparent) 40%,
    transparent 72%)}
.focus{position:absolute;inset:24px;border-radius:6px}
.skel{position:absolute;inset:0}
.bg{width:${TILE}px;height:${TILE}px;background:${BACKDROP};border-radius:8px}
</style></head><body>
<div class="grid">
  <div class="head"><div>sentiment</div><div>subtle</div><div>base</div><div>bloom</div><div>focus-ring</div></div>
  ${rows}
  ${skeletonRow}
  <div class="row"><div class="label">ref</div>
    <div class="tile" data-swatch="ref:backdrop"><div class="bg"></div></div>
  </div>
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

/** Rec.709 relative luminance (sRGB 0–255, без гамма-линеаризации — для delta достаточно). */
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
 * measurements: { backdropL, glow: {s:{subtle,base,bloom}}, focus: {s:{r,g,b,L}} }
 *
 * ПОЧЕМУ focus-ring НЕ проверяется на попарную «различимость» цветов: по паспорту
 * labui (EC4, см. packages/colors/test/fx-family.test.mjs) focus-ring НЕ несёт
 * собственного сентимент-цвета — он алиасит СИЛЬНЫЙ штрих Label
 * (label-{sentiment}-primary) с полом контраста ~17–20:1 к фону. Поэтому по темам
 * он near-white (dark) / near-black (light) — намеренно КОНТРАСТНЫЙ, а не
 * хроматически-различимый. Прежний инвариант «RGB-дист ≥ 24» кодировал старый
 * (цветной) дизайн #93 и на текущем контракте давал бы ложный RED. Пиксельный
 * гейт судит то, что дизайн реально гарантирует: focus-ring РЕНДЕРИТСЯ (non-blank
 * над фоном). Наследование/контраст закрыты исходным тестом fx-family (Класс А).
 *
 * @returns {{glow: Record<string,object>, focus: Record<string,object>}} нормализованные дельты
 */
export function assertFxRender(m) {
  const NONBLANK = 1.0; // мин. luminance-delta base-glow над фоном (пикс. единицы)
  const MONO_MARGIN = 0.3; // строгий шаг между ступенями

  const problems = [];
  const deltas = {};

  // (a) 6 сентиментов: base-glow non-blank + монотонность subtle<base<bloom.
  for (const s of SENTIMENTS) {
    const g = m.glow[s];
    if (!g) {
      problems.push(`glow отсутствует у сентимента ${s}`);
      continue;
    }
    const dSub = g.subtle.L - m.backdropL;
    const dBase = g.base.L - m.backdropL;
    const dBloom = g.bloom.L - m.backdropL;
    deltas[s] = { subtle: dSub, base: dBase, bloom: dBloom };
    if (dBase <= NONBLANK) {
      problems.push(`${s}: base-glow пустой (delta ${dBase.toFixed(2)} ≤ ${NONBLANK})`);
    }
    if (!(dSub + MONO_MARGIN < dBase)) {
      problems.push(`${s}: subtle≮base (${dSub.toFixed(2)} vs ${dBase.toFixed(2)})`);
    }
    if (!(dBase + MONO_MARGIN < dBloom)) {
      problems.push(`${s}: base≮bloom (${dBase.toFixed(2)} vs ${dBloom.toFixed(2)})`);
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
    for (const s of SENTIMENTS) {
      for (const step of GLOW_STEPS) {
        boxes[`${s}:${step}`] = await page.locator(`[data-swatch="${s}:${step}"]`).boundingBox();
      }
      boxes[`${s}:focus`] = await page.locator(`[data-swatch="${s}:focus"]`).boundingBox();
    }
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
    for (const s of SENTIMENTS) {
      glow[s] = {
        subtle: sampleRegion(decoded, boxes[`${s}:subtle`]),
        base: sampleRegion(decoded, boxes[`${s}:base`]),
        bloom: sampleRegion(decoded, boxes[`${s}:bloom`]),
      };
      focus[s] = sampleRegion(decoded, boxes[`${s}:focus`]);
    }
    const skeleton = {
      base: sampleRegion(decoded, boxes['skeleton:base']),
      highlight: sampleRegion(decoded, boxes['skeleton:highlight']),
    };
    return { png, measurements: { backdropL, glow, focus, skeleton } };
  } finally {
    await browser.close();
  }
}
