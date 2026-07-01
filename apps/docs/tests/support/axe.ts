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
  passes: boolean;
  threshold: number;
}

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

  for (const sel of exclude) {
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
 * Читает computed `color` у `labelLocator` и computed `background-color` у
 * `surfaceLocator` (ближайший непрозрачный предок текстового узла или сам
 * компонент-контейнер). Вычисляет WCAG relative luminance + contrast ratio.
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
  // Читаем computed foreground из лейбла.
  const fgRaw: string = await labelLocator.evaluate((el) => getComputedStyle(el).color);

  // Читаем computed background из поверхности (или из самого лейбла).
  const bgRaw: string = surfaceLocator
    ? await surfaceLocator.evaluate((el) => getComputedStyle(el).backgroundColor)
    : await labelLocator.evaluate((el) => getComputedStyle(el).backgroundColor);

  const fgRgb = parseRgb(fgRaw);
  const bgRgb = parseRgb(bgRaw);

  if (!fgRgb || !bgRgb) {
    throw new Error(
      `assertLabelContrast: не удалось распознать цвета.\n  fg="${fgRaw}"\n  bg="${bgRaw}"`,
    );
  }

  const ratio = contrastRatio(fgRgb, bgRgb);
  const threshold = isLargeText ? 3.0 : 4.5;
  const passes = ratio >= threshold;

  expect(
    ratio,
    `Контраст лейбл/поверхность: ${ratio.toFixed(2)}:1 (порог ${threshold}:1)\n  fg=${fgRaw} | bg=${bgRaw}`,
  ).toBeGreaterThanOrEqual(threshold);

  return { fg: fgRaw, bg: bgRaw, ratio, passes, threshold };
}

// ---------------------------------------------------------------------------
// Вспомогательные функции (WCAG contrast ratio)
// ---------------------------------------------------------------------------

type Rgb = { r: number; g: number; b: number };

/** Разбирает строку `rgb(r, g, b)` или `rgba(r, g, b, a)` в компоненты 0-255. */
function parseRgb(raw: string): Rgb | null {
  const m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
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
