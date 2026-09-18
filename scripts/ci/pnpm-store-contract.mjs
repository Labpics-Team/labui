#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
  full: readFileSync('.github/workflows/e2e-full.yml', 'utf8'),
  browser: readFileSync('.github/scripts/browser-check.sh', 'utf8'),
};
const host = 'pnpm install --frozen-lockfile --store-dir "$RUNNER_TEMP/pnpm-store"';
const container = 'pnpm install --frozen-lockfile --store-dir /job/pnpm-store';
const count = (source, needle) => source.split(needle).length - 1;

function violations(subject) {
  const out = [];
  if (count(subject.ci, host) !== 2) out.push('ci.yml must isolate both pnpm installs in RUNNER_TEMP');
  if (count(subject.full, host) !== 1) out.push('e2e-full.yml must isolate pnpm install in RUNNER_TEMP');
  if (count(subject.browser, container) !== 1) out.push('browser-check must isolate pnpm store inside /job');
  for (const [name, source] of Object.entries(subject)) {
    const bare = source.split('\n').filter(line => line.includes('pnpm install --frozen-lockfile') && !line.includes('--store-dir'));
    if (bare.length) out.push(`${name} contains shared/bare pnpm store use: ${bare.join(' | ')}`);
  }
  return out;
}

const actual = violations(files);
if (actual.length) throw new Error(actual.join('\n'));
const mutants = [
  { ...files, ci: files.ci.replace(host, 'pnpm install --frozen-lockfile') },
  { ...files, full: files.full.replace(host, 'pnpm install --frozen-lockfile') },
  { ...files, browser: files.browser.replace(container, 'pnpm install --frozen-lockfile') },
];
for (const [index, mutant] of mutants.entries()) {
  if (violations(mutant).length === 0) throw new Error(`mutation ${index + 1} escaped pnpm store contract`);
}
console.log('pnpm store contract: PASS (live + 3 sabotage controls)');
