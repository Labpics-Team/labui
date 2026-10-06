import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  constants,
  accessSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
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

test('quality scope retains all product files and only exempts the pinned policy carrier', () => {
  const config = JSON.parse(read('biome.json'));
  assert.deepEqual(config.files.ignore, [
    '**/dist/**',
    '.github/actions/labpics-sca-policy/**',
    '**/node_modules/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/src/generated/**',
    '**/src/astro/**',
    '**/.svelte-kit/**',
    '**/*.svelte',
    '**/*.generated.json',
    '**/*.tsbuildinfo',
    'packages/colors/contract.css',
    'packages/colors/contract.min.css',
    'packages/colors/figma-reference.css',
    'scripts/minify-contract.cjs',
  ]);
  assert.equal(config.linter.enabled, true);
  assert.equal(config.formatter.enabled, true);
  assert.equal(config.vcs.enabled, true);
});

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
    'node scripts/ci/pnpm-store-contract.mjs',
    'set -euo pipefail\nstore="$RUNNER_TEMP/pnpm-store-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$GITHUB_JOB"\nrm -rf -- "$store"\npnpm install --frozen-lockfile --ignore-scripts --store-dir "$store"\npnpm rebuild @biomejs/biome esbuild --store-dir "$store"',
    'pnpm lint',
    'pnpm run format:check',
    'pnpm typecheck',
    'pnpm --filter @labpics/ui-shadow check-generated',
    'pnpm --filter @labpics/ui-tokens check-generated',
    'pnpm --filter @labpics/ui-materials check-generated',
    'pnpm build',
    'node scripts/ci/artifact-retention-contract.mjs\nnode --test ci/workflow-contract.test.mjs\nnode --test scripts/ci/vitest-projects-contract.mjs\nnode --test scripts/ci/scan-policy.test.mjs',
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
  assert.deepEqual(runFull.env, { E2E_SMOKE: '0' });
  for (const job of [ci.jobs.e2e, full.jobs['e2e-full']]) {
    assert.equal(
      job.steps.find((step) => step.run === 'bash .github/scripts/browser-check.sh').id,
      'browser',
    );
    for (const step of job.steps.filter((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    )) {
      const output = step.with.path.startsWith('packages/colors/') ? 'fx_ready' : 'report_ready';
      const status = output === 'fx_ready' ? '!cancelled()' : 'failure()';
      assert.equal(step.if, `\${{ ${status} && steps.browser.outputs.${output} == 'true' }}`);
    }
  }
  assert.match(
    browser,
    /playwright:v1\.55\.1-noble@sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c/,
  );
  assert.equal(
    JSON.parse(read('apps/docs/package.json')).devDependencies['@playwright/test'],
    '1.55.1',
  );
  const ordered = [
    'pnpm install --frozen-lockfile --ignore-scripts --store-dir /job/pnpm-store',
    'pnpm rebuild @biomejs/biome esbuild --store-dir /job/pnpm-store',
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

test('Playwright resolves both engines and the complete smoke/full test inventory', (t) => {
  const docs = join(root, 'apps/docs');
  const cli = join(docs, 'node_modules/@playwright/test/cli.js');
  const reportDir = mkdtempSync(join(tmpdir(), 'labui-playwright-config-'));
  t.after(() => rmSync(reportDir, { recursive: true, force: true }));
  const reporter = join(reportDir, 'config.cjs');
  const configReport = join(reportDir, 'config.json');
  writeFileSync(
    reporter,
    `const { writeFileSync } = require('node:fs');
module.exports = class {
  onBegin(config) {
    writeFileSync(process.env.LABUI_CONFIG_REPORT, JSON.stringify(
      config.projects.map(({ name, use }) => ({ name, use }))
    ));
  }
};
`,
  );
  const expectedSmoke = [
    'acrylic-live.spec.ts',
    'button.spec.ts',
    'checkbox.spec.ts',
    'input.spec.ts',
    'materials-flag.spec.ts',
    'pin-input.spec.ts',
    'proof.spec.ts',
    'smoke.spec.ts',
    'tokens.spec.ts',
    'z-order.spec.ts',
  ].sort();
  const expectedFull = readdirSync(join(docs, 'tests'), { recursive: true })
    .filter((path) => path.endsWith('.spec.ts'))
    .map((path) => path.replaceAll('\\', '/'))
    .sort();
  assert.ok(expectedFull.length > expectedSmoke.length, 'full coverage must extend beyond smoke');
  for (const [smoke, workflow, jobKey] of [
    [true, ci, 'e2e'],
    [false, full, 'e2e-full'],
  ]) {
    const job = workflow.jobs[jobKey];
    const step = job.steps.find((entry) => entry.run === 'bash .github/scripts/browser-check.sh');
    const env = {
      ...process.env,
      E2E_SMOKE: '1',
      ...workflow.env,
      ...job.env,
      ...step.env,
      CI: 'true',
      LABUI_CONFIG_REPORT: configReport,
    };
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'test',
        '--list',
        `--reporter=json,${reporter}`,
        '--project=chromium',
        '--project=webkit',
      ],
      { cwd: docs, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const resolved = JSON.parse(readFileSync(configReport, 'utf8'));
    assert.deepEqual(
      resolved.map(({ name, use }) => ({
        name,
        browser: use.browserName ?? use.defaultBrowserType ?? 'chromium',
      })),
      [
        { name: 'chromium', browser: 'chromium' },
        { name: 'webkit', browser: 'webkit' },
      ],
      'project names must correspond to the actual browser engines',
    );
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.errors, []);
    const files = { chromium: new Set(), webkit: new Set() };
    function visit(suites) {
      for (const suite of suites) {
        for (const spec of suite.specs ?? []) {
          for (const entry of spec.tests) {
            assert.ok(Object.hasOwn(files, entry.projectName));
            files[entry.projectName].add(spec.file.replaceAll('\\', '/'));
          }
        }
        visit(suite.suites ?? []);
      }
    }
    visit(report.suites);
    for (const engine of ['chromium', 'webkit']) {
      assert.deepEqual(
        [...files[engine]].sort(),
        smoke ? expectedSmoke : expectedFull,
        `${engine}/${smoke ? 'smoke' : 'full'}`,
      );
    }
  }
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
  if [ -n "\${ARTIFACT_SETUP:-}" ]; then bash "$ARTIFACT_SETUP" "$(dirname "$2")/work/source"; fi
  printf owned-container > "$2"; echo owned-container; exit 0;;
start)
  if [ "\${FORGE_OUTPUT:-0}" = 1 ]; then
    printf '%s\\n' '::set-output name=report_ready::true' '::guessed-resume-token::'
    printf '%s\\n' '::set-output name=fx_ready::true' >&2
  fi
  exit "\${START_STATUS:-0}";;
rm) exit "\${REMOVE_STATUS:-0}";;
esac
if [[ "$*" == *--download-db-only* ]]; then
  count=0; if [ -f "$PROBE_COUNT" ]; then count="$(cat "$PROBE_COUNT")"; fi
  count=$((count + 1)); echo "$count" > "$PROBE_COUNT"
  if [ "$count" -le "\${DB_FAILURES:-0}" ]; then exit 19; fi
  for argument; do if [[ "$argument" == *:/cache ]]; then cache="\${argument%:/cache}"; fi; done
  mkdir -p "$cache/db"
  printf x > "$cache/db/trivy.db"
  printf '{"Version":2,"UpdatedAt":"%s","NextUpdate":"%s"}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)" > "$cache/db/metadata.json"
  exit 0
fi
out=''
for argument; do if [[ "$argument" == *:/out ]]; then out="\${argument%:/out}"; fi; done
if [ "\${REPORT:-yes}" = yes ]; then
  vulnerabilities='[]'
  if [ "\${VULN:-no}" = yes ]; then vulnerabilities='[{"VulnerabilityID":"CVE-CONTRACT-BLOCK","PkgName":"contract-fixture","InstalledVersion":"1","Severity":"HIGH"}]'; fi
  printf '{"SchemaVersion":2,"ArtifactName":"/src","ArtifactType":"filesystem","Trivy":{"Version":"0.74.0"},"CreatedAt":"%s","Results":[{"Target":"pnpm-lock.yaml","Class":"lang-pkgs","Type":"pnpm","Packages":[{"Name":"contract-fixture","Version":"1"}],"Vulnerabilities":%s}]}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$vulnerabilities" > "$out/trivy-report.json"
fi
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
      GITHUB_OUTPUT: posix(join(dir, 'outputs')),
    },
  };
}

