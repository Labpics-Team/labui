import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guard scanner for the `@labpics/icons` stub bridge (zero-runtime-dep,
 * North invariant #3). The package must stay a THIN bridge — never grow back
 * into a copy of the real `lab-icons` build/resolver engine (SVG optimizer,
 * bundler, codegen script, or a `src/` tree of icon sources).
 *
 * Split into a pure `scanPackageDir()` (fed a directory) so the live-tree
 * assertion and the synthetic detection proofs share one code path — a
 * green live-tree run means "the scanner looked and found nothing", never
 * "the scanner never looked".
 */

export interface EngineViolation {
  readonly kind: 'forbidden-dependency' | 'forbidden-file' | 'forbidden-script';
  readonly detail: string;
}

/** Tooling that indicates an internal SVG/icon BUILD pipeline, not a thin bridge. */
export const FORBIDDEN_ENGINE_DEPS: readonly string[] = [
  'tsup',
  'svgo',
  'rollup',
  'esbuild',
  '@svgr/core',
  '@svgr/cli',
  'svg-sprite',
  'svgstore',
];

/** File names/globs that indicate a build/codegen pipeline lives in the package. */
export const FORBIDDEN_FILE_PATTERNS: readonly RegExp[] = [
  /^tsup\.config\./,
  /^rollup\.config\./,
  /^svgo\.config\./,
  /^build\.(js|ts|mjs|cjs)$/,
];

/** Directories that would hold icon SOURCE or a generator script. */
const FORBIDDEN_DIRS: readonly string[] = ['src', 'scripts', 'assets'];

interface PackageManifest {
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
}

/** Scans an in-memory manifest + file list (used by both the live scan and the proofs). */
export function scanManifest(
  manifest: PackageManifest,
  files: readonly string[],
): EngineViolation[] {
  const violations: EngineViolation[] = [];

  const allDeps = { ...manifest.dependencies, ...manifest.devDependencies };
  for (const dep of FORBIDDEN_ENGINE_DEPS) {
    if (dep in allDeps) {
      violations.push({ kind: 'forbidden-dependency', detail: dep });
    }
  }

  for (const file of files) {
    if (FORBIDDEN_DIRS.includes(file)) {
      violations.push({ kind: 'forbidden-file', detail: file });
      continue;
    }
    if (FORBIDDEN_FILE_PATTERNS.some((re) => re.test(file))) {
      violations.push({ kind: 'forbidden-file', detail: file });
    }
  }

  const buildScript = manifest.scripts?.build ?? '';
  for (const dep of FORBIDDEN_ENGINE_DEPS) {
    if (new RegExp(`\\b${dep}\\b`).test(buildScript)) {
      violations.push({ kind: 'forbidden-script', detail: `build: "${buildScript}"` });
    }
  }

  return violations;
}

/** Reads a real package directory on disk and runs it through scanManifest(). */
export function scanPackageDir(dir: string): EngineViolation[] {
  const pkgPath = resolve(dir, 'package.json');
  const manifest: PackageManifest = existsSync(pkgPath)
    ? JSON.parse(readFileSync(pkgPath, 'utf8'))
    : {};
  const files = existsSync(dir) ? readdirSync(dir) : [];
  return scanManifest(manifest, files);
}
