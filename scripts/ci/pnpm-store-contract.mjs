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
    ci: { count: 2, command: 'pnpm install --frozen-lockfile --store-dir "$store"' },
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
  if (subject.ci.split('\n').filter((line) => line.trim() === jobStore).length !== 2)
    out.push('ci.yml must bind both installs to the per-job RUNNER_TEMP store');

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
];
for (const [index, mutant] of mutants.entries()) {
  if (violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped pnpm store contract`);
}

process.stdout.write(`pnpm store contract: PASS (live + ${mutants.length} sabotage controls)\n`);
