/**
 * Copy the non-JS artifacts (CSS, DTCG JSON) from `src/generated/` into `dist/`
 * after tsup has built the JS/types, so the package's `./tokens.css` and
 * `./tokens.dtcg.json` exports resolve for consumers.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const generated = join(here, '..', 'src', 'generated');
const dist = join(here, '..', 'dist');

function main(): void {
  mkdirSync(dist, { recursive: true });
  for (const file of ['tokens.css', 'tokens.dtcg.json']) {
    copyFileSync(join(generated, file), join(dist, file));
  }
  process.stdout.write('tokens: copied tokens.css + tokens.dtcg.json to dist\n');
}

main();
