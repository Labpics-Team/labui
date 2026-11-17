import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const data = JSON.parse(
  await readFile(new URL('packages/tokens/src/generated/tokens.dtcg.json', root), 'utf8'),
);
const lines = [
  '// Generated from packages/tokens/src/generated/tokens.dtcg.json. Do not edit.',
  'package pics.lab.ui',
  '',
  'internal object LabTokens {',
];
for (const [group, entries] of Object.entries(data)) {
  for (const [name, token] of Object.entries(entries)) {
    const value = token.$type === 'dimension' ? token.$value.value : token.$value;
    if (typeof value !== 'number') continue;
    const key = `${group}-${name}`
      .split('-')
      .map((x) => x[0].toUpperCase() + x.slice(1))
      .join('');
    lines.push(`    const val ${key}: Float = ${value}f`);
  }
}
lines.push('}', '');
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabTokens.kt', import.meta.url);
const source = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== source)
    throw new Error('Native tokens are stale; run generate-tokens.mjs');
} else {
  await mkdir(fileURLToPath(new URL('./', output)), { recursive: true });
  await writeFile(output, source);
}
