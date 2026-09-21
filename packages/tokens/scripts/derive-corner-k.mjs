// Воспроизводимая деривация RadiiConfig.cornerK — фит суперэллипса к кривой
// сглаживания углов Figma (ζ = corner smoothing).
//
// Запуск: node packages/tokens/scripts/derive-corner-k.mjs
//
// Конструкция кривой Figma — эталонная реализация figma-squircle
// (getPathParamsForCorner; сама она — реконструкция официального блога Figma
// «Desperately seeking squircles»):
//   p               = (1 + ζ)·R      — отход от прямой кромки
//   arcMeasure      = 90·(1 − ζ)°    — оставшаяся круговая дуга
//   arcSectionLen   = sin(arc/2)·R·√2
//   angleAlpha      = (90 − arcMeasure)/2 = 45ζ;  angleBeta = 45ζ
//   p3p4            = R·tan(angleAlpha/2)
//   c = p3p4·cos(angleBeta);  d = c·tan(angleBeta)
//   b = (p − arcSectionLen − c − d)/3;  a = 2b
//   Угол: [кромка] → кубик Безье (a, b, c, d) → дуга R → зеркальный кубик.
//
// Суперэллипс CSS (css-borders-4): corner-shape: superellipse(K) рисует в
// боксе R×R кривую |x|^n + |y|^n = 1 с экспонентой n = 2^K (round = K1/n2,
// squircle = K2/n4, «иконный» сквиркл Apple n≈5 → K = log₂5 ≈ 2.32).
//
// Метрика фита: максимум расстояния от плотной выборки кривой Figma до
// полилинии суперэллипса (Хаусдорф в одну сторону; кривые — монотонные дуги
// одного угла, обратная сторона симметрична по построению фита-минимума).
// Золотое сечение по n. Печатает n*, K* = log₂(n*), отклонения при R = 100
// для K* и для зафиксированного в конфиге K, чтобы подтвердить/отозвать его.

import { fileURLToPath } from 'node:url';

export const R = 100;
export const ZETA = 0.6;

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Точки кривой Figma для одного угла в локальных координатах:
 * угол-вершина в (0,0), кромки — луч y=0 при x<0 и луч x=0 при y>0,
 * интерьер в квадранте (x<0, y>0). Центр дуги C = (−R, R).
 */
export function figmaCornerPoints(radius, zeta, samplesPerSegment = 4000) {
  const p = (1 + zeta) * radius;
  const arcMeasure = 90 * (1 - zeta);
  const arcSectionLength = Math.sin(rad(arcMeasure / 2)) * radius * Math.SQRT2;
  const angleAlpha = (90 - arcMeasure) / 2;
  const angleBeta = 45 * zeta;
  const p3p4 = radius * Math.tan(rad(angleAlpha / 2));
  const c = p3p4 * Math.cos(rad(angleBeta));
  const d = c * Math.tan(rad(angleBeta));
  const b = (p - arcSectionLength - c - d) / 3;
  const a = 2 * b;

  // Кубик Безье фланка: от кромки (−p, 0) к началу дуги.
  const P0 = [-p, 0];
  const P1 = [-p + a, 0];
  const P2 = [-p + a + b, 0];
  const P3 = [-p + a + b + c, d];

  const C = [-radius, radius]; // центр круговой дуги

  // Санити G1-стыка: P3 обязан лежать на окружности (|P3 − C| = R).
  const g1 = Math.hypot(P3[0] - C[0], P3[1] - C[1]);
  if (Math.abs(g1 - radius) > 1e-9 * radius) {
    throw new Error(`G1-стык сломан: |P3−C| = ${g1}, ожидалось R = ${radius}`);
  }

  const pts = [];
  const cubic = (t) => {
    const u = 1 - t;
    return [
      u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
      u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1],
    ];
  };
  for (let i = 0; i <= samplesPerSegment; i++) pts.push(cubic(i / samplesPerSegment));

  // Дуга: от угла точки P3 до биссектрисы угла (середина всей кривой).
  const angP3 = Math.atan2(P3[1] - C[1], P3[0] - C[0]);
  const angMid = Math.atan2(-1, 1); // направление (1,−1)/√2 от C к вершине
  for (let i = 1; i <= samplesPerSegment; i++) {
    const t = i / samplesPerSegment;
    const ang = angP3 + (angMid - angP3) * t;
    pts.push([C[0] + radius * Math.cos(ang), C[1] + radius * Math.sin(ang)]);
  }

  // Вторая половина — отражение через биссектрису: (x, y) → (−y, −x).
  const mirrored = pts
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [-y, -x]);
  return pts.concat(mirrored);
}

/**
 * Полилиния суперэллипса n в том же фрейме: ((R+x)/R)^n + ((R−y)/R)^n = 1,
 * ПРОДОЛЖЕННАЯ прямыми кромками до точки отхода кривой Figma (p = (1+ζ)R):
 * сравниваются ФОРМЫ углов целиком, а не изолированные дуги — у Figma кривая
 * отходит от кромки при p > R, и на участке [R, p] форма CSS-угла — это сама
 * прямая кромка. Без продолжения метрика мерила бы расстояние до конца дуги
 * (артефакт p − R), а не расстояние между формами.
 */
