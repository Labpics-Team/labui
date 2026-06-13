/**
 * React component auto-discovery — the ONE place that knows the file convention.
 *
 * The native-React renderer keeps one `.tsx` file per component directly under
 * `src/`, e.g. `src/button.tsx`. This helper enumerates them so the build
 * (tsup entry + the package's `exports` wildcard) is derived, not hand-listed.
 * Adding a component is then purely additive — drop `src/<name>.tsx` and it
 * ships its own per-component subpath (`@labpics/ui-react/<name>`), which is the
 * tree-shaking seam (arch-debt #6): a consumer pulls only the component it
 * imports instead of the whole barrel.
 *
 * Pure and dependency-free (only `node:fs`/`node:path`), so it runs under any
 * supported Node (>=20) without a glob dependency in the build config.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** Absolute path to `packages/react/src`. */
const srcDir = join(here, '..', 'src');

/** One discovered component: its `<name>` and entry path relative to the package root. */
export interface DiscoveredComponent {
  /** The component name, e.g. "button". The subpath key and dist basename. */
  readonly name: string;
  /** Entry path relative to the package root, e.g. "src/button.tsx". */
  readonly entry: string;
}

/**
 * Discover every per-component `src/<name>.tsx`, sorted by name for
 * deterministic build output. `index.ts` (the barrel) and the non-component
 * `.ts` seam files (e.g. `use-zag.ts`) are not `.tsx` and so are never matched.
 */
export function discoverComponents(): DiscoveredComponent[] {
  if (!existsSync(srcDir)) return [];
  return readdirSync(srcDir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.tsx'))
    .map((dirent) => dirent.name.slice(0, -'.tsx'.length))
    .sort()
    .map((name) => ({ name, entry: `src/${name}.tsx` }));
}
