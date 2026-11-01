// Ordinary: тонкие подложки и текст сохраняют авторский результат. Численная
// композиция принадлежит Core; доступность IC требует отдельного actual render.
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

import { createLabuiEngine } from '../engine.mjs';
import { authoredReference } from './authored-reference.mjs';
import { pairPixels } from './core-observation.mjs';
import { THEMES, rgba, scopes } from './labui-program-shared.mjs';
import { PAIRS_ON_BG, PAIRS_TINTED, resolveValue } from './state-overlays-shared.mjs';

const actual = scopes(await readFile(new URL('../contract.css', import.meta.url), 'utf8'));
const reference = await authoredReference();
beforeAll(async () => {
  await createLabuiEngine();
});
const pixels = (vars, surface, text) =>
  pairPixels(
    rgba(resolveValue(surface, vars)),
    rgba(resolveValue(text, vars)),
    rgba(resolveValue('--lab-bg-primary', vars)).rgb,
  );

describe('ordinary: акцент на подложках', () => {
  for (const [index, theme] of THEMES.entries()) {
    it.each([...PAIRS_TINTED, ...PAIRS_ON_BG])(`${theme}: %s × %s`, (surface, text) => {
      expect(pixels(actual[index], surface, text)).toEqual(pixels(reference[index], surface, text));
    });
  }
});
