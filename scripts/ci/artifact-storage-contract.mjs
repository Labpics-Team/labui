import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const directory = new URL('../../.github/workflows/', import.meta.url);
const usesStorage = /actions\/(?:upload-artifact|upload-pages-artifact)@|@actions\/artifact/iu;
const validate = (text) => assert.doesNotMatch(text, usesStorage);

test('all workflows keep diagnostic output local', () => {
  for (const name of readdirSync(directory)) {
    if (!/\.ya?ml$/u.test(name)) continue;
    validate(readFileSync(new URL(name, directory), 'utf8'));
  }
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
