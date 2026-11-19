import { symbol as calendar } from '@labpics/icons/symbols/calendar-number';
import { symbol } from '@labpics/icons/symbols/plus';
import { describe, expect, it } from 'vitest';
import { html, renderToString } from '../src/ssr/index.js';
import '../src/components/icon/index.js';
import {
  createTypographyScale,
  resolveTypographySize,
  typographyStyle,
} from '../src/typography.js';

describe('Icon first frame and shared typography', () => {
  it('reflects an explicit calendar instant and zone without serializing Date objects', () => {
    const date = new Date('2026-11-19T22:00:00Z');
    const output = renderToString(
      html`<lab-icon .symbol=${calendar} .date=${date} time-zone="Europe/Moscow"></lab-icon>`,
    );
    expect(output).toContain('date="2026-11-19T22:00:00.000Z"');
    expect(output).toContain('time-zone="Europe/Moscow"');
    expect(output).toContain('<svg');
    expect(output).not.toContain('coordinates');
  });
  it('renders selected imported artwork without serializing its resource packet', () => {
    const output = renderToString(
      html`<lab-icon .symbol=${symbol} state="selected" .size=${32}></lab-icon>`,
    );
    expect(output).toContain('<svg');
    expect(output).toContain('aria-hidden="true"');
    expect(output).toContain('width="32"');
    expect(output).not.toContain('&quot;symbol&quot;');
    expect(output).not.toContain('coordinates');
    expect(output.length).toBeLessThan(4000);
  });
  it('derives em and rem from the same authored text area, once', () => {
    for (const root of [16, 20, 32]) {
      const scale = createTypographyScale('headline', root);
      expect(typographyStyle(scale).fontSize).toBe(`${root * 1.25}px`);
      expect(resolveTypographySize('1em', scale)).toEqual({
        css: `${root * 1.25}px`,
        pixels: root * 1.25,
      });
      expect(resolveTypographySize('1.5rem', scale).pixels).toBe(root * 1.5);
    }
    expect(() => resolveTypographySize('1em')).toThrow('TypographyScale');
    expect(() => resolveTypographySize(0)).toThrow();
  });
});
