import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
// Liquid Glass — CI integration wiring (test plan #10).
//
// The wiring contract, pinned so no suite can silently fall out of CI and no
// suite can land in a job that cannot run it:
//
//   · `test` (quality job, NO browsers installed) runs ONLY browserless Node
//     suites: the pure math unit tests and this wiring test. A browser-launching
//     suite in the browserless job is a guaranteed CI red — the original class.
//   · `test:engine` (e2e job, AFTER `playwright install`) runs the
//     browser-launching Node suites: cache/scratch integration, pending-decode
//     regression, and the Class-D mutation bite-proof.
//   · the visual gate runs via `test:e2e` (Playwright, Chromium-only), hermetic
//     against the base ref that CI resolves into LG_GATE_BASE.
//
// Failure is an explicit assertion about the broken wiring — never a bare
// import crash.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_PKG = resolve(HERE, '../../package.json');
const CI_YML = resolve(HERE, '../../../../.github/workflows/ci.yml');

test('`test` stays browserless; `test:engine` carries the browser suites', async () => {
  const pkg = JSON.parse(await readFile(DOCS_PKG, 'utf8'));
  const scripts = pkg.scripts || {};

  const testScript = scripts.test || '';
  assert.match(
    testScript,
    /lg-math\.unit|lg-ci-wiring/,
    `apps/docs \`test\` must run the browserless liquid-glass node suites, got: ${testScript}`,
  );
  assert.match(
    testScript,
    /pb-math\.unit/,
    `apps/docs \`test\` must run the browserless progressive-blur math suite, got: ${testScript}`,
  );
  const BROWSER_SUITES = ['lg-cache', 'lg-pending-decode', 'lg-mutation', 'pb-gate', 'pb-mutation'];
  for (const browserSuite of BROWSER_SUITES) {
    assert.ok(
      !testScript.includes(browserSuite),
      `\`test\` runs in the browserless quality job — ${browserSuite} launches Chromium and must live in \`test:engine\` (got: ${testScript})`,
    );
  }

  const engineScript = scripts['test:engine'] || '';
  for (const browserSuite of BROWSER_SUITES) {
    assert.match(
      engineScript,
      new RegExp(browserSuite),
      `\`test:engine\` must run ${browserSuite} (browser suites run in the e2e job after playwright install), got: ${engineScript}`,
    );
  }

  assert.match(
    scripts['test:e2e'] || '',
    /playwright/i,
    'apps/docs must keep `test:e2e` running Playwright (the hermetic gate runs there, Chromium-only)',
  );
});

test('ci.yml runs the engine suites after browser install and feeds the hermetic gate a base', async () => {
  const ci = await readFile(CI_YML, 'utf8');
  assert.match(
    ci,
    /test:engine/,
    'ci.yml must invoke `test:engine` (cache/pending/mutation suites) in the browser-equipped e2e job',
  );
  const installIdx = ci.indexOf('playwright install');
  const engineIdx = ci.indexOf('test:engine');
  assert.ok(
    installIdx !== -1 && engineIdx > installIdx,
    '`test:engine` must run AFTER `playwright install` — the suites launch Chromium',
  );
  assert.match(
    ci,
    /LG_GATE_BASE/,
    'ci.yml must resolve LG_GATE_BASE so the visual gate freezes its reference from the PR base on the CI machine itself',
  );
  // The resolve step must land BEFORE the gate consumes it: a step reordered
  // after `pnpm test:e2e` leaves the gate without a base — resolveGateBase()
  // then throws (loud red), but the wiring should not rely on the runtime guard.
  const gateBaseIdx = ci.indexOf('LG_GATE_BASE');
  const smokeIdx = ci.indexOf('pnpm test:e2e');
  assert.ok(
    smokeIdx !== -1 && gateBaseIdx < smokeIdx,
    'the LG_GATE_BASE resolve step must precede the smoke/gate run in ci.yml',
  );
  // The browserless quality job must stay browserless: no engine suites, no
  // browser installs inside it (its `pnpm test` picks up only browserless tests).
  const qualityIdx = ci.indexOf('quality:');
  const e2eJobIdx = ci.indexOf('e2e:');
  assert.ok(qualityIdx !== -1 && e2eJobIdx > qualityIdx, 'ci.yml must keep quality and e2e jobs');
  const qualityJob = ci.slice(qualityIdx, e2eJobIdx);
  assert.ok(
    !qualityJob.includes('test:engine') && !qualityJob.includes('playwright install'),
    'the quality job has no browsers — engine suites and browser installs must not appear in it',
  );
});
