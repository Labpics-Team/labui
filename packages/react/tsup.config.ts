import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libraryPreset } from '../../tsup.config.base';
import { discoverComponents } from './scripts/discover-components';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, 'dist');

/**
 * Re-assert the `'use client'` boundary at the TOP of every emitted JS file,
 * once the build has written `dist`.
 *
 * esbuild drops the source files' own `'use client'` when it bundles their
 * imports into an entry (ESM hoists imports above any directive, so the
 * directive is no longer module-level and is ignored — esbuild emits a benign
 * "module level directives" warning). A `banner` does not help, for the same
 * hoist reason. So we post-process each output: strip any now-misplaced
 * `'use client'` and prepend a single valid one. Every file in this renderer is
 * a client component, so a blanket directive is correct — it is what lets
 * Next.js App Router consumers import `@labpics/ui-react/<name>` as a client
 * leaf under a Server Component shell (dive-next P1).
 */
async function preserveUseClientDirective(): Promise<void> {
  const stripMisplaced = /^\s*(['"])use client\1;?\s*$/gm;
  const files = await readdir(distDir);
  await Promise.all(
    files
      .filter((file) => /\.(js|cjs|mjs)$/.test(file))
      .map(async (file) => {
        const path = join(distDir, file);
        const source = await readFile(path, 'utf8');
        const body = source.replace(stripMisplaced, '').replace(/^\n+/, '');
        await writeFile(path, `'use client';\n${body}`);
      }),
  );
}

/**
 * React, react-dom, Zag and the core seam stay external — the consumer's app
 * owns React; we never bundle it. Keeps the renderer thin (ADR-0001: the React
 * path is a second VISUAL implementation, not a second framework copy).
 *
 * Entries: the `index` barrel PLUS one per component, AUTO-DISCOVERED from
 * `src/<name>.tsx` (see `discoverComponents`). Each component is its own entry
 * so a consumer can import `@labpics/ui-react/<name>` and pull only that
 * component — the per-component tree-shaking seam (arch-debt #6). Adding a
 * component needs no edit here, and emits a flat `dist/<name>.{js,cjs,d.ts}`
 * that the package's `exports` wildcard already targets.
 */
const componentEntries = Object.fromEntries(
  discoverComponents().map(({ name, entry }) => [name, entry]),
);

export default libraryPreset({
  entry: {
    index: 'src/index.ts',
    ...componentEntries,
  },
  // Disable code-splitting so each per-component entry is SELF-CONTAINED — a
  // consumer importing `@labpics/ui-react/<name>` pulls only that component, with
  // no shared chunk dragging the others in. The renderer is thin, so the small
  // duplication of the style/seam glue across entries is a fair trade for clean
  // per-component tree-shaking (arch-debt #6).
  splitting: false,
  // Re-assert `'use client'` on every output after the build writes `dist`.
  // esbuild logs a benign "module level directives" warning per entry while
  // bundling (the source directive is hoisted below the imports); the output is
  // corrected here, so the warning is expected noise, not a failure.
  onSuccess: preserveUseClientDirective,
  external: ['react', 'react-dom', 'react/jsx-runtime', /^@zag-js\//, /^@labpics\//],
  // CSS материалов входит в существующий injectStyle; package URL внутри
  // инъекции браузер не разрешит. JS-зависимости по-прежнему внешние.
  noExternal: ['@labpics/ui-materials/material.css'],
  // Inline the component CSS (`button.css`) into the JS as a runtime-injected
  // <style>, so importing the component brings its styles with it in ANY bundler
  // — no separate stylesheet-import step. Without this, tsup emits a sibling
  // .css file but does NOT re-link it from the ESM output, so consumers silently
  // lose the styles (caught by the Lit↔React parity test).
  injectStyle: true,
});
