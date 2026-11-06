// r5 снимает CAM16 achievedDj и старые self-reported legalFloor.
// Сохраняются реальные глубина, направление, alpha и композиция конечных красок.
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import { authoredReference } from './authored-reference.mjs';
import { composePaint, luminance } from './core-observation.mjs';
import { THEMES, readyTheme, rgba, scopes } from './labui-program-shared.mjs';
import { resolveValue } from './state-overlays-shared.mjs';

const LEVELS = ['primary', 'secondary', 'tertiary', 'quaternary'];
const FAMILIES = [
  '',
  'brand-',
  'danger-',
  'warning-',
  'success-',
  'info-',
  'static-dark-',
  'static-light-',
];
const actual = scopes(await readFile(new URL('../contract.css', import.meta.url), 'utf8'));
const reference = await authoredReference();
let engine;
beforeAll(async () => {
  engine = await createLabuiEngine();
});

describe('лестницы конечного CSS', () => {
  it.each(THEMES)('%s: фоновые тоны сохраняют направление и ненулевую глубину', (theme) => {
    const vars = actual[THEMES.indexOf(theme)];
    const tones = [1, 2, 3].map((level) =>
      luminance(rgba(resolveValue(`--lab-bg-tone-${level}`, vars)).rgb),
    );
    if (theme === 'light') {
      expect(tones[0].lower).toBeGreaterThan(tones[1].upper);
      expect(tones[1]).toEqual(tones[2]);
    } else {
      expect(tones[0].upper).toBeLessThan(tones[1].lower);
      expect(tones[1].upper).toBeLessThan(tones[2].lower);
    }
  });

  it.each(THEMES)('%s: все уровни семей сохраняют авторские RGBA и alpha-порядок', (theme) => {
    const index = THEMES.indexOf(theme);
    for (const domain of ['label', 'fill', 'border']) {
      const levels = domain === 'border' ? ['strong', 'base', 'soft'] : LEVELS;
      const families = domain === 'label' ? [...FAMILIES, 'inverted-'] : FAMILIES;
      for (const family of families) {
        const row = levels.map((level) => {
          const name = `--lab-${domain}-${family}${level}`;
          const value = rgba(resolveValue(name, actual[index]));
          expect(value, name).toEqual(rgba(resolveValue(name, reference[index])));
          return value;
        });
        for (let i = 1; i < row.length; i++)
          expect(row[i - 1].opacity).toBeGreaterThan(row[i].opacity);
      }
    }
  });

  it.each(THEMES)(
    '%s: вся fill/border эмиссия даёт тот же Core-композит, что краски владельца',
    (theme) => {
      const index = THEMES.indexOf(theme);
      const result = readyTheme(engine, theme);
      const backdrop = result.paints.get('--lab-bg-tone-1').rgb;
      for (const [name, paint] of result.paints) {
        if (!/^--lab-(fill|border)-/.test(name)) continue;
        const emitted = rgba(resolveValue(name, actual[index]));
        expect(composePaint(emitted, backdrop), name).toEqual(composePaint(paint, backdrop));
      }
    },
  );

  it('material 01/02 остаются отдельными blend-слоями с авторскими значениями', () => {
    for (const [index] of THEMES.entries()) {
      for (const [name] of reference[index]) {
        if (name.startsWith('--lab-bg-material-'))
          expect(rgba(resolveValue(name, actual[index])), name).toEqual(
            rgba(resolveValue(name, reference[index])),
          );
      }
    }
  });
});