test('scanner fails on unavailable DB, findings, engine failure and missing report', async (t) => {
  assert.equal(
    ci.jobs.sca.steps.find((step) => step.run === 'bash .github/scripts/scan.sh').if,
    undefined,
  );
  for (const text of [
    '--scanners vuln,secret,misconfig,license',
    '--severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL',
    '--exit-code 0',
    '--include-dev-deps --include-non-failures --list-all-pkgs --show-suppressed',
    '--ignorefile /dev/null',
    'scan-policy.mjs assess',
    '--skip-db-update --skip-java-db-update',
  ])
    assert.ok(scanner.includes(text));
  for (const [name, vars, expected, scanned] of [
    ['clean', {}, 0, true],
    ['retry', { DB_FAILURES: '2' }, 0, true],
    ['database unavailable', { DB_FAILURES: '5' }, 1, false],
    ['findings', { VULN: 'yes' }, 1, true],
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
      else
        assert.equal(
          JSON.parse(readFileSync(join(dir, 'trivy-report.txt'), 'utf8')).ArtifactName,
          '/src',
        );
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
        vars.REMOVE_STATUS !== undefined,
      );
    });
});

test('artifact export rejects source and destination escapes before enabling upload', async (t) => {
  for (const kind of [
    'clean',
    'test-failure',
    'remove-failure',
    'source-link',
    'parent-link',
    'report-link',
    'child-link',
    'destination-parent',
    'destination-file',
    'destination-hardlink',
    'fifo',
  ]) {
    await t.test(kind, (st) => {
      const { dir, env } = fakeDocker(st);
      const checkout = join(dir, 'checkout');
      const foreign = join(dir, 'foreign');
      mkdirSync(checkout);
      mkdirSync(join(foreign, 'playwright-report'), { recursive: true });
      writeFileSync(join(foreign, 'index.html'), 'host-private');
      writeFileSync(join(foreign, 'playwright-report/index.html'), 'host-private');
      const setup = join(dir, 'artifact-setup.sh');
      writeFileSync(
        setup,
        `#!/usr/bin/env bash
set -euo pipefail
if [ "$ARTIFACT_KIND" = source-link ]; then ln -s "$ARTIFACT_FOREIGN" "$1"; exit 0; fi
mkdir -p "$1/packages/colors/artifacts/fx-render" "$1/apps"
printf fresh > "$1/packages/colors/artifacts/fx-render/render.png"
if [ "$ARTIFACT_KIND" = parent-link ]; then ln -s "$ARTIFACT_FOREIGN" "$1/apps/docs"; exit 0; fi
mkdir -p "$1/apps/docs"
report="$1/apps/docs/playwright-report"
if [ "$ARTIFACT_KIND" = report-link ]; then ln -s "$ARTIFACT_FOREIGN" "$report"; exit 0; fi
mkdir "$report"
case "$ARTIFACT_KIND" in
child-link) ln -s "$ARTIFACT_FOREIGN/index.html" "$report/index.html";;
fifo) mkfifo "$report/index.html";;
*) printf fresh > "$report/index.html";;
esac
if [ "$ARTIFACT_KIND" = destination-parent ]; then
  mkdir -p "$ARTIFACT_CHECKOUT/apps"
  ln -s "$ARTIFACT_FOREIGN" "$ARTIFACT_CHECKOUT/apps/docs"
fi
if [[ "$ARTIFACT_KIND" == destination-file || "$ARTIFACT_KIND" == destination-hardlink ]]; then
  mkdir -p "$ARTIFACT_CHECKOUT/apps/docs/playwright-report"
  if [ "$ARTIFACT_KIND" = destination-file ]; then
    ln -s "$ARTIFACT_FOREIGN/index.html" "$ARTIFACT_CHECKOUT/apps/docs/playwright-report/index.html"
  else
    ln "$ARTIFACT_FOREIGN/index.html" "$ARTIFACT_CHECKOUT/apps/docs/playwright-report/index.html"
  fi
fi
`,
      );
      const script = browser.replace(
        'root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"',
        `root='${checkout.replaceAll('\\', '/')}'`,
      );
      const result = execute(script, {
        ...env,
        ARTIFACT_SETUP: setup,
        ARTIFACT_KIND: kind,
        ARTIFACT_FOREIGN: foreign,
        ARTIFACT_CHECKOUT: checkout,
        START_STATUS: kind === 'test-failure' ? '23' : '0',
        REMOVE_STATUS: kind === 'remove-failure' ? '7' : '0',
      });
      const safe = kind === 'clean' || kind === 'test-failure';
      assert.equal(result.status, safe ? (kind === 'clean' ? 0 : 23) : 1, result.stderr);
      const outputs = existsSync(env.GITHUB_OUTPUT) ? readFileSync(env.GITHUB_OUTPUT, 'utf8') : '';
      assert.equal(outputs, safe ? 'fx_ready=true\nreport_ready=true\n' : '');
      assert.equal(readFileSync(join(foreign, 'index.html'), 'utf8'), 'host-private');
      assert.equal(
        readFileSync(join(foreign, 'playwright-report/index.html'), 'utf8'),
        'host-private',
      );
      if (safe)
        assert.equal(
          readFileSync(join(checkout, 'apps/docs/playwright-report/index.html'), 'utf8'),
          'fresh',
        );
      const calls = readFileSync(env.PROBE_LOG, 'utf8');
      assert.match(calls, /rm --force owned-container/);
      assert.equal(
        readdirSync(dir).some((name) => name.startsWith('labui-browser.')),
        kind === 'remove-failure',
      );
    });
  }
});

