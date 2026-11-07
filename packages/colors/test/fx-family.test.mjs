// r5 сохраняет авторские glow-краски и прогрессивное наложение в реальном render.
// CAM16 bands/spread и halo/core/alpha старого DTO сняты, не эмулируются.
import { readFile } from 'node:fs/promises';
import { evaluateWcag22 } from '@labpics/colors';
import { beforeAll, describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import dictionary from '../roles.json' with { type: 'json' };
import {
  EXPECTED_FX_ROLES,
  FOCUS_FAMILIES,
  GLOW_FAMILIES,
  RETIRED_FX_ROLES,
  authoredReference,
} from './authored-reference.mjs';
import { composePaint, luminance, rgbHex } from './core-observation.mjs';
import { THEMES, readyTheme, rgba, scopes } from './labui-program-shared.mjs';
import { resolveValue } from './state-overlays-shared.mjs';

const reference = await authoredReference();
const emitted = scopes(await readFile(new URL('../contract.css', import.meta.url), 'utf8'));
let engine;
beforeAll(async () => {
  engine = await createLabuiEngine();
});

const labelName = (family) => `--lab-label-${family === 'neutral' ? '' : `${family}-`}primary`;

describe('FX: точный авторский контракт r5', () => {
  it('пять glow, шесть focus и shimmer составляют ровно 12 ролей', () => {
    expect(dictionary.groups.FX.slice().sort()).toEqual(EXPECTED_FX_ROLES);
    expect(RETIRED_FX_ROLES).toHaveLength(50);
    expect(new Set(RETIRED_FX_ROLES).size).toBe(50);
    for (const vars of emitted) {
      expect([...vars.keys()].filter((name) => name.startsWith('--lab-fx-')).sort()).toEqual(
        EXPECTED_FX_ROLES,
      );
      for (const name of RETIRED_FX_ROLES) expect(vars.has(name), name).toBe(false);
    }
  });

  it.each(THEMES)('%s: все пять glow повторяют RGB и alpha независимого reference', (theme) => {
    const { paints } = readyTheme(engine, theme);
    const index = THEMES.indexOf(theme);
    for (const family of [...GLOW_FAMILIES, 'inverted']) {
      const name = `--lab-fx-glow-${family}`;
      const expected = rgba(resolveValue(name, reference[index]));
      expect(paints.get(name), name).toEqual(expected);
      expect(rgba(resolveValue(name, emitted[index])), name).toEqual(expected);
    }
  });

  it.each([0, 1])(
    'общая glow alpha=%s доходит до четырёх красок, сохраняя inverted',
    async (alpha) => {
      const changed = structuredClone(config);
      changed.authored.glowAlpha = alpha;
      const modified = await createLabuiEngine({ config: changed });
      for (const theme of THEMES) {
        const before = readyTheme(engine, theme).paints;
        const after = readyTheme(modified, theme).paints;
        for (const family of GLOW_FAMILIES) {
          const name = `--lab-fx-glow-${family}`;
          expect(after.get(name)).toEqual({ ...before.get(name), opacity: alpha });
        }
        expect(after.get('--lab-fx-glow-inverted')).toEqual(before.get('--lab-fx-glow-inverted'));
      }
    },
  );
});

describe('FX: focus наследует выбранный Label', () => {
  it.each(THEMES)('%s: шесть focus-пар сохраняют цвет и contrast assessment эталона', (theme) => {
    const { paints, vars } = readyTheme(engine, theme);
    const expected = reference[THEMES.indexOf(theme)];
    const bg = paints.get('--lab-bg-tone-1').rgb;
    for (const family of FOCUS_FAMILIES) {
      const focus = `--lab-fx-focus-ring-${family}`;
      const label = labelName(family);
      expect(vars.get(focus)).toBe(`var(${label})`);
      expect(paints.get(focus)).toEqual(paints.get(label));
      const actualRgb = composePaint(paints.get(focus), bg);
      const expectedRgb = composePaint(rgba(resolveValue(label, expected)), bg);
      expect(
        evaluateWcag22(rgbHex(actualRgb), rgbHex(bg), 'sc-1.4.11-ui-component-or-state').decision,
      ).toBe(
        evaluateWcag22(rgbHex(expectedRgb), rgbHex(bg), 'sc-1.4.11-ui-component-or-state').decision,
      );
    }
  });
});

describe('FX: shimmer светлее resting', () => {
  it.each(THEMES)(
    '%s: белый shimmer делит alpha с fill-quaternary и осветляет композит',
    (theme) => {
      const { paints } = readyTheme(engine, theme);
      const base = paints.get('--lab-fill-quaternary');
      const highlight = paints.get('--lab-fx-skeleton-highlight');
      const bg = paints.get('--lab-bg-tone-1').rgb;
      expect(highlight).toEqual({ rgb: [255, 255, 255], opacity: base.opacity });
      expect(luminance(composePaint(highlight, bg)).lower).toBeGreaterThan(
        luminance(composePaint(base, bg)).upper,
      );
      expect(paints.has('--lab-fx-skeleton-base')).toBe(false);
    },
  );
});
