/**
 * Consumer enumerator + three-bucket classifier for the `--lab-*` contract.
 *
 * labui consumes `@labpics/colors` EXCLUSIVELY through the `--lab-*` CSS custom
 * property contract. Every consumed name falls into exactly ONE of three buckets
 * (конвенция «три корзины потребления»):
 *
 *   1. `colour-contract` — a semantic colour role owned by @labpics/colors and
 *      mirrored in `roles.json` (any group). THIS is the surface the pin test
 *      asserts against the generated Lab UI colour contract.
 *   2. `dimension` — owned by @labpics/ui-tokens, generated locally; matches a
 *      prefix in `core/src/css.ts` `DIMENSION_PREFIXES`.
 *   3. `local-or-gap` — provisional tokens labui declares today (shadow stack,
 *      materials) that SHOULD eventually be resolved by the external engine.
 *      The allowlist below is the single source CH-03's external-deps doc must
 *      stay in sync with.
 *
 * Anything else is `unclassified` — a name that entered silently and must be
 * triaged (added to the contract upstream, confirmed a dimension, or documented
 * as a gap). The pin test fails on a non-empty unclassified set.
 *
 * Framework-free (plain string scanning over file text), mirroring the sibling
 * `no-literal-colour-fallback.ts` scanner: same repoRoot resolution, same
 * glob/exclude style. It only READS roles.json / css.ts constants — it never
 * mutates the contract.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './no-magic-dimension.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Repo root — from `test/` inside `packages/colors`, three levels up. */
export const repoRoot = resolve(here, '..', '..', '..');

/**
 * Read a `export const NAME = [ '--lab-x-', ... ] as const;` prefix array out of
 * `packages/core/src/css.ts` as the SINGLE source of truth — no second copy of
 * the boundary rule lives here (DIP). css.ts is build-free TS we parse as text
 * so the color-contract test does not depend on @labpics/ui-core being built.
 */
