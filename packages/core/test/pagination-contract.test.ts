import { describe, expect, it } from 'vitest';
import {
  compactPages,
  paginationCount,
  paginationPage,
  paginationPageSize,
  paginationSiblings,
} from '../src/components/pagination/contract.js';

describe('pagination input boundary', () => {
  it('bounds range work even for hostile numeric input', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5, Number.MAX_VALUE])
      expect(paginationCount(value)).toBe(0);
    expect(paginationPageSize(0)).toBe(10);
    expect(paginationSiblings(Number.MAX_SAFE_INTEGER)).toBe(4);
    for (const total of [0, 1, 2, 5, 6, 20, Number.MAX_SAFE_INTEGER]) {
      for (const input of [0, 1, total / 2, total, total + 1, Number.NaN]) {
        const current = paginationPage(input, total);
        const pages = compactPages(current, total);
        expect(pages.length).toBeLessThanOrEqual(5);
        if (total > 0) {
          expect(pages).toContain(current);
          expect(
            pages.every((page) => Number.isSafeInteger(page) && page >= 1 && page <= total),
          ).toBe(true);
        }
      }
    }
  });
});
