import { libraryPreset } from '../../tsup.config.base';

/**
 * Three entries, three boundaries:
 *   - `index`  the renderer-agnostic seam + the Lit base + behaviors.
 *   - `ssr`    the `@lit-labs/ssr` shim — isolated so consumers that never
 *              server-render the Lit path don't pull the SSR engine into their
 *              client bundle.
 *   - `proof`  the `lab-proof` custom element (side-effectful: it self-registers).
 *
 * Zag and Lit stay external: they are real dependencies, deduped by the consumer,
 * not inlined into every build.
 */
export default libraryPreset({
  entry: {
    index: 'src/index.ts',
    ssr: 'src/ssr/index.ts',
    proof: 'src/proof/lab-proof.ts',
  },
  external: [/^@zag-js\//, /^@lit-labs\//, 'lit'],
});
