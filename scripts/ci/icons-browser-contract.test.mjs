import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  GIT_DEADLINE_MS,
  GIT_TRACE_MAX_BYTES,
  createGitRunner,
  summarizeGitTrace,
} from '../../apps/docs/tests/icons-git-diagnostics.mjs';

const helper = readFileSync(
  new URL('../../.github/scripts/browser-check.sh', import.meta.url),
  'utf8',
);
const workflow = readFileSync(
  new URL('../../.github/workflows/icons-consumer.yml', import.meta.url),
  'utf8',
);

test('Icons workflow delegates the workload and preserves exact source-read failure', () => {
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(
    workflow,
    /container:\n\s+image: mcr\.microsoft\.com\/playwright:v1\.55\.1-noble@sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c\n\s+options: --init/,
  );
  assert.match(
    workflow,
    /UI_SOURCE_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
  );
  assert.match(
    workflow,
    /ref: \$\{\{ env\.UI_SOURCE_COMMIT \}\}\n\s+path: ui\n\s+persist-credentials: false/,
  );
  assert.match(
    workflow,
    /set -euo pipefail\n\s+sha="\$\(node ui\/apps\/docs\/tests\/prepare-icons-inputs\.mjs --checkout-ref\)"\n\s+printf/,
  );
  assert.match(
    workflow,
    /repository: Labpics-Team\/lab-icons\n\s+ref: \$\{\{ steps\.source\.outputs\.sha \}\}\n\s+path: icons\n\s+persist-credentials: false/,
  );
  assert.match(
    workflow,
    /run: bash ui\/\.github\/scripts\/browser-check\.sh --icons-consumer "\$GITHUB_WORKSPACE\/icons"/,
  );
  assert.doesNotMatch(
    workflow,
    /self-hosted|head\.repo\.full_name|pnpm\/action-setup|pnpm install|chown/,
  );
});

test('the browser helper scopes diagnostics and preserves the consumer exit status', () => {
  assert.match(helper, /import \{ assertActionsRunner \}.*assertActionsRunner\(\)/);
  assert.match(helper, /exec 2>&1/);
  assert.match(helper, /trap 'printf "::%s::\\n" "\$resume_token"' EXIT/);
  assert.ok(helper.indexOf('::stop-commands::') < helper.indexOf('corepack enable'));
  assert.ok(helper.indexOf('::stop-commands::') < helper.indexOf('node --input-type=module'));
  assert.match(
    helper,
    /LABUI_ICONS_GIT_DIAGNOSTICS="\$output" node apps\/docs\/tests\/prepare-icons-inputs\.mjs/,
  );
  assert.match(
    helper,
    /--subject "\$output\/inputs\/subject\.json" --out "\$output\/result" \|\| status=\$\?/,
  );
  assert.match(
    helper,
    /--summarize "\$output" \|\| \{\n\s+if \[ "\$status" -eq 0 \]; then status=1; fi\n\s+\}\n\s+exit "\$status"/,
  );
  assert.doesNotMatch(helper, /docker|--cidfile|\/job\/|chown|--consumer-exit-code/);
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
