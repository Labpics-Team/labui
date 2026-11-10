import { randomUUID } from 'node:crypto';
// CSS — проекция готовых результатов Colors и объявленных LabUI aliases.
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLabuiEngine } from './engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, 'contract.css');

function choice(axis, first, second) {
  if (first === second) return first;
  const [a, b] = axis;
  return `var(--_lab-${a}, ${first}) var(--_lab-${b}, ${second})`;
}

function renderScope(results, groups, indent = '  ') {
  const lines = [];
  const declared = new Set(Object.values(groups).flat());
  for (const result of Object.values(results)) {
    for (const name of declared) {
      if (!result.vars.has(name)) throw new Error(`Colors не выдал обязательную роль ${name}`);
    }
    for (const name of result.vars.keys()) {
      if (!declared.has(name)) throw new Error(`Colors выдал необъявленную роль ${name}`);
    }
  }
  for (const [group, names] of Object.entries(groups)) {
    if (lines.length) lines.push('');
    lines.push(`${indent}/* ${group} */`);
    for (const name of names) {
      const normal = choice(
        ['light', 'dark'],
        results.light.vars.get(name),
        results.dark.vars.get(name),
      );
      const more = choice(
        ['light', 'dark'],
        results.lightMore.vars.get(name),
        results.darkMore.vars.get(name),
      );
      lines.push(`${indent}${name}: ${choice(['normal', 'more'], normal, more)};`);
    }
  }
  return lines.join('\n');
}

/** Ни одна часть CSS не возвращается до готовности обеих тем и обоих режимов. */
export async function generateContract({ config } = {}) {
  const engine = await createLabuiEngine({ config });
  const { groups } = JSON.parse(await readFile(join(here, 'roles.json'), 'utf8'));
  const results = {
    light: engine.resolve('light'),
    dark: engine.resolve('dark'),
    lightMore: engine.resolve('light', 'more'),
    darkMore: engine.resolve('dark', 'more'),
  };
  const rejected = Object.entries(results).filter(([, result]) => result.state !== 'ready');
  if (rejected.length) {
    const error = new Error(
      rejected
        .map(
          ([theme, result]) =>
            `${theme}: ${result.state}: ${result.reason ?? 'результат не готов'}`,
        )
        .join('\n'),
    );
    error.code = 'LABUI_COLORS_NOT_READY';
    error.diagnostics = Object.fromEntries(
      rejected.map(([theme, result]) => [theme, result.diagnostics]),
    );
    throw error;
  }
  const body = renderScope(results, groups);
  return `/*
СГЕНЕРИРОВАНО — НЕ ПРАВИТЬ РУКАМИ.
Источник: @labpics/colors@${engine.metadata.version}, source ${engine.metadata.sourceSha}.
WASM SHA256: ${engine.metadata.wasmSha256}.
Авторские входы: labui.config.json, SHA256 ${engine.fingerprint}.
Краски и alpha получены из готового Program; aliases принадлежат LabUI.
Регенерация: node packages/colors/generate-contract.mjs
*/

/* Пустой маркер выключает ветку; initial выбирает fallback функции var().
   Обе оси наследуются независимо. Отсутствующий атрибут сохраняет предка,
   auto начинает новый scope от настройки ОС. */
:root, [data-theme="auto"], [data-theme="light"] {
  --_lab-light: initial;
  --_lab-dark: ;
}
[data-theme="dark"] {
  --_lab-light: ;
  --_lab-dark: initial;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]), [data-theme="auto"] {
    --_lab-light: ;
    --_lab-dark: initial;
  }
}

:root, [data-contrast="auto"], [data-contrast="normal"] {
  --_lab-normal: initial;
  --_lab-more: ;
}
[data-contrast="more"] {
  --_lab-normal: ;
  --_lab-more: initial;
}
@media (prefers-contrast: more) {
  :root:not([data-contrast="normal"]):not([data-contrast="more"]), [data-contrast="auto"] {
    --_lab-normal: ;
    --_lab-more: initial;
  }
}

/* Перевязка на обеих границах не замораживает вторую ось на предке.
   Здесь выбираются только готовые результаты Core, цветовой математики нет. */
:root, [data-theme], [data-contrast] {
  --_lab-contrast-mode: var(--_lab-normal, normal) var(--_lab-more, more);
${body}
}
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = await generateContract();
  const temporary = `${contractPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, css, { flag: 'wx' });
    await rename(temporary, contractPath);
  } finally {
    await rm(temporary, { force: true });
  }
  console.info(`contract.css сгенерирован (${Buffer.byteLength(css)} байт)`);
}
