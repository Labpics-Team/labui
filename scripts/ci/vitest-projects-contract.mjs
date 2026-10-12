import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

function testFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return entry.isFile() && entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

function normalize(records) {
  return records.map(({ file, projectName }) => `${file}:${projectName}`).sort();
}

for (const name of ['vue', 'solid', 'svelte', 'astro']) {
  test(`${name}: actual Vitest projects preserve every Node and DOM test`, (t) => {
    const directory = join(root, 'packages', name);
    const manifest = require.resolve('vitest/package.json', { paths: [directory] });
    assert.equal(JSON.parse(readFileSync(manifest, 'utf8')).version, '4.1.11');
    const work = mkdtempSync(join(tmpdir(), 'labui-vitest-projects-'));
    t.after(() => rmSync(work, { recursive: true, force: true }));
    const report = join(work, 'files.json');
    execFileSync(
      process.execPath,
      [join(dirname(manifest), 'vitest.mjs'), 'list', '--filesOnly', '--json', report],
      { cwd: directory, env: { ...process.env, CI: 'true' }, timeout: 90_000 },
    );
    const expected = testFiles(join(directory, 'test')).map((file) => ({
      file,
      projectName: (
        name === 'astro'
          ? file.replaceAll('\\', '/').endsWith('/hydration.test.ts')
          : /\/(?:mount|coverage)\.test\.ts$/.test(file.replaceAll('\\', '/'))
      )
        ? 'dom'
        : 'node',
    }));
    assert.ok(expected.some(({ projectName }) => projectName === 'node'));
    assert.ok(expected.some(({ projectName }) => projectName === 'dom'));
    const actual = JSON.parse(readFileSync(report, 'utf8')).map(({ file, projectName }) => ({
      file: join(directory, relative(directory, file)),
      projectName,
    }));
    assert.deepEqual(normalize(actual), normalize(expected));
    assert.throws(() => assert.deepEqual(normalize(actual.slice(1)), normalize(expected)));
    const wrongEnvironment = actual.map((entry) => ({ ...entry, projectName: 'node' }));
    assert.throws(() => assert.deepEqual(normalize(wrongEnvironment), normalize(expected)));
  });
}
