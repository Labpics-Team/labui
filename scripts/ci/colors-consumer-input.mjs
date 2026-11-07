import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'Labpics-Team/lab-colors';
const repositoryId = '1221255339';
const manifestName = 'release-manifest.json';
const wasmPath = 'pkg/labcolors_bg.wasm';
const limit = 64 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function consumerTuple(env = process.env) {
  const tuple = {
    run: env.CORE_RUN_ID,
    artifact: env.CORE_ARTIFACT_ID,
    source: env.CORE_SOURCE_SHA,
  };
  assert.match(tuple.run ?? '', /^[1-9][0-9]{0,19}$/, 'Core run must be an exact numeric ID');
  assert.match(tuple.source ?? '', /^[0-9a-f]{40}$/, 'Core source must be a full lowercase SHA');
  if (env.CORE_INPUT_MODE === 'same-job') {
    assert.ok(!tuple.artifact, 'Same-job input cannot carry an artifact ID');
    tuple.mode = 'same-job';
    tuple.attempt = env.CORE_RUN_ATTEMPT;
    tuple.job = env.CORE_JOB;
    tuple.tarballSha256 = env.CORE_TARBALL_SHA256;
    tuple.manifestSha256 = env.CORE_MANIFEST_SHA256;
    assert.match(tuple.attempt ?? '', /^[1-9][0-9]{0,19}$/);
    assert.equal(tuple.job, 'wasm');
    assert.match(tuple.tarballSha256 ?? '', /^[0-9a-f]{64}$/);
    assert.match(tuple.manifestSha256 ?? '', /^[0-9a-f]{64}$/);
    assert.match(env.UI_SOURCE_COMMIT ?? '', /^[0-9a-f]{40}$/);
  } else {
    assert.ok(
      !env.CORE_INPUT_MODE || env.CORE_INPUT_MODE === 'artifact',
      'Unknown Core input mode',
    );
    assert.match(
      tuple.artifact ?? '',
      /^[1-9][0-9]{0,19}$/,
      'Core artifact must be an exact numeric ID',
    );
  }
  return tuple;
}

export function assertSameJob(env = process.env) {
  const tuple = consumerTuple(env);
  assert.equal(tuple.mode, 'same-job');
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.CI, 'true');
  assert.equal(env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(env.RUNNER_OS, 'Linux');
  assert.equal(env.GITHUB_REPOSITORY, repository);
  assert.equal(env.GITHUB_REPOSITORY_ID, repositoryId);
  assert.equal(env.GITHUB_JOB, tuple.job);
  assert.equal(env.GITHUB_RUN_ID, tuple.run);
  assert.equal(env.GITHUB_RUN_ATTEMPT, tuple.attempt);
  assert.equal(env.GITHUB_SHA, tuple.source);
  assert.equal(env.CORE_VERIFIED_RELEASE_OUTCOME, 'success');
  return tuple;
}

export async function prepareSameJob(manifest, tarball, destination, env = process.env) {
  const tuple = assertSameJob(env);
  assert.equal(basename(manifest), manifestName);
  return verifyFiles([resolve(manifest), resolve(tarball)], tuple, destination);
}

