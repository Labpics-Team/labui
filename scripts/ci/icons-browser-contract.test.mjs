import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  GIT_DEADLINE_MS,
  GIT_TRACE_MAX_BYTES,
  createGitRunner,
  summarizeGitTrace,
} from '../../apps/docs/tests/icons-git-diagnostics.mjs';

const helper = new URL('../../.github/scripts/browser-check.sh', import.meta.url);
const workflow = readFileSync(
  new URL('../../.github/workflows/icons-consumer.yml', import.meta.url),
  'utf8',
);
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const posix = (path) =>
  path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);

test('each local runtime archive is packed and supplied to both input and installed-consumer handoffs', () => {
  const source = readFileSync(helper, 'utf8');
  const core = JSON.parse(
    readFileSync(new URL('../../packages/core/package.json', import.meta.url)),
  );
  const local = Object.entries(core.dependencies)
    .filter(([, range]) => range.startsWith('workspace:'))
    .map(([name]) => name.replace('@labpics/ui-', ''));
  for (const name of ['core', ...local]) {
    assert.ok(
      source.includes(`pnpm --dir packages/${name} pack --pack-destination /job/output/ui-${name}`),
      `missing packed ${name}`,
    );
    assert.equal(
      source.split(`--ui-${name}-tarball /job/output/ui-${name}/*.tgz`).length - 1,
      2,
      `both handoffs require ${name}`,
    );
  }
});

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
    mkdir -p "$work/output/result" "$work/output/inputs" "$work/output/icons"
    printf '{"outcome":"fixture"}\\n' > "$work/output/result/receipt.json"
    "$REAL_NODE" "$MAKE_PUBLIC" "$work/output" || exit 91
    if [ "$MISSING_MANIFEST" = true ]; then rm "$work/output/public/manifest.json"; fi
    if [ "$TRUNCATED_MANIFEST" = true ]; then printf '{"projectionVersion":\\n' > "$work/output/public/manifest.json"; fi
    printf 'private-source-reference\\n' > "$work/output/inputs/subject.json"
    printf 'private-producer-archive\\n' > "$work/output/icons/producer.tgz"
    if [ "$RAW_TRACE" = file ]; then printf 'secret-argv-env-config\\n' > "$work/output/.git-trace2.raw"; fi
    if [ "$RAW_TRACE" = directory ]; then mkdir "$work/output/.git-trace2.raw"; fi
    if [ "$BAD_LINK" = true ]; then ln "$work/output/public/receipt.json" "$CAPTURE/receipt-link"; fi
    printf '::set-output name=icons_ready::forged\\n'
    if [ "$INTERRUPT" = true ]; then kill -TERM "$PPID"; fi
    exit "$START_STATUS";;
  rm)
    [ ! -e "$EXPORTED_RECEIPT" ]
    exit "$REMOVE_STATUS";;
  *) exit 99;;
