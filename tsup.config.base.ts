import { type Options, defineConfig } from 'tsup';

/**
 * Shared tsup preset for LabUI library packages.
 *
 * Deterministic, dual-format (ESM + CJS) builds with type declarations.
 * Each package re-exports this with its own entry if it needs to override.
 *
 * Perf note (physical threshold): minify + treeshake enabled to push published
 * JS bundle sizes as low as the tool allows without losing debuggability (sourcemaps on).
 * Consumers' bundlers will still minify further; this reduces install/parse cost.
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
    ...overrides,
  };
}

export default defineConfig(libraryPreset());
