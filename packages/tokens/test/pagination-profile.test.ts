import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { paginationProfile as profile } from '../src/pagination.js';

interface Measurement {
  name: string;
  size: { x: number; y: number };
  radius?: number;
  padding?: number;
  gap?: number;
  font?: { fontFamily: string; fontWeight: number; fontSize: number; lineHeightPx: number };
  children?: Measurement[];
}
const source = JSON.parse(
  readFileSync(
    new URL('../../../docs/evidence/pagination-20261119/source-measurements.json', import.meta.url),
    'utf8',
  ),
) as {
  root: { gap: number };
  pageButtons: Measurement[];
  compact: Measurement[];
};
describe('Pagination author profile', () => {
  it('preserves the authored numbered geometry and typography', () => {
    expect(profile.gap).toBe(source.root.gap);
    for (const button of source.pageButtons) {
      expect(button.size).toEqual({ x: profile.control, y: profile.control });
      expect(button.radius).toBe(profile.radius);
      expect(button.padding).toBe(profile.padding);
      const text = button.children?.find((node) => node.font);
      if (text)
        expect(text.font).toMatchObject({
          fontFamily: 'Geist',
          fontWeight: profile.fontWeight,
          fontSize: profile.fontSize,
          lineHeightPx: profile.lineHeight,
        });
    }
  });
  it('preserves compact dots, receding dots, track and ambient geometry', () => {
    for (const variant of source.compact) {
      expect(variant.size.y).toBe(profile.compact.height);
      expect(variant.padding).toBe(profile.compact.padding);
      expect(variant.gap).toBe(profile.compact.gap);
      for (const item of variant.children ?? []) {
        expect(item.size.y).toBe(profile.compact.dot);
        expect(item.size.x).toBe(
          item.name === 'Track' ? profile.compact.track : profile.compact.dot,
        );
        if (item.name === 'Dot Container')
          expect(item.children?.[0]?.size.x).toBe(profile.compact.recedingDot);
      }
    }
  });
});
