import { describe, expect, it } from 'vitest';
import { generateShadowCss } from '../src/generate-css.js';

// Независимые значения read-only эталона: design-baseline.md, 1 ноября 2026.
describe('Button inset: направление и тематический paint', () => {
  const css = generateShadowCss();
  for (const [selector, alpha] of [
    [':root', 12],
    ['[data-theme="light"]', 12],
    ['[data-theme="dark"]', 20],
    [':root:not([data-theme="light"])', 20],
  ] as const) {
    it(`${selector} публикует оба полных значения с alpha ${alpha}%`, () => {
      const start = css.indexOf(`${selector} {`);
      expect(start).toBeGreaterThanOrEqual(0);
      const block = css.slice(start, css.indexOf('}', start));
      const paint = `color-mix(in srgb, var(--lab-bg-static-dark) ${alpha}%, transparent)`;
      expect(block).toContain(`--lab-shadow-button: inset 0 -0.0625rem 0.0625rem 0 ${paint};`);
      expect(block).toContain(
        `--lab-shadow-button-pressed: inset 0 0.0625rem 0.0625rem 0 ${paint};`,
      );
    });
  }
});
