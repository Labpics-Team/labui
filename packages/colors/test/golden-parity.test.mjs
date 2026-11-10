// Авторские краски сохраняют независимый reference. Единственный принятый
// вычисляемый светлый тон проверяется отдельно; основание — ../FIDELITY.md.
// White shimmer имеет собственный закон в fx-family.test.mjs.
import { describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import { RETIRED_REFERENCE_ROLES, authoredReference } from './authored-reference.mjs';
import { THEMES, readyTheme, rgba } from './labui-program-shared.mjs';
import { resolveValue } from './state-overlays-shared.mjs';

const reference = await authoredReference();
const lightToneAliases = [
  '--lab-bg-grouped-primary',
  '--lab-bg-grouped-tertiary',
  '--lab-bg-secondary',
];

describe('ordinary: точность авторского эталона', () => {
  it.each(THEMES)(
    '%s: авторские краски и остальные роли точно сохраняют reference',
    async (theme) => {
      const actual = readyTheme(await createLabuiEngine(), theme).vars;
      const expected = reference[THEMES.indexOf(theme)];
      const differences = [];
      for (const name of expected.keys()) {
        if (RETIRED_REFERENCE_ROLES.has(name) || name === '--lab-fx-skeleton-highlight') continue;
        if (theme === 'light' && lightToneAliases.includes(name)) continue;
        const a = rgba(resolveValue(name, actual));
        const b = rgba(resolveValue(name, expected));
        if (JSON.stringify(a) !== JSON.stringify(b))
          differences.push({ name, actual: a, reference: b });
      }
      expect(differences, JSON.stringify(differences)).toEqual([]);
    },
  );

  it('принятый вычисляемый Light-тон сохраняет оба baseline и ровно три общих алиаса', async () => {
    const actual = readyTheme(await createLabuiEngine(), 'light').vars;
    const tone = '--lab-bg-tone-2';
    const aliases = [...actual]
      .filter(([, value]) => value === `var(${tone})`)
      .map(([name]) => name)
      .sort();
    expect(aliases).toEqual(lightToneAliases);
    expect(rgba(resolveValue(tone, actual))).toEqual({ rgb: [248, 248, 249], opacity: 1 });
    for (const name of lightToneAliases) {
      expect(rgba(resolveValue(name, reference[0])), name).toEqual({
        rgb: [247, 248, 250],
        opacity: 1,
      });
    }
  });

  it('один паспорт даёт тот же fingerprint и полный результат', async () => {
    const first = await createLabuiEngine();
    const second = await createLabuiEngine();
    expect(first.fingerprint).toBe(second.fingerprint);
    for (const theme of THEMES)
      expect(readyTheme(first, theme).vars).toEqual(readyTheme(second, theme).vars);
  });
});
