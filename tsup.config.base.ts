import { defineConfig, type Options } from 'tsup';

/**
 * Shared tsup preset for LabUI library packages.
 *
 * Deterministic, dual-format (ESM + CJS) builds with type declarations.
 * Each package re-exports this with its own entry if it needs to override.
 */
export function libraryPreset(overrides: Options = {}): Options {
  return {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2022',
    ...overrides,
  };
}

export default defineConfig(libraryPreset());
