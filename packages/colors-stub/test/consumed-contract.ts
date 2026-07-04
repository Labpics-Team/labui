/**
 * Consumer enumerator + three-bucket classifier for the `--lab-*` contract.
 *
 * labui consumes `@labpics/colors` EXCLUSIVELY through the `--lab-*` CSS custom
 * property contract. Every consumed name falls into exactly ONE of three buckets
 * (конвенция «три корзины потребления»):
 *
 *   1. `colour-contract` — a semantic colour role owned by @labpics/colors and
 *      mirrored in `roles.json` (any group). THIS is the surface the pin test
 *      asserts against the stub.
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
import { globSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './no-magic-dimension.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Repo root — from `test/` inside `packages/colors-stub`, three levels up. */
export const repoRoot = resolve(here, '..', '..', '..');

/**
 * Read a `export const NAME = [ '--lab-x-', ... ] as const;` prefix array out of
 * `packages/core/src/css.ts` as the SINGLE source of truth — no second copy of
 * the boundary rule lives here (DIP). css.ts is build-free TS we parse as text
 * so the colors-stub test does not depend on @labpics/ui-core being built.
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
 *   - `packages/core/src/materials.css`: `--lab-mat-*`, `--lab-ambient-*`,
 *     `--lab-glass-*`.
 *   - `--lab-surface-shadow-tint`: per-surface shadow tint read from the core
 *     contract (a single exact name, not a family).
 */
export const LOCAL_OR_GAP_PREFIXES = [
  '--lab-shadow-', // shadow stack alphas + colour anchor (shadow.css)
  '--lab-surface-shadow-tint', // exact: per-surface shadow tint (shadow.css seam)
  '--lab-shadow-color', // exact: theme shadow-colour anchor (shadow.css)
  '--lab-light-angle', // exact: single global light source (shadow.css)
  '--lab-mat-', // material roles (materials.css)
  '--lab-ambient-', // ambient material primitives (materials.css)
  '--lab-glass-', // glass material aliases (materials.css)
  '--lab-elevation-', // semantic elevation roles (shadow.css)
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
  const raw = readFileSync(resolve(repoRoot, 'packages/colors-stub/roles.json'), 'utf8');
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
export function consumerFiles(): string[] {
  const patterns = [
    'packages/**/*.ts',
    'packages/**/*.tsx',
    'packages/**/*.css',
    'apps/**/*.ts',
    'apps/**/*.tsx',
    'apps/**/*.css',
  ];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const abs of globSync(resolve(repoRoot, pattern))) {
      const rel = relative(repoRoot, abs).split('\\').join('/');
      if (rel.includes('/dist/')) continue;
      if (rel.includes('/node_modules/')) continue;
      if (rel.includes('/src/generated/')) continue;
      // Source-of-truth definitions — exclude so prefix fragments / role lists
      // do not register as "consumed".
      if (rel.endsWith('packages/core/src/css.ts')) continue;
      if (rel.endsWith('packages/colors-stub/roles.json')) continue;
      if (rel.endsWith('test/no-literal-colour-fallback.ts')) continue;
      if (rel.endsWith('test/no-literal-colour-fallback.test.ts')) continue;
      if (rel.endsWith('test/consumed-contract.ts')) continue;
      if (rel.endsWith('test/consumed-contract.test.ts')) continue;
      if (rel.endsWith('test/no-hardcoded-colour.ts')) continue;
      if (rel.endsWith('test/no-hardcoded-colour.test.ts')) continue;
      // Test files hold probe strings, snapshot expectations, and fabricated token
      // names inside JS string literals — they are NOT consumer source. A raw-text
      // scan cannot distinguish a probe token inside `expect(…).toBe('var(--lab-x)')`
      // from an actual `var(--lab-x)` usage, so including test files EITHER poisons
      // the zero-unclassified gate (probe tokens classified as 'unclassified') OR
      // phantom-inflates the consumed surface with non-real names.  Skip ALL *.test.ts
      // files from the consumer surface; the above per-file exclusions keep the
      // scanner files excluded by exact path.
      if (rel.endsWith('.test.ts')) continue;
      // Scratch / probe files: any filename that starts with `_` is a transient
      // artifact (e.g. `_adv_probe.test.ts`). A stray `--lab-x` token inside such a
      // file MUST NOT poison the zero-unclassified gate.
      const basename = rel.split('/').at(-1) ?? '';
      if (basename.startsWith('_')) continue;
      seen.add(rel);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
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
export function consumedRolesWithSites(): Map<string, SeenAt> {
  const out = new Map<string, SeenAt>();
  for (const rel of consumerFiles()) {
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    for (const { name, line } of consumedNamesInSource(rel, source)) {
      if (!out.has(name)) out.set(name, { file: rel, line });
    }
  }
  return out;
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
 * The `--lab-mat-` prefix is deliberately BOTH a semantic prefix (css.ts) AND a
 * `local-or-gap` token family (materials.css, owned locally — intentionally NOT
 * in roles.json). So a name that classifies into a NON-colour bucket
 * (`local-or-gap` / `dimension`) is NOT a missing colour role — only names that
 * fall through to `unclassified` (look like a colour role, in no other bucket)
 * are flagged. This routes through the single `classify` chokepoint, so the rule
 * never forks. The pin test feeds the live consumed set here AND a fabricated
 * `--lab-label-*` name to prove the "missing" path fires (green = pinned, not
 * blind).
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
