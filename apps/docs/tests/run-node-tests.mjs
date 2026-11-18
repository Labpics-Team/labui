import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [scope, ...options] = process.argv.slice(2);
if (!['docs', 'icons'].includes(scope)) {
  throw new Error('Usage: node run-node-tests.mjs docs|icons');
}

const cwd = fileURLToPath(new URL('.', import.meta.url));
const files = globSync('**/*.test.mjs', { cwd, exclude: ['**/node_modules/**'] }).sort();
const isIconContract = (file) => /^(?:icons-|prepare-icons-inputs)/.test(basename(file));
// Both the docs package and the packed consumer validate the terminal receipt.
const terminal = 'icons-public-terminal.test.mjs';
if (!files.includes(terminal)) throw new Error(`Missing shared contract: ${terminal}`);
const selected = files.filter(
  (file) => file !== terminal && isIconContract(file) === (scope === 'icons'),
);
if (!selected.length) {
  throw new Error(`No Node.js test files found for ${scope}`);
}
selected.push(terminal);

const child = spawnSync(
  process.execPath,
  ['--test', ...options, ...selected.map((file) => join(cwd, file))],
  {
    stdio: 'inherit',
  },
);
if (child.error) throw child.error;
process.exitCode = child.status ?? 1;
