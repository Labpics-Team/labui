#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
  browser: readFileSync('.github/scripts/browser-check.sh', 'utf8'),
};

const installLines = (source) =>
  source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:run:\s*)?pnpm install --frozen-lockfile(?:\s|$)/.test(line))
    .map((line) => line.replace(/^run:\s*/, ''));

function violations(subject) {
  const out = [];
  const expected = {
    ci: { count: 1, command: 'pnpm install --frozen-lockfile --store-dir "$store"' },
    full: {
      count: 1,
      command: 'pnpm install --frozen-lockfile --store-dir "$RUNNER_TEMP/pnpm-store"',
    },
    browser: { count: 1, command: 'pnpm install --frozen-lockfile --store-dir /job/pnpm-store' },
  };
  for (const [name, source] of Object.entries(subject)) {
    const installs = installLines(source);
    if (installs.length !== expected[name].count)
      out.push(`${name}: unexpected frozen install count ${installs.length}`);
    if (installs.some((line) => line !== expected[name].command))
      out.push(`${name}: frozen installs must use the isolated pnpm store`);
  }

  const jobStore = 'store="$RUNNER_TEMP/pnpm-store-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$GITHUB_JOB"';
  if (subject.ci.split('\n').filter((line) => line.trim() === jobStore).length !== 1)
    out.push('ci.yml must bind the host install to the per-job RUNNER_TEMP store');

  return out;
}

const actual = violations(files);
if (actual.length) throw new Error(actual.join('\n'));

const mutants = [
  { ...files, ci: files.ci.replace('--store-dir "$store"', '') },
  { ...files, full: files.full.replace('--store-dir "$RUNNER_TEMP/pnpm-store"', '') },
  { ...files, browser: files.browser.replace('--store-dir /job/pnpm-store', '') },
  {
    ...files,
    ci: files.ci.replace(
      'pnpm install --frozen-lockfile --store-dir "$store"',
      '# pnpm install --frozen-lockfile --store-dir "$store"',
    ),
  },
  {
    ...files,
    browser: files.browser.replace(
      'pnpm install --frozen-lockfile --store-dir /job/pnpm-store',
      '# pnpm install --frozen-lockfile --store-dir /job/pnpm-store',
    ),
  },
  {
    ...files,
    ci: files.ci.replace(
      'store="$RUNNER_TEMP/pnpm-store-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$GITHUB_JOB"',
      'store="$RUNNER_TEMP/pnpm-store"',
    ),
  },
];
for (const [index, mutant] of mutants.entries()) {
  if (violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped pnpm store contract`);
}

process.stdout.write(`pnpm store contract: PASS (live + ${mutants.length} sabotage controls)\n`);

// Workspace ownership follows the host runner identity, including non-1000 users.
// Execute the real workflow shell with a Docker argument recorder, not a privileged daemon.
const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { spawnSync } = await import('node:child_process');
const { default: assert } = await import('node:assert/strict');
const fixture = mkdtempSync(`${tmpdir()}/labui-owner-`);
try {
  writeFileSync(
    `${fixture}/id`,
    '#!/bin/sh\ncase "$1" in -u) echo "$TEST_UID";; -g) echo "$TEST_GID";; *) exit 2;; esac\n',
    { mode: 0o755 },
  );
  writeFileSync(
    `${fixture}/docker`,
    '#!/bin/sh\nprintf "%s\\n" "$@" > "$OWNER_CAPTURE"\nexit "$DOCKER_STATUS"\n',
    { mode: 0o755 },
  );
  let count = 0;
  const roles = { primary: 0, final: 0 };
  for (const text of [files.ci, files.full]) {
    for (const block of text.matchAll(/run: \|\n((?: {10,}[^\n]*\n)+)/g)) {
      const script = block[1].replace(/^ {10}/gm, '');
      if (!script.includes('chown')) continue;
      count++;
      roles[script.includes('rm -rf') ? 'primary' : 'final']++;
      for (const [uid, gid] of [
        ['1000', '1000'],
        ['1001', '1234'],
      ]) {
        const env = {
          ...process.env,
          PATH: `${fixture}:${process.env.PATH}`,
          TEST_UID: uid,
          TEST_GID: gid,
          GITHUB_WORKSPACE: fixture,
          DOCKER_CONFIG: `${fixture}/docker-config`,
          BUSYBOX_IMAGE: 'busybox-pinned',
          OWNER_CAPTURE: `${fixture}/capture`,
          DOCKER_STATUS: '0',
        };
        const result = spawnSync(
          'bash',
          ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script],
          { env, encoding: 'utf8' },
        );
        assert.equal(result.status, 0, result.stderr);
        const args = readFileSync(`${fixture}/capture`, 'utf8').trimEnd().split('\n');
        if (script.includes('rm -rf')) {
          assert.deepEqual(args.slice(-3), ['sh', uid, gid]);
          assert.ok(args.some((arg) => arg.includes('chown "$1:$2" /workspace')));
        } else assert.ok(args.includes(`${uid}:${gid}`));
        const failed = spawnSync(
          'bash',
          ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script],
          { env: { ...env, DOCKER_STATUS: '7' }, encoding: 'utf8' },
        );
        if (script.includes('rm -rf')) {
          assert.notEqual(failed.status, 0, 'primary cleanup failure must stop checkout');
        } else {
          assert.equal(
            failed.status,
            0,
            'final ownership cleanup must preserve verification result',
          );
          assert.match(
            failed.stderr,
            /::warning::.*ownership/i,
            'cleanup failure must stay visible',
          );
        }
      }
    }
  }
  assert.equal(count, 6, 'three CI preparation + one CI cleanup + two full-E2E ownership steps');
  assert.deepEqual(roles, { primary: 4, final: 2 });
  console.info(
    'workspace owner contract: PASS (6 real shell steps, two identities, mandatory preparation, visible best-effort cleanup)',
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
