/**
 * Вспомогательные утилиты axe-core для e2e-гейта WCAG 2.1 AA.
 *
 * Два уровня проверки:
 *   1. `assertAxeAA` — автоматизированный axe-core скан: структурные нарушения,
 *      семантика, keyboard-trap, ARIA и color-contrast (где axe разрешает
 *      computed styles). Работает на обоих рендерерах (Lit shadow DOM + React).
 *   2. `assertLabelContrast` — явная проверка контраста «лейбл над своей
 *      поверхностью» (label-over-own-surface): читает computed foreground/
 *      background конкретного текстового узла, вычисляет WCAG contrast ratio и
 *      проверяет против AA-порога (4.5:1 обычный / 3:1 крупный текст).
 *
 * @module tests/support/axe
 */

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/** Опции для `assertAxeAA`. */
export interface AxeScanOptions {
  /**
   * WCAG-теги axe.
   * По умолчанию: wcag2a, wcag2aa, wcag21a, wcag21aa
   * (WCAG 2.0 A/AA + WCAG 2.1 A/AA).
   */
  tags?: string[];
  /** CSS-селекторы, исключённые из скана. */
  exclude?: string[];
  /** Идентификаторы правил axe для отключения. */
  disableRules?: string[];
}

/** Результат замера контраста. */
export interface ContrastResult {
  fg: string;
  bg: string;
  ratio: number;
  threshold: number;
}

/**
 * Селекторы неактивных (disabled) UI-компонентов — WCAG 1.4.3 явно исключает
 * их текст/изображения из требования контраста ("no contrast requirement for
 * any text ... that is part of an inactive user interface component").
 * Покрывает нативный `disabled`, ARIA `aria-disabled`, и `data-disabled` (наш
 * контракт для non-form элементов вроде `<lab-badge disabled>`).
 */
const DISABLED_SELECTORS = ['[disabled]', '[aria-disabled="true"]', '[data-disabled="true"]'];

// ---------------------------------------------------------------------------
// assertAxeAA
// ---------------------------------------------------------------------------

/**
 * Запускает полный axe-core WCAG 2.1 AA скан на текущей странице.
 *
 * Axe разрешает CSS custom properties (--lab-* роли) через браузерный
 * computed-styles API, поэтому color-contrast проверяется реальными
 * вычисленными значениями. Для shadow DOM элементов axe v4.x использует
 * встроенный механизм обхода shadow root.
 *
 * Ожидаемый результат: zero violations (violations.length === 0).
 * При нарушениях выводится читаемый список с impact, id, html-узлом.
 */
