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
 *   - `badge` / `kbd` / `loader` / `avatar` the presentational primitives, each
 *              its own side-effectful entry so a consumer pulls only what it imports.
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
    badge: 'src/components/badge/lab-badge.ts',
    kbd: 'src/components/kbd/lab-kbd.ts',
    loader: 'src/components/loader/lab-loader.ts',
    avatar: 'src/components/avatar/lab-avatar.ts',
  },
  external: [/^@zag-js\//, /^@lit-labs\//, 'lit'],
});
