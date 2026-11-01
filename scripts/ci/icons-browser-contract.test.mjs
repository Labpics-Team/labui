import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';

const helper = new URL('../../.github/scripts/browser-check.sh', import.meta.url);
const workflow = readFileSync(
  new URL('../../.github/workflows/icons-consumer.yml', import.meta.url),
  'utf8',
);
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const posix = (path) =>
  path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);

test('Icons workflow delegates the workload and preserves source-read failure', () => {
  assert.match(workflow, /runs-on: \[self-hosted, Linux, X64\]/);
  assert.match(
    workflow,
    /sha="\$\(node ui\/apps\/docs\/tests\/prepare-icons-inputs\.mjs --checkout-ref\)"\n\s+printf/,
  );
  assert.match(
    workflow,
    /run: bash ui\/\.github\/scripts\/browser-check\.sh --icons-consumer "\$GITHUB_WORKSPACE\/icons"/,
  );
  assert.doesNotMatch(
    workflow,
    /container:|mcr\.microsoft\.com|pnpm\/action-setup|pnpm install|chown/,
  );
  assert.match(
    workflow,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
});

test('the exact source-read shell publishes a healthy SHA and preserves a failing Node exit', () => {
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(parent, 'labui-icons-ref-'));
  try {
    const block = workflow.split('- name: Прочитать закреплённый Icons SHA')[1].split('      #')[0];
    const match = /run: \|\n((?: {10}[^\n]*\n)+)/.exec(block);
    assert.ok(match);
    const script = match[1].replace(/^ {10}/gm, '');
    writeFileSync(
      join(fixture, 'node'),
      '#!/bin/sh\n[ "$NODE_STATUS" = 0 ] || exit "$NODE_STATUS"\nprintf "%s\\n" "$TEST_SHA"\n',
      { mode: 0o755 },
    );
    for (const status of ['0', '23']) {
      const output = join(fixture, 'output');
      writeFileSync(output, '');
      const result = spawnSync(bash, ['--noprofile', '--norc'], {
        env: {
          ...process.env,
          STUB_BIN: posix(fixture),
          GITHUB_OUTPUT: posix(output),
          NODE_STATUS: status,
          TEST_SHA: 'a'.repeat(40),
        },
        input: `export PATH="$STUB_BIN:$PATH"\n${script}`,
        encoding: 'utf8',
        timeout: 10_000,
      });
      assert.equal(result.status, Number(status), result.stdout + result.stderr);
      assert.equal(readFileSync(output, 'utf8'), status === '0' ? `sha=${'a'.repeat(40)}\n` : '');
    }
  } finally {
    const target = realpathSync(fixture);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-ref-'));
    rmSync(target, { recursive: true, force: true });
  }
});

const recorder = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\0' "$@" > "$CAPTURE/$1.args"
printf '%s\\n' "$1" >> "$CAPTURE/order"
case "$1" in
  create)
    shift
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --cidfile) printf 'owned-container\\n' > "$2"; shift 2;;
        --mount)
          if [[ "$2" = *,target=/job ]]; then
            value="\${2#type=bind,source=}"
            printf '%s' "\${value%,target=/job}" > "$CAPTURE/work"
          fi
          shift 2;;
        *) shift;;
      esac
    done
    exit "$CREATE_STATUS";;
  start)
    work="$(cat "$CAPTURE/work")"
    mkdir -p "$work/output/result"
    printf '{"outcome":"fixture"}\\n' > "$work/output/result/receipt.json"
    if [ "$BAD_LINK" = true ]; then ln "$FOREIGN_FILE" "$work/output/result/unsafe"; fi
    printf '::set-output name=icons_ready::forged\\n'
    if [ "$INTERRUPT" = true ]; then kill -TERM "$PPID"; fi
    exit "$START_STATUS";;
  rm)
    [ ! -e "$EXPORTED_RECEIPT" ]
    exit "$REMOVE_STATUS";;
  *) exit 99;;