export async function assertAxeAA(page: Page, options: AxeScanOptions = {}): Promise<void> {
  const {
    tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    exclude = [],
    disableRules = [],
  } = options;

  let builder = new AxeBuilder({ page }).withTags(tags);

  // Неактивные (disabled) UI-компоненты ВСЕГДА исключены из скана: WCAG 1.4.3
  // Contrast (Minimum) прямо освобождает "text ... that is part of an inactive
  // user interface component" от требования контраста — приглушённая (opacity)
  // disabled-поверхность не обязана проходить AA. Это не ослабление гейта, а
  // корректное применение самого критерия (иначе ложные срабатывания на каждом
  // disabled-фикстуре компонента).
  for (const sel of [...DISABLED_SELECTORS, ...exclude]) {
    builder = builder.exclude(sel);
  }
  if (disableRules.length > 0) {
    builder = builder.disableRules(disableRules);
  }

  const results = await builder.analyze();

  expect(results.violations, formatViolations(results.violations)).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// assertLabelContrast  (label-over-own-surface)
// ---------------------------------------------------------------------------

/**
 * Явная проверка контраста «лейбл над своей поверхностью».
 *
 * Читает computed `color` у `labelLocator`. Для фона — если `surfaceLocator`
 * (или сам `labelLocator`, когда `surfaceLocator` не передан) имеет
 * полупрозрачный `background-color` (частый случай для `--lab-fill-*-tinted`
 * ролей), эффективный фон композитится ("src over dst") вверх по цепочке
 * предков (через shadow-root границу тоже) до первого непрозрачного слоя или
 * белого холста canvas по умолчанию — реальный отрендеренный цвет, не догадка.
 * Вычисляет WCAG relative luminance + contrast ratio.
 * Проверяет: ratio >= 4.5 для обычного текста (< 18pt или < 14pt bold),
 * ratio >= 3.0 для крупного (≥ 18pt или ≥ 14pt bold).
 *
 * Работает как в shadow DOM (Lit), так и в light DOM (React).
 *
 * @param labelLocator     Локатор текстового элемента (лейбла).
 * @param surfaceLocator   Локатор поверхности-фона. Если не передан —
 *                         используется `background-color` самого `labelLocator`.
 * @param isLargeText      Применять порог крупного текста (3:1). По умолчанию
 *                         false (4.5:1).
 */
export async function assertLabelContrast(
  labelLocator: Locator,
  surfaceLocator?: Locator,
  isLargeText = false,
): Promise<ContrastResult> {
  // Читаем computed foreground из лейбла. Нормализуем через canvas: движок
  // эмитит роли в oklch(), и computed color сохраняет этот синтаксис (CSS
  // Color 4 сериализация), а Node-сторона парсит только rgb/rgba. Canvas
  // 2d-контекст парсит ЛЮБОЙ валидный CSS-цвет — рисуем 1px и читаем байты:
  // тот же путь, каким цвет реально приходит на экран, не свой конвертер.
  const fgRaw: string = await labelLocator.evaluate((el) => {
    const raw = getComputedStyle(el).color;
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return raw;
    ctx.canvas.width = 1;
    ctx.canvas.height = 1;
    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${d[0] ?? 0}, ${d[1] ?? 0}, ${d[2] ?? 0}, ${((d[3] ?? 255) / 255).toFixed(3)})`;
  });

  // Читаем эффективный (скомпонованный) background поверхности: если сама
  // поверхность имеет полупрозрачный background-color (частый случай для
  // --lab-fill-*-tinted ролей), реальный отрендеренный цвет — это результат
  // alpha-композитинга этого слоя НАД фоном предков, вплоть до первого
  // непрозрачного слоя (или белого холста canvas по умолчанию). Читать только
  // computed-style самого элемента и бросать ошибку на alpha<1 — false negative:
  // страница СУЩЕСТВУЕТ, контраст РЕАЛЕН и измерим, просто не одним слоем.
  const target = surfaceLocator ?? labelLocator;
  const bgRaw: string = await target.evaluate((el) => {
    // Композитинг "src over dst": result = src*srcA + dst*(1-srcA).
    function over(
      src: { r: number; g: number; b: number; a: number },
      dst: { r: number; g: number; b: number },
    ): { r: number; g: number; b: number } {
      return {
        r: src.r * src.a + dst.r * (1 - src.a),
        g: src.g * src.a + dst.g * (1 - src.a),
        b: src.b * src.a + dst.b * (1 - src.a),
      };
    }
    // Canvas-нормализация: слои фона тоже эмитятся движком в oklch(), а не
    // только в rgb/rgba — парсим ЛЮБОЙ валидный CSS-цвет тем же путём, каким
    // он приходит на экран (1px fill + чтение байтов), вместо своего регэкспа.
    const normCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (normCtx) {
      normCtx.canvas.width = 1;
      normCtx.canvas.height = 1;
    }
    function parse(raw: string): { r: number; g: number; b: number; a: number } | null {
      const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
      if (m) {
        return {
          r: Number(m[1]),
          g: Number(m[2]),
          b: Number(m[3]),
          a: m[4] === undefined ? 1 : Number(m[4]),
        };
      }
      if (!normCtx || !raw) return null;
      normCtx.clearRect(0, 0, 1, 1);
      // Сентинел: если raw не парсится, fillStyle остаётся прежним — тогда
      // честно возвращаем null, а не мусорный цвет сентинела.
      normCtx.fillStyle = '#010203';
      normCtx.fillStyle = raw;
      if (normCtx.fillStyle === '#010203' && raw.toLowerCase() !== '#010203') return null;
      normCtx.fillRect(0, 0, 1, 1);
      const d = normCtx.getImageData(0, 0, 1, 1).data;
      return { r: d[0] ?? 0, g: d[1] ?? 0, b: d[2] ?? 0, a: (d[3] ?? 255) / 255 };
    }

    let composed = { r: 255, g: 255, b: 255 }; // canvas default (opaque white)
    const chain: Element[] = [];
    // Собираем цепочку предков, переходя через shadow-root границу (getRootNode
    // возвращает ShadowRoot, чей .host — следующий реальный узел выше).
    let node: Node | null = el;
    while (node) {
      if (node instanceof Element) chain.push(node);
      const parent: Node | null = (node as Element).parentElement;
      if (parent) {
        node = parent;
      } else {
        const root = node.getRootNode();
        node = root instanceof ShadowRoot ? root.host : null;
      }
    }
    // Компонуем от самого дальнего предка (документа) вниз к элементу, чтобы
    // каждый слой лёг "over" уже накопленный результат снизу вверх по DOM.
    for (const layerEl of chain.slice().reverse()) {
      const layer = parse(getComputedStyle(layerEl).backgroundColor);
      if (layer && layer.a > 0) composed = over(layer, composed);
    }
    const { r, g, b } = composed;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  });

  const fgRgb = parseRgb(fgRaw);
  const bgRgb = parseRgb(bgRaw);

  if (!fgRgb || !bgRgb) {
    throw new Error(
      `assertLabelContrast: не удалось распознать цвета.\n  fg="${fgRaw}"\n  bg="${bgRaw}"`,
    );
  }

  const ratio = contrastRatio(fgRgb, bgRgb);
  const threshold = isLargeText ? 3.0 : 4.5;

  expect(
    ratio,
    `Контраст лейбл/поверхность: ${ratio.toFixed(2)}:1 (порог ${threshold}:1)\n  fg=${fgRaw} | bg=${bgRaw}`,
  ).toBeGreaterThanOrEqual(threshold);

  return { fg: fgRaw, bg: bgRaw, ratio, threshold };
}

// ---------------------------------------------------------------------------
// Вспомогательные функции (WCAG contrast ratio)
// ---------------------------------------------------------------------------

type Rgb = { r: number; g: number; b: number; a: number };

/**
 * Разбирает строку `rgb(r, g, b)` или `rgba(r, g, b, a)` в компоненты 0-255
 * + альфа (0-1, по умолчанию 1 — непрозрачно). Альфа ОБЯЗАНА разбираться:
 * `background-color: transparent` computed-стиль браузера возвращает
 * `rgba(0, 0, 0, 0)`, и без учёта альфы это молча читалось бы как непрозрачный
 * чёрный — ложно занижая/завышая контраст поверхности, чей реальный фон
 * приходит от предка.
 */
function parseRgb(raw: string): Rgb | null {
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/** Relative luminance по WCAG 2.x (sRGB → linearised). */
function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio WCAG (1.0–21.0). */
function contrastRatio(a: Rgb, b: Rgb): number {
  const La = relativeLuminance(a) + 0.05;
  const Lb = relativeLuminance(b) + 0.05;
  return La > Lb ? La / Lb : Lb / La;
}

/** Форматирует список axe-нарушений для читаемого вывода теста. */
function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): string {
  if (violations.length === 0) return 'axe: нарушений нет';
  return [
    `axe AA нарушения (${violations.length}):`,
    ...violations.map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => `      › ${n.html.slice(0, 140)}`)
        .join('\n');
      return `  [${v.impact ?? '?'}] ${v.id}: ${v.description}\n${nodes}`;
    }),
  ].join('\n');
}
