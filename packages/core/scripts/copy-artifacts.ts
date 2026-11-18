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
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { badgeCss } from '../src/components/badge/styles.js';
import { cardCss } from '../src/components/card/styles.js';
import { inputCss } from '../src/components/input/styles.js';
import { kbdCss } from '../src/components/kbd/styles.js';
import { progressCss } from '../src/components/progress/styles.js';
import { selectionCss } from '../src/components/selection/styles.js';
import { sheetCss } from '../src/components/sheet/styles.js';
import { snackbarCss } from '../src/components/snackbar/styles.js';
import { switchCss } from '../src/components/switch/styles.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const dist = join(here, '..', 'dist');

// Resolve the shadow package dist from the workspace — the generated shadow.css
// is the canonical source of truth; we re-export it verbatim.
const require = createRequire(import.meta.url);
const shadowPkg = require.resolve('@labpics/ui-shadow/shadow.css');
const tokensPkg = require.resolve('@labpics/ui-tokens/tokens.css');

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
  copyFileSync(tokensPkg, join(dist, 'tokens.css'));
  writeFileSync(join(dist, 'sheet.css'), sheetCss);
  writeFileSync(join(dist, 'input.css'), inputCss);
  writeFileSync(join(dist, 'snackbar.css'), snackbarCss);
  writeFileSync(join(dist, 'card.css'), cardCss);
  writeFileSync(join(dist, 'switch.css'), switchCss);
  writeFileSync(join(dist, 'selection-controls.css'), selectionCss);
  writeFileSync(join(dist, 'badge.css'), badgeCss);
  writeFileSync(join(dist, 'kbd.css'), kbdCss);
  writeFileSync(join(dist, 'progress.css'), progressCss);

  process.stdout.write(
    `ui-core: copied ${[...ownFiles, 'shadow.css', 'tokens.css'].join(', ')} to dist\n`,
  );
}

main();
