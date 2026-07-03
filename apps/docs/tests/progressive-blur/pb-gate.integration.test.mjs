import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Progressive blur — physical gate (integration, launches Chromium).
//
// The harness renders a two-scale contrast pattern behind the surface and
// measures the blur profile off screenshots; this test pins that EVERY check
// of the suite holds on the committed engine. Runs in `test:engine` (the
// browser-equipped e2e job) — never in the browserless quality job.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/progressive-blur/pb-harness.mjs');

const CHECKS = [
  'strong-end-attenuation',
  'monotone-profile',
  'no-banding-cliff',
  'cumulative-blur-at-strong-end',
  'feather-fades-present',
  'ladder-dense-enough',
  'strips-stay-tight',
  'easing-bends-profile',
  'multi-stop-valley',
  'axis-follows-points',
  'deterministic',
  'reduced-transparency-honest',
];

test('progressive blur passes the full physical gate', async () => {
  const harness = await import(`file://${HARNESS}`);
  assert.equal(typeof harness.runPbSuite, 'function', 'pb-harness must export runPbSuite()');
  const { pass, checks } = await harness.runPbSuite();
  for (const name of CHECKS) {
    assert.ok(checks[name], `check '${name}' must be present in the suite`);
    assert.equal(checks[name].pass, true, `${name}: ${checks[name].detail}`);
  }
  assert.equal(pass, true, 'every physical check must pass');
});
