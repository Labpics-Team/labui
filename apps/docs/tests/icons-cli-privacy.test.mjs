import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('отказ CLI сохраняет код и commitment без сырых argv и stack', () => {
  for (const file of ['icons-packed.mjs', 'prepare-icons-inputs.mjs']) {
    const privateArgument = 'https://www.figma.com/design/PrivateFixtureFile?node-id=900%3A19';
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL(file, import.meta.url)), '--private', privateArgument],
      {
        encoding: 'utf8',
        timeout: 5000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    const prefix = 'LABUI_ICONS_CONSUMER_ERROR ';
    assert.ok(result.stderr.startsWith(prefix));
    const failure = JSON.parse(result.stderr.slice(prefix.length));
    assert.deepEqual(Object.keys(failure).sort(), ['code', 'diagnosticSha256', 'name']);
    assert.match(failure.diagnosticSha256, /^[a-f0-9]{64}$/);
    assert.ok(['ERR_ASSERTION', 'ERROR'].includes(failure.code));
    assert.doesNotMatch(result.stderr, /PrivateFixtureFile|node-id|900|stack|file:\/\//);
  }
});
