/**
 * Build-time entry: generate the shadow CSS contract and write it to
 * `src/generated/`. The only layer that touches the filesystem — domain and
 * generator stay pure. The artifact is committed so the docs site and consumers
 * can `@import` it without running the generator.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateShadowCss } from '../src/generate-css.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'generated');

function main(): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'shadow.css'), generateShadowCss(), 'utf8');
  process.stdout.write(`shadow: wrote shadow.css to ${outDir}\n`);
}

main();