export async function verifyProducer(tuple, request = fetch, env = process.env) {
  assert.notEqual(tuple.mode, 'same-job', 'Same-job input has no remote producer receipt');
  const api = async (path) => {
    const response = await request(`${env.GITHUB_API_URL}/repos/${repository}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GH_READ_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    assert.equal(response.status, 200, `Core metadata HTTP ${response.status}`);
    return response.json();
  };
  const [run, artifact] = await Promise.all([
    api(`actions/runs/${tuple.run}`),
    api(`actions/artifacts/${tuple.artifact}`),
  ]);
  assert.equal(String(run.id), tuple.run);
  assert.equal(run.head_sha, tuple.source);
  assert.equal(run.status, 'completed', 'Core package producer run is unfinished');
  assert.equal(run.conclusion, 'success', 'Core package producer run did not succeed');
  assert.equal(run.repository?.full_name, repository);
  assert.equal(String(run.repository?.id), repositoryId);
  assert.equal(String(run.head_repository?.id), repositoryId);
  assert.equal(String(artifact.id), tuple.artifact);
  assert.equal(artifact.expired, false);
  assert.ok(Date.parse(artifact.expires_at) > Date.now(), 'Core artifact has expired');
  assert.equal(String(artifact.workflow_run?.id), tuple.run);
  assert.equal(artifact.workflow_run?.head_sha, tuple.source);
  assert.equal(String(artifact.workflow_run?.repository_id), repositoryId);
  assert.equal(String(artifact.workflow_run?.head_repository_id), repositoryId);
  return run.conclusion;
}

async function regularFile(path, maximum = limit, singleLink = true) {
  const stat = await lstat(path);
  assert.ok(
    stat.isFile() && (!singleLink || stat.nlink === 1) && stat.size <= maximum,
    'Expected bounded regular input without links',
  );
  const bytes = await readFile(path);
  assert.ok(bytes.length <= maximum, 'Input exceeded its byte bound');
  return bytes;
}

async function inputFiles(directory) {
  assert.ok((await lstat(directory)).isDirectory(), 'Input root must be a directory without links');
  const files = [];
  const walk = async (current) => {
    for (const name of await readdir(current)) {
      const path = join(current, name);
      const stat = await lstat(path);
      if (stat.isDirectory()) await walk(path);
      else {
        assert.ok(stat.isFile() && stat.nlink === 1, 'Input tree contains a link or non-file');
        files.push(path);
        assert.ok(files.length <= 2, 'Core input must contain only its manifest and tarball');
      }
    }
  };
  await walk(directory);
  return files;
}

function artifactRecord(record, path) {
  assert.equal(record?.path, path, 'Unexpected Core artifact path');
  assert.ok(Number.isSafeInteger(record.bytes) && record.bytes > 0 && record.bytes <= limit);
  assert.match(record.sha256 ?? '', /^[0-9a-f]{64}$/);
}

function matchBytes(bytes, record, label) {
  assert.equal(bytes.length, record.bytes, `${label} byte count differs`);
  assert.equal(digest(bytes), record.sha256, `${label} SHA-256 differs`);
}

function packedFile(tarball, path) {
  return execFileSync('tar', ['-xOzf', tarball, `package/${path}`], { maxBuffer: limit });
}

export async function verifyBundle(directory, tuple, destination) {
  return verifyFiles(await inputFiles(directory), tuple, destination);
}

async function verifyFiles(files, tuple, destination) {
  assert.equal(files.length, 2, 'Core input must contain exactly one manifest and one tarball');
  const manifests = files.filter((path) => basename(path) === manifestName);
  assert.equal(manifests.length, 1, 'Core input must contain one release-manifest.json');
  const manifestPath = manifests[0];
  const manifestBytes = await regularFile(manifestPath, 1024 * 1024);
  if (tuple.mode === 'same-job')
    assert.equal(digest(manifestBytes), tuple.manifestSha256, 'Verified manifest SHA-256 differs');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  assert.equal(manifest.schemaVersion, 6, 'Unsupported Core release manifest');
  assert.equal(manifest.sourceSha, tuple.source, 'Core manifest source differs');
  const tarball = manifest.artifacts?.tarball;
  artifactRecord(tarball, `.release/${tarball?.sha256}.tgz`);
  if (tuple.mode === 'same-job')
    assert.equal(tarball.sha256, tuple.tarballSha256, 'Verified tarball identity differs');
  assert.ok(Array.isArray(manifest.artifacts.wasm) && manifest.artifacts.wasm.length === 1);
  const wasm = manifest.artifacts.wasm[0];
  assert.equal(wasm.role, 'runtime');
  artifactRecord(wasm, wasmPath);
  const tarballs = files.filter((path) => basename(path) === `${tarball.sha256}.tgz`);
  assert.equal(tarballs.length, 1, 'Core input lacks the exact manifest-bound tarball');
  const tarballPath = tarballs[0];
  matchBytes(await regularFile(tarballPath), tarball, 'Core tarball');
  matchBytes(packedFile(tarballPath, wasmPath), wasm, 'Packed runtime WASM');
  const pkg = JSON.parse(packedFile(tarballPath, 'package.json').toString('utf8'));
  assert.equal(pkg.name, '@labpics/colors');
  assert.equal(pkg.version, manifest.npm);
  if (destination) {
    await mkdir(destination, { recursive: false });
    await mkdir(join(destination, '.release'));
    await copyFile(manifestPath, join(destination, manifestName));
    await copyFile(tarballPath, join(destination, ...tarball.path.split('/')));
  }
  return { manifest, tarballPath };
}

export async function verifyInstalled(directory, tuple, installed) {
  const { manifest } = await verifyBundle(directory, tuple);
  const pkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@labpics/colors');
  assert.equal(pkg.version, manifest.npm);
  matchBytes(
    await regularFile(join(installed, ...wasmPath.split('/')), limit, false),
    manifest.artifacts.wasm[0],
    'Installed runtime WASM',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, directory, target] = process.argv.slice(2);
  const tuple = consumerTuple();
  if (mode === 'same-job-identity') {
    assertSameJob();
  } else if (mode === 'prepare-same-job') {
    await prepareSameJob(directory, target, process.argv[5]);
    console.info(
      `Core same-job verified-release source=${tuple.source} run=${tuple.run} attempt=${tuple.attempt} job=${tuple.job} tgz-sha256=${tuple.tarballSha256} consumer=${process.env.UI_SOURCE_COMMIT}`,
    );
  } else if (mode === 'metadata') {
    const conclusion = await verifyProducer(tuple);
    console.info(
      `Core candidate source=${tuple.source} run=${tuple.run} artifact=${tuple.artifact} producer-conclusion=${conclusion}`,
    );
  } else if (mode === 'verify' || mode === 'path') {
    const { manifest, tarballPath } = await verifyBundle(
      resolve(directory),
      tuple,
      mode === 'verify' && target ? resolve(target) : undefined,
    );
    if (mode === 'path') console.info(tarballPath);
    else
      console.info(
        `Core candidate source=${tuple.source} run=${tuple.run} artifact=${tuple.artifact} tgz-sha256=${manifest.artifacts.tarball.sha256} consumer=${process.env.UI_SOURCE_COMMIT}`,
      );
  } else if (mode === 'installed') {
    await verifyInstalled(resolve(directory), tuple, resolve(target));
    console.info('Installed Core runtime WASM matches the exact packed manifest input.');
  } else
    throw new Error(
      'Expected metadata, verify <input> [normalized], path <input>, or installed <input> <package>',
    );
}
