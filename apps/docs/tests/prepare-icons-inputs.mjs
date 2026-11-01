import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateSubject } from './icons-packed.mjs';

const PIN = new URL('./icons-consumer-source.json', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const outside = (path) => path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
const git = (root, args) =>
  execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, timeout: 20_000 });

export function validateSourcePin(pin) {
  assert.deepEqual(Object.keys(pin).sort(), [
    'figma',
    'repository',
    'schemaVersion',
    'sourceCommit',
  ]);
  assert.equal(pin.schemaVersion, 1);
  assert.equal(pin.repository, 'Labpics-Team/lab-icons');
  assert.match(pin.sourceCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(pin.figma).sort(), ['fileKey', 'version']);
  assert.match(pin.figma.fileKey, /^[A-Za-z0-9]+$/);
  assert.match(pin.figma.version, /^\d+$/);
  return pin;
}

export function assertCheckout(root, expected) {
  assert.match(expected, /^[a-f0-9]{40}$/);
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), expected);
  assert.equal(git(root, ['status', '--porcelain', '--untracked-files=no']).toString(), '');
}

async function sourceFile(root, commit, file) {
  const bytes = await readFile(join(root, file));
  assert.deepEqual(bytes, git(root, ['show', `${commit}:${file}`]), `изменён источник: ${file}`);
  return { file, sha256: hash(bytes), bytes: bytes.length };
}

// Проверяется raw master и owner-аннотация. Packed glyph/effect не читаются.
export async function authorReference(iconsRoot, pin) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const annotations = JSON.parse(await readFile(join(iconsRoot, 'semantics/author-anatomy.json')));
  const { loadAuthorBaseline } = await import(
    pathToFileURL(join(iconsRoot, 'scripts/lib/author-baseline.js'))
  );
  const { compileAuthorAnatomy } = await import(
    pathToFileURL(join(iconsRoot, 'scripts/lib/author-anatomy.js'))
  );
  const { authorPathEntries } = await import(
    pathToFileURL(join(iconsRoot, 'src/core/icon-geometry.js'))
  );
  const baseline = loadAuthorBaseline(iconsRoot, {
    manifest: {
      ...manifest,
      counts: { families: 1, variants: 2 },
      icons: { reload: manifest.icons.reload },
    },
  });
  const anatomy = compileAuthorAnatomy(baseline, {
    ...annotations,
    icons: { reload: annotations.icons.reload },
  });
  const variants = {};
  for (const variant of ['outline', 'filled']) {
    const record = baseline.icons.reload[variant];
    const contract = anatomy[`reload/${variant}`];
    const paths = authorPathEntries(record.normalizedSvg);
    variants[variant] = {
      sourceFile: record.master,
      author: record.author,
      anatomy: contract.anatomy,
      viewBox: record.normalizedSvg
        .match(/\bviewBox="([^"]+)"/)[1]
        .trim()
        .split(/\s+/)
        .map(Number),
      paths: paths.map(({ d, fillRule }) => ({ d, fillRule })),
      parts: contract.parts.map((part, index) => ({
        id: part.id,
        role: part.role,
        zIndex: part.zIndex,
        d: paths[index].d,
        fillRule: paths[index].fillRule,
      })),
      gesture: contract.gestures.find((gesture) => gesture.id === 'reload.cycle'),
    };
  }
  return {
    fileName: manifest.source.name,
    fileKey: manifest.source.fileKey,
    version: manifest.source.version,
    icons: { reload: variants },
  };
}

