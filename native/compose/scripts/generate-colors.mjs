import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const programs = [];
const files = [];
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
    const slots = new Map(prepared.outputs.map(({ slot, name }) => [name, slot]));
    function slot(role, seen = new Set()) {
      if (slots.has(role)) return slots.get(role);
      if (seen.has(role)) throw new Error(`Cyclic Colors output alias ${role}`);
      seen.add(role);
      const value = prepared.roles[role];
      return typeof value === 'string' && value.startsWith('@') ? slot(value.slice(1), seen) : null;
    }
    const key = `${theme}${contrast}`;
    programs.push({
      key,
      background: [...prepared.background].map((value) => (value < 128 ? value : value - 256)),
      roles: [...colors.keys()].map((name) => ({ name, slot: slot(name) })),
    });
    files.push([
      new URL(`../src/commonMain/composeResources/files/colors-${key}.bin`, import.meta.url),
      prepared.bytes,
    ]);
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
files.push([output, lines.join('\n')]);
const programLines = [
  '// Generated from the same prepareThemeProgram as web. Do not edit.',
  'package pics.lab.ui',
  '',
  'import pics.lab.ui.resources.Res',
  '',
  'public suspend fun loadLabColorProgram(preferences: LabPreferences = LabPreferences()): LabPreparedColorProgram {',
  '    val key = when (preferences.appearance) {',
  '        LabAppearance.Light -> if (preferences.increasedContrast) "lightmore" else "lightnormal"',
  '        LabAppearance.Dark -> if (preferences.increasedContrast) "darkmore" else "darknormal"',
  '    }',
  '    val (background, roles) = when (key) {',
];
for (const { key, background, roles } of programs) {
  programLines.push(`        "${key}" -> byteArrayOf(${background.join(', ')}) to listOf(`);
  for (const { name, slot } of roles) {
    if (!Number.isSafeInteger(slot) || slot < 0 || slot > 2147483647)
      throw new Error(`Native role ${name} has no representable output slot`);
    programLines.push(`            LabColorRole("${name}", ${slot}),`);
  }
  programLines.push('        )');
}
programLines.push(
  '        else -> error("Unknown Lab color profile")',
  '    }',
  '    return LabPreparedColorProgram(Res.readBytes("files/colors-$key.bin"), background, roles)',
  '}',
  '',
);
files.push([
  new URL('../src/commonMain/kotlin/pics/lab/ui/LabColorPrograms.kt', import.meta.url),
  programLines.join('\n'),
]);
for (const [path, content] of files) {
  const bytes = Buffer.from(content);
  if (process.argv.includes('--check')) {
    if (!(await readFile(path)).equals(bytes))
      throw new Error(`Native Colors artifact is stale: ${path}`);
  } else {
    await mkdir(new URL('.', path), { recursive: true });
    await writeFile(path, bytes);
  }
}
