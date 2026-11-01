// Измерение состава реальных оверлеев. Скаляр mud и выводы о его
// липшицевости сняты r5; никакой заменяющей численной шкалы здесь нет.
import { readFile } from 'node:fs/promises';

import {
  CONTRACT_PATH,
  REACT_BUTTON_CSS_PATH,
  THEME_SCOPE,
  TOKENS_CSS_PATH,
  expectedOverlays,
  extractOverlays,
  readStateFractions,
  resolveValue,
  scopeVars,
} from './state-overlays-shared.mjs';

const [contract, tokens, button] = await Promise.all([
  readFile(CONTRACT_PATH, 'utf8'),
  readFile(TOKENS_CSS_PATH, 'utf8'),
  readFile(REACT_BUTTON_CSS_PATH, 'utf8'),
]);
const fractions = readStateFractions(tokens);
const expected = expectedOverlays();
const actual = extractOverlays(button, 'react');
if (JSON.stringify([...actual.keys()].sort()) !== JSON.stringify([...expected.keys()].sort())) {
  throw new Error('Набор реальных state-overlays разошёлся с контрактом');
}
const roles = [...new Set([...actual.values()].map((overlay) => overlay.role))].sort();
for (const theme of ['light', 'dark']) {
  const vars = scopeVars(contract, THEME_SCOPE[theme]);
  for (const role of roles) resolveValue(role, vars);
}
console.info(
  JSON.stringify(
    {
      roles,
      fractions,
      overlays: actual.size,
      separateStateTokensAvoided: roles.length * Object.keys(fractions).length,
      scope: 'число производных токенов для реально используемых ролей; не оценка восприятия',
    },
    null,
    2,
  ),
);
