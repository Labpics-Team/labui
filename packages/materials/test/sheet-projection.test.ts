import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('../src/profiles/sheet');
  vi.resetModules();
});

it('a changed shared Solid role reaches the distributed CSS without a second declaration', async () => {
  vi.doMock('../src/profiles/sheet', () => ({ SHEET_SOLID: '--lab-test-sheet-surface' }));
  const { readMaterialCss } = await import('../scripts/material-css');
  const block = readMaterialCss().match(/\.lab-material--sheet\s*\{([^}]+)\}/)?.[1];
  expect(block).toContain('--_base: var(--lab-test-sheet-surface)');
  expect(block).not.toContain('--lab-bg-grouped-secondary');
});