esac
`;

function assertFixtureReceipt(bytes) {
  const report = JSON.parse(bytes);
  assert.equal(report.projectionVersion, 1);
  assert.equal(report.evidence.outcome, 'fixture');
  assert.match(report.originalBytesSha256, /^[a-f0-9]{64}$/);
}

function runFixture(overrides = {}, mode = 'icons', helperText = undefined) {
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
    if (helperText === undefined)
      copyFileSync(helper, join(fixture, 'ui/.github/scripts/browser-check.sh'));
    else writeFileSync(join(fixture, 'ui/.github/scripts/browser-check.sh'), helperText);
    writeFileSync(join(fixture, 'bin/docker'), recorder, { mode: 0o755 });
    const prepareFile = fileURLToPath(
      new URL('../../apps/docs/tests/prepare-icons-inputs.mjs', import.meta.url),
    );
    writeFileSync(
      join(fixture, 'bin/node'),
      `#!/bin/sh\nshift\nexec '${posix(process.execPath)}' '${posix(prepareFile)}' "$@"\n`,
      { mode: 0o755 },
    );
    const producer = join(fixture, 'bin/make-public.mjs');
    writeFileSync(
      producer,
      `import { exportPublicEvidence } from ${JSON.stringify(new URL('../../apps/docs/tests/prepare-icons-inputs.mjs', import.meta.url).href)};\nawait exportPublicEvidence(process.argv[2], { jsonFiles: new Map([['receipt.json', Buffer.from('{"outcome":"fixture"}\\n')]]), visuals: [], privateLocations: [] });\n`,
    );
    writeFileSync(
      join(fixture, 'bin/id'),
      '#!/bin/sh\ncase "$1" in -u) echo "$TEST_UID";; -g) echo "$TEST_GID";; *) exit 2;; esac\n',
      { mode: 0o755 },
    );
    writeFileSync(join(fixture, 'runner/foreign'), 'preserve');
    const output = join(fixture, 'output');
    writeFileSync(output, '');
    const exported = join(fixture, 'ui/apps/docs/test-results/icons-consumer/receipt.json');
    if (overrides.STALE_ARTIFACT === 'true') {
      const stale = join(dirname(exported), 'inputs');
      mkdirSync(stale, { recursive: true });
      writeFileSync(join(stale, 'subject.json'), 'prior-private-source\n');
    }
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
      TEST_UID: '1001',
      TEST_GID: '1234',
      CREATE_STATUS: '0',
      START_STATUS: '0',
      REMOVE_STATUS: '0',
      BAD_LINK: 'false',
      RAW_TRACE: 'none',
      MISSING_MANIFEST: 'false',
      TRUNCATED_MANIFEST: 'false',
      REAL_NODE: posix(process.execPath),
      MAKE_PUBLIC: posix(producer),
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
    assert.equal(
      result.error,
      undefined,
      JSON.stringify({
        overrides,
        stdout: result.stdout,
        stderr: result.stderr,
        order: existsSync(join(fixture, 'capture/order'))
          ? readFileSync(join(fixture, 'capture/order'), 'utf8')
          : null,
      }),
    );
    const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
    const captured = read(join(fixture, 'capture/create.args'));
    const work = read(join(fixture, 'capture/work'));
    return {
      ...result,
      args: captured?.split('\0').slice(0, -1),
      order: read(join(fixture, 'capture/order'))?.trim().split('\n'),
      outputs: read(output),
      exported: read(exported),
      rawTrace: read(join(fixture, 'ui/apps/docs/test-results/icons-consumer/.git-trace2.raw')),
      rawSubject: read(
        join(fixture, 'ui/apps/docs/test-results/icons-consumer/inputs/subject.json'),
      ),
      producerArchive: read(
        join(fixture, 'ui/apps/docs/test-results/icons-consumer/icons/producer.tgz'),
      ),
      foreign: read(join(fixture, 'runner/foreign')),
      runnerEntries: readdirSync(join(fixture, 'runner')),
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
  assertFixtureReceipt(result.exported);
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
    assertFixtureReceipt(result.exported);
    assert.equal(result.foreign, 'preserve');
    assert.equal(result.workExists, false);
  }
});

test('public export excludes raw subjects and archives; an incomplete projection refuses readiness', () => {
  const healthy = runFixture();
  assert.equal(healthy.status, 0);
  assert.equal(healthy.rawSubject, null);
  assert.equal(healthy.producerArchive, null);
  const incomplete = runFixture({ MISSING_MANIFEST: 'true' });
  assert.notEqual(incomplete.status, 0);
  assert.equal(incomplete.exported, null);
  assert.equal(incomplete.outputs, '');
  assert.equal(incomplete.foreign, 'preserve');
  const truncated = runFixture({ START_STATUS: '7', TRUNCATED_MANIFEST: 'true' });
  assert.equal(truncated.status, 7);
  assert.equal(truncated.outputs, '');
  assert.equal(truncated.exported, null);
  const stale = runFixture({ STALE_ARTIFACT: 'true' });
  assert.notEqual(stale.status, 0);
  assert.equal(stale.outputs, '');
  assert.equal(stale.exported, null);
  assert.equal(stale.rawSubject, 'prior-private-source\n');
  const oldCopy = readFileSync(helper, 'utf8').replace(
    'icons_ready output/public',
    'icons_ready output',
  );
  const counterexample = runFixture({}, 'icons', oldCopy);
  assert.notEqual(counterexample.status, 0);
  assert.equal(counterexample.outputs, '');
  assert.equal(counterexample.rawSubject, null);
  assert.equal(counterexample.producerArchive, null);
});

