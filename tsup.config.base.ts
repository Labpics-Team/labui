import { type Options, defineConfig } from 'tsup';

/**
 * Shared tsup preset for LabUI library packages.
 *
 * Deterministic, dual-format (ESM + CJS) builds with type declarations.
 * Each package re-exports this with its own entry if it needs to override.
 *
 * Perf (extreme): minify + treeshake + esbuild opts (legal none) to push published
 * JS as small as possible (target 15%+ smaller react entry etc). sideEffects audit
 * in packages complements (pure JS reexports shakeable).
 * Consumers' bundlers further minify; this cuts install/parse.
 */
export function libraryPreset(overrides: Options = {}): Options {
  return {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: true,
    target: 'es2022',
    esbuildOptions(options) {
      options.legalComments = 'none';
      options.treeShaking = true;
    },
    ...overrides,
  };
}

export default defineConfig(libraryPreset());
