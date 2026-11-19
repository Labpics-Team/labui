import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const directory = new URL('../../.github/workflows/', import.meta.url);
const usesStorage = /actions\/(?:upload-artifact|upload-pages-artifact)@|@actions\/artifact/iu;
const validate = (text) => assert.doesNotMatch(text, usesStorage);
const browserJobs = (text) =>
  text
    .split(/^ {2}(?=[\w-]+:\s*(?:#.*)?$)/mu)
    .filter((job) => /run: bash \.github\/scripts\/browser-check\.sh/u.test(job));

test('browser jobs keep diagnostic output local', () => {
  for (const name of readdirSync(directory)) {
    if (!/\.ya?ml$/u.test(name)) continue;
    for (const job of browserJobs(readFileSync(new URL(name, directory), 'utf8'))) validate(job);
  }
});

test('native packages can be handed to consumers without changing browser diagnostics', () => {
  const native = '  native:\n    steps:\n      - uses: actions/upload-artifact@v4\n';
  const browser = '  browser:\n    steps:\n      - run: bash .github/scripts/browser-check.sh\n';
  const jobs = browserJobs(`jobs:\n${native}${browser}`);
  assert.equal(jobs.length, 1);
  jobs.forEach(validate);
  assert.throws(() =>
    browserJobs(`jobs:\n${browser}      - uses: actions/upload-artifact@v4\n`).forEach(validate),
  );
});

test('the browser check remains mandatory without archive storage', () => {
  for (const name of ['ci.yml', 'e2e-full.yml']) {
    const text = readFileSync(new URL(name, directory), 'utf8');
    assert.match(text, /run: bash \.github\/scripts\/browser-check\.sh/u);
  }
});

test('ordinary diagnostic uploads cannot return', () => {
  for (const action of ['upload-artifact', 'upload-pages-artifact']) {
    assert.throws(() => validate(`steps:\n  - uses: actions/${action}@v4\n`));
  }
  assert.throws(() => validate("const client = require('@actions/artifact');"));
  validate('steps:\n  - run: pnpm test:e2e\n');
});