test('inner workload and cancellation status survive a later summary refusal', () => {
  const script = readFileSync(helper, 'utf8');
  const snippet = / {6}status=0\n[\s\S]*? {6}exit "\$status"/.exec(script)?.[0];
  assert.ok(snippet);
  for (const [workStatus, summaryStatus, expected] of [
    [7, 1, 7],
    [143, 1, 143],
    [0, 1, 1],
    [0, 0, 0],
  ]) {
    const result = spawnSync(bash, ['--noprofile', '--norc'], {
      input: `set -euo pipefail\nnode() { case "$1" in *icons-packed.mjs) return "$WORK_STATUS";; *prepare-icons-inputs.mjs) return "$SUMMARY_STATUS";; *) return 99;; esac; }\n${snippet}\n`,
      env: {
        ...process.env,
        WORK_STATUS: String(workStatus),
        SUMMARY_STATUS: String(summaryStatus),
      },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, expected);
  }
});

test('preparation scopes Git diagnostics and preserves failure before the browser', () => {
  const body = runFixture().args.at(-1);
  const script = body
    .split('pnpm --dir packages/shadow pack --pack-destination /job/output/ui-shadow')[1]
    .split('    else')[0];
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(parent, 'labui-icons-git-scope-'));
  try {
    writeFileSync(
      join(fixture, 'node'),
      `#!/bin/sh
printf '%s %s\\n' "$1" "\${LABUI_ICONS_GIT_DIAGNOSTICS:-unset}" >> "$CAPTURE"
case "$*" in *--summarize*) exit 0;; esac
case "$1" in *prepare-icons-inputs.mjs) exit "$PREPARE_STATUS";; esac
`,
      { mode: 0o755 },
    );
    for (const status of ['0', '23']) {
      const capture = join(fixture, 'capture');
      writeFileSync(capture, '');
      const result = spawnSync(bash, ['--noprofile', '--norc'], {
        env: {
          ...process.env,
          STUB_BIN: posix(fixture),
          CAPTURE: posix(capture),
          PREPARE_STATUS: status,
          UI_SOURCE_COMMIT: 'a'.repeat(40),
        },
        input: `set -euo pipefail\nexport PATH="$STUB_BIN:$PATH"\n${script}`,
        encoding: 'utf8',
        timeout: 10_000,
      });
      assert.equal(result.status, Number(status), result.stdout + result.stderr);
      assert.equal(
        readFileSync(capture, 'utf8'),
        `apps/docs/tests/prepare-icons-inputs.mjs /job/output\n${
          status === '0'
            ? 'apps/docs/tests/icons-packed.mjs unset\napps/docs/tests/prepare-icons-inputs.mjs unset\n'
            : ''
        }`,
      );
    }
  } finally {
    const target = realpathSync(fixture);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-git-scope-'));
    rmSync(target, { recursive: true, force: true });
  }
});

const traceLine = (value) => JSON.stringify({ sid: 'secret-process-id', thread: 'main', ...value });
const trace = (...values) => Buffer.from(`${values.map(traceLine).join('\n')}\n`);

