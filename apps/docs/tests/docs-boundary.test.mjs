import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import test from 'node:test';

const src = new URL('../src/', import.meta.url);
const app = new URL('../', import.meta.url);

const read = (base, path) => readFile(new URL(path, base), 'utf8');

test('public docs never link browser fixtures', async () => {
  const index = await read(src, 'index.html');
  assert.doesNotMatch(index, /_fixtures\//u);
});

test('docs obtain the live color boundary through its LabUI owner', async () => {
  const pkg = JSON.parse(await read(app, 'package.json'));
  assert.equal(pkg.dependencies?.['@labpics/colors'], undefined);
  assert.equal(pkg.dependencies?.['@labui/colors'], 'workspace:*');
  const bridge = await read(src, 'colors-runtime.ts');
  assert.match(bridge, /from '@labui\/colors\/runtime'/u);
  assert.doesNotMatch(bridge, /@labpics\/colors/u);
});

test('retired live color-engine harness cannot re-enter the build graph', async () => {
  const vite = await read(app, 'vite.config.ts');
  assert.doesNotMatch(vite, /engine-live/u);
});

// Навигационные адреса остаются действительными при изменении workspace.
const rootReadme = new URL('../../../README.md', import.meta.url);
const docsRoot = new URL('../../../docs/', import.meta.url);
const packageMap = new URL('reference/packages.md', docsRoot);

async function checkLinks(markdown, base) {
  for (const [, destination] of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|mailto:)/.test(destination)) continue;
    const target = new URL(destination, base);
    const fragment = decodeURIComponent(target.hash.slice(1));
    target.hash = '';
    const info = await stat(target);
    assert.ok(info.isFile() || info.isDirectory(), `not a file or directory: ${destination}`);
    if (!fragment) continue;
    assert.ok(info.isFile() && target.pathname.endsWith('.md'), destination);
    const headings = new Set();
    const seen = new Map();
    const content = await readFile(target, 'utf8');
    for (const [, heading] of content.matchAll(/^#{1,6} +(.+?) *#*$/gm)) {
      const slug = heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .replace(/ /g, '-');
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      headings.add(count ? `${slug}-${count}` : slug);
    }
    assert.ok(headings.has(fragment), `missing heading: ${destination}`);
  }
}

async function checkCoreOwner(markdown) {
  const destination = markdown.match(/\[Core\]\(([^)]+)\)/)?.[1];
  assert.ok(destination, 'package map must identify the core owner');
  const manifest = JSON.parse(
    await readFile(new URL(`${destination}package.json`, packageMap), 'utf8'),
  );
  assert.equal(manifest.name, '@labpics/ui-core');
  assert.ok(manifest.exports?.['./ssr'], 'core must export the documented server renderer');
  assert.ok(manifest.exports?.['./*'], 'core must export component entrypoints');
}

test('documentation entrypoints link to existing local files, directories and headings', async () => {
  const documents = [
    rootReadme,
    new URL('CONTRIBUTING.md', rootReadme),
    new URL('SECURITY.md', rootReadme),
    ...(await readdir(docsRoot, { recursive: true }))
      .filter((path) => path.endsWith('.md'))
      .map((path) => new URL(path.replaceAll('\\', '/'), docsRoot)),
  ];
  for (const base of documents) await checkLinks(await readFile(base, 'utf8'), base);
});

test('package map points to the public core component and SSR owner', async () => {
  await checkCoreOwner(await readFile(packageMap, 'utf8'));
});

test('documentation checks distinguish a broken anchor and an existing wrong owner', async () => {
  const markdown = await readFile(packageMap, 'utf8');
  const readme = await readFile(rootReadme, 'utf8');
  await checkLinks(`${readme}\n[Начало работы](#начало-работы)`, rootReadme);
  await assert.rejects(
    checkLinks(`${readme}\n[Начало работы](#несуществующий-раздел)`, rootReadme),
    /missing heading/,
  );
  await assert.rejects(
    checkCoreOwner(markdown.replace('../../packages/core/', '../../packages/adapter-codegen/')),
    /@labpics\/ui-core/,
  );
});

async function checkCommands(markdown) {
  const rootManifest = JSON.parse(await readFile(new URL('package.json', rootReadme), 'utf8'));
  const docsManifest = JSON.parse(await readFile(new URL('package.json', app), 'utf8'));
  let commands = 0;
  for (const [, filter, command] of markdown.matchAll(
    /\bpnpm (?:--filter (\S+) )?([a-z][\w:-]*)/g,
  )) {
    commands++;
    const manifest = filter ? docsManifest : rootManifest;
    if (filter) assert.equal(filter, manifest.name, 'documented package must match its manifest');
    if (!filter && command === 'install') continue; // pnpm built-in, not a package script.
    assert.ok(Object.hasOwn(manifest.scripts, command), `missing documented script: ${command}`);
  }
  assert.ok(commands > 0, 'README must document runnable commands');
}

test('README commands match package names and scripts, including typo controls', async () => {
  const markdown = await readFile(rootReadme, 'utf8');
  await checkCommands(markdown);
  await assert.rejects(
    checkCommands(markdown.replace('@labpics/ui-docs dev', '@labpics/ui-docs devv')),
    /missing documented script: devv/,
  );
  await assert.rejects(
    checkCommands(markdown.replace('@labpics/ui-docs dev', '@labpics/ui-missing dev')),
    /documented package must match/,
  );
});