esac
`;

function runFixture(overrides = {}, mode = 'icons') {
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(parent, 'labui-icons-browser-'));
  try {
    for (const directory of [
      'ui/.github/scripts',
      'ui/.git',
      'icons/.git',
      'bin',
      'capture',
      'runner',
    ])
      mkdirSync(join(fixture, directory), { recursive: true });
    copyFileSync(helper, join(fixture, 'ui/.github/scripts/browser-check.sh'));
    writeFileSync(join(fixture, 'bin/docker'), recorder, { mode: 0o755 });
    writeFileSync(
      join(fixture, 'bin/id'),
      '#!/bin/sh\ncase "$1" in -u) echo 1001;; -g) echo 1234;; *) exit 2;; esac\n',
      { mode: 0o755 },
    );
    writeFileSync(join(fixture, 'runner/foreign'), 'preserve');
    const output = join(fixture, 'output');
    writeFileSync(output, '');
    const exported = join(fixture, 'ui/apps/docs/test-results/icons-consumer/result/receipt.json');
    const env = {
      ...process.env,
      STUB_BIN: posix(join(fixture, 'bin')),
      SUBJECT: posix(join(fixture, 'ui/.github/scripts/browser-check.sh')),
      ICONS_ROOT: posix(join(fixture, 'icons')),
      CAPTURE: posix(join(fixture, 'capture')),
      RUNNER_TEMP: posix(join(fixture, 'runner')),
      GITHUB_OUTPUT: posix(output),
      GITHUB_ACTIONS: 'true',
      RUNNER_ENVIRONMENT: 'self-hosted',
      GITHUB_RUN_ID: '123',
      UI_SOURCE_COMMIT: 'a'.repeat(40),
      GITHUB_RUN_ATTEMPT: '1',
      RUNNER_NAME: 'fixture',
      RUNNER_OS: 'Linux',
      E2E_SMOKE: '0',
      CREATE_STATUS: '0',
      START_STATUS: '0',
      REMOVE_STATUS: '0',
      BAD_LINK: 'false',
      INTERRUPT: 'false',
      FOREIGN_FILE: posix(join(fixture, 'runner/foreign')),
      EXPORTED_RECEIPT: posix(exported),
      ...overrides,
    };
    const result = spawnSync(bash, ['--noprofile', '--norc'], {
      env,
      input: `export PATH="$STUB_BIN:$PATH"\nsource "$SUBJECT"${mode === 'icons' ? ' --icons-consumer "$ICONS_ROOT"' : ''}\n`,
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
    const captured = read(join(fixture, 'capture/create.args'));
    const work = read(join(fixture, 'capture/work'));
    return {
      ...result,
      args: captured?.split('\0').slice(0, -1),
      order: read(join(fixture, 'capture/order'))?.trim().split('\n'),
      outputs: read(output),
      exported: read(exported),
      foreign: read(join(fixture, 'runner/foreign')),
      workExists: work
        ? existsSync(process.platform === 'win32' ? work.replace(/^\/([a-z])\//, '$1:/') : work)
        : false,
    };
  } finally {
    const target = realpathSync(fixture);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-browser-'));
    rmSync(target, { recursive: true, force: true });
  }
}

test('one unprivileged owner removes its container before copying diagnostics and deleting its files', () => {
  const result = runFixture();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.order, ['create', 'start', 'rm']);
  assert.equal(result.args[result.args.indexOf('--user') + 1], '1001:1234');
  assert.equal(result.args.filter((arg) => arg.endsWith(',readonly')).length, 2);
  assert.ok(result.args.includes('GITHUB_RUN_ID') && result.args.includes('RUNNER_ENVIRONMENT'));
  assert.equal(result.exported, '{"outcome":"fixture"}\n');
  assert.equal(result.foreign, 'preserve');
  assert.equal(result.workExists, false);
  assert.equal(result.outputs, 'icons_ready=true\n');
  assert.ok(result.stdout.indexOf('::stop-commands::') < result.stdout.indexOf('::set-output'));
});

test('failed workload and cancellation retain failure, diagnostics and bounded cleanup', () => {
  for (const overrides of [{ START_STATUS: '7' }, { INTERRUPT: 'true' }]) {
    const result = runFixture(overrides);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.order, ['create', 'start', 'rm']);
    assert.equal(result.exported, '{"outcome":"fixture"}\n');
    assert.equal(result.foreign, 'preserve');
    assert.equal(result.workExists, false);
  }
});

test('create failure still removes an assigned CID; removal failure forbids copying unstable output', () => {
  const create = runFixture({ CREATE_STATUS: '9' });
  assert.equal(create.status, 9);
  assert.deepEqual(create.order, ['create', 'rm']);
  assert.equal(create.workExists, false);
  const removal = runFixture({ REMOVE_STATUS: '11' });
  assert.notEqual(removal.status, 0);
  assert.equal(removal.exported, null);
  assert.equal(removal.outputs, '');
  assert.equal(removal.workExists, true);
  assert.equal(removal.foreign, 'preserve');
});

test('linked diagnostics are refused without copying or changing foreign files', () => {
  const result = runFixture({ BAD_LINK: 'true' });
  assert.notEqual(result.status, 0);
  assert.equal(result.exported, null);
  assert.equal(result.outputs, '');
  assert.equal(result.foreign, 'preserve');
  assert.equal(result.workExists, false);
});

test('the Icons workload refuses a non-runner invocation before allocating a container', () => {
  const result = runFixture({ GITHUB_ACTIONS: 'false' });
  assert.notEqual(result.status, 0);
  assert.equal(result.args, undefined);
  assert.equal(result.exported, null);
  assert.equal(result.foreign, 'preserve');
});

test('the existing full E2E mode forwards its mode and keeps Icons out of that workload', () => {
  const result = runFixture({}, 'e2e');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(
    result.args.includes('E2E_SMOKE=0') && result.args.includes('LABUI_BROWSER_WORKLOAD=e2e'),
  );
  assert.equal(result.args.filter((arg) => arg.endsWith(',readonly')).length, 1);
  assert.equal(result.outputs, '');
  assert.equal(result.foreign, 'preserve');
});
