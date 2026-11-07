import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  assertSameJob,
  consumerTuple,
  prepareSameJob,
  verifyBundle,
  verifyInstalled,
  verifyProducer,
} from './colors-consumer-input.mjs';

const source = 'a'.repeat(40);
const tuple = consumerTuple({
  CORE_RUN_ID: '123',
  CORE_ARTIFACT_ID: '456',
  CORE_SOURCE_SHA: source,
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('exact tuple rejects partial identifiers and latest selectors', () => {
  for (const env of [
    {},
    { CORE_RUN_ID: '123' },
    { CORE_RUN_ID: 'latest', CORE_ARTIFACT_ID: '456', CORE_SOURCE_SHA: source },
    { CORE_RUN_ID: '123', CORE_ARTIFACT_ID: '456', CORE_SOURCE_SHA: source.slice(0, 8) },
  ]) {
    assert.throws(() => consumerTuple(env));
  }
});

test('metadata binds a completed successful producer, repository, run, source and an unexpired artifact', async () => {
  const run = {
    id: 123,
    head_sha: source,
    status: 'completed',
    conclusion: 'success',
    repository: { id: 1221255339, full_name: 'Labpics-Team/lab-colors' },
    head_repository: { id: 1221255339 },
  };
  const artifact = {
    id: 456,
    expired: false,
    expires_at: '2100-01-01T00:00:00Z',
    workflow_run: {
      id: 123,
      head_sha: source,
      repository_id: 1221255339,
      head_repository_id: 1221255339,
    },
  };
  const request =
    (a, r, status = 200) =>
    async (url, options) => {
      assert.match(url, /^https:\/\/api.github.com\/repos\/Labpics-Team\/lab-colors\/actions\//);
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
      return { status, json: async () => (url.includes('/artifacts/') ? a : r) };
    };
  const env = { GITHUB_API_URL: 'https://api.github.com', GH_READ_TOKEN: 'fixture-token' };
  assert.equal(await verifyProducer(tuple, request(artifact, run), env), 'success');
  const mutations = [
    [{ ...artifact, expired: true }, run],
    [{ ...artifact, expires_at: '2000-01-01T00:00:00Z' }, run],
    [{ ...artifact, workflow_run: { ...artifact.workflow_run, id: 999 } }, run],
    [{ ...artifact, workflow_run: { ...artifact.workflow_run, head_sha: 'b'.repeat(40) } }, run],
    [{ ...artifact, workflow_run: { ...artifact.workflow_run, head_repository_id: 999 } }, run],
    [artifact, { ...run, head_sha: 'b'.repeat(40) }],
    [artifact, { ...run, status: 'in_progress', conclusion: null }],
    [artifact, { ...run, conclusion: 'failure' }],
    [artifact, { ...run, repository: { ...run.repository, full_name: 'other/colors' } }],
  ];
  for (const [a, r] of mutations) await assert.rejects(verifyProducer(tuple, request(a, r), env));
  await assert.rejects(verifyProducer(tuple, request(artifact, run, 404), env));
});

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'labui-colors-input-test-'));
  try {
    const upload = join(root, 'download');
    const staging = join(root, 'staging');
    const manifestDir = join(upload, 'checkout/packages/colors/.release');
    const tarballDir = join(upload, '_temp/release-owned');
    await mkdir(join(staging, 'package/pkg'), { recursive: true });
    await mkdir(manifestDir, { recursive: true });
    await mkdir(tarballDir, { recursive: true });
    const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    await writeFile(join(staging, 'package/pkg/labcolors_bg.wasm'), wasm);
    await writeFile(
      join(staging, 'package/package.json'),
      JSON.stringify({ name: '@labpics/colors', version: '2.0.0' }),
    );
    const packed = join(root, 'packed.tgz');
    execFileSync('tar', ['-czf', packed, '-C', staging, 'package']);
    const bytes = await readFile(packed);
    const tarballHash = hash(bytes);
    const tarball = join(tarballDir, `${tarballHash}.tgz`);
    await writeFile(tarball, bytes);
    const manifest = {
      schemaVersion: 6,
      sourceSha: source,
      npm: '2.0.0',
      artifacts: {
        tarball: { path: `.release/${tarballHash}.tgz`, bytes: bytes.length, sha256: tarballHash },
        wasm: [
          {
            role: 'runtime',
            path: 'pkg/labcolors_bg.wasm',
            bytes: wasm.length,
            sha256: hash(wasm),
          },
        ],
      },
    };
    const manifestFile = join(manifestDir, 'release-manifest.json');
    await writeFile(manifestFile, JSON.stringify(manifest));
    await run({ root, upload, staging, manifestFile, tarball, manifest });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('producer layout normalizes only after exact tarball and packed WASM checks; installed bytes must match', async () => {
  await fixture(async ({ root, upload, staging, manifest }) => {
    const normalized = join(root, 'verified');
    const result = await verifyBundle(upload, tuple, normalized);
    assert.equal(result.manifest.artifacts.tarball.sha256, manifest.artifacts.tarball.sha256);
    await verifyInstalled(normalized, tuple, join(staging, 'package'));
    await writeFile(join(staging, 'package/pkg/labcolors_bg.wasm'), 'changed');
    await assert.rejects(
      verifyInstalled(normalized, tuple, join(staging, 'package')),
      /Installed runtime WASM byte count differs/,
    );
  });
});

test('schema, source, traversal, tarball and WASM mismatches refuse the input before copying', async () => {
  await fixture(async ({ root, upload, manifestFile, tarball, manifest }) => {
    const mutations = [
      { ...manifest, schemaVersion: 5 },
      { ...manifest, sourceSha: 'b'.repeat(40) },
      {
        ...manifest,
        artifacts: {
          ...manifest.artifacts,
          tarball: { ...manifest.artifacts.tarball, path: '../escape.tgz' },
        },
      },
      {
        ...manifest,
        artifacts: { ...manifest.artifacts, tarball: { ...manifest.artifacts.tarball, bytes: 1 } },
      },
      {
        ...manifest,
        artifacts: {
          ...manifest.artifacts,
          wasm: [{ ...manifest.artifacts.wasm[0], sha256: '0'.repeat(64) }],
        },
      },
    ];
    for (const mutation of mutations) {
      await writeFile(manifestFile, JSON.stringify(mutation));
      await assert.rejects(verifyBundle(upload, tuple, join(root, 'refused')));
    }
    await writeFile(manifestFile, JSON.stringify(manifest));
    const bytes = await readFile(tarball);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(tarball, bytes);
    await assert.rejects(verifyBundle(upload, tuple), /Core tarball SHA-256 differs/);
  });
});

test('same-job substitution preserves normalized package bytes and rejects partial identity, failed verification and tamper', async () => {
  await fixture(async ({ root, upload, staging, manifestFile, tarball, manifest }) => {
    const env = {
      CORE_INPUT_MODE: 'same-job',
      CORE_RUN_ID: '123',
      CORE_RUN_ATTEMPT: '2',
      CORE_JOB: 'wasm',
      CORE_SOURCE_SHA: source,
      CORE_TARBALL_SHA256: manifest.artifacts.tarball.sha256,
      CORE_MANIFEST_SHA256: hash(await readFile(manifestFile)),
      UI_SOURCE_COMMIT: 'c'.repeat(40),
      GITHUB_ACTIONS: 'true',
      CI: 'true',
      RUNNER_ENVIRONMENT: 'github-hosted',
      RUNNER_OS: 'Linux',
      GITHUB_REPOSITORY: 'Labpics-Team/lab-colors',
      GITHUB_REPOSITORY_ID: '1221255339',
      GITHUB_JOB: 'wasm',
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_SHA: source,
      CORE_VERIFIED_RELEASE_OUTCOME: 'success',
    };
    const sameJob = join(root, 'same-job');
    const artifact = join(root, 'artifact');
    await prepareSameJob(manifestFile, tarball, sameJob, env);
    await verifyBundle(upload, tuple, artifact);
    for (const relative of ['release-manifest.json', manifest.artifacts.tarball.path])
      assert.deepEqual(
        await readFile(join(sameJob, relative)),
        await readFile(join(artifact, relative)),
      );
    const localTuple = consumerTuple(env);
    await verifyInstalled(sameJob, localTuple, join(staging, 'package'));
    await assert.rejects(verifyProducer(localTuple), /no remote producer receipt/);
    for (const mutation of [
      { CORE_ARTIFACT_ID: '456' },
      { CORE_INPUT_MODE: 'local' },
      { CORE_JOB: 'other' },
      { CORE_TARBALL_SHA256: '' },
      { CORE_MANIFEST_SHA256: '' },
      { UI_SOURCE_COMMIT: '' },
      { GITHUB_RUN_ID: '124' },
      { GITHUB_RUN_ATTEMPT: '3' },
      { GITHUB_JOB: 'other' },
      { GITHUB_SHA: 'b'.repeat(40) },
      { GITHUB_REPOSITORY_ID: '999' },
      { RUNNER_OS: 'Windows' },
      { RUNNER_ENVIRONMENT: 'self-hosted' },
      { GITHUB_ACTIONS: 'false' },
      { CORE_VERIFIED_RELEASE_OUTCOME: 'failure' },
      { CORE_VERIFIED_RELEASE_OUTCOME: '' },
    ])
      assert.throws(() => assertSameJob({ ...env, ...mutation }));
    await assert.rejects(
      prepareSameJob(manifestFile, tarball, join(root, 'wrong-hash'), {
        ...env,
        CORE_TARBALL_SHA256: '0'.repeat(64),
      }),
      /Verified tarball identity/,
    );
    await writeFile(manifestFile, JSON.stringify({ ...manifest, sourceSha: 'b'.repeat(40) }));
    await assert.rejects(
      prepareSameJob(manifestFile, tarball, join(root, 'manifest-tamper'), env),
      /Verified manifest SHA-256/,
    );
    await writeFile(manifestFile, JSON.stringify(manifest));
    const changed = await readFile(tarball);
    changed[changed.length - 1] ^= 1;
    await writeFile(tarball, changed);
    await assert.rejects(
      prepareSameJob(manifestFile, tarball, join(root, 'tarball-tamper'), env),
      /Core tarball SHA-256/,
    );
  });
});

test('extra files and directory links cannot widen the artifact input', async () => {
  await fixture(async ({ root, upload }) => {
    const extra = join(upload, 'extra');
    await writeFile(extra, 'unexpected');
    await assert.rejects(verifyBundle(upload, tuple), /only its manifest and tarball/);
    await rm(extra);
    await symlink(root, join(upload, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(verifyBundle(upload, tuple), /link or non-file/);
  });
});
