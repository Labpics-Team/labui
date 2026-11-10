import { expect } from 'vitest';

import { scopeVars, themeVars } from './state-overlays-shared.mjs';

export const THEMES = ['light', 'dark'];

export function readyTheme(engine, theme) {
  const result = engine.resolve(theme);
  expect(result.state, `${theme}: ${result.reason ?? JSON.stringify(result.diagnostics)}`).toBe(
    'ready',
  );
  expect(result.vars).toBeInstanceOf(Map);
  expect(result.paints).toBeInstanceOf(Map);
  return result;
}

// Разбор конечного формата CSS, без преобразования цветового пространства.
export function rgba(value) {
  const hex = /^#([\da-f]{6})$/i.exec(value);
  if (hex)
    return { rgb: [0, 2, 4].map((i) => Number.parseInt(hex[1].slice(i, i + 2), 16)), opacity: 1 };
  const rgb = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(value);
  if (!rgb) throw new Error(`Ожидался конечный sRGB8/opacity: ${value}`);
  return { rgb: rgb.slice(1, 4).map(Number), opacity: rgb[4] === undefined ? 1 : Number(rgb[4]) };
}

export function scopes(css) {
  if (css.includes('--_lab-normal'))
    return [themeVars(css, 'light'), themeVars(css, 'dark'), themeVars(css, 'dark')];
  return [
    /^:root,\s*\r?\n\[data-theme="light"\]\s*\{/m,
    /^\[data-theme="dark"\]\s*\{/m,
    /:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\)\s*\{/,
  ].map((selector) => scopeVars(css, selector));
}