test('Git Trace2 keeps the last open region while discarding argv, env, config and unknown text', () => {
  const report = summarizeGitTrace(
    trace(
      { event: 'version', exe: '2.43.0' },
      { event: 'start', argv: ['git', 'https://token:secret@remote'] },
      { event: 'def_param', param: 'http.extraHeader', value: 'secret-header' },
      { event: 'cmd_name', name: 'status', hierarchy: 'secret-hierarchy' },
      { event: 'region_enter', category: 'index', label: 'do_read_index', nesting: 1, t_abs: 0.1 },
      {
        event: 'region_leave',
        category: 'index',
        label: 'do_read_index',
        nesting: 1,
        t_abs: 0.2,
        t_rel: 0.1,
      },
      { event: 'region_enter', category: 'index', label: 'refresh', nesting: 1, t_abs: 0.3 },
      {
        event: 'data',
        category: 'index',
        key: 'refresh/sum_scan',
        value: '1552',
        env: 'secret-env',
      },
      { event: 'region_enter', category: 'secret-category', label: 'secret-label', nesting: 2 },
      { event: 'data', category: 'index', key: 'refresh/sum_lstat', value: 'secret-counter' },
    ),
  );
  assert.equal(report.gitVersion, '2.43.0');
  assert.deepEqual(report.openRegions, [
    {
      event: 'region_enter',
      process: 1,
      elapsedSeconds: 0.3,
      category: 'index',
      label: 'refresh',
      nesting: 1,
    },
  ]);
  assert.ok(
    report.events.some((event) => event.counter === 'refresh/sum_scan' && event.value === 1552),
  );
  assert.doesNotMatch(JSON.stringify(report), /secret|argv|env|param|hierarchy/);
});

test('Git Trace2 bounds bytes, event history and unmatched regions and marks incomplete input', () => {
  const many = trace(
    ...Array.from({ length: 1000 }, (_, i) => ({
      event: 'region_enter',
      category: 'index',
      label: 'refresh',
      nesting: i,
      t_abs: i,
    })),
  );
  const report = summarizeGitTrace(many);
  assert.equal(report.events.length, 24);
  assert.equal(report.openRegions.length, 16);
  assert.equal(report.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(report)) < 8192);
  const oversized = summarizeGitTrace(
    Buffer.concat([
      Buffer.from(' '.repeat(GIT_TRACE_MAX_BYTES)),
      trace({ event: 'version', exe: '9.9.9' }),
    ]),
  );
  assert.equal(oversized.truncated, true);
  assert.equal(oversized.gitVersion, null);
  assert.equal(oversized.invalidLines, 1);
  assert.doesNotThrow(() => summarizeGitTrace(Buffer.from('null\n[]\n{broken\n')));
});

test('Git diagnostics retains the exact deadline, original timeout error and normal untraced call', () => {
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(parent, 'labui-icons-git-trace-'));
  const failure = Object.assign(new Error('secret error text'), {
    code: 'ETIMEDOUT',
    status: null,
    signal: 'SIGTERM',
    spawnargs: ['secret-argv'],
  });
  try {
    const output = [];
    const observed = [];
    const run = createGitRunner(
      fixture,
      (file, args, options) => {
        observed.push({ file, args, options });
        writeFileSync(
          options.env.GIT_TRACE2_EVENT,
          trace(
            { event: 'version', exe: '2.43.0' },
            { event: 'region_enter', category: 'index', label: 'refresh', nesting: 1, t_abs: 0.1 },
          ),
        );
        throw failure;
      },
      (line) => output.push(line),
    );
    assert.throws(
      () => run('/job/icons', ['status', '--porcelain', '--untracked-files=no']),
      (error) => error === failure,
    );
    assert.equal(observed[0].options.timeout, 20_000);
    assert.equal(GIT_DEADLINE_MS, 20_000);
    assert.deepEqual(observed[0].args, [
      '--no-replace-objects',
      'status',
      '--porcelain',
      '--untracked-files=no',
    ]);
    assert.equal(observed[0].options.env.GIT_TRACE2_ENV_VARS, '');
    assert.equal(observed[0].options.env.GIT_TRACE2_CONFIG_PARAMS, '');
    const report = JSON.parse(readFileSync(join(fixture, 'git-diagnostics.json'), 'utf8'));
    assert.equal(report.source, 'icons');
    assert.equal(report.error, 'ETIMEDOUT');
    assert.equal(report.exitStatus, null);
    assert.equal(report.signal, 'SIGTERM');
    assert.equal(report.openRegions.at(-1).label, 'refresh');
    assert.equal(existsSync(join(fixture, '.git-trace2.raw')), false);
    assert.doesNotMatch(output.join(''), /secret/);
    assert.ok(Buffer.byteLength(output.join('')) < 8192);
    const value = Buffer.from('expected');
    const plain = createGitRunner(undefined, (file, args, options) => {
      assert.equal(file, 'git');
      assert.deepEqual(args, ['--no-replace-objects', 'rev-parse', 'HEAD']);
      assert.deepEqual(options, { cwd: '/job/source', timeout: 20_000 });
      return value;
    });
    assert.equal(plain('/job/source', ['rev-parse', 'HEAD']), value);
    const brokenObserver = createGitRunner(
      fixture,
      (_file, _args, options) => {
        rmSync(options.env.GIT_TRACE2_EVENT);
        throw failure;
      },
      () => {
        throw new Error('closed stderr');
      },
    );
    assert.throws(
      () => brokenObserver('/job/icons', ['status']),
      (error) => error === failure,
    );
  } finally {
    const target = realpathSync(fixture);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-git-trace-'));
    rmSync(target, { recursive: true, force: true });
  }
});

