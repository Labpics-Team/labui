/**
 * Consumed-not-reinvented scanner for box-shadow.
 *
 * Every ELEVATION box-shadow a component applies MUST be consumed from the
 * @labpics/ui-shadow contract via a pure `var(--lab-elevation-*)` or
 * `var(--lab-shadow-*)` token. A component that authors its own box-shadow
 * geometry (e.g. `box-shadow: 0 0.5rem 1.5rem var(--lab-fx-shadow-major)`) silently
 * forks off the shadow system — scale, tint, and motion tokens no longer apply to
 * it and the owner's vertical-light law is silently violated.
 *
 * ALLOWED forms (NOT flagged):
 *   - `box-shadow: var(--lab-elevation-*)` — pure contract token.
 *   - `box-shadow: var(--lab-shadow-*)` — pure size token.
 *   - `box-shadow: none` — explicit clear.
 *   - Focus-ring pattern: `box-shadow: 0 0 0 <token> <token>` where BOTH the
 *     ring width AND colour are `var(--lab-*)`. (A focus ring is not an elevation
 *     shadow; it is structural, not a depth cue.)
 *   - `transition: … box-shadow …` — the property is named, not assigned.
 *
 * FLAGGED forms (the reinvention class):
 *   1. Any box-shadow value that contains a literal CSS length (px/rem/em) AND is
 *      NOT one of the allowed forms above. Catches geometry-hardcoded shadows
 *      where a token is used only for colour.
 *   2. Any box-shadow value that is a pure CSS custom property but references a
 *      FOREIGN namespace — i.e. `var(--lab-*)` where the name does NOT begin with
 *      `--lab-elevation-` or `--lab-shadow-`. This closes the flat foreign-
 *      namespace gap: `var(--lab-fx-shadow-minor)` is a flat single-colour token
 *      from the old `--lab-fx-*` family, NOT a shadow-stack contract token; it
 *      carries no geometry, tint, or motion — the component silently forks.
 *
 * The generated `shadow.css` and `config.ts` are allowlisted — they ARE the
 * contract. Widening the allowlist to hide a component violation is forbidden.
 */
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { repoRoot } from './no-literal-colour-fallback.js';

