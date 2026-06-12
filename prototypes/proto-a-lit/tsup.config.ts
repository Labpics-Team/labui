import { defineConfig } from 'tsup';

// Two outputs:
//  - index: the component + its Lit runtime, for the size measurement (gzip).
//  - react: the typed React wrapper (criterion 2 surface).
export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/react.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  minify: true,
  target: 'es2022',
  // Bundle Lit IN so the measured artifact reflects real runtime+component
  // weight shipped to a browser (criterion 4). React stays external.
  noExternal: ['lit', '@lit/labs', 'lit-html', 'lit-element', '@lit/reactive-element'],
  external: ['react', '@lit/react'],
});
