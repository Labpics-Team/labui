/**
 * Build-time entry: resolve the default config, generate all three artifacts,
 * and write them to `src/generated/`. The only layer that touches the
 * filesystem — domain and generators stay pure.
 *
 * Generated artifacts are committed (not gitignored) so consumers and the docs
 * site can `@import` the CSS without running the generator, and the DTCG export
 * is reviewable in PRs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../src/config/default-config.js';
import { generate } from '../src/generate/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'generated');

function main(): void {
  const artifacts = generate(defaultConfig);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, 'tokens.css'), artifacts.css, 'utf8');
  writeFileSync(join(outDir, 'tokens.dtcg.json'), artifacts.dtcg, 'utf8');
  writeFileSync(join(outDir, 'tokens.ts'), artifacts.ts, 'utf8');

  process.stdout.write(`tokens: wrote 3 artifacts to ${outDir}\n`);
}

main();
