import { libraryPreset } from '../../tsup.config.base';

/**
 * Entries, one per boundary:
 *   - `index`  the renderer-agnostic seam + the Lit base + behaviors.
 *   - `ssr`    the `@lit-labs/ssr` shim — isolated so consumers that never
 *              server-render the Lit path don't pull the SSR engine into their
 *              client bundle.
 *   - `proof`  the `lab-proof` custom element (side-effectful: it self-registers).
 *   - `button` the `lab-button` PRODUCTION element (side-effectful: self-registers).
 *              Its own entry so a consumer pulls only the component it imports.
 *
 * Zag and Lit stay external: they are real dependencies, deduped by the consumer,
 * not inlined into every build.
 */
export default libraryPreset({
  entry: {
    index: 'src/index.ts',
    ssr: 'src/ssr/index.ts',
    proof: 'src/proof/lab-proof.ts',
    button: 'src/components/button/lab-button.ts',
  },
  external: [/^@zag-js\//, /^@lit-labs\//, 'lit'],
});
