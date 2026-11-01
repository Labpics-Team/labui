// Скаляр muddiness прежнего движка снят в r5. Здесь сохраняется предметная
// защита обычных состояний: неизменные авторские входы и общие 8/14%.
// Этот тест не называет другую метрику эквивалентом прежнего mud.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { authoredReference } from './authored-reference.mjs';
import { THEMES, rgba, scopes } from './labui-program-shared.mjs';
import {
  CONTRACT_PATH,
  INK_ROLE,
  REST_ROLES,
  TOKENS_CSS_PATH,
  readStateFractions,
  resolveValue,
} from './state-overlays-shared.mjs';

const actual = scopes(await readFile(CONTRACT_PATH, 'utf8'));
const reference = await authoredReference();
const fractions = readStateFractions(await readFile(TOKENS_CSS_PATH, 'utf8'));
const used = [
  ...new Set([INK_ROLE, ...Object.values(REST_ROLES).flatMap((props) => Object.values(props))]),
].sort();

describe('обычные состояния: авторская основа вместо снятого mud-score', () => {
  it('обе общие фракции состояния сохранены', () => {
    expect(fractions).toEqual({ hover: 0.08, pressed: 0.14 });
  });

  it.each(THEMES)('%s: каждый вход реальных state-overlays совпадает с reference', (theme) => {
    const index = THEMES.indexOf(theme);
    expect(used).toContain('--lab-fill-accent');
    expect(used).toContain('--lab-label-primary');
    for (const name of used)
      expect(rgba(resolveValue(name, actual[index])), name).toEqual(
        rgba(resolveValue(name, reference[index])),
      );
  });

  it('отсутствующий state-token отвергается, а не превращается в нулевой эффект', () => {
    expect(() => readStateFractions('--lab-state-hover: 8%;')).toThrow(/pressed/);
    expect(() => readStateFractions('--lab-state-pressed: 14%;')).toThrow(/hover/);
  });
});
