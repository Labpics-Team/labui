import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import * as owner from '@labpics/colors';
import * as v1 from '@labpics/colors/program-wire/abi-v1.js';
import * as v3 from '@labpics/colors/program-wire/abi-v3.js';
import { test } from 'vitest';
import config from '../labui.config.json' with { type: 'json' };
import { projectTheme } from '../program.mjs';
import { createThemeRuntime } from '../runtime.mjs';

// Real attachment and real install intents: no resolver or lifecycle double.
// Contrast oracle uses encoded-sRGB luminance directly, not Core's assessment.
const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve('@labpics/colors'));
await owner.default({ module_or_path: await readFile(join(pkg, 'pkg/labcolors_bg.wasm')) });
const contrast = (a, b) => {
  const luminance = (rgb) =>
    rgb
      .map((byte) => {
        const c = byte / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('actual Program attachment preserves inputs, replay, refusal, recovery and cleanup', async () => {
  let inputs = {
    theme: 'dark',
    contrast: 'normal',
    observation: { kind: 'observed', surface: [16, 16, 18] },
  };
  let installed = null;
  const effects = [];
  const runtime = createThemeRuntime({
    config,
    readInputs: () => inputs,
    loader: async () => ({ owner, abi: { ...v1, ...v3 } }),
    makeHost(program, selected) {
      let open = true;
      return {
        isCurrent: () => open,
        install(intent) {
          if (!open) return false;
          effects.push(intent.operation);
          if (intent.operation === 'setAll')
            installed = projectTheme(
              program,
              selected,
              intent.points,
              intent.presentationComposites,
            );
          else if (intent.operation === 'revokeAll') installed = null;
          return true;
        },
        revoke() {
          installed = null;
          effects.push('externalRevoke');
        },
        close() {
          open = false;
        },
      };
    },
  });
  try {
    const ordinary = await runtime.refresh();
    assert.equal(ordinary.state, 'ready');
    const original = installed.paints;
    assert.deepEqual(original.get('--lab-fill-accent'), { rgb: [74, 143, 255], opacity: 1 });
    const replay = await runtime.refresh();
    assert.equal(replay.revision, ordinary.revision);
    assert.equal(replay.snapshotVersion, ordinary.snapshotVersion);
    assert.ok(effects.includes('confirmExact'));
    inputs = { ...inputs, contrast: 'more' };
    assert.equal((await runtime.refresh()).state, 'ready');
    const fill = installed.paints.get('--lab-fill-accent').rgb;
    assert.ok(contrast([255, 255, 255], fill) >= 4.5);
    assert.deepEqual(installed.paints.get('--lab-label-accent').rgb, [64, 156, 255]);
    inputs = { ...inputs, observation: { kind: 'unknown', reason: 'gradient' } };
    assert.notEqual((await runtime.refresh()).state, 'ready');
    assert.equal(installed, null);
    inputs = {
      ...inputs,
      contrast: 'normal',
      observation: { kind: 'observed', surface: [0, 0, 0] },
    };
    assert.equal((await runtime.refresh()).state, 'ready');
    assert.deepEqual(installed.paints, original);
    inputs = { ...inputs, overrides: [{ name: 'label-accent', source: [255, 0, 0], opacity: 1 }] };
    assert.equal((await runtime.refresh()).state, 'ready');
    assert.deepEqual(installed.paints.get('--lab-label-accent').rgb, [255, 0, 0]);
    assert.deepEqual(installed.paints.get('--lab-fill-accent'), original.get('--lab-fill-accent'));
    runtime.cancel();
    assert.equal(installed, null);
    assert.equal((await runtime.refresh()).state, 'ready');
  } finally {
    assert.equal(runtime.dispose().state, 'disposed');
    assert.equal(installed, null);
  }
});

test('independent contrast oracle distinguishes passing and failing controls', () => {
  assert.ok(contrast([255, 255, 255], [0, 0, 0]) >= 4.5);
  assert.ok(contrast([255, 255, 255], [119, 119, 119]) < 4.5);
});
