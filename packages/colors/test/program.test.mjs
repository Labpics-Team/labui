import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeNodeColors } from '../engine.mjs';
import { themeProfile } from '../profile.mjs';
import { createThemeProgram } from '../program.mjs';

beforeAll(initializeNodeColors);

function resolved(values, name) {
  const value = values[`--lab-${name}`];
  const alias = /^var\(--lab-(.+)\)$/.exec(value);
  return alias ? resolved(values, alias[1]) : value;
}

describe('LabUI profile over the published Colors Program', () => {
  for (const theme of ['light', 'dark']) {
    it(`${theme}: preserves the authored palette, primary and white on accent`, async () => {
      const program = createThemeProgram(theme);
      try {
        const values = program.update();
        const reference = await readFile(
          new URL('../figma-reference.css', import.meta.url),
          'utf8',
        );
        const body = new RegExp(`^\\[data-theme="${theme}"\\]\\s*\\{([^}]+)`, 'm').exec(
          reference,
        )[1];
        for (const [, name, value] of body.matchAll(/--lab-([a-z0-9-]+):\s*(rgb\([^;]+\));/g)) {
          // FX recipes have a separate cumulative light/shadow contract.
          if (name.startsWith('fx-')) continue;
          expect(resolved(values, name), name).toBe(value);
        }
        expect(resolved(values, 'label-on-accent')).toBe('rgb(255 255 255)');
        expect(resolved(values, 'fill-accent')).toBe(resolved(values, 'border-brand-strong'));
      } finally {
        program.dispose();
      }
    });
  }

  it('more selects primary polarity for actual backgrounds and rejects incompatible scenarios', () => {
    const program = createThemeProgram('light', 'more');
    try {
      expect(program.update([[255, 255, 255]])['--lab-label-primary']).toBe('rgb(16 16 18)');
      expect(program.update([[0, 0, 0]])['--lab-label-primary']).toBe('rgb(246 248 250)');
      expect(() =>
        program.update([
          [0, 0, 0],
          [255, 255, 255],
        ]),
      ).toThrow(/No palette/);
      expect(program.update([[255, 255, 255]])['--lab-label-primary']).toBe('rgb(16 16 18)');
    } finally {
      program.dispose();
    }
  });

  it('rejects invalid observations before byte conversion and remains usable', () => {
    const program = createThemeProgram();
    try {
      const before = program.update();
      for (const backgrounds of [
        [],
        [[256, 0, 0]],
        [[0.5, 1, 2]],
        [[Number.NaN, 0, 0]],
        [[1, 2]],
      ]) {
        expect(() => program.update(backgrounds)).toThrow(/sRGB8/);
      }
      expect(program.update()).toEqual(before);
      program.dispose();
      expect(() => program.update()).toThrow(/disposed/);
      program.dispose();
    } finally {
      program.dispose();
    }
  });

  it('every relationship resolves, and semantic roles never depend on component roles', () => {
    for (const theme of ['light', 'dark']) {
      const profile = themeProfile(theme);
      for (const [name, value] of Object.entries(profile.roles)) {
        expect(profile.resolve(name), name).toBeDefined();
        if (!name.startsWith('badge-') && typeof value === 'string') {
          expect(value).not.toMatch(/^@badge-/);
        }
      }
    }
  });
});
