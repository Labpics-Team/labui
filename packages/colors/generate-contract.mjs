import { randomUUID } from 'node:crypto';
// CSS — проекция готовых результатов Colors и объявленных LabUI aliases.
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLabuiEngine } from './engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, 'contract.css');

function renderScope(result, groups, indent = '  ') {
  const lines = [];
  const declared = new Set(Object.values(groups).flat());
  for (const name of declared) {
    if (!result.vars.has(name)) throw new Error(`Colors не выдал обязательную роль ${name}`);
  }
  for (const name of result.vars.keys()) {
    if (!declared.has(name)) throw new Error(`Colors выдал необъявленную роль ${name}`);
  }
  for (const [group, names] of Object.entries(groups)) {
    if (lines.length) lines.push('');
    lines.push(`${indent}/* ${group} */`);
    for (const name of names) lines.push(`${indent}${name}: ${result.vars.get(name)};`);
  }
  return lines.join('\n');
}

/** Ни одна часть CSS не возвращается до готовности полного набора обеих тем. */
export async function generateContract({ config } = {}) {
  const engine = await createLabuiEngine({ config });
  const { groups } = JSON.parse(await readFile(join(here, 'roles.json'), 'utf8'));
  const light = engine.resolve('light');
  const dark = engine.resolve('dark');
  const rejected = Object.entries({ light, dark }).filter(([, result]) => result.state !== 'ready');
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
  const lightBody = renderScope(light, groups);
  const darkBody = renderScope(dark, groups);
  const systemDarkBody = renderScope(dark, groups, '    ');
  return `/*
СГЕНЕРИРОВАНО — НЕ ПРАВИТЬ РУКАМИ.
Источник: @labpics/colors@${engine.metadata.version}, source ${engine.metadata.sourceSha}.
WASM SHA256: ${engine.metadata.wasmSha256}.
Авторские входы: labui.config.json, SHA256 ${engine.fingerprint}.
Краски и alpha получены из готового Program; aliases принадлежат LabUI.
Регенерация: node packages/colors/generate-contract.mjs
*/

:root,
[data-theme="light"] {
${lightBody}
}

[data-theme="dark"] {
${darkBody}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not([data-theme="dark"]) {
${systemDarkBody}
  }
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
