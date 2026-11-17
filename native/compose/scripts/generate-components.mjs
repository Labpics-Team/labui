import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceArg = process.argv.indexOf('--source');
const root =
  sourceArg < 0
    ? new URL('../../../', import.meta.url)
    : pathToFileURL(`${resolve(process.argv[sourceArg + 1])}/`);
const { button } = JSON.parse(
  await readFile(new URL('packages/tokens/src/components.json', root), 'utf8'),
);
const properties = Object.keys(button.sizes.s);
const lines = [
  '// Generated from packages/tokens/src/components.json. Do not edit.',
  'package pics.lab.ui',
  '',
  `internal data class LabButtonMetrics(${properties.map((key) => `val ${key}: Float`).join(', ')})`,
  '',
  'internal object LabComponents {',
];
for (const [size, metrics] of Object.entries(button.sizes)) {
  lines.push(
    `    val Button${size.toUpperCase()} = LabButtonMetrics(${properties.map((key) => `${metrics[key]}f`).join(', ')})`,
  );
}
for (const [name, value] of Object.entries(button)) {
  if (typeof value === 'number')
    lines.push(`    const val Button${name[0].toUpperCase()}${name.slice(1)} = ${value}f`);
}
for (const [group, entries] of [
  ['Fill', button.fill],
  ['InnerShadow', button.innerShadow],
]) {
  for (const [name, value] of Object.entries(entries))
    lines.push(`    const val Button${group}${name[0].toUpperCase()}${name.slice(1)} = ${value}f`);
}
lines.push('}', '');
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabComponents.kt', import.meta.url);
const content = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== content)
    throw new Error('Native component metrics are stale');
} else await writeFile(output, content);
