import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('отказ чтения summarize не раскрывает путь исходного error', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('prepare-icons-inputs.mjs', import.meta.url)),
      '--summarize',
      'SyntheticPrivateSourceKey-missing-directory',
    ],
    { encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  const failure = JSON.parse(result.stderr.slice('LABUI_ICONS_CONSUMER_ERROR '.length));
  assert.equal(failure.code, 'ENOENT');
  assert.match(failure.diagnosticSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(result.stderr, /SyntheticPrivateSourceKey|node:internal|file:\/\//);
});

test('native Git stderr remains private at the real prepare CLI with and without diagnostics', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-icons-private-git-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = 'SyntheticPrivateFileAuditZ7';
  const init = spawnSync('git', ['init', '--quiet', directory], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(init.status, 0, init.stderr);
  const diagnostics = join(directory, 'diagnostics');
  await mkdir(diagnostics);
  await writeFile(join(directory, '.git/config'), `[core]\nrepositoryformatversion = ${marker}\n`);
  const cli = fileURLToPath(new URL('prepare-icons-inputs.mjs', import.meta.url));
  for (const trace of ['', diagnostics]) {
    const result = spawnSync(
      process.execPath,
      [
        cli,
        '--icons-source',
        directory,
        '--ui-source',
        directory,
        '--ui-commit',
        'a'.repeat(40),
        '--icons-tarball',
        'unused',
        '--ui-core-tarball',
        'unused',
        '--ui-materials-tarball',
        'unused',
        '--ui-tokens-tarball',
        'unused',
        '--ui-shadow-tarball',
        'unused',
        '--out',
        join(directory, 'unused-output'),
      ],
      {
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, LABUI_ICONS_GIT_DIAGNOSTICS: trace },
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.includes(marker), false, 'native Git stderr must remain captured');
    const lines = result.stderr.trim().split('\n');
    const errors = lines.filter((line) => line.startsWith('LABUI_ICONS_CONSUMER_ERROR '));
    assert.equal(errors.length, 1);
    assert.match(
      JSON.parse(errors[0].slice('LABUI_ICONS_CONSUMER_ERROR '.length)).diagnosticSha256,
      /^[a-f0-9]{64}$/,
    );
    assert.ok(
      lines.every((line) =>
        /^(?:LABUI_ICONS_CONSUMER_ERROR|LABUI_ICONS_GIT_DIAGNOSTIC) /.test(line),
      ),
    );
  }
  await writeFile(join(directory, '.git/config'), '[core]\nrepositoryformatversion = 0\n');
  const commit = spawnSync(
    'git',
    [
      '-C',
      directory,
      '-c',
      'user.name=privacy-fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--allow-empty',
      '--quiet',
      '-m',
      'fixture',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  assert.equal(commit.status, 0, commit.stderr);
  const head = spawnSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).stdout.trim();
  for (const trace of ['', diagnostics]) {
    const source = `import { assertCheckout } from ${JSON.stringify(new URL('prepare-icons-inputs.mjs', import.meta.url).href)};
      assertCheckout(${JSON.stringify(directory)}, ${JSON.stringify(head)});
      process.stdout.write('CHECKOUT_OK');`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, LABUI_ICONS_GIT_DIAGNOSTICS: trace },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'CHECKOUT_OK');
    assert.equal(result.stderr, '');
  }
});

test('archive reader captures native tar error before publicError', () => {
  const path = join(tmpdir(), 'SyntheticPrivateFileAuditZ7-missing-archive.tgz');
  const source = `import { readArchiveManifest } from ${JSON.stringify(new URL('icons-packed.mjs', import.meta.url).href)};
    import { publicError } from ${JSON.stringify(new URL('../../../scripts/ci/icons-public-provenance.mjs', import.meta.url).href)};
    try { readArchiveManifest(${JSON.stringify(path)}, {}); }
    catch (error) { process.stderr.write(JSON.stringify(publicError(error))); process.exitCode = 1; }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes('SyntheticPrivateFileAuditZ7'), false);
  assert.match(JSON.parse(result.stderr).diagnosticSha256, /^[a-f0-9]{64}$/);
});
