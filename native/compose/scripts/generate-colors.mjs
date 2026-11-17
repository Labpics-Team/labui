import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceArg = process.argv.indexOf('--source');
const source =
  sourceArg < 0
    ? new URL('../../../', import.meta.url)
    : pathToFileURL(`${resolve(process.argv[sourceArg + 1])}/`);
const { initializeNodeColors } = await import(new URL('packages/colors/engine.mjs', source));
const { prepareThemeProgram } = await import(new URL('packages/colors/program-source.mjs', source));
const require = createRequire(new URL('packages/colors/program-source.mjs', source));
const { compileProgramWire } = await import(pathToFileURL(require.resolve('@labpics/colors')));
await initializeNodeColors();
const lines = [
  '// Generated using the public Colors Program outputs. Do not edit.',
  'package pics.lab.ui',
  '',
  'import androidx.compose.ui.graphics.Color',
  '',
  'internal object LabInitialColors {',
];
for (const theme of ['light', 'dark']) {
  for (const contrast of ['normal', 'more']) {
    const prepared = prepareThemeProgram(theme, contrast);
    const program = compileProgramWire(prepared.bytes, 1);
    const colors = new Map();
    const snapshot = program.updateObserved(
      1n,
      Uint32Array.of(1),
      Uint8Array.from(prepared.background),
      1,
    );
    try {
      if (snapshot.state !== 'ready')
        throw new Error(`Baseline Colors output is ${snapshot.state}`);
      const names = new Map(prepared.outputs.map(({ slot, name }) => [slot, name]));
      for (let index = 0; index < snapshot.outputCount(); index++) {
        const name = names.get(snapshot.outputSlot(index));
        if (!name) throw new Error('Unknown Colors output slot');
        const rgb = snapshot.outputRgb(index);
        const opacity = snapshot.outputOpacity(index);
        colors.set(
          name,
          `Color(${rgb[0]} / 255f, ${rgb[1]} / 255f, ${rgb[2]} / 255f, ${opacity}f)`,
        );
      }
    } finally {
      snapshot.free();
      program.free();
    }
    function color(role, seen = new Set()) {
      if (colors.has(role)) return colors.get(role);
      if (seen.has(role)) throw new Error(`Cyclic Colors output alias ${role}`);
      seen.add(role);
      const value = prepared.roles[role];
      if (typeof value === 'string' && value.startsWith('@')) return color(value.slice(1), seen);
      return null;
    }
    for (const role of Object.keys(prepared.roles)) {
      const resolved = color(role);
      if (resolved) colors.set(role, resolved);
    }
    lines.push(`    val ${theme}${contrast} = LabColorOutput(mapOf(`);
    for (const [role, value] of colors) lines.push(`        "${role}" to ${value},`);
    lines.push('    ))');
  }
}
lines.push(
  '}',
  '',
  'public fun initialLabColors(preferences: LabPreferences = LabPreferences()): LabColorOutput =',
  '    when (preferences.appearance) {',
  '        LabAppearance.Light -> if (preferences.increasedContrast) LabInitialColors.lightmore else LabInitialColors.lightnormal',
  '        LabAppearance.Dark -> if (preferences.increasedContrast) LabInitialColors.darkmore else LabInitialColors.darknormal',
  '    }',
  '',
);
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabInitialColors.kt', import.meta.url);
const content = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== content)
    throw new Error('Native baseline Colors outputs are stale');
} else await writeFile(output, content);
