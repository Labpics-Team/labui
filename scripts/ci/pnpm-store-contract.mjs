#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
  browser: readFileSync('.github/scripts/browser-check.sh', 'utf8'),
};

const count = (source, needle) => source.split(needle).length - 1;
const installLines = (source) =>
  source.split('\n').filter((line) => line.includes('pnpm install --frozen-lockfile'));

function violations(subject) {
  const out = [];
  const expected = { ci: 2, full: 1, browser: 1 };
  for (const [name, source] of Object.entries(subject)) {
    const installs = installLines(source);
    if (installs.length !== expected[name])
      out.push(`${name}: unexpected frozen install count ${installs.length}`);
    const bare = installs.filter((line) => !line.includes('--store-dir'));
    if (bare.length) out.push(`${name}: shared/bare pnpm store use: ${bare.join(' | ')}`);
  }

  const jobStore = 'store="$RUNNER_TEMP/pnpm-store-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$GITHUB_JOB"';
  if (count(subject.ci, jobStore) !== 2 || count(subject.ci, '--store-dir "$store"') !== 2)
    out.push('ci.yml must bind both installs to the per-job RUNNER_TEMP store');

  if (count(subject.full, '--store-dir "$RUNNER_TEMP/pnpm-store"') !== 1)
    out.push('e2e-full.yml must use its runner-local temporary pnpm store');

  if (count(subject.browser, '--store-dir /job/pnpm-store') !== 1)
    out.push('browser-check must use the isolated container pnpm store');

  return out;
}

const actual = violations(files);
if (actual.length) throw new Error(actual.join('\n'));

const mutants = [
  { ...files, ci: files.ci.replace('--store-dir "$store"', '') },
  { ...files, full: files.full.replace('--store-dir "$RUNNER_TEMP/pnpm-store"', '') },
  { ...files, browser: files.browser.replace('--store-dir /job/pnpm-store', '') },
];
for (const [index, mutant] of mutants.entries()) {
  if (violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped pnpm store contract`);
}

process.stdout.write('pnpm store contract: PASS (live + 3 sabotage controls)\n');
