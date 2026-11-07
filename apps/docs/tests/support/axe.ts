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
 * Цветовая математика (нормализация CSS-цвета, relative luminance, contrast
 * ratio) в этом модуле НЕ живёт — единственная реализация в `support/color.ts`,
 * отсюда только импортируется (там же — вердикт о каноне порога 0.03928).
 *
 * @module tests/support/axe
 */

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { type Srgb, contrastRatio, normalizeCssColor } from './color.js';

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
  // Читаем computed foreground из лейбла. Движок эмитит роли в oklch(), и
  // computed color сохраняет этот синтаксис (CSS Color 4 сериализация) —
  // нормализацию в целочисленный sRGB делает КАНОНИЧЕСКИЙ примитив
  // `normalizeCssColor` из support/color.ts (canvas руками браузера, с
  // двух-сентинельной валидацией), а не локальная копия конвертера.
  const page = labelLocator.page();
  const fgRaw: string = await labelLocator.evaluate((el) => getComputedStyle(el).color);
  const fgRgb: Srgb | null = await normalizeCssColor(page, fgRaw);

  // Читаем эффективный (скомпонованный) background поверхности: если сама
  // поверхность имеет полупрозрачный background-color (частый случай для
  // --lab-fill-*-tinted ролей), реальный отрендеренный цвет — это результат
  // alpha-композитинга этого слоя НАД фоном предков, вплоть до первого
  // непрозрачного слоя (или белого холста canvas по умолчанию). Читать только
  // computed-style самого элемента и бросать ошибку на alpha<1 — false negative:
  // страница СУЩЕСТВУЕТ, контраст РЕАЛЕН и измерим, просто не одним слоем.
  const target = surfaceLocator ?? labelLocator;
  // В браузере — только СБОР слоёв: цепочка computed background-color от
  // элемента вверх, через shadow-root границу (getRootNode возвращает
  // ShadowRoot, чей .host — следующий реальный узел выше). Парсинг каждого
  // слоя — канонический `normalizeCssColor` на Node-стороне, не своя копия.
  const bgLayersRaw: string[] = await target.evaluate((el) => {
    const layers: string[] = [];
    let node: Node | null = el;
    while (node) {
      if (node instanceof Element) layers.push(getComputedStyle(node).backgroundColor);
      const parent: Node | null = (node as Element).parentElement;
      if (parent) {
        node = parent;
      } else {
        const root = node.getRootNode();
        node = root instanceof ShadowRoot ? root.host : null;
      }
    }
    return layers;
  });

  // Композитинг "src over dst" (result = src*srcA + dst*(1-srcA)): компонуем
  // от самого дальнего предка (документа) вниз к элементу поверх белого холста
  // canvas по умолчанию — каждый слой ложится "over" накопленный результат.
  let composed = { r: 255, g: 255, b: 255 }; // canvas default (opaque white)
  for (const rawLayer of bgLayersRaw.slice().reverse()) {
    const layer = await normalizeCssColor(page, rawLayer);
    if (layer && layer.a > 0) {
      composed = {
        r: layer.r * layer.a + composed.r * (1 - layer.a),
        g: layer.g * layer.a + composed.g * (1 - layer.a),
        b: layer.b * layer.a + composed.b * (1 - layer.a),
      };
    }
  }
  const bgRgb: Srgb = { r: composed.r, g: composed.g, b: composed.b, a: 1 };
  const bgRaw = `rgb(${Math.round(composed.r)}, ${Math.round(composed.g)}, ${Math.round(composed.b)})`;

  if (!fgRgb) {
    throw new Error(`assertLabelContrast: не удалось распознать цвет лейбла.\n  fg="${fgRaw}"`);
  }

  // WCAG оценивает видимую краску текста, а не RGB до применения его alpha.
  const visibleForeground: Srgb = {
    r: fgRgb.r * fgRgb.a + bgRgb.r * (1 - fgRgb.a),
    g: fgRgb.g * fgRgb.a + bgRgb.g * (1 - fgRgb.a),
    b: fgRgb.b * fgRgb.a + bgRgb.b * (1 - fgRgb.a),
    a: 1,
  };
  const ratio = contrastRatio(visibleForeground, bgRgb);
  const threshold = isLargeText ? 3.0 : 4.5;

  expect(
    ratio,
    `Контраст лейбл/поверхность: ${ratio.toFixed(2)}:1 (порог ${threshold}:1)\n  fg=${fgRaw} | bg=${bgRaw}`,
  ).toBeGreaterThanOrEqual(threshold);

  return { fg: fgRaw, bg: bgRaw, ratio, threshold };
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

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
