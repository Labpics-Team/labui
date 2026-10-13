import { libraryPreset } from '../../tsup.config.base';
import { discoverComponents } from './scripts/discover-components';

/**
 * Entries, one per boundary:
 *   - `index`  the renderer-agnostic seam + the Lit base + behaviors.
 *   - `theme` — чистый контракт скоупа для renderer adapters, без загрузки Lit.
 *   - `ssr`    the `@lit-labs/ssr` shim — isolated so consumers that never
 *              server-render the Lit path don't pull the SSR engine into their
 *              client bundle.
 *   - `proof`  the `lab-proof` custom element (side-effectful: it self-registers).
 *   - every component under `src/components/<name>/lab-<name>.ts` — each its own
 *              side-effectful entry so a consumer pulls only the component it
 *              imports.
 *
 * Components are AUTO-DISCOVERED (see `discoverComponents`): a new component
 * needs no edit here. Each is built from its public barrel and keeps its `src`
 * path in `dist`, emitting to `dist/components/<name>/index.{js,cjs,d.ts}`. That
 * nested, single-name layout lets the package's `exports` and `sideEffects`
 * target them with a single `*`/`components/**` wildcard — the only form
 * TypeScript and esbuild both resolve — so neither this file NOR `package.json`
 * grows per component.
 *
 * Zag and Lit stay external: they are real dependencies, deduped by the consumer,
 * not inlined into every build.
 */
const componentEntries = discoverComponents().map(({ entry }) => entry);

export default libraryPreset({
  entry: [
    'src/index.ts',
    'src/theme.ts',
    'src/ssr/index.ts',
    'src/proof/lab-proof.ts',
    ...componentEntries,
  ],
  external: [/^@zag-js\//, /^@lit-labs\//, 'lit'],
});
