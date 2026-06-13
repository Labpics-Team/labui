/**
 * Component auto-discovery — the ONE place that knows the file convention.
 *
 * LabUI components follow a fixed convention:
 *   `packages/core/src/components/<name>/lab-<name>.ts`  — the element
 *   `packages/core/src/components/<name>/index.ts`       — its public barrel
 *
 * This helper enumerates that directory and returns the discovered component
 * names, with the BARREL as the entry. Keying off `index.ts` keeps the dist
 * path (`components/<name>/index.js`) and every wildcard — tsconfig `paths`,
 * package `exports` — to a SINGLE wildcard, which is the only form TypeScript
 * and esbuild both accept (a two-wildcard target that repeats the name in both
 * the directory and the file is rejected by both).
 *
 * Build config (tsup entry, exports) is derived from this, so adding a
 * component is purely additive — drop `components/<name>/lab-<name>.ts` plus its
 * one-line `index.ts` barrel and it is picked up. No shared file is edited, so
 * parallel component batches never conflict on the registration plumbing.
 *
 * Pure and dependency-free (only `node:fs`/`node:path`), so it runs under any
 * supported Node (>=20) without a glob dependency in the build config.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** Absolute path to `packages/core/src/components`. */
const componentsDir = join(here, '..', 'src', 'components');

/** One discovered component: its `<name>` and the barrel entry relative to `src`. */
export interface DiscoveredComponent {
  /** The component name, e.g. "button". The subpath key and dist directory. */
  readonly name: string;
  /** Barrel entry path relative to the package root, e.g. "src/components/button/index.ts". */
  readonly entry: string;
}

/**
 * Discover every component that follows the `components/<name>/lab-<name>.ts`
 * convention, sorted by name for deterministic build output. A directory is a
 * component only if it carries BOTH the element (`lab-<name>.ts`) and its public
 * barrel (`index.ts`); a directory missing either is skipped (not yet a real
 * component). The returned entry is the barrel.
 */
export function discoverComponents(): DiscoveredComponent[] {
  if (!existsSync(componentsDir)) return [];
  return readdirSync(componentsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter(
      (name) =>
        existsSync(join(componentsDir, name, `lab-${name}.ts`)) &&
        existsSync(join(componentsDir, name, 'index.ts')),
    )
    .sort()
    .map((name) => ({ name, entry: `src/components/${name}/index.ts` }));
}
