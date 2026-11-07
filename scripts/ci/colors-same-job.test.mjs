import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('same-job entrypoint binds producer paths and consumer HEAD, invokes only full owner, and cleans on failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'labui-same-job-'));
  const verified = mkdtempSync(join(tmpdir(), 'labcolors-release-verified-'));
  try {
    const ui = join(root, 'ui');
    const workspace = join(root, 'core');
    const runner = join(root, 'runner');
    const manifest = join(workspace, 'packages/colors/.release/release-manifest.json');
    for (const dir of [
      join(ui, '.github/scripts'),
      join(ui, 'scripts/ci'),
      join(root, 'bin'),
      runner,
      verified,
      join(workspace, 'packages/colors/.release'),
      join(root, 'package/pkg'),
    ])
      mkdirSync(dir, { recursive: true });
    for (const file of [
      '.github/scripts/colors-same-job.sh',
      'scripts/ci/colors-consumer-input.mjs',
    ])
      copyFileSync(new URL(`../../${file}`, import.meta.url), join(ui, file));
    const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    writeFileSync(join(root, 'package/pkg/labcolors_bg.wasm'), wasm);
    writeFileSync(
      join(root, 'package/package.json'),
      JSON.stringify({ name: '@labpics/colors', version: '2.0.0' }),
    );
    const packed = join(root, 'packed.tgz');
    execFileSync('tar', ['-czf', packed, '-C', root, 'package']);
    const bytes = readFileSync(packed);
    const hash = sha256(bytes);
    const tarball = join(verified, `${hash}.tgz`);
    copyFileSync(packed, tarball);
    writeFileSync(
      manifest,
      JSON.stringify({
        schemaVersion: 6,
        sourceSha: 'a'.repeat(40),
        npm: '2.0.0',
        artifacts: {
          tarball: { path: `.release/${hash}.tgz`, bytes: bytes.length, sha256: hash },
          wasm: [
            {
              role: 'runtime',
              path: 'pkg/labcolors_bg.wasm',
              bytes: wasm.length,
              sha256: sha256(wasm),
            },
          ],
        },
      }),
    );
    writeFileSync(join(root, 'bin/git'), '#!/bin/sh\nprintf "%s\\n" "$FIXTURE_UI_HEAD"\n', {
      mode: 0o755,
    });
    writeFileSync(join(root, 'bin/id'), '#!/bin/sh\nprintf "%s\\n" "$FIXTURE_UID"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(ui, '.github/scripts/browser-check.sh'),
      '#!/bin/bash\nset -euo pipefail\ntest "$E2E_SMOKE" = 0\ntest "$CORE_INPUT_MODE" = same-job\ntest -f "$CORE_INPUT_DIR/.release/$CORE_TARBALL_SHA256.tgz"\nprintf "%s" "$CORE_INPUT_DIR" > "$CAPTURE"\nexit "$BROWSER_STATUS"\n',
    );
    const capture = join(root, 'capture');
    const env = {
      ...process.env,
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      GITHUB_ACTIONS: 'true',
      CI: 'true',
      RUNNER_ENVIRONMENT: 'github-hosted',
      RUNNER_OS: 'Linux',
      GITHUB_REPOSITORY: 'Labpics-Team/lab-colors',
      GITHUB_REPOSITORY_ID: '1221255339',
      GITHUB_JOB: 'wasm',
      GITHUB_RUN_ID: '123',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_SHA: 'a'.repeat(40),
      GITHUB_WORKSPACE: workspace,
      RUNNER_TEMP: runner,
      VERIFIED_MANIFEST: manifest,
      VERIFIED_TARBALL: tarball,
      CORE_SOURCE_SHA: 'a'.repeat(40),
      CORE_TARBALL_SHA256: hash,
      CORE_MANIFEST_SHA256: sha256(readFileSync(manifest)),
      CORE_VERIFIED_RELEASE_OUTCOME: 'success',
      UI_SOURCE_COMMIT: 'c'.repeat(40),
      FIXTURE_UI_HEAD: 'c'.repeat(40),
      FIXTURE_UID: '1001',
      CAPTURE: capture,
      BROWSER_STATUS: '0',
    };
    Reflect.deleteProperty(env, 'TMPDIR');
    const run = (overrides) =>
      spawnSync('bash', [join(ui, '.github/scripts/colors-same-job.sh')], {
        env: { ...env, ...overrides },
        encoding: 'utf8',
        timeout: 10000,
      });
    for (const [status, overrides] of [
      ['0', {}],
      ['0', { TMPDIR: '/tmp' }],
      ['23', {}],
    ]) {
      const result = run({ BROWSER_STATUS: status, ...overrides });
      assert.equal(result.status, Number(status), result.stdout + result.stderr);
      assert.equal(existsSync(readFileSync(capture, 'utf8')), false);
      rmSync(capture);
    }
    for (const override of [
      { FIXTURE_UI_HEAD: 'd'.repeat(40) },
      { FIXTURE_UID: '0' },
      { CORE_VERIFIED_RELEASE_OUTCOME: 'failure' },
      { GITHUB_RUN_ATTEMPT: '' },
      { VERIFIED_MANIFEST: join(root, 'other.json') },
      { VERIFIED_TARBALL: packed },
      { CORE_ARTIFACT_ID: '456' },
    ]) {
      const result = run(override);
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.equal(existsSync(capture), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(verified, { recursive: true, force: true });
  }
});