export interface ShadowViolation {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

/**
 * Files where a literal box-shadow value is legitimate — the contract source
 * and the generated artifact, not a component consumer.
 */
export const SHADOW_ALLOWLIST: readonly string[] = [
  'packages/shadow/src/generated/shadow.css',
  'packages/shadow/src/config.ts',
  'packages/shadow/src/generate-css.ts',
  'packages/colors-stub/contract.css',
  // These test files contain box-shadow probe strings inside JS string literals,
  // not actual shadow usage. The scanner reads raw text and cannot distinguish
  // a probe inside a string from a real declaration — allowlist is the correct fix.
  'packages/colors-stub/test/no-hardcoded-colour.test.ts',
  'packages/colors-stub/test/no-literal-colour-fallback.test.ts',
];

/** A literal CSS length unit — the marker of hardcoded geometry. */
const LITERAL_LENGTH_RE = /\d+(?:\.\d+)?(?:px|rem|em)\b/i;

/**
 * Extract every `box-shadow:` declaration from a file, skipping:
 *   - `transition: … box-shadow …` lines (the property is only NAMED)
 *   - In-line comments
 * Returns the line number and raw value for each found declaration.
 */
function extractBoxShadowValues(source: string): Array<{ line: number; value: string }> {
  const results: Array<{ line: number; value: string }> = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    // Strip inline comments (preserving line structure for accurate numbering).
    const stripped = raw.replace(/\/\/[^\n]*$/, '').replace(/\/\*.*?\*\//g, '');

    // Must be a `box-shadow:` assignment, not a `transition:` mention.
    if (!/\bbox-shadow\s*:/i.test(stripped)) continue;
    if (/\btransition\s*:/i.test(stripped)) continue;

    // Capture the value to the end of the logical line or semicolon.
    const valueMatch = stripped.match(/\bbox-shadow\s*:\s*(.+?)(?:;|$)/i);
    if (!valueMatch) continue;
    const value = valueMatch[1]?.trim() ?? '';

    results.push({ line: i + 1, value });
  }
  return results;
}

/**
 * Classify one box-shadow value:
 *   - 'allowed'   — pure contract token / none / valid focus-ring pattern.
 *   - 'violation' — contains hardcoded geometry OR a foreign-namespace token
 *                   (the reinvention class, in either form).
 */
function classify(value: string): 'allowed' | 'violation' {
  // Explicit clear.
  if (/^none\s*$/.test(value.toLowerCase())) return 'allowed';

  // Pure contract token — the only correct form for elevation shadows.
  // Must start with --lab-elevation-* or --lab-shadow-* (and nothing else).
  if (/^var\(\s*--lab-(?:elevation|shadow)-/.test(value)) return 'allowed';

  // Focus-ring pattern: `0 0 0 var(--lab-…) var(--lab-…)` or
  // `0 0 0 <literal-width> var(--lab-…)` — structural, not elevation.
  // Both the offset-x AND offset-y are 0; the spread may be a token or a
  // small literal; the colour MUST be a token.
  if (/^0\s+0\s+0\s+(?:\d+(?:\.\d+)?(?:px|rem)\s+)?var\(\s*--lab-/.test(value)) return 'allowed';

  // If the value contains any literal CSS length, it is a reinvention.
  if (LITERAL_LENGTH_RE.test(value)) return 'violation';

  // Flat foreign-namespace token: a pure `var(--lab-*)` that is NOT the
  // elevation or shadow namespace is a single-colour flat token (e.g.
  // `var(--lab-fx-shadow-minor)` from the old --lab-fx-* family). It carries
  // no geometry, no tint, no motion — the component silently forks off the
  // shadow system even though it has no literal length.
  if (/^var\(\s*--lab-/.test(value)) return 'violation';

  return 'allowed';
}

/** Scan one file's text for box-shadow reinventions. */
export function scanBoxShadow(relPath: string, source: string): ShadowViolation[] {
  const out: ShadowViolation[] = [];
  for (const { line, value } of extractBoxShadowValues(source)) {
    if (classify(value) === 'violation') {
      out.push({ file: relPath, line, snippet: `box-shadow: ${value.slice(0, 120)}` });
    }
  }
  return out;
}

/** The files the rule governs (component source, NOT the allowlisted files). */
export function shadowTargetFiles(): string[] {
  const patterns = [
    'packages/**/*.css',
    'packages/**/*.ts',
    'packages/**/*.tsx',
    'apps/docs/**/*.css',
  ];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const abs of globSync(resolve(repoRoot, pattern))) {
      const rel = relative(repoRoot, abs).split('\\').join('/');
      if (rel.includes('/dist/')) continue;
      if (rel.includes('/node_modules/')) continue;
      if (rel.includes('/src/generated/')) continue;
      if (rel.endsWith('test/no-box-shadow-literal.ts')) continue;
      if (rel.endsWith('test/no-box-shadow-literal.test.ts')) continue;
      // Test files hold probe strings with literal box-shadow values inside JS string
      // literals — scanning them would produce false violations. Skip ALL *.test.ts.
      if (rel.endsWith('.test.ts')) continue;
      // Scratch / probe files (filename starts with `_`) are transient artifacts and
      // must not be scanned as governed component source.
      const basename = rel.split('/').at(-1) ?? '';
      if (basename.startsWith('_')) continue;
      seen.add(rel);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Scan the whole governed surface; return every violation across all files. */
export function scanAllShadowLiterals(): ShadowViolation[] {
  const out: ShadowViolation[] = [];
  for (const rel of shadowTargetFiles()) {
    if (SHADOW_ALLOWLIST.some((allowed) => rel.endsWith(allowed.replace(/\\/g, '/')))) continue;
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    out.push(...scanBoxShadow(rel, source));
  }
  return out;
}
