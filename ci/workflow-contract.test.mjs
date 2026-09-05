import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  constants,
  accessSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
function parse(text) {
  const docs = parseAllDocuments(text, { uniqueKeys: true, strict: true, version: '1.2' });
  assert.equal(docs.length, 1);
  assert.deepEqual(docs[0].errors, []);
  return docs[0].toJS({ maxAliasCount: 100 });
}
const ci = parse(read('.github/workflows/ci.yml'));
const full = parse(read('.github/workflows/e2e-full.yml'));
const scanner = read('.github/scripts/scan.sh');
const browser = read('.github/scripts/browser-check.sh');

function resolveBash() {
  if (process.platform !== 'win32') return 'bash';
  const dirs = (process.env.PATH ?? process.env.Path ?? '').split(delimiter);
  const candidates = dirs
    .filter((dir) => existsSync(join(dir, 'git.exe')))
    .flatMap((dir) => [
      join(dir, '../bin/bash.exe'),
      join(dir, '../../bin/bash.exe'),
      join(dir, 'bash.exe'),
    ]);
  for (const path of candidates) {
    try {
      accessSync(path, constants.X_OK);
      return resolve(path);
    } catch {}
  }
  throw new Error('Git Bash is required to execute the CI contract');
}
const bash = resolveBash();
function execute(script, env, cwd = root) {
  return spawnSync(bash, ['--noprofile', '--norc', '-euo', 'pipefail', '-s'], {
    cwd,
    input: (env.PROBE_BIN ? 'export PATH="$PROBE_BIN:$PATH"\n' : '') + script,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}
function checkGraph(workflow) {
  const jobs = workflow.jobs;
  assert.deepEqual(
    [...jobs.ci.needs].sort(),
    Object.keys(jobs)
      .filter((id) => id !== 'ci')
      .sort(),
  );
  assert.equal(jobs.ci.if, '${{ always() }}');
  assert.deepEqual(jobs.ci.permissions, {});
  assert.equal(jobs.ci.steps.length, 1);
  assert.equal(jobs.ci.steps[0].env.NEEDS_RESULTS, "${{ join(needs.*.result, ',') }}");
  for (const [id, job] of Object.entries(jobs)) {
    assert.equal(job['runs-on'], 'self-hosted');
    assert.equal(job['continue-on-error'], undefined);
    for (const step of job.steps) assert.equal(step['continue-on-error'], undefined);
    if (id !== 'ci') {
      assert.equal(
        job.if,
        "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository",
      );
    }
  }
}

test('required graph covers every native check and all admitted events', () => {
  checkGraph(ci);
  assert.deepEqual(ci.on, { push: { branches: ['main'] }, pull_request: null, merge_group: null });
  assert.deepEqual(ci.permissions, { contents: 'read' });
  assert.equal(
    ci.concurrency.group,
    '${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}',
  );
  assert.equal(ci.concurrency['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
  assert.deepEqual(readdirSync(join(root, '.github/workflows')).sort(), ['ci.yml', 'e2e-full.yml']);
  const extra = structuredClone(ci);
  extra.jobs.future = structuredClone(ci.jobs.quality);
  assert.throws(() => checkGraph(extra));
  extra.jobs.ci.needs.push('future');
  checkGraph(extra);
  for (const key of ['sca', 'quality', 'e2e']) {
    const incomplete = structuredClone(ci);
    incomplete.jobs.ci.needs = incomplete.jobs.ci.needs.filter((id) => id !== key);
    assert.throws(() => checkGraph(incomplete));
    const ignored = structuredClone(ci);
    ignored.jobs[key]['continue-on-error'] = true;
    assert.throws(() => checkGraph(ignored));
  }
});

test('original quality commands remain ordered and CI tests cannot disappear', () => {
  const commands = ci.jobs.quality.steps
    .filter((step) => step.run && step.name !== 'Prepare workspace ownership')
    .map((step) => step.run.trim());
  assert.deepEqual(commands, [
    'pnpm install --frozen-lockfile',
    'npm ci --ignore-scripts --prefix ci\nnode --test ci/workflow-contract.test.mjs',
    'pnpm lint',
    'pnpm run format:check',
    'pnpm typecheck',
    'pnpm --filter @labpics/ui-shadow check-generated',
    'pnpm --filter @labpics/ui-tokens check-generated',
    'pnpm --filter @labpics/ui-materials check-generated',
    'pnpm build',
    'pnpm test',
  ]);
  const node = ci.jobs.quality.steps.find((step) => step.name === 'Setup Node');
  assert.equal(node.with['node-version'], 22);
  const pnpm = ci.jobs.quality.steps.find((step) => step.name === 'Setup pnpm');
  assert.equal(pnpm.with.dest, '${{ runner.temp }}/setup-pnpm');
  const missing = spawnSync(process.execPath, ['--test', 'ci/missing-contract.test.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(missing.status, 0);
});

test('native aggregate rejects every non-success and an empty result set', () => {
  const gate = ci.jobs.ci.steps[0].run;
  const check = (script, results) => execute(script, { NEEDS_RESULTS: results }).status === 0;
  for (let count = 1; count <= 4; count++) {
    const values = Array(count).fill('success');
    assert.equal(check(gate, values.join(',')), true);
    for (let i = 0; i < count; i++) {
      for (const status of ['failure', 'cancelled', 'skipped', 'neutral', 'unknown', '']) {
        const bad = [...values];
        bad[i] = status;
        assert.equal(check(gate, bad.join(',')), false, bad.join(','));
      }
    }
  }
  assert.equal(check(gate, ''), false);
  assert.equal(check('exit 0', 'failure'), true, 'counterexample must catch an always-green gate');
});

test('browser execution preserves both engines, FX and full-suite cadence', () => {
  assert.deepEqual(
    ci.jobs.e2e.steps
      .filter((step) => step.run)
      .map((step) => step.run.trim())
      .slice(1),
    ['bash .github/scripts/browser-check.sh'],
  );
  assert.deepEqual(
    ci.jobs.e2e.steps.find((step) => step.run === 'bash .github/scripts/browser-check.sh').env,
    { E2E_SMOKE: '1' },
  );
  assert.deepEqual(full.on, { schedule: [{ cron: '0 3 * * *' }], workflow_dispatch: null });
  const runFull = full.jobs['e2e-full'].steps.find(
    (step) => step.run === 'bash .github/scripts/browser-check.sh',
  );
  assert.equal(runFull.env, undefined);
  assert.match(
    browser,
    /playwright:v1\.55\.1-noble@sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c/,
  );
  assert.equal(
    JSON.parse(read('apps/docs/package.json')).devDependencies['@playwright/test'],
    '1.55.1',
  );
  const ordered = [
    'pnpm install --frozen-lockfile',
    'pnpm build',
    'pnpm --filter @labpics/ui-docs exec playwright install chromium webkit',
    'pnpm --filter @labui/colors fx:render',
    'pnpm test:e2e',
  ];
  let previous = -1;
  for (const command of ordered) {
    const index = browser.indexOf(command);
    assert.ok(index > previous);
    previous = index;
  }
  assert.doesNotMatch(
    browser,
    /pkill|--network[= ]host|--publish|--privileged|docker\.sock|\|\| true/,
  );
  assert.match(browser, /source=\$\{root\},target=\/source,readonly/);
  assert.match(browser, /--user "\$\(id -u\):\$\(id -g\)"/);
  assert.match(browser, /docker rm --force "\$container"/);
  assert.match(browser, /trap 'exit 143' TERM/);
});

function fakeDocker(t) {
  const dir = mkdtempSync(join(tmpdir(), 'labui-contract-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const posix = (value) => value.replaceAll('\\', '/');
  writeFileSync(
    join(dir, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$PROBE_LOG"
case "$1" in
create) if [ "\${CREATE_STATUS:-0}" -ne 0 ]; then exit "$CREATE_STATUS"; fi
  while [ "$1" != --cidfile ]; do shift; done
  printf owned-container > "$2"; echo owned-container; exit 0;;
start) exit "\${START_STATUS:-0}";;
rm) exit "\${REMOVE_STATUS:-0}";;
esac
if [[ "$*" == *--download-db-only* ]]; then
  count=0; if [ -f "$PROBE_COUNT" ]; then count="$(cat "$PROBE_COUNT")"; fi
  count=$((count + 1)); echo "$count" > "$PROBE_COUNT"
  if [ "$count" -le "\${DB_FAILURES:-0}" ]; then exit 19; fi
  exit 0
fi
out=''
for argument; do if [[ "$argument" == *:/out ]]; then out="\${argument%:/out}"; fi; done
if [ "\${REPORT:-yes}" = yes ]; then printf 'fresh report\\n' > "$out/trivy-report.txt"; fi
exit "\${SCAN_STATUS:-0}"
`,
    { mode: 0o755 },
  );
  writeFileSync(join(dir, 'sleep'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  return {
    dir,
    env: {
      PATH: [dir, process.env.PATH ?? process.env.Path].join(delimiter),
      RUNNER_TEMP: posix(dir),
      TRIVY_IMAGE: 'fixture@sha256:0',
      PROBE_BIN: posix(dir).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`),
      PROBE_LOG: posix(join(dir, 'calls')),
      PROBE_COUNT: posix(join(dir, 'count')),
    },
  };
}

test('scanner fails on unavailable DB, findings, engine failure and missing report', async (t) => {
  assert.equal(
    ci.jobs.sca.steps.find((step) => step.run === 'bash .github/scripts/scan.sh').if,
    undefined,
  );
  for (const text of [
    '--scanners vuln,secret,misconfig',
    '--severity HIGH,CRITICAL',
    '--exit-code 1',
    '--skip-db-update --skip-java-db-update',
  ])
    assert.ok(scanner.includes(text));
  for (const [name, vars, expected, scanned] of [
    ['clean', {}, 0, true],
    ['retry', { DB_FAILURES: '2' }, 0, true],
    ['database unavailable', { DB_FAILURES: '5' }, 1, false],
    ['findings', { SCAN_STATUS: '1' }, 1, true],
    ['engine error', { SCAN_STATUS: '2' }, 2, true],
    ['other error', { SCAN_STATUS: '17' }, 17, true],
    ['missing report', { REPORT: 'no' }, 1, true],
  ])
    await t.test(name, (st) => {
      const { dir, env } = fakeDocker(st);
      writeFileSync(join(dir, 'trivy-report.txt'), 'stale report');
      const result = execute(scanner, { ...env, ...vars });
      assert.equal(result.status, expected, result.stderr);
      const calls = readFileSync(join(dir, 'calls'), 'utf8');
      assert.equal(calls.includes('fs /src'), scanned);
      assert.equal(
        readdirSync(dir).some((name) => name.startsWith('trivy-output.')),
        false,
      );
      if (!scanned || vars.REPORT === 'no')
        assert.equal(existsSync(join(dir, 'trivy-report.txt')), false);
      else assert.equal(readFileSync(join(dir, 'trivy-report.txt'), 'utf8'), 'fresh report\n');
    });
  await t.test('discarding scanner status is observable', (st) => {
    const { env } = fakeDocker(st);
    assert.equal(
      execute(scanner.replace('exit "$status"', 'exit 0'), { ...env, SCAN_STATUS: '17' }).status,
      0,
    );
    assert.equal(execute(scanner, { ...env, SCAN_STATUS: '17' }).status, 17);
  });
});

test('browser wrapper preserves process errors and removes only its created container', async (t) => {
  for (const [name, vars, expected, created] of [
    ['success', {}, 0, true],
    ['test failed', { START_STATUS: '23' }, 23, true],
    ['create failed', { CREATE_STATUS: '19' }, 19, false],
    ['cleanup failed', { REMOVE_STATUS: '7' }, 1, true],
  ])
    await t.test(name, (st) => {
      const { dir, env } = fakeDocker(st);
      const script = browser.replace(
        'root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"',
        `root='${root.replaceAll('\\', '/')}'`,
      );
      const result = execute(script, { ...env, ...vars });
      assert.equal(result.status, expected, result.stderr);
      const calls = readFileSync(join(dir, 'calls'), 'utf8');
      assert.equal(calls.includes('rm --force owned-container'), created);
      assert.equal(
        readdirSync(dir).some((name) => name.startsWith('labui-browser.')),
        false,
      );
    });
});
