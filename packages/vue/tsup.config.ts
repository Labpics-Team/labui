import { libraryPreset } from '../../tsup.config.base';

export default libraryPreset({
  // Vue AND the Lit core stay external — the consumer's app owns Vue, and the
  // Lit runtime (the `<lab-*>` custom elements this adapter mounts) is resolved
  // once from @labpics/ui-core, never bundled per-adapter. The registration
  // side-effect import survives tree-shaking via `sideEffects` in package.json.
  external: ['vue', /^@labpics\//],
});
