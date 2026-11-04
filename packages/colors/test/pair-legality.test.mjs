// Обычный режим сохраняет авторскую пару. Прежний всеобщий ordinary AA4.5
// отозван прямым выбором пользователя; IC проверяется на actual render отдельно.
import { readFile } from 'node:fs/promises';
import { evaluateWcag22 } from '@labpics/colors';
import { beforeAll, describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import { authoredReference } from './authored-reference.mjs';
import { pairPixels, rgbHex } from './core-observation.mjs';
import { THEMES, readyTheme, rgba, scopes } from './labui-program-shared.mjs';
import { PAIRS_FILL, resolveValue } from './state-overlays-shared.mjs';

const actual = scopes(await readFile(new URL('../contract.css', import.meta.url), 'utf8'));
const reference = await authoredReference();
beforeAll(async () => {
  await createLabuiEngine();
});
const pixels = (vars, fill, label) =>
  pairPixels(
    rgba(resolveValue(fill, vars)),
    rgba(resolveValue(label, vars)),
    rgba(resolveValue('--lab-bg-primary', vars)).rgb,
  );

describe('ordinary: несущие текст поверхности сохраняют эталон', () => {
  for (const [index, theme] of THEMES.entries()) {
    it.each(PAIRS_FILL)(`${theme}: %s × %s`, (fill, label) => {
      const observed = pixels(actual[index], fill, label);
      const expected = pixels(reference[index], fill, label);
      expect(observed).toEqual(expected);
      const assessment = (pair) =>
        evaluateWcag22(rgbHex(pair.foreground), rgbHex(pair.background), 'sc-1.4.3-text-default')
          .decision;
      expect(assessment(observed)).toBe(assessment(expected));
    });
  }

  it('AA oracle различает стороны границы, ordinary не выдаётся за IC', () => {
    expect(evaluateWcag22('#777777', '#FFFFFF', 'sc-1.4.3-text-default').decision).toBe('fail');
    expect(evaluateWcag22('#000000', '#FFFFFF', 'sc-1.4.3-text-default').decision).toBe('pass');
  });

  it('strict не публикует обычные авторские краски при несовместимом AA', async () => {
    const ordinary = await createLabuiEngine();
    const strictInput = structuredClone(config);
    strictInput.policy.contrast = 'strict';
    const strict = await createLabuiEngine({ config: strictInput });
    for (const theme of THEMES) {
      readyTheme(ordinary, theme);
      const result = strict.resolve(theme);
      expect(result.state).toBe('failed');
      expect(result.vars).toBeNull();
      expect(result.paints).toBeNull();
    }
    // Это проверка явного отказа Core, не приёмка будущего increased-contrast UI.
  });
});
