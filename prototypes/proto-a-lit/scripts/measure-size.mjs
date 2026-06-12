// Measures the REAL gzipped weight of the built Button + Lit runtime
// (criterion 4). Runs after `tsup` build. No memory estimates — reads the
// emitted artifact and gzips it.
import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../dist/index.js');

const raw = readFileSync(file);
const rawSize = statSync(file).size;
const gz = gzipSync(raw, { level: 9 }).length;

const kb = (n) => (n / 1024).toFixed(2);

process.stdout.write(
  [
    'proto-a-lit — Button + Lit runtime (bundled, minified)',
    `  raw:  ${rawSize} B  (${kb(rawSize)} KB)`,
    `  gzip: ${gz} B  (${kb(gz)} KB)`,
    '',
  ].join('\n'),
);
