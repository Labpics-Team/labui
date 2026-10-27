#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
  browser: readFileSync('.github/scripts/browser-check.sh', 'utf8'),
};

// Recognize the ordinary env/assignment prefixes used by workflow shell commands.
const commandLine = (line) =>
  line
    .trim()
    .replace(/^run:\s*/, '')
    .replace(/^(?:(?:env|[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+))\s+)*/, '');
const installLines = (source) =>
  source
    .split('\n')
    .map(commandLine)
    .filter((line) => /^pnpm install --frozen-lockfile(?:\s|$)/.test(line));

const browserRun = 'run: bash .github/scripts/browser-check.sh';
const fullOwner = [
  '        id: browser',
  '        shell: bash',
  '        env:',
  '          E2E_SMOKE: "0"',
  `        ${browserRun}`,
].sort();
const activeLines = (source) =>
  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
const ownerLines = (source) =>
  source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
const browserOwners = (source) =>
  source.split(/(?=^ {6}- )/m).filter((block) => activeLines(block).includes(browserRun));

function fullBrowserProblems(subject) {
  const out = [];
  const jobs = subject.full
    .replace(/\r\n/g, '\n')
    .split(/(?=^(?: {2})?[A-Za-z_][A-Za-z0-9_-]*:)/m)
    .filter((block) => /^ {2}e2e-full:[ \t]*(?:#.*)?\n/.test(block));
  if (
    jobs.length !== 1 ||
    jobs[0]
      .split('\n')
      .some(
        (line) =>
          /^ {4}if[ \t]*:/.test(line) ||
          (/^ {4}continue-on-error[ \t]*:/.test(line) &&
            !/^ {4}continue-on-error[ \t]*:[ \t]*false[ \t]*(?:#.*)?$/.test(line)),
      )
  )
    out.push('full E2E job must run unconditionally and preserve failures');

  const owners = browserOwners(jobs.length === 1 ? jobs[0] : '');
  const fields = owners.length === 1 ? ownerLines(owners[0]).slice(1) : [];
  const envIndex = fields.indexOf('        env:');
  if (
    owners.length !== 1 ||
    browserOwners(subject.full).length !== 1 ||
    fields.slice().sort().join('\n') !== fullOwner.join('\n') ||
    envIndex === -1 ||
    fields[envIndex + 1] !== '          E2E_SMOKE: "0"'
  )
    out.push('full E2E must have one unconditional browser owner with explicit full mode');
  if (
    activeLines(subject.full).some((line) =>
      /^(?:pnpm|corepack|npx)(?:\s|$)/.test(commandLine(line)),
    )
  )
    out.push('full E2E installation and workload belong to the browser runtime');
  const forwarded = '--env "E2E_SMOKE=${E2E_SMOKE:-}" "$image" bash -euo pipefail -c ' + "'";
  const modeLines = activeLines(subject.browser).filter((line) => /--env.*E2E_SMOKE=/.test(line));
  if (modeLines.length !== 1 || modeLines[0] !== forwarded)
    out.push('browser runtime must forward the caller full/smoke mode');
  if (activeLines(subject.browser).filter((line) => line === 'pnpm test:e2e').length !== 1)
    out.push('browser runtime must execute the canonical E2E command once');
  return out;
}

function violations(subject) {
  const out = [];
  const expected = {
    ci: { count: 1, command: 'pnpm install --frozen-lockfile --store-dir "$store"' },
    full: { count: 0, command: '' },
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

  out.push(...fullBrowserProblems(subject));
  return out;
}

const actual = violations(files);
if (actual.length) throw new Error(actual.join('\n'));

const mutants = [
  { ...files, ci: files.ci.replace('--store-dir "$store"', '') },
  {
    ...files,
    full: files.full.replace(
      browserRun,
      `${browserRun}\n      - name: Accidental host install\n        run: pnpm install --frozen-lockfile --store-dir "$RUNNER_TEMP/pnpm-store"`,
    ),
  },
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

const fullBlock = browserOwners(files.full)[0];
const browserMutants = [
  [
    'owner moved to disabled neighboring job',
    {
      ...files,
      full: `${files.full.replace(fullBlock, '')}\n  displaced:\n    if: false\n    runs-on: self-hosted\n    steps:\n${fullBlock}      - name: Neighbor step\n        run: true\n`,
    },
  ],
  [
    'conditional job',
    {
      ...files,
      full: files.full.replace('    steps:', '    if: false\n    steps:'),
    },
  ],
  ['condition after steps', { ...files, full: `${files.full}\n    if: false\n` }],
  [
    'ignored job failure',
    {
      ...files,
      full: files.full.replace('    steps:', '    continue-on-error: true\n    steps:'),
    },
  ],
  [
    'ignored job failure after steps',
    { ...files, full: `${files.full}\n    continue-on-error: true\n` },
  ],
  [
    'misnested mode',
    {
      ...files,
      full: files.full.replace('          E2E_SMOKE: "0"', '        E2E_SMOKE: "0"'),
    },
  ],
  [
    'mode under scalar field',
    {
      ...files,
      full: files.full.replace(
        '        shell: bash\n        env:\n          E2E_SMOKE: "0"',
        '        env:\n        shell: bash\n          E2E_SMOKE: "0"',
      ),
    },
  ],
  [
    'env-prefixed host install',
    {
      ...files,
      full: files.full.replace(
        browserRun,
        `${browserRun}\n      - name: Host install\n        run: env CI=1 pnpm install --frozen-lockfile`,
      ),
    },
  ],
  [
    'assignment-prefixed host install',
    {
      ...files,
      full: files.full.replace(
        browserRun,
        `${browserRun}\n      - name: Host install\n        run: CI=1 pnpm install --frozen-lockfile`,
      ),
    },
  ],
  ['missing owner', { ...files, full: files.full.replace(browserRun, 'run: true') }],
  ['commented owner', { ...files, full: files.full.replace(browserRun, `# ${browserRun}`) }],
  ['duplicate owner', { ...files, full: files.full.replace(fullBlock, fullBlock + fullBlock) }],
  [
    'conditional owner',
    { ...files, full: files.full.replace(browserRun, `${browserRun}\n        if: false`) },
  ],
  [
    'ignored owner failure',
    {
      ...files,
      full: files.full.replace(browserRun, `${browserRun}\n        continue-on-error: true`),
    },
  ],
  [
    'smoke instead of full',
    { ...files, full: files.full.replace('E2E_SMOKE: "0"', 'E2E_SMOKE: "1"') },
  ],
  [
    'implicit full mode',
    { ...files, full: files.full.replace('E2E_SMOKE: "0"', '# E2E_SMOKE: "0"') },
  ],
  [
    'lost forwarded mode',
    {
      ...files,
      browser: files.browser.replace('E2E_SMOKE=${E2E_SMOKE:-}', 'E2E_SMOKE=1'),
    },
  ],
  [
    'missing canonical command',
    { ...files, browser: files.browser.replace('    pnpm test:e2e', '    # pnpm test:e2e') },
  ],
  [
    'host install after owner',
    {
      ...files,
      full: files.full.replace(
        browserRun,
        `${browserRun}\n      - name: Accidental host install\n        run: pnpm install --frozen-lockfile --store-dir "$RUNNER_TEMP/pnpm-store"`,
      ),
    },
  ],
];
for (const [name, mutant] of browserMutants) {
  if (JSON.stringify(mutant) === JSON.stringify(files) || fullBrowserProblems(mutant).length === 0)
    throw new Error(`browser ownership control survived: ${name}`);
}
const browserVariants = [
  [
    'conditional neighboring job',
    {
      ...files,
      full: `${files.full}\n  unrelated:\n    if: false\n    runs-on: self-hosted\n    steps:\n      - name: Unrelated step\n        run: true\n`,
    },
  ],
  [
    'explicit blocking job after steps',
    { ...files, full: `${files.full}\n    continue-on-error: false\n` },
  ],
  [
    'env block after run',
    {
      ...files,
      full: files.full.replace(
        `        env:\n          E2E_SMOKE: "0"\n        ${browserRun}`,
        `        ${browserRun}\n        env:\n          E2E_SMOKE: "0"`,
      ),
    },
  ],
  [
    'renamed step',
    {
      ...files,
      full: files.full.replace(
        fullBlock,
        fullBlock.replace(/^ {6}- name: .*$/m, '      - name: Complete browser coverage'),
      ),
    },
  ],
  [
    'reordered fields',
    {
      ...files,
      full: files.full.replace(
        '        id: browser\n        shell: bash',
        '        shell: bash\n        id: browser',
      ),
    },
  ],
  [
    'CRLF',
    Object.fromEntries(
      Object.entries(files).map(([name, value]) => [name, value.replace(/\r?\n/g, '\r\n')]),
    ),
  ],
];
for (const [name, variant] of browserVariants) {
  if (
    JSON.stringify(variant) === JSON.stringify(files) ||
    fullBrowserProblems(variant).length !== 0
  )
    throw new Error(`lawful browser variant rejected: ${name}`);
}
console.info(
  `full browser ownership: PASS (${browserMutants.length} sabotage controls, ${browserVariants.length} lawful variants)`,
);

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
