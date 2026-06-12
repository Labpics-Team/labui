import { defineConfig } from 'tsup';

// Two outputs:
//  - index: the component + its Lit runtime, for the size measurement (gzip).
//  - react: the typed React wrapper (criterion 2 surface).
export default defineConfig({
  // Single self-contained entry so the measured artifact is ONE file with Lit
  // bundled in — the real runtime+component weight shipped to a browser
  // (criterion 4). No code splitting, so nothing leaks into a shared chunk.
  // The typed React wrapper is NOT part of the runtime-weight artifact; its
  // type-safety (criterion 2) is verified separately by `tsc --noEmit`.
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  // No DTS bundling: this is a throwaway sandbox, never published. Type-safety
  // (criterion 2) is verified by `tsc --noEmit`, not by emitted declarations.
  dts: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  minify: true,
  splitting: false,
  target: 'es2022',
  // Bundle Lit IN so the measured artifact reflects real runtime+component
  // weight shipped to a browser (criterion 4).
  noExternal: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element'],
  external: ['react', '@lit/react'],
});
