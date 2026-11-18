import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceArg = process.argv.indexOf('--source');
const root =
  sourceArg < 0
    ? new URL('../../../', import.meta.url)
    : pathToFileURL(`${resolve(process.argv[sourceArg + 1])}/`);
const profile = JSON.parse(
  await readFile(new URL('packages/tokens/src/components.json', root), 'utf8'),
);
const upper = (name) =>
  name
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
const kotlinString = (value) => JSON.stringify(value).replaceAll('$', '\\$');
// Authored component contours use explicit absolute commands. Reject unsupported
// input at generation time instead of parsing or silently losing it at mount.
function authoredPath(prefix, data) {
  const commands = { M: ['moveTo', 2], L: ['lineTo', 2], C: ['cubicTo', 6], Z: ['close', 0] };
  const tokens = [];
  let end = 0;
  for (const match of data.matchAll(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)) {
    if (!/^[\s,]*$/.test(data.slice(end, match.index)))
      throw new Error(`${prefix}: invalid path token at ${end}`);
    tokens.push(match[0]);
    end = match.index + match[0].length;
  }
  if (!/^[\s,]*$/.test(data.slice(end)) || tokens[0] !== 'M' || tokens.at(-1) !== 'Z')
    throw new Error(`${prefix}: expected a closed absolute path`);
  const body = [];
  for (let index = 0; index < tokens.length; ) {
    const command = tokens[index++];
    const operation = commands[command];
    if (!operation) throw new Error(`${prefix}: unsupported path command ${command}`);
    const [method, count] = operation;
    const values = tokens.slice(index, index + count).map(Number);
    if (values.length !== count || values.some((value) => !Number.isFinite(Math.fround(value))))
      throw new Error(`${prefix}: invalid operands for ${command}`);
    body.push(`        ${method}(${values.map((value) => `${value}f`).join(', ')})`);
    index += count;
  }
  return [
    '    // Shared contour: transform the canvas, never mutate this path.',
    `    val ${prefix}Path by lazy { androidx.compose.ui.graphics.Path().apply {`,
    ...body,
    '    } }',
  ];
}
const lines = [
  '// Generated from packages/tokens/src/components.json. Do not edit.',
  'package pics.lab.ui',
  '',
];
for (const [component, definition] of Object.entries(profile)) {
  if (!definition.sizes) continue;
  const properties = Object.keys(Object.values(definition.sizes)[0]);
  lines.push(
    `internal data class Lab${upper(component)}Metrics(${properties.map((key) => `val ${key}: Float`).join(', ')})`,
  );
}
lines.push(
  '',
  `public enum class LabBadgeColor(internal val role: String) { ${Object.keys(profile.badge.colors)
    .map((name) => `${upper(name)}(${kotlinString(name)})`)
    .join(', ')} }`,
);
lines.push('', 'internal object LabComponents {');
function emitConstants(prefix, definition) {
  for (const [name, value] of Object.entries(definition)) {
    if (prefix === 'Badge' && name === 'defaultColor') {
      lines.push(`    val BadgeDefaultColor = LabBadgeColor.${upper(value)}`);
      continue;
    }
    if (
      name === 'source' ||
      name === 'sourceNode' ||
      name === 'sourceRef' ||
      name === 'sizes' ||
      name === 'colors' ||
      name === 'aliases'
    )
      continue;
    if (
      name === 'data' &&
      typeof definition.viewBox === 'number' &&
      typeof definition.x === 'number' &&
      typeof definition.y === 'number'
    )
      lines.push(...authoredPath(prefix, value));
    else if (typeof value === 'number')
      lines.push(`    const val ${prefix}${upper(name)} = ${value}f`);
    else if (name === 'material' && typeof value === 'string')
      lines.push(`    val ${prefix}${upper(name)} get() = LabMaterials.${value}`);
    else if (/shadow$/i.test(name) && typeof value === 'string')
      lines.push(`    val ${prefix}${upper(name)} get() = LabShadows.${value}`);
    else if (/shadow$/i.test(name) && value === null)
      lines.push(`    val ${prefix}${upper(name)} = emptyList<LabShadowLayer>()`);
    else if (/shadow$/i.test(name) && Array.isArray(value)) {
      lines.push(`    val ${prefix}${upper(name)} = listOf(`);
      for (const layer of value) {
        lines.push(
          `        LabShadowLayer(${['x', 'y', 'blur', 'spread'].map((key) => `${layer[key]}f`).join(', ')}, ${kotlinString(layer.colorRole)}, ${layer.opacity}f),`,
        );
      }
      lines.push('    )');
    } else if (typeof value === 'string')
      lines.push(`    const val ${prefix}${upper(name)} = ${kotlinString(value)}`);
    else if (typeof value === 'boolean')
      lines.push(`    const val ${prefix}${upper(name)} = ${value}`);
    else if (Array.isArray(value) && value.every((entry) => typeof entry === 'number'))
      lines.push(
        `    val ${prefix}${upper(name)} = listOf(${value.map((entry) => `${entry}f`).join(', ')})`,
      );
    else if (value && typeof value === 'object') emitConstants(prefix + upper(name), value);
  }
}
for (const [component, definition] of Object.entries(profile)) {
  if (definition.sizes) {
    const properties = Object.keys(Object.values(definition.sizes)[0]);
    for (const [size, metrics] of Object.entries(definition.sizes)) {
      lines.push(
        `    val ${upper(component)}${size.toUpperCase()} = Lab${upper(component)}Metrics(${properties.map((key) => `${metrics[key]}f`).join(', ')})`,
      );
    }
  }
  emitConstants(upper(component), definition);
}
lines.push('}', '');
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabComponents.kt', import.meta.url);
const content = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== content)
    throw new Error('Native component metrics are stale');
} else await writeFile(output, content);