function readCssTsPrefixConst(constName: string): string[] {
  const src = readFileSync(resolve(repoRoot, 'packages/core/src/css.ts'), 'utf8');
  const re = new RegExp(`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const body = re.exec(src)?.[1];
  if (body == null) throw new Error(`css.ts: could not read ${constName}`);
  return [...body.matchAll(/['"`](--lab-[a-z0-9-]+)['"`]/g)].map((m) => m[1] as string);
}

/** css.ts `DIMENSION_PREFIXES` — the dimension-bucket boundary (read at load). */
export const DIMENSION_PREFIXES: readonly string[] = readCssTsPrefixConst('DIMENSION_PREFIXES');
/** css.ts `SEMANTIC_ROLE_PREFIXES` — the "looks like a colour role" boundary. */
export const SEMANTIC_ROLE_PREFIXES: readonly string[] =
  readCssTsPrefixConst('SEMANTIC_ROLE_PREFIXES');

/**
 * Locally-provided / engine-gap token prefixes (bucket 3). Provisional values
 * labui ships today; each maps to a `local-or-gap` entry that MUST appear in
 * `docs/external-deps/lab-colors.md` (CH-03). Keep this list and that doc in
 * sync — the `engine-gaps doc consistency` test cross-checks them.
 *
 * Sources of the declarations:
 *   - `packages/shadow/src/generated/shadow.css`: `--lab-shadow-*`,
 *     `--lab-light-angle`, `--lab-elevation-*`.
 *   - `--lab-surface-shadow-tint`: per-surface shadow tint read from the core
 *     contract (a single exact name, not a family).
 *   - `packages/tokens/src/generated/motion.css`: `--lab-motion-*` — the
 *     motion family (durations/easings/roles). Permanently local and
 *     non-colour: it never migrates to the colour contract; it is listed here
 *     so the zero-unclassified colour gate can place it (#125 wiring).
 */
export const LOCAL_OR_GAP_PREFIXES = [
  '--lab-shadow-', // shadow stack alphas + colour anchor (shadow.css)
  '--lab-surface-shadow-tint', // exact: per-surface shadow tint (shadow.css seam)
  '--lab-shadow-color', // exact: theme shadow-colour anchor (shadow.css)
  '--lab-light-angle', // exact: single global light source (shadow.css)
  '--lab-elevation-', // semantic elevation roles (shadow.css)
  '--lab-motion-', // motion durations/easings/roles (motion.css — non-colour, permanently local)
] as const;

export type Bucket = 'colour-contract' | 'dimension' | 'local-or-gap' | 'unclassified';

/** Where a consumed name was first seen — for actionable failure messages. */
export interface SeenAt {
  readonly file: string;
  readonly line: number;
}

/** Lazily-loaded canonical colour-role set from roles.json (READ ONLY). */
let rolesCache: ReadonlySet<string> | null = null;
function colourContractRoles(): ReadonlySet<string> {
  if (rolesCache) return rolesCache;
  const raw = readFileSync(resolve(repoRoot, 'packages/colors/roles.json'), 'utf8');
  const parsed = JSON.parse(raw) as { groups?: Record<string, string[]>; aliases?: string[] };
  if (parsed?.groups == null || typeof parsed.groups !== 'object') {
    throw new Error('roles.json: missing or malformed "groups" object');
  }
  for (const [group, roles] of Object.entries(parsed.groups)) {
    if (!Array.isArray(roles) || roles.some((r) => typeof r !== 'string')) {
      throw new Error(`roles.json: group "${group}" must be an array of role-name strings`);
    }
  }
  rolesCache = new Set(Object.values(parsed.groups).flat());
  return rolesCache;
}

/**
 * The files scanned as CONSUMERS. `packages/**` and `apps/**` `.ts/.tsx/.css`,
 * excluding build output, deps, generated CSS (it DECLARES, does not consume),
 * and the source-of-truth/scanner files themselves (css.ts and roles.json hold
 * the prefix constants / role list — scanning them would pollute the consumed
 * set with prefix fragments; the scanner + its tests hold literal token names).
 */
let consumerFilesCache: readonly string[] | null = null;

export function consumerFiles(): string[] {
  if (consumerFilesCache) return [...consumerFilesCache];
  const seen: string[] = [];
  const roots = ['packages', 'apps'] as const;
  const ignoredDirs = new Set(['node_modules', 'dist']);
  const ignoredFiles = new Set([
    'packages/core/src/css.ts',
    'packages/colors/roles.json',
    'packages/colors/test/no-literal-colour-fallback.ts',
    'packages/colors/test/no-literal-colour-fallback.test.ts',
    'packages/colors/test/consumed-contract.ts',
    'packages/colors/test/consumed-contract.test.ts',
    'packages/colors/test/no-hardcoded-colour.ts',
    'packages/colors/test/no-hardcoded-colour.test.ts',
  ]);

  const walk = (relDir: string): void => {
    const absDir = resolve(repoRoot, relDir);
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue;
        if (rel.endsWith('/src/generated')) continue;
        walk(rel);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(?:ts|tsx|css)$/.test(entry.name)) continue;
      if (ignoredFiles.has(rel)) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.startsWith('_')) continue;
      seen.push(rel);
    }
  };

  for (const root of roots) walk(root);
  consumerFilesCache = seen.sort((a, b) => a.localeCompare(b));
  return [...consumerFilesCache];
}

/**
 * Match a consumed `--lab-*` name in the three authored forms:
 *   CSS: `var(--lab-<name>...)`
 *   TS : `litVar('--lab-<name>'...)` / `cssVar('--lab-<name>'...)`
 * The trailing char class stops at the first non-name character, so a fallback
 * or close-paren does not bleed into the captured name. A trailing hyphen would
 * be a prefix fragment (e.g. `--lab-fill-`); we drop those (only css.ts holds
 * them and css.ts is excluded, but guard anyway).
 */
