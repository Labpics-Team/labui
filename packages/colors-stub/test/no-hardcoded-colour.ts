/**
 * No-hardcoded-colour scanner — the SUPERSET of the fallback guard.
 *
 * The sibling `no-literal-colour-fallback.ts` closes a NARROW class: a literal
 * colour baked as the FALLBACK of a colour role (`var(--lab-role, #fff)`). This
 * module closes the WIDER class: any literal colour VALUE appearing free-standing
 * in a `packages/*` component (`color: #fff;`, `background: rebeccapurple;`,
 * `border-color: oklch(...)`) — because every colour a component paints must come
 * through a `--lab-*` role.
 *
 * Precision matters far more here than for the fallback scanner, because a
 * free-standing match has no `var(--lab-…)` anchor to disambiguate it. The
 * fallback scanner could match any named colour anywhere on the line; a
 * free-standing scanner that did the same would fire on the word "white" inside
 * `white-space`, "field" inside a comment, or the valueless keywords
 * `transparent` / `currentColor`. So this scanner is deliberately TIGHTER:
 *
 *   1. Comments (`/​* … *​/` and `// …`) are stripped before scanning — a colour
 *      word in prose is not a hardcoded value.
 *   2. The valueless colour KEYWORDS `transparent` and `currentColor` are NOT
 *      flagged: they carry no brand colour (a transparent border / a
 *      `currentColor` SVG fill inherits the role-driven colour) and are
 *      legitimate everywhere. They are the documented allowed keywords.
 *   3. A named / system colour is matched ONLY in CSS VALUE POSITION — right
 *      after a `:` (a declaration value), never as a substring of a property
 *      name (`white-space`) or identifier (`Fieldset`).
 *   4. Functional colour forms (`rgb()`/`hsl()`/`oklch()`/`color-mix()`/…) and
 *      hex are matched anywhere (they cannot occur innocently).
 *
 * It REUSES the fallback scanner's `NAMED_COLOURS` / `SYSTEM_COLOURS` so the two
 * guards never disagree on "what is a colour", and it does NOT touch the fallback
 * scanner or its assertions — the #23/#24/#31 class stays closed.
 */
import { globSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  NAMED_COLOURS,
  SYSTEM_COLOURS,
  type Violation,
  repoRoot,
} from './no-literal-colour-fallback.js';

/**
 * The ONLY files where a literal colour value is legitimate — the system
 * boundary where colour values are DECLARED, not consumed:
 *   - `contract.css` — the colour contract; it IS the values (the @labpics/colors
 *     stub). Shape pinned by `contract.test.ts`.
 *   - `materials.css` — provisional material primitives; an engine-gap recorded
 *     in `docs/external-deps/lab-colors.md` (CH-03). In plain `src/`, so NOT
 *     covered by the `/src/generated/` exclude — MUST be allowlisted.
 *   - `generated/shadow.css` — provisional shadow anchor + JND alphas (same gap
 *     record). Also covered by `/src/generated/`; listed for an explicit record.
 *   - `shadow/src/config.ts` — the source-of-truth that GENERATES shadow.css; it
 *     holds the same provisional `#101012` anchor (`--lab-shadow-color`). It is a
 *     declaration of the gap value, not a component leak; recorded in CH-03.
 * Widening this list to hide a real component leak is forbidden — a leak is fixed
 * by substituting the correct `--lab-*` role upstream.
 */
export const ALLOWLIST: readonly string[] = [
  'packages/colors-stub/contract.css',
  'packages/core/src/materials.css',
  'packages/shadow/src/generated/shadow.css',
  'packages/shadow/src/config.ts',
];

/**
 * Valueless colour keywords that are legitimate in any component — they bind to
 * the role-driven colour, they do not introduce a hardcoded brand colour. Kept
 * out of the free-standing match (subtracted from NAMED_COLOURS).
 */
const ALLOWED_KEYWORDS = new Set(['transparent', 'currentcolor']);
const FLAGGED_NAMED = NAMED_COLOURS.filter((c) => !ALLOWED_KEYWORDS.has(c.toLowerCase()));

/**
 * Strip CSS/JS comments so a colour word in prose ("a transparent border", "Mark
 * a region") is never matched. Block comments first, then line comments. (URLs
 * with `//` are not present in these stylesheet/TS-template sources.)
 */
