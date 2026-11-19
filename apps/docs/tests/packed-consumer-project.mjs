import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const corepack = join(
  dirname(process.execPath),
  process.platform === 'win32'
    ? 'node_modules/corepack/dist/pnpm.js'
    : '../lib/node_modules/corepack/dist/pnpm.js',
);

export function runPnpm(args, cwd) {
  return execFileSync(process.execPath, [corepack, ...args], {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
    windowsHide: true,
  });
}

export async function writePackedConsumerProject(consumer, { name, dependencies, overrides }) {
  const { packageManager } = JSON.parse(
    await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
  );
  assert.match(packageManager, /^pnpm@\d+\.\d+\.\d+(?:[-+].+)?$/, 'The project must pin pnpm');
  // Outside the repository Corepack otherwise selects its machine-wide default.
  await writeFile(
    join(consumer, 'package.json'),
    `${JSON.stringify({ name, private: true, type: 'module', packageManager, dependencies }, null, 2)}\n`,
  );
  // pnpm 11 no longer reads package.json#pnpm. This config also works on pnpm 10
  // and keeps every transitive LabUI dependency on the tarballs under test.
  await writeFile(
    join(consumer, 'pnpm-workspace.yaml'),
    `${JSON.stringify({ packages: ['.'], overrides }, null, 2)}\n`,
  );
}