const VAR_RE = /var\(\s*(--lab-[a-z0-9-]+)/gi;
const LITCSS_RE = /(?:lit|css)Var\(\s*['"`](--lab-[a-z0-9-]+)['"`]/gi;

function* scanNames(source: string): Generator<{ name: string; line: number }> {
  const lineAt = (index: number): number => source.slice(0, index).split('\n').length;
  for (const re of [VAR_RE, LITCSS_RE]) {
    re.lastIndex = 0;
    for (let m = re.exec(source); m !== null; m = re.exec(source)) {
      const name = m[1] ?? '';
      if (name.endsWith('-')) continue; // prefix fragment, not a real role
      yield { name, line: lineAt(m.index) };
    }
  }
}

/**
 * Потребление одного файла-источника. Комментарии срезаются ДО скана
 * (stripComments сохраняет переносы строк — номера строк не плывут): проза —
 * примеры `var(--lab-X, …)` в doc-комментариях гардов/утилит — не является
 * потреблением и не должна попадать в contract-гейт как «неклассифицированное
 * имя». Экспортирована как чистая функция, чтобы класс был закрыт тестом, а не
 * только живым деревом.
 */
export function consumedNamesInSource(
  relPath: string,
  source: string,
): { name: string; line: number }[] {
  const isTs = relPath.endsWith('.ts') || relPath.endsWith('.tsx');
  return [...scanNames(stripComments(source, isTs))];
}

/** First-seen location of every distinct consumed `--lab-*` name. */
let consumedSitesCache: ReadonlyMap<string, SeenAt> | null = null;

export function consumedRolesWithSites(): Map<string, SeenAt> {
  if (consumedSitesCache) return new Map(consumedSitesCache);
  const out = new Map<string, SeenAt>();
  for (const rel of consumerFiles()) {
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    for (const { name, line } of consumedNamesInSource(rel, source)) {
      if (!out.has(name)) out.set(name, { file: rel, line });
    }
  }
  consumedSitesCache = out;
  return new Map(out);
}

/** Every distinct consumed `--lab-*` name across the consumer surface, sorted. */
export function consumedRoles(): string[] {
  return [...consumedRolesWithSites().keys()].sort((a, b) => a.localeCompare(b));
}

/**
 * Pure classifier — the single chokepoint. Reads the exported `roles.json` set,
 * the `DIMENSION_PREFIXES` from css.ts, and the `LOCAL_OR_GAP_PREFIXES` above.
 * No second copy of the rule (DIP): adding a role to roles.json or a prefix to a
 * constant automatically extends classification.
 */
export function classify(name: string): Bucket {
  if (colourContractRoles().has(name)) return 'colour-contract';
  if (DIMENSION_PREFIXES.some((p) => name.startsWith(p))) return 'dimension';
  if (LOCAL_OR_GAP_PREFIXES.some((p) => (p.endsWith('-') ? name.startsWith(p) : name === p))) {
    return 'local-or-gap';
  }
  return 'unclassified';
}

/** Group the live consumed surface by bucket — sorted names per bucket. */
export function byBucket(): Record<Bucket, string[]> {
  const out: Record<Bucket, string[]> = {
    'colour-contract': [],
    dimension: [],
    'local-or-gap': [],
    unclassified: [],
  };
  for (const name of consumedRoles()) out[classify(name)].push(name);
  return out;
}

/**
 * PURE missing-role detector (anti-blindness). Returns consumed names that LOOK
 * like a colour-contract role yet are ABSENT from the contract — i.e. a
 * dropped/renamed role. "Looks like a colour role" = matches a
 * `SEMANTIC_ROLE_PREFIXES` prefix; "absent" = not in `knownRoles`.
 *
 * A name that classifies into a NON-colour bucket (`local-or-gap` /
 * `dimension`) is NOT a missing colour role — only names that fall through to
 * `unclassified` (look like a colour role, in no other bucket) are flagged.
 * (Historically `--lab-mat-` sat in BOTH lists — a semantic prefix in css.ts
 * AND a local-or-gap family; the family was torn down with the temporary core
 * material, #41.) This routes through the single `classify` chokepoint, so the
 * rule never forks. The pin test feeds the live consumed set here AND a
 * fabricated `--lab-label-*` name to prove the "missing" path fires (green =
 * pinned, not blind).
 */
export function missingColourRoles(
  names: readonly string[],
  knownRoles: ReadonlySet<string>,
): string[] {
  return names
    .filter((n) => SEMANTIC_ROLE_PREFIXES.some((p) => n.startsWith(p)))
    .filter((n) => !knownRoles.has(n))
    .filter((n) => classify(n) === 'unclassified')
    .sort((a, b) => a.localeCompare(b));
}

/** The live contract role set — exposed so the pin test shares one source. */
export function knownColourRoles(): ReadonlySet<string> {
  return colourContractRoles();
}