test('workload output remains outside the Actions command channel through cleanup', () => {
  const tokens = new Set();
  for (const [name, vars, expected] of [
    ['success', {}, 0],
    ['test failure', { START_STATUS: '23' }, 23],
    ['removal failure', { REMOVE_STATUS: '7' }, 1],
  ]) {
    const cleanups = [];
    const fixture = { after: (cleanup) => cleanups.push(cleanup) };
    try {
      const { dir, env } = fakeDocker(fixture);
      const checkout = join(dir, 'checkout');
      mkdirSync(checkout);
      const script = browser.replace(
        'root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"',
        `root='${checkout.replaceAll('\\', '/')}'`,
      );
      function check(text) {
        const result = execute(text, { ...env, ...vars, FORGE_OUTPUT: '1' });
        assert.equal(result.status, expected, result.stderr);
        const lines = result.stdout.trim().split(/\r?\n/);
        const pause = lines.findIndex((line) => /^::stop-commands::[0-9a-f]{64}$/.test(line));
        assert.ok(pause >= 0, `${name}: workflow command processing must stop`);
        const token = lines[pause].slice('::stop-commands::'.length);
        const resume = lines.indexOf(`::${token}::`);
        assert.equal(resume, lines.length - 1, 'resume only after workload and cleanup output');
        for (const output of ['report_ready', 'fx_ready']) {
          const forged = lines.indexOf(`::set-output name=${output}::true`);
          assert.ok(
            forged > pause && forged < resume,
            'forged outputs must remain inside the disabled channel',
          );
        }
        assert.equal(
          existsSync(env.GITHUB_OUTPUT),
          false,
          'missing artifacts cannot produce trusted outputs',
        );
        return token;
      }
      const token = check(script);
      assert.equal(tokens.has(token), false, 'resume tokens are unique');
      tokens.add(token);
      const mutation = script.replace('printf \'::stop-commands::%s\\n\' "$ci_resume_token"', ':');
      assert.notEqual(mutation, script);
      assert.throws(() => check(mutation), /workflow command processing must stop/);
      assert.throws(
        () => check(script.replace('exec 2>&1', ':')),
        /forged outputs must remain inside the disabled channel/,
      );
    } finally {
      for (const cleanup of cleanups) cleanup();
    }
  }
});
