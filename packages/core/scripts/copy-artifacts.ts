/**
 * Copy the non-JS artifacts (CSS) from `src/` into `dist/` after tsup has built
 * the JS/types, so the package's `./theme.css` export resolves for consumers.
 * (The temporary `materials.css` / `glass.css` surfaces were torn down in #41 —
 * the material axis is owned by `@labpics/ui-materials`.)
 *
 * Also copies the generated `shadow.css` from @labpics/ui-shadow into
 * `dist/shadow.css` so consumers can import `@labpics/ui-core/shadow.css` as the
 * canonical elevation-contract entry point, without adding a second dep.
 *
 * Mirrors the same step in @labpics/ui-tokens. tsup only bundles the TS entry;
 * the CSS surface is shipped verbatim.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const dist = join(here, '..', 'dist');

// Resolve the shadow package dist from the workspace — the generated shadow.css
// is the canonical source of truth; we re-export it verbatim.
const require = createRequire(import.meta.url);
const shadowPkg = require.resolve('@labpics/ui-shadow/shadow.css');

function main(): void {
  mkdirSync(dist, { recursive: true });

  // Own source CSS files. selection.css — the UA-chrome binding layer
  // (selection/caret/accent/scrollbar), axis 10 of the foundations census (task 125).
  const ownFiles = ['theme.css', 'selection.css'];
  for (const file of ownFiles) {
    copyFileSync(join(src, file), join(dist, file));
  }

  // Re-export the shadow contract so consumers need only `@labpics/ui-core/shadow.css`.
  copyFileSync(shadowPkg, join(dist, 'shadow.css'));

  process.stdout.write(`ui-core: copied ${[...ownFiles, 'shadow.css'].join(', ')} to dist\n`);
}

main();