export function superellipsePoints(radius, n, edgeExtent, samples = 8000) {
  const pts = [];
  // Прямой участок верхней кромки: от (−edgeExtent, 0) до (−R, 0).
  const edgeSamples = Math.ceil(samples / 8);
  for (let i = 0; i <= edgeSamples; i++) {
    pts.push([-edgeExtent + (i / edgeSamples) * (edgeExtent - radius), 0]);
  }
  for (let i = 0; i <= samples; i++) {
    // Равномерная параметризация по углу через |cos|^(2/n)-форму —
    // плотность у кромок выше, чем у равномерного шага по x.
    const t = (i / samples) * (Math.PI / 2);
    const cx = Math.cos(t) ** (2 / n);
    const cy = Math.sin(t) ** (2 / n);
    // (R+x)/R = cx → x = R(cx − 1);  (R−y)/R = cy → y = R(1 − cy)
    pts.push([radius * (cx - 1), radius * (1 - cy)]);
  }
  // Прямой участок правой кромки: от (0, R) до (0, edgeExtent).
  for (let i = 0; i <= edgeSamples; i++) {
    pts.push([0, radius + (i / edgeSamples) * (edgeExtent - radius)]);
  }
  return pts;
}

/** Точный квадрат расстояния от точки до отрезка. */
function segmentDistance2(ax, ay, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((ax - x1) * dx + (ay - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const ddx = ax - (x1 + t * dx);
  const ddy = ay - (y1 + t * dy);
  return ddx * ddx + ddy * ddy;
}

function buildSegmentGrid(points) {
  const segmentCount = points.length - 1;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(width > 0) || !(height > 0)) return null;
  const size = Math.min(128, Math.max(16, Math.ceil(Math.sqrt(segmentCount))));
  const cellW = width / size;
  const cellH = height / size;
  const cells = Array.from({ length: size * size }, () => []);
  const cellX = (x) => Math.max(0, Math.min(size - 1, Math.floor((x - minX) / cellW)));
  const cellY = (y) => Math.max(0, Math.min(size - 1, Math.floor((y - minY) / cellH)));
  for (let index = 0; index < segmentCount; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const x0 = cellX(Math.min(x1, x2));
    const xN = cellX(Math.max(x1, x2));
    const y0 = cellY(Math.min(y1, y2));
    const yN = cellY(Math.max(y1, y2));
    for (let y = y0; y <= yN; y++) {
      for (let x = x0; x <= xN; x++) cells[y * size + x].push(index);
    }
  }
  return { points, segmentCount, minX, minY, maxX, maxY, width, height, size, cellW, cellH, cells, cellX, cellY };
}

function nearestGridDistance2(ax, ay, grid) {
  if (ax < grid.minX || ax > grid.maxX || ay < grid.minY || ay > grid.maxY) {
    return nearestBruteDistance2(ax, ay, grid.points);
  }
  const cx = grid.cellX(ax);
  const cy = grid.cellY(ay);
  const seen = new Set();
  let best = Number.POSITIVE_INFINITY;
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) return;
    for (const index of grid.cells[y * grid.size + x]) {
      if (seen.has(index)) continue;
      seen.add(index);
      const [x1, y1] = grid.points[index];
      const [x2, y2] = grid.points[index + 1];
      best = Math.min(best, segmentDistance2(ax, ay, x1, y1, x2, y2));
    }
  };
  for (let radius = 0; radius < grid.size; radius++) {
    const x0 = cx - radius;
    const x1 = cx + radius;
    const y0 = cy - radius;
    const y1 = cy + radius;
    for (let x = x0; x <= x1; x++) {
      visit(x, y0);
      if (y1 !== y0) visit(x, y1);
    }
    for (let y = y0 + 1; y < y1; y++) {
      visit(x0, y);
      if (x1 !== x0) visit(x1, y);
    }
    if (!Number.isFinite(best)) continue;

    const sx0 = Math.max(0, x0);
    const sx1 = Math.min(grid.size - 1, x1);
    const sy0 = Math.max(0, y0);
    const sy1 = Math.min(grid.size - 1, y1);
    const bounds = [];
    if (sx0 > 0) bounds.push(ax - (grid.minX + sx0 * grid.cellW));
    if (sx1 < grid.size - 1) bounds.push(grid.minX + (sx1 + 1) * grid.cellW - ax);
    if (sy0 > 0) bounds.push(ay - (grid.minY + sy0 * grid.cellH));
    if (sy1 < grid.size - 1) bounds.push(grid.minY + (sy1 + 1) * grid.cellH - ay);
    if (!bounds.length) break;
    const unseenLowerBound = Math.max(0, Math.min(...bounds));
    if (unseenLowerBound * unseenLowerBound >= best) break;
  }
  return best;
}