export async function prepareInputs(options) {
  const pin = validateSourcePin(JSON.parse(await readFile(PIN)));
  const iconsRoot = await realpath(resolve(options.get('--icons-source')));
  const uiRoot = await realpath(resolve(options.get('--ui-source')));
  const uiCommit = options.get('--ui-commit');
  assertCheckout(iconsRoot, pin.sourceCommit);
  assertCheckout(uiRoot, uiCommit);
  const out = resolve(options.get('--out'));
  const parent = await realpath(dirname(out));
  for (const root of [iconsRoot, uiRoot]) {
    assert.ok(outside(relative(root, parent)), 'Inputs должны находиться вне source checkout');
  }
  const packages = {};
  const files = [];
  for (const [key, option, root, commit, file] of [
    ['icons', '--icons-tarball', iconsRoot, pin.sourceCommit, 'package.json'],
    ['uiCore', '--ui-core-tarball', uiRoot, uiCommit, 'packages/core/package.json'],
    ['uiShadow', '--ui-shadow-tarball', uiRoot, uiCommit, 'packages/shadow/package.json'],
  ]) {
    files.push({
      repository: key === 'icons' ? pin.repository : 'Labpics-Team/labui',
      ...(await sourceFile(root, commit, file)),
    });
    const pkg = JSON.parse(await readFile(join(root, file)));
    const archive = await readFile(resolve(options.get(option)));
    packages[key] = {
      name: pkg.name,
      version: pkg.version,
      archiveSha256: hash(archive),
      archiveBytes: archive.length,
      sourceCommit: commit,
    };
  }
  const reference = await authorReference(iconsRoot, pin);
  for (const file of [
    'semantics/figma-baseline.json',
    'semantics/author-anatomy.json',
    ...Object.values(reference.icons.reload).map((item) => item.sourceFile),
  ]) {
    files.push({
      repository: pin.repository,
      ...(await sourceFile(iconsRoot, pin.sourceCommit, file)),
    });
  }
  const subject = validateSubject({ schemaVersion: 1, packages, authorReference: reference });
  assertCheckout(iconsRoot, pin.sourceCommit);
  assertCheckout(uiRoot, uiCommit);
  await mkdir(out, { recursive: false, mode: 0o700 });
  const bytes = `${JSON.stringify(subject, null, 2)}\n`;
  await writeFile(join(out, 'subject.json'), bytes, { flag: 'wx', mode: 0o600 });
  await writeFile(
    join(out, 'source-receipt.json'),
    `${JSON.stringify({ schemaVersion: 1, pin, uiCommit, subjectSha256: hash(bytes), files }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  process.stdout.write(
    `icons-inputs: ${JSON.stringify({ subjectSha256: hash(bytes), packages })}\n`,
  );
}

// Контракт Lab UI сохраняет диагностику локально; Actions storage не участвует.
export async function summarize(directory) {
  const root = await realpath(resolve(directory));
  const files = [];
  for (const name of ['inputs', 'result']) {
    for (const entry of await readdir(join(root, name), { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:json|png)$/.test(entry.name)) continue;
      const path = `${name}/${entry.name}`;
      const bytes = await readFile(join(root, path));
      files.push({ path, sha256: hash(bytes), bytes: bytes.length });
    }
  }
  const receipt = JSON.parse(await readFile(join(root, 'result/receipt.json')));
  const source = JSON.parse(await readFile(join(root, 'inputs/source-receipt.json')));
  process.stdout.write(
    `LABUI_ICONS_CONSUMER_RESULT ${JSON.stringify({
      schemaVersion: 1,
      outcome: receipt.outcome,
      source,
      harness: receipt.harness,
      runner: receipt.runner,
      archives: receipt.archives,
      observations: receipt.records?.length,
      failure: receipt.failure ? { phase: receipt.failure.phase } : null,
      files,
      diagnosticDirectory: root,
    })}\n`,
  );
  assert.equal(receipt.outcome, 'passed');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--checkout-ref') {
    process.stdout.write(`${validateSourcePin(JSON.parse(await readFile(PIN))).sourceCommit}\n`);
    return;
  }
  if (args.length === 2 && args[0] === '--summarize') return summarize(args[1]);
  const required = [
    '--icons-source',
    '--ui-source',
    '--ui-commit',
    '--icons-tarball',
    '--ui-core-tarball',
    '--ui-shadow-tarball',
    '--out',
  ];
  const options = new Map();
  assert.equal(args.length, required.length * 2);
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(required.includes(args[index]) && args[index + 1] && !options.has(args[index]));
    options.set(args[index], args[index + 1]);
  }
  return prepareInputs(options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
