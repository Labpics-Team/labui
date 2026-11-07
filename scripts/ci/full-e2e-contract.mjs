#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
  browser: readFileSync('.github/scripts/browser-check.sh', 'utf8'),
};

// Recognize the ordinary env/assignment prefixes used by workflow shell commands.
const commandLine = (line) =>
  line
    .trim()
    .replace(/^run:\s*/, '')
    .replace(/^(?:(?:env|[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+))\s+)*/, '');
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
const ownerLines = (source) => {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
  const end = lines.findIndex((line, index) => index > 0 && !line.startsWith('      '));
  return lines.slice(0, end < 0 ? lines.length : end);
};
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
  if (
    activeLines(subject.browser).some((line) =>
      /E2E_SMOKE\s*=|unset\s+E2E_SMOKE|env\s+-u\s+E2E_SMOKE/.test(line),
    )
  )
    out.push('browser helper must inherit the caller full/smoke mode');
  if (activeLines(subject.browser).filter((line) => line === 'pnpm test:e2e').length !== 1)
    out.push('browser runtime must execute the canonical E2E command once');
  return out;
}

const actual = fullBrowserProblems(files);
if (actual.length) throw new Error(actual.join('\n'));

const fullBlock = browserOwners(files.full)[0];
const browserMutants = [
  [
    'owner moved to disabled neighboring job',
    {
      ...files,
      full: `${files.full.replace(fullBlock, '')}\n  displaced:\n    if: false\n    runs-on: ubuntu-latest\n    steps:\n${fullBlock}      - name: Neighbor step\n        run: true\n`,
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
    'overridden caller mode',
    {
      ...files,
      browser: files.browser.replace('  pnpm test:e2e', '  E2E_SMOKE=1 pnpm test:e2e'),
    },
  ],
  [
    'missing canonical command',
    { ...files, browser: files.browser.replace('  pnpm test:e2e', '  # pnpm test:e2e') },
  ],
  [
    'host install after owner',
    {
      ...files,
      full: files.full.replace(
        browserRun,
        `${browserRun}\n      - name: Accidental host install\n        run: pnpm install --frozen-lockfile`,
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
      full: `${files.full}\n  unrelated:\n    if: false\n    runs-on: ubuntu-latest\n    steps:\n      - name: Unrelated step\n        run: true\n`,
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
  `full E2E contract: PASS (source + ${browserMutants.length} sabotage controls, ${browserVariants.length} lawful variants)`,
);
