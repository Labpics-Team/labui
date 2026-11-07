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
const hash = (b) => createHash('sha256').update(b).digest('hex');

test('browser owner preserves ordinary and icons commands and qualifies only verified full colors with restoration', () => {
  const root = mkdtempSync(join(tmpdir(), 'labui-browser-owner-'));
  try {
    const ui = join(root, 'ui');
    const runner = join(root, 'runner');
    const input = join(runner, 'labui-colors-inputs.fixture/verified');
    const capture = join(root, 'capture');
    for (const path of [
      join(ui, '.github/scripts'),
      join(ui, 'scripts/ci'),
      join(ui, 'apps/docs/tests'),
      join(ui, 'packages/colors'),
      join(ui, '.git'),
      join(root, 'bin'),
      input,
      join(root, 'package/pkg'),
      join(root, 'icons'),
    ])
      mkdirSync(path, { recursive: true });
    for (const file of ['.github/scripts/browser-check.sh', 'scripts/ci/colors-consumer-input.mjs'])
      copyFileSync(new URL(`../../${file}`, import.meta.url), join(ui, file));
    writeFileSync(
      join(ui, 'apps/docs/tests/icons-packed.mjs'),
      'export function assertActionsRunner() {}\n',
    );
    writeFileSync(join(ui, 'apps/docs/tests/prepare-icons-inputs.mjs'), 'process.exit(0);\n');
    const packageFile = join(ui, 'packages/colors/package.json');
    const lockFile = join(ui, 'pnpm-lock.yaml');
    writeFileSync(
      packageFile,
      '{"name":"@labui/colors","dependencies":{"@labpics/colors":"0.6.2"}}',
    );
    writeFileSync(lockFile, 'original lock');
    const originalPackage = readFileSync(packageFile);
    const originalLock = readFileSync(lockFile);
    const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    writeFileSync(join(root, 'package/pkg/labcolors_bg.wasm'), wasm);
    writeFileSync(
      join(root, 'package/package.json'),
      '{"name":"@labpics/colors","version":"2.0.0"}',
    );
    const packed = join(root, 'packed.tgz');
    execFileSync('tar', ['-czf', packed, '-C', root, 'package']);
    const bytes = readFileSync(packed);
    const digest = hash(bytes);
    mkdirSync(join(input, '.release'));
    copyFileSync(packed, join(input, '.release', `${digest}.tgz`));
    const manifest = {
      schemaVersion: 6,
      sourceSha: 'a'.repeat(40),
      npm: '2.0.0',
      artifacts: {
        tarball: { path: `.release/${digest}.tgz`, bytes: bytes.length, sha256: digest },
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
    const manifestBytes = Buffer.from(JSON.stringify(manifest));
    writeFileSync(join(input, 'release-manifest.json'), manifestBytes);
    writeFileSync(join(root, 'bin/git'), '#!/bin/sh\nprintf "%s\\n" "$UI_SOURCE_COMMIT"\n', {
      mode: 0o755,
    });
    writeFileSync(join(root, 'bin/id'), '#!/bin/sh\nprintf "1001\\n"\n', { mode: 0o755 });
    writeFileSync(
      join(root, 'bin/corepack'),
      '#!/bin/sh\nprintf "corepack:%s\\n" "$*" >> "$CAPTURE"\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(root, 'bin/pnpm'),
      '#!/bin/bash\nset -euo pipefail\nprintf "pnpm:%s\\n" "$*" >> "$CAPTURE"\nif [[ "$*" == *--lockfile-only* ]]; then printf changed > packages/colors/package.json; printf changed > pnpm-lock.yaml; fi\nif [[ "$*" == "install --frozen-lockfile" && "${CORE_INPUT_MODE:-}" == same-job ]]; then mkdir -p packages/colors/node_modules/@labpics/colors; cp -a "$INSTALLED_FIXTURE/." packages/colors/node_modules/@labpics/colors/; fi\nif [[ "$*" == test:e2e ]]; then printf "smoke:%s\\n" "${E2E_SMOKE:-}" >> "$CAPTURE"; exit "${E2E_EXIT:-0}"; fi\n',
      { mode: 0o755 },
    );
    const env = {
      ...process.env,
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      CAPTURE: capture,
      RUNNER_TEMP: runner,
      UI_SOURCE_COMMIT: 'd'.repeat(40),
      CORE_INPUT_MODE: 'same-job',
      CORE_RUN_ID: '123',
      CORE_RUN_ATTEMPT: '2',
      CORE_JOB: 'wasm',
      CORE_SOURCE_SHA: 'a'.repeat(40),
      CORE_TARBALL_SHA256: digest,
      CORE_MANIFEST_SHA256: hash(manifestBytes),
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
      CORE_VERIFIED_RELEASE_OUTCOME: 'success',
      INSTALLED_FIXTURE: join(root, 'package'),
      E2E_SMOKE: '1',
    };
    const run = (args, overrides = {}) =>
      spawnSync('bash', [join(ui, '.github/scripts/browser-check.sh'), ...args], {
        env: { ...env, ...overrides },
        encoding: 'utf8',
        timeout: 10000,
      });
    for (const status of ['0', '31']) {
      const result = run(['--colors-consumer', input], { E2E_EXIT: status });
      assert.equal(result.status, Number(status), result.stdout + result.stderr);
      const calls = readFileSync(capture, 'utf8');
      assert.ok(calls.includes('smoke:0\n'));
      assert.ok(calls.includes('pnpm:build\npnpm:typecheck\npnpm:test\n'));
      assert.ok(
        calls.includes(
          'pnpm:--filter @labpics/ui-docs exec playwright install --with-deps chromium webkit\n',
        ),
      );
      assert.deepEqual(readFileSync(packageFile), originalPackage);
      assert.deepEqual(readFileSync(lockFile), originalLock);
      rmSync(capture);
    }
    for (const override of [
      { CORE_ARTIFACT_ID: '456' },
      { CORE_VERIFIED_RELEASE_OUTCOME: 'failure' },
      { GITHUB_RUN_ID: '124' },
      { RUNNER_OS: 'Windows' },
      { CORE_MANIFEST_SHA256: '0'.repeat(64) },
    ]) {
      const result = run(['--colors-consumer', input], override);
      assert.notEqual(result.status, 0);
      if (existsSync(capture)) {
        assert.ok(!readFileSync(capture, 'utf8').includes('pnpm:build'));
        rmSync(capture);
      }
      assert.deepEqual(readFileSync(packageFile), originalPackage);
      assert.deepEqual(readFileSync(lockFile), originalLock);
    }
    const ordinary = run([], { CORE_INPUT_MODE: '', E2E_SMOKE: '1' });
    assert.equal(ordinary.status, 0, ordinary.stdout + ordinary.stderr);
    assert.equal(
      readFileSync(capture, 'utf8'),
      'corepack:enable\npnpm:install --frozen-lockfile\npnpm:build\npnpm:--filter @labpics/ui-docs exec playwright install chromium webkit\npnpm:--filter @labui/colors fx:render\npnpm:test:e2e\nsmoke:1\n',
    );
    rmSync(capture);
    const icons = run(['--icons-consumer', join(root, 'icons')], { CORE_INPUT_MODE: '' });
    assert.equal(icons.status, 0, icons.stdout + icons.stderr);
    const calls = readFileSync(capture, 'utf8');
    assert.equal((calls.match(/pnpm:install --frozen-lockfile/g) || []).length, 2);
    assert.ok(calls.includes('pnpm:--filter @labpics/ui-core... build\n'));
    assert.ok(!calls.includes('pnpm:test:e2e'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