function stripComments(source: string): string {
  // Blank out comment content but PRESERVE newlines, so a colour word in a
  // multi-line block comment is removed without shifting the line numbers of
  // every later finding (the guard reports file:line — that must stay exact).
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * Functional colour-PRODUCING forms + hex — these introduce a literal colour and
 * cannot occur innocently, so they match anywhere on a (comment-stripped) line.
 *
 * `color-mix(` and `light-dark(` are EXCLUDED from this anywhere-match: they are
 * colour COMBINATORS, legitimate when their arguments are role tokens
 * (`color-mix(in srgb, transparent, var(--lab-surface-shadow-tint, …))` is the
 * shadow engine, not a hardcoded colour). They are caught instead by
 * `COMBINATOR_RE` below ONLY when their body holds an actual hex/rgb/hsl literal
 * — so `color-mix(in srgb, #fff, #000)` is flagged but a token-only mix is not.
 */
const FUNCTIONAL_HEX =
  '(?:rgba?\\(|hsla?\\(|hwb\\(|(?:ok)?lab\\(|(?:ok)?lch\\(|color\\(|#[0-9a-f]{3,8}\\b)';
const FUNCTIONAL_HEX_RE = new RegExp(FUNCTIONAL_HEX, 'gi');

/**
 * A `color-mix(` / `light-dark(` whose body (up to the matching-ish close) holds
 * a hex or rgb/hsl/oklch literal. A combinator over pure role tokens / keywords
 * introduces no literal and is NOT matched. Non-greedy body keeps it on one
 * call; the embedded literal alternation is the actual finding.
 */
const COMBINATOR_RE =
  /(?:color-mix|light-dark)\([^)]*(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|(?:ok)?lch\(|(?:ok)?lab\()/gi;

/**
 * Named / system colour in CSS VALUE POSITION only: preceded by `:` (optionally
 * with whitespace) and bounded as a whole word, so `white-space` (property name)
 * and `Fieldset` (identifier) never match, but `color: rebeccapurple;` and
 * `background: Canvas;` do. The `:` lookbehind also excludes a bare word in a TS
 * string that is not a declaration value.
 */
const VALUE_NAMED_RE = new RegExp(
  `:\\s*(?:${[...FLAGGED_NAMED, ...SYSTEM_COLOURS].join('|')})\\b`,
  'gi',
);

/**
 * Scan one file's (comment-stripped) text for any free-standing colour literal.
 * An allowlisted path yields nothing. The `Violation` shape matches the fallback
 * scanner so one reporter formats both guards.
 */
export function scanSource(relPath: string, source: string): Violation[] {
  if (ALLOWLIST.includes(relPath)) return [];
  const text = stripComments(source);
  const out: Violation[] = [];
  const lineAt = (index: number): number => text.slice(0, index).split('\n').length;
  for (const re of [FUNCTIONAL_HEX_RE, COMBINATOR_RE, VALUE_NAMED_RE]) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      out.push({
        file: relPath,
        line: lineAt(m.index),
        token: m[0].trim(),
        snippet: text.slice(Math.max(0, m.index - 16), m.index + m[0].length + 8).trim(),
      });
    }
  }
  return out;
}

/**
 * The governed surface: every `packages/**` `.ts/.tsx/.css` (scope is
 * `packages/*` per the brief). Excludes build output, deps, generated CSS, the
 * scanner + test files, AND the allowlisted source files (so a future un-exclude
 * cannot silently start flagging them).
 */
export function targetFiles(): string[] {
  const patterns = ['packages/**/*.ts', 'packages/**/*.tsx', 'packages/**/*.css'];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const abs of globSync(resolve(repoRoot, pattern))) {
      const rel = relative(repoRoot, abs).split('\\').join('/');
      if (rel.includes('/dist/')) continue;
      if (rel.includes('/node_modules/')) continue;
      if (rel.includes('/src/generated/')) continue;
      if (rel.endsWith('.test.ts')) continue; // test files hold literal colour table fixtures
      if (rel.endsWith('test/no-literal-colour-fallback.ts')) continue;
      if (rel.endsWith('test/no-hardcoded-colour.ts')) continue;
      if (rel.endsWith('test/consumed-contract.ts')) continue;
      seen.add(rel);
    }
  }
  return [...seen].sort();
}

/** Scan the whole governed surface; return every free-standing colour literal. */
export function scanHardcoded(): Violation[] {
  const out: Violation[] = [];
  for (const rel of targetFiles()) {
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    out.push(...scanSource(rel, source));
  }
  return out;
}
