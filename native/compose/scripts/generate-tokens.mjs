import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const data = JSON.parse(
  await readFile(new URL('packages/tokens/src/generated/tokens.dtcg.json', root), 'utf8'),
);
const lines = [
  '// Generated from packages/tokens/src/generated/{tokens,motion}.dtcg.json. Do not edit.',
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
const motion = JSON.parse(
  await readFile(new URL('packages/tokens/src/generated/motion.dtcg.json', root), 'utf8'),
);
const dereference = (value) =>
  typeof value === 'string' && value.startsWith('{')
    ? value
        .slice(1, -1)
        .split('.')
        .reduce((part, key) => part[key], motion).$value
    : value;
for (const [name, role] of Object.entries(motion.motion)) {
  if (role.$type !== 'transition') continue;
  const prefix = `Motion${name[0].toUpperCase()}${name.slice(1)}`;
  const duration = dereference(role.$value.duration);
  const easing = dereference(role.$value.timingFunction);
  lines.push(`    const val ${prefix}DurationMs = ${duration.value}f`);
  easing.forEach((value, index) => lines.push(`    const val ${prefix}Ease${index} = ${value}f`));
}
lines.push('}', '', 'internal object LabTextStyles {');
for (const [name, token] of Object.entries(data.typography)) {
  const style = token.$value;
  const key = name
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  lines.push(
    `    // Figma ${token.$extensions['com.labpics.ui-tokens'].sourceNode}`,
    `    val ${key} = androidx.compose.ui.text.TextStyle(`,
    `        fontSize = ${style.fontSize.value}.sp,`,
    `        lineHeight = ${style.fontSize.value * style.lineHeight}.sp,`,
    `        fontWeight = androidx.compose.ui.text.font.FontWeight(${style.fontWeight}),`,
    `        letterSpacing = ${style.letterSpacing.value}.sp,`,
    '    )',
  );
}
lines.push('}', '');
lines.splice(2, 0, '', 'import androidx.compose.ui.unit.sp');
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabTokens.kt', import.meta.url);
const source = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== source)
    throw new Error('Native tokens are stale; run generate-tokens.mjs');
} else {
  await mkdir(fileURLToPath(new URL('./', output)), { recursive: true });
  await writeFile(output, source);
}
