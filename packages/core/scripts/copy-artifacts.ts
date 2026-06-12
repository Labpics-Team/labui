/**
 * Copy the non-JS artifacts (CSS) from `src/` into `dist/` after tsup has built
 * the JS/types, so the package's `./materials.css` (and the `./glass.css`
 * back-compat shim) exports resolve for consumers.
 *
 * Mirrors the same step in @labpics/ui-tokens. tsup only bundles the TS entry;
 * the CSS surface is shipped verbatim.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const dist = join(here, '..', 'dist');

function main(): void {
  mkdirSync(dist, { recursive: true });
  const files = ['materials.css', 'glass.css'];
  for (const file of files) {
    copyFileSync(join(src, file), join(dist, file));
  }
  process.stdout.write(`ui-core: copied ${files.join(', ')} to dist\n`);
}

main();
