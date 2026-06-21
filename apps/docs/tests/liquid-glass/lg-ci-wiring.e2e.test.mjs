import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
// Liquid Glass — CI integration wiring (test plan #10).
//
// The unit + cache + scratch + mutation suites must run under `pnpm test`
// (= `pnpm -r --if-present test`, which only picks up a workspace package that
// HAS a `test` script), and the visual gate under `pnpm test:e2e` (Chromium,
// workers:1). This test pins that wiring contract so the suite cannot silently
// fall out of CI.
//
// THE CONTRACT UNDER TEST (ch04 must create it):
//   apps/docs/package.json gains a `test` (or `test:liquid-glass`) script that
//   runs the Node unit+cache+mutation tests, so `pnpm -r --if-present test`
//   executes them. The gate runs via the existing `test:e2e` (playwright). CI
//   (.github/workflows/ci.yml) already invokes `pnpm test` and `pnpm test:e2e`.
//
// RED until apps/docs declares the test script. Failure is an explicit assertion
// about the MISSING wiring — never a bare import crash.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_PKG = resolve(HERE, '../../package.json');

test('apps/docs declares a `test` script so `pnpm -r --if-present test` runs the suite', async () => {
  const pkg = JSON.parse(await readFile(DOCS_PKG, 'utf8'));
  const scripts = pkg.scripts || {};
  const testScript = scripts.test;
  assert.ok(
    typeof testScript === 'string' && testScript.length > 0,
    'apps/docs/package.json must declare a `test` script that runs the Node ' +
      'unit+cache+mutation liquid-glass tests (ch04 wiring) so ' +
      '`pnpm -r --if-present test` picks them up',
  );
  assert.match(
    testScript,
    /liquid-glass|lg-|tests[\\/]liquid-glass|node --test/i,
    `apps/docs \`test\` script must run the liquid-glass node suite, got: ${testScript}`,
  );

  // The gate runs via the existing Playwright `test:e2e` (Chromium-only). This is
  // a precondition the wiring must keep intact alongside the new `test` script —
  // asserted in the same test so the wiring contract passes/fails as one unit.
  assert.match(
    scripts['test:e2e'] || '',
    /playwright/i,
    'apps/docs must keep `test:e2e` running Playwright (the gate runs there, Chromium-only)',
  );
});
