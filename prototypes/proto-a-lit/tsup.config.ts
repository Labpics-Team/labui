import { defineConfig, type Options } from 'tsup';

/**
 * Two distinct builds:
 *
 *  1. CONSUMABLE (index, react) — `lit` stays EXTERNAL. Fixtures (Next, Astro)
 *     and the @lit/react wrapper resolve the SAME lit-html instance the host's
 *     SSR renderer uses. Bundling Lit here would give the element templates a
 *     private lit-html copy, which @lit-labs/ssr cannot walk (cross-instance
 *     template objects → "getLast(undefined)"). So consumers get lit external.
 *
 *  2. SIZE (size) — `lit` is BUNDLED IN, minified, no splitting: one
 *     self-contained file whose gzip is the real runtime+component weight
 *     shipped to a browser (criterion 4). Never imported by anything; measured
 *     by scripts/measure-size.mjs.
 */
const shared: Options = {
  format: ['esm'],
  sourcemap: false,
  treeshake: true,
  target: 'es2022',
  splitting: false,
};

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts', react: 'src/react.ts' },
    // Emit .d.ts so CONSUMERS type-check against declarations, not the decorator
    // source (a consumer tsconfig lacks experimentalDecorators).
    dts: true,
    clean: true,
    minify: false,
    external: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element', 'react', '@lit/react'],
  },
  {
    ...shared,
    entry: { size: 'src/index.ts' },
    dts: false,
    clean: false,
    minify: true,
    noExternal: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element'],
    external: ['react', '@lit/react'],
  },
]);
