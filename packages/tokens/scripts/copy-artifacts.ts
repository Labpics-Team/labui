/**
 * Copy the non-JS artifacts (CSS, DTCG JSON) from `src/generated/` into `dist/`
 * after tsup has built the JS/types, so the package's `./tokens.css`,
 * `./tokens.dtcg.json`, `./motion.css` and `./motion.dtcg.json` exports resolve
 * for consumers.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import components from '../src/components.js';

const here = dirname(fileURLToPath(import.meta.url));
const generated = join(here, '..', 'src', 'generated');
const dist = join(here, '..', 'dist');

function main(): void {
  mkdirSync(dist, { recursive: true });
  for (const file of ['tokens.css', 'tokens.dtcg.json', 'motion.css', 'motion.dtcg.json']) {
    copyFileSync(join(generated, file), join(dist, file));
  }
  writeFileSync(join(dist, 'components.json'), `${JSON.stringify(components, null, 2)}\n`);
  process.stdout.write('tokens: copied css + dtcg artifacts (dimension + motion) to dist\n');
}

main();