function nearestBruteDistance2(ax, ay, points) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    best = Math.min(best, segmentDistance2(ax, ay, x1, y1, x2, y2));
  }
  return best;
}

/**
 * Максимум расстояния от точек A до полилинии B (одна сторона Хаусдорфа).
 * Spatial grid индексирует bbox каждого сегмента. Ring search прекращается только
 * когда расстояние до любой ещё не посещённой клетки не может улучшить best;
 * вырожденная полилиния сохраняет универсальный brute-force fallback.
 */
export function maxDeviation(A, B) {
  if (B.length < 2) return Number.POSITIVE_INFINITY;
  const grid = buildSegmentGrid(B);
  let worst = 0;
  for (const [ax, ay] of A) {
    const best = grid
      ? nearestGridDistance2(ax, ay, grid)
      : nearestBruteDistance2(ax, ay, B);
    if (best > worst) worst = best;
  }
  return Math.sqrt(worst);
}

export const DERIVATION_FIGMA_SAMPLES = 300;
export const DERIVATION_SUPERELLIPSE_SAMPLES = 750;

const figma = figmaCornerPoints(R, ZETA, DERIVATION_FIGMA_SAMPLES);

export const EDGE_EXTENT = (1 + ZETA) * R;
export function deviationForNAtResolution(
  n,
  figmaSamples = DERIVATION_FIGMA_SAMPLES,
  superellipseSamples = DERIVATION_SUPERELLIPSE_SAMPLES,
) {
  const figmaPoints =
    figmaSamples === DERIVATION_FIGMA_SAMPLES ? figma : figmaCornerPoints(R, ZETA, figmaSamples);
  const se = superellipsePoints(R, n, EDGE_EXTENT, superellipseSamples);
  // Симметричный Хаусдорф: форма-к-форме в обе стороны (односторонняя метрика
  // пропустила бы участки, где суперэллипс отходит от кривой Figma).
  return Math.max(maxDeviation(figmaPoints, se), maxDeviation(se, figmaPoints));
}

export function deviationForN(n) {
  return deviationForNAtResolution(n);
}

export function fitOptimalN() {
  // Золотое сечение по n ∈ [2, 4].
  // 16 итераций: остаточный интервал 2·φ^16 ≈ 9e-4, то есть более чем
  // на порядок уже допуска потребителя (тест сравнивает n* с 2.02).
  // Сетка 300/750 отдельно сверяется тестом с удвоенной 600/1500:
  // ошибка Hausdorff для круга < 0.001px при R=100. Прежние 1200/3000 +
  // 28 итераций тратили >80с на тот же вывод и блокировали RPC vitest worker.
  let lo = 2.0;
  let hi = 4.0;
  const phi = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - phi * (hi - lo);
  let x2 = lo + phi * (hi - lo);
  let f1 = deviationForN(x1);
  let f2 = deviationForN(x2);
  for (let i = 0; i < 16; i++) {
    if (f1 < f2) {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - phi * (hi - lo);
      f1 = deviationForN(x1);
    } else {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + phi * (hi - lo);
      f2 = deviationForN(x2);
    }
  }
  return (lo + hi) / 2;
}

// Кросс-платформенный self-run: сравнение OS-путей (сборка `file://${argv}`
// ломалась на Windows — argv с бэкслэшами не совпадал с URL). Конвенция
// репозитория — см. generate-contract.mjs.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
  const nOpt = fitOptimalN();
  const kOpt = Math.log2(nOpt);

  console.info(`Figma corner smoothing ζ = ${ZETA}, R = ${R}px`);
  console.info(
    `оптимальный суперэллипс: n* = ${nOpt.toFixed(4)}  →  K* = log₂(n*) = ${kOpt.toFixed(4)}`,
  );
  console.info(`макс. отклонение при n*: ${deviationForN(nOpt).toFixed(3)}px / R${R}`);
  for (const k of [1.0, 1.1, kOpt, 2.0]) {
    const n = 2 ** k;
    console.info(
      `K = ${k.toFixed(4)} (n = ${n.toFixed(4)}): max dev = ${deviationForN(n).toFixed(3)}px / R${R}`,
    );
  }

  // Кривизна входа (у стыка с прямой кромкой) — вторая ось выбора K.
  // Кривая Figma входит в кромку с НУЛЕВОЙ кривизной (фланк-кубик стартует
  // коллинеарно кромке: P0→P1 вдоль кромки ⇒ κ(0) = 0) — G2-стык.
  // Круг (n = 2) входит со скачком кривизны 0 → 1/R — только G1.
  // Суперэллипс n > 2 входит с κ = 0 (в вершинах оси кривизна ∝ (n−1)·x^{n−2}
  // при x→0 для n>2 → 0) — воспроизводит G2-характер Figma-кривой.
  console.info('');
  console.info(
    'кривизна входа: Figma ζ>0 — κ=0 (G2); круг K=1 — κ=1/R (G1); суперэллипс K>1 — κ=0 (G2)',
  );
}