test('native Git Trace2 supplies the actual binary version and sanitizes its events', () => {
  const parent = realpathSync(tmpdir());
  const fixture = mkdtempSync(join(parent, 'labui-icons-git-native-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: fixture, timeout: 5000 });
    const run = createGitRunner(fixture);
    assert.equal(run(fixture, ['status', '--porcelain', '--untracked-files=no']).toString(), '');
    const report = JSON.parse(readFileSync(join(fixture, 'git-diagnostics.json'), 'utf8'));
    assert.match(report.gitVersion, /^\d+\.\d+\.\d+/);
    assert.equal(report.outcome, 'passed');
    assert.ok(report.events.some((event) => event.command === 'status'));
    assert.equal(report.openRegions.length, 0);
    assert.equal(report.invalidLines, 0);
    assert.equal(existsSync(join(fixture, '.git-trace2.raw')), false);
  } finally {
    const target = realpathSync(fixture);
    assert.equal(dirname(target), parent);
    assert.ok(basename(target).startsWith('labui-icons-git-native-'));
    rmSync(target, { recursive: true, force: true });
  }
});

test('cancellation raw trace is removed before export; an unremovable raw trace forbids export', () => {
  const safe = runFixture({ RAW_TRACE: 'file', START_STATUS: '7' });
  assert.equal(safe.status, 7);
  assertFixtureReceipt(safe.exported);
  assert.equal(safe.rawTrace, null);
  const unsafe = runFixture({ RAW_TRACE: 'directory' });
  assert.notEqual(unsafe.status, 0);
  assert.equal(unsafe.exported, null);
  assert.equal(unsafe.outputs, '');
  assert.equal(unsafe.foreign, 'preserve');
  for (const overrides of [
    { RAW_TRACE: 'directory', START_STATUS: '7' },
    { RAW_TRACE: 'directory', INTERRUPT: 'true' },
    { REMOVE_STATUS: '11', START_STATUS: '7' },
  ]) {
    const failed = runFixture(overrides);
    assert.equal(failed.status, overrides.INTERRUPT === 'true' ? 143 : 7);
    assert.equal(failed.outputs, '');
    assert.equal(failed.exported, null);
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

test('the Icons workload refuses root UID before creating writable job files or a container', () => {
  for (const gid of ['0', '1234']) {
    const result = runFixture({ TEST_UID: '0', TEST_GID: gid });
    assert.notEqual(result.status, 0);
    assert.equal(result.args, undefined);
    assert.equal(result.order, undefined);
    assert.equal(result.outputs, '');
    assert.equal(result.exported, null);
    assert.deepEqual(result.runnerEntries, ['foreign']);
    assert.equal(result.foreign, 'preserve');
  }
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
