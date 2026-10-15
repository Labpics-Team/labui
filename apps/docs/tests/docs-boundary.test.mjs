import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const src = new URL('../src/', import.meta.url);
const app = new URL('../', import.meta.url);

const read = (base, path) => readFile(new URL(path, base), 'utf8');

test('public docs never link browser fixtures', async () => {
  const index = await read(src, 'index.html');
  assert.doesNotMatch(index, /_fixtures\//u);
});

test('docs do not depend on the Lab Colors runtime engine', async () => {
  const pkg = JSON.parse(await read(app, 'package.json'));
  assert.equal(pkg.dependencies?.['@labpics/colors'], undefined);
  assert.equal(pkg.dependencies?.['@labui/colors'], 'workspace:*');
});

test('retired live color-engine harness cannot re-enter the build graph', async () => {
  const vite = await read(app, 'vite.config.ts');
  assert.doesNotMatch(vite, /engine-live/u);
});

// Навигационные адреса остаются действительными при изменении workspace.
test('documentation entrypoints link to existing local files and directories', async () => {
  for (const doc of ['../../../README.md', '../../../docs/README.md']) {
    const base = new URL(doc, import.meta.url);
    const markdown = await readFile(base, 'utf8');
    for (const [, destination] of markdown.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|#|mailto:)/.test(destination)) continue;
      const path = destination.split('#', 1)[0];
      if (!path) continue;
      const target = new URL(path, base);
      const info = await stat(target);
      assert.ok(info.isFile() || info.isDirectory(), `not a file or directory: ${destination}`);
    }
  }
});
