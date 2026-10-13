#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (manifest.scripts?.['pnpm:devPreinstall'] !== 'node scripts/ci/install-policy.mjs')
  throw new Error('Default installs must stop before dependency lifecycle scripts');

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
    ci: {
      count: 1,
      command: 'pnpm install --frozen-lockfile --ignore-scripts --store-dir "$store"',
    },
    full: {
      count: 0,
      command:
        'pnpm install --frozen-lockfile --ignore-scripts --store-dir "$RUNNER_TEMP/pnpm-store"',
    },
    browser: {
      count: 1,
      command: 'pnpm install --frozen-lockfile --ignore-scripts --store-dir /job/pnpm-store',
    },
  };
  for (const [name, source] of Object.entries(subject)) {
    const installs = installLines(source);
    if (installs.length !== expected[name].count)
      out.push(`${name}: unexpected frozen install count ${installs.length}`);
    if (installs.some((line) => line !== expected[name].command))
      out.push(`${name}: frozen installs must use the isolated pnpm store`);
  }

  for (const name of ['ci', 'browser']) {
    const rebuilds = subject[name]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^pnpm rebuild(?:\s|$)/.test(line));
    if (
      JSON.stringify(rebuilds) !==
      JSON.stringify([
        `pnpm rebuild @biomejs/biome esbuild --store-dir ${name === 'ci' ? '"$store"' : '/job/pnpm-store'}`,
      ])
    )
      out.push(`${name}: builds must remain limited to the two reviewed dependencies`);
  }

  const jobStore = 'store="$RUNNER_TEMP/pnpm-store-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$GITHUB_JOB"';
  if (subject.ci.split('\n').filter((line) => line.trim() === jobStore).length !== 1)
    out.push('ci.yml must bind the quality install to the per-job RUNNER_TEMP store');

  return out;
}

const actual = violations(files);
if (actual.length) throw new Error(actual.join('\n'));

const mutants = [
  { ...files, ci: files.ci.replace('--ignore-scripts ', '') },
  { ...files, browser: files.browser.replace('--ignore-scripts ', '') },
  { ...files, ci: files.ci.replace('pnpm rebuild @biomejs/biome esbuild', 'pnpm rebuild') },
  {
    ...files,
    browser: files.browser.replace('pnpm rebuild @biomejs/biome esbuild', 'pnpm rebuild malicious'),
  },
  { ...files, ci: files.ci.replace('--store-dir "$store"', '') },
  { ...files, full: `${files.full}\n        run: pnpm install --frozen-lockfile\n` },
  { ...files, browser: files.browser.replace('--store-dir /job/pnpm-store', '') },
  {
    ...files,
    ci: files.ci.replace(
      'pnpm install --frozen-lockfile --ignore-scripts --store-dir "$store"',
      '# pnpm install --frozen-lockfile --ignore-scripts --store-dir "$store"',
    ),
  },
];
for (const [index, mutant] of mutants.entries()) {
  if (violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped pnpm store contract`);
}

process.stdout.write(`pnpm store contract: PASS (live + ${mutants.length} sabotage controls)\n`);
