// Единственный численный владелец — установленный @labpics/colors.
// Все краски и конечные композиции темы читаются из одного готового снимка.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareEngineConfig } from './prepare-config.mjs';
import { compileTheme, projectTheme } from './program.mjs';

export { addBackgroundTones, compileTheme } from './program.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const notReady = (state, reason, diagnostics) => ({
  state,
  reason,
  vars: null,
  paints: null,
  diagnostics,
});

/** Поднять Program-owner с конкретными входами, не захватывая состояние темы. */
export async function createLabuiEngine({ config } = {}) {
  const input = structuredClone(
    config ?? JSON.parse(await readFile(join(here, 'labui.config.json'), 'utf8')),
  );
  const models = new Map([['normal', prepareEngineConfig(input)]]);
  const fingerprint = digest(JSON.stringify(input));
  const pkgDir = dirname(require.resolve('@labpics/colors'));
  const [owner, v1, v3, wasm, packageJson, buildJson] = await Promise.all([
    import('@labpics/colors'),
    import('@labpics/colors/program-wire/abi-v1.js'),
    import('@labpics/colors/program-wire/abi-v3.js'),
    readFile(join(pkgDir, 'pkg', 'labcolors_bg.wasm')),
    readFile(join(pkgDir, 'package.json'), 'utf8'),
    readFile(join(pkgDir, 'build-metadata.json'), 'utf8'),
  ]);
  const abi = { ...v1, ...v3 };
  await owner.default({ module_or_path: wasm });
  const metadata = {
    version: JSON.parse(packageJson).version,
    sourceSha: JSON.parse(buildJson).sourceSha,
    wasmSha256: digest(wasm),
  };
  return {
    fingerprint,
    metadata,
    resolve(theme, contrast = 'normal') {
      if (!['normal', 'more'].includes(contrast))
        throw new Error(`неизвестный режим контраста ${contrast}`);
      if (!models.has(contrast)) models.set(contrast, prepareEngineConfig(input, contrast));
      const model = models.get(contrast);
      const selected = model.themes[theme];
      if (!selected) throw new Error(`неизвестная тема ${theme}`);
      const diagnostics = {
        fingerprint,
        ...metadata,
        programs: [],
        constraints: selected.constraints,
        pending: [...selected.pending],
      };
      if (selected.pending.length)
        return notReady('blocked', selected.pending.join('; '), diagnostics);
      const { wire, slots, composites, roleCount } = compileTheme(abi, model, selected);
      const runtime = owner.compileProgramWire(wire, 1);
      let snapshot;
      try {
        snapshot = runtime.updateObserved(
          1n,
          new Uint32Array([1]),
          Uint8Array.from(model.sources[selected.background]),
          1,
        );
        diagnostics.programs.push({
          kind: 'theme',
          contrast,
          wireSha256: digest(wire),
          state: snapshot.state,
        });
        if (snapshot.state !== 'ready')
          return notReady(snapshot.state, snapshot.reason, diagnostics);
        diagnostics.programs[0].outputCount = snapshot.outputCount();
        const points = [];
        for (let i = 0; i < snapshot.outputCount(); i++) {
          points.push({
            slot: snapshot.outputSlot(i),
            source: snapshot.outputRgb(i),
            opacity: snapshot.outputOpacity(i),
          });
        }
        const presentationComposites = [];
        for (const root of new Set([...composites.values()].map(({ root }) => root))) {
          presentationComposites.push({
            root,
            scenario: 1,
            source: snapshot.presentationCompositeRgb(root, 1),
          });
        }
        const { vars, paints } = projectTheme(
          { slots, composites, roleCount },
          selected,
          points,
          presentationComposites,
        );
        return { state: 'ready', vars, paints, diagnostics };
      } finally {
        snapshot?.free();
        runtime.free();
      }
    },
  };
}
