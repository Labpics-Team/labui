import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('new docs and Icons contracts reach their native jobs and propagate failures', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'labui-node-discovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const runner = join(root, 'run-node-tests.mjs');
  copyFileSync(new URL('./run-node-tests.mjs', import.meta.url), runner);
  mkdirSync(join(root, 'nested'));
  const docs = 'nested/catalogue-links.test.mjs';
  const icons = 'nested/icons-input.test.mjs';
  const prepare = 'prepare-icons-inputs-extra.test.mjs';
  const terminal = 'icons-public-terminal.test.mjs';
  for (const file of [docs, icons, prepare, terminal]) {
    writeFileSync(
      join(root, file),
      `
      import assert from 'node:assert/strict';
      import test from 'node:test';
      test(${JSON.stringify(`ran ${file}`)}, () => assert.notEqual(process.env.FAIL_FILE, ${JSON.stringify(file)}));
    `,
    );
  }

  function check(scope, failedFile, expectedStatus, ...options) {
    const env = { ...process.env, NODE_TEST_CONTEXT: undefined, FAIL_FILE: failedFile };
    const result = spawnSync(process.execPath, [runner, scope, ...options], {
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
    return result.stdout;
  }
  const docsRun = check('docs', docs, 1);
  const iconsRun = check('icons', terminal, 1);
  for (const file of [docs, icons, prepare, terminal]) {
    assert.equal(docsRun.includes(`ran ${file}`), file === docs || file === terminal);
    assert.equal(iconsRun.includes(`ran ${file}`), file !== docs);
  }
  check('docs', docs, 0, '--test-name-pattern=another property');
  unlinkSync(join(root, docs));
  check('docs', '', 1);
  unlinkSync(join(root, icons));
  unlinkSync(join(root, prepare));
  check('icons', '', 1);
  unlinkSync(join(root, terminal));
  writeFileSync(join(root, icons), '');
  check('icons', '', 1);
});
