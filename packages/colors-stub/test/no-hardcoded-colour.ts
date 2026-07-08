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
  // Замороженный Figma-якорь: он ЕСТЬ сырые замеры (включая material rgb-литералы),
  // против него меряет золотая сверка — не компонентный код, не редактируется.
  'packages/colors-stub/figma-reference.css',
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
 * a region") is never matched. Block comments first, then line comments.
 *
 * IMPORTANT — CSS has NO `//` line comments. The sequence `//` appears legitimately
 * inside CSS values as a URL protocol separator (`url(https://…)`,
 * `url(//cdn/…)`) and inside TS/TSX template literals. Applying `//` stripping to
 * a CSS file would blank the rest of that line from the first `//` onward, hiding
 * any hardcoded colour that follows the URL — a latent false-negative.
 *
 * Fix: apply `//` line-comment stripping ONLY to non-CSS files (.ts, .tsx). CSS
 * files have block comments only (`/* … *​/`). This matches the actual comment
 * models of the governed file types.
 */
function stripComments(source: string, isCss: boolean): string {
  // Blank out comment content but PRESERVE newlines, so a colour word in a
  // multi-line block comment is removed without shifting the line numbers of
  // every later finding (the guard reports file:line — that must stay exact).
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (!isCss) {
    // TS/TSX: strip `//` line comments but NOT inside string/template literals.
    // A simple regex over raw text cannot see into string context, so we apply a
    // conservative rule: skip the `//` replacement when it appears inside a URL
    // context (`://` or `//` preceded by a quote or `=`). In practice the only
    // `//` occurrences in the governed .ts/.tsx sources are genuine comments, so
    // the simple replacement is safe and sufficient. The URL false-negative class
    // is only in CSS (handled above by the isCss guard).
    out = out.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  }
  return out;
}

/**
 * Two LICENSED spans are blanked (space-filled, newline-preserving — line numbers
 * of later findings stay exact) after comment stripping, BEFORE any matching:
 *
 *   1. `@supports` PRELUDES (`@supports … {` up to the block brace). A prelude is
 *      a capability PROBE — it never paints. The canonical color-mix feature probe
 *      is `@supports (color: color-mix(in oklab, red, blue))` (#109 fallback law);
 *      `red`/`blue` there are probe syntax, not consumed colours. Only the prelude
 *      is blanked — a literal colour inside the @supports BLOCK still fires.
 *   2. The recipe-D state-overlay combinator (#109), in BOTH authored forms (CSS
 *      `var()` — including biome's multi-line layout — and Lit `${litVar(…)}`):
 *      `color-mix(in oklab, <--lab-* role ref>, black <--lab-state-* fraction ref>)`.
 *      This exact shape cannot introduce a brand colour: the base is a role token,
 *      `black` is the achromatic darkening anchor mandated by design law in both
 *      themes (docs/vocabulary.md § stated overlays, «почему к чёрному»), and the
 *      fraction is a governed `--lab-state-*` token. Its correctness is separately
 *      CI-gated (state-overlay-{contrast,muddiness}); the shared parser in
 *      `packages/colors/test/state-overlays-shared.mjs` pins the same shape. ANY
 *      deviation — `white`, a literal fraction (`black 30%`), a non-role base, a
 *      non-state fraction var, or free-standing `black` — stays flagged.
 */
const SUPPORTS_PRELUDE_RE = /@supports[^{]*/g;
const LAB_REF = String.raw`(?:var\(\s*--lab-[a-z0-9-]+\s*\)|\$\{litVar\(\s*'--lab-[a-z0-9-]+'\s*\)\})`;
const STATE_FRACTION_REF = String.raw`(?:var\(\s*--lab-state-(?:hover|pressed)\s*(?:,\s*[\d.]+%\s*)?\)|\$\{litVar\(\s*'--lab-state-(?:hover|pressed)'\s*(?:,\s*'[\d.]+%'\s*)?\)\})`;
const RECIPE_D_RE = new RegExp(
  String.raw`color-mix\(\s*in oklab\s*,\s*${LAB_REF}\s*,\s*black\s+${STATE_FRACTION_REF}\s*\)`,
  'gi',
);
function blankLicensedSpans(text: string): string {
  const blank = (m: string): string => m.replace(/[^\n]/g, ' ');
  return text.replace(SUPPORTS_PRELUDE_RE, blank).replace(RECIPE_D_RE, blank);
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
 *
 * The function NAMES carry a non-identifier-char lookbehind so a name that is merely
 * the SUFFIX of an identifier is not matched: `color(` is the CSS function, but
 * `makeColor(` / `getTextColor(` / `useColor(` are ordinary JS calls and must NOT be
 * flagged (the `color()` form is the only function name that is also a common identifier
 * suffix, but the boundary is applied uniformly so `calcLch(` etc. are safe too). The hex
 * branch keeps its own `#` anchor and is left outside the lookbehind.
 */
const FUNCTIONAL_NAME = '(?:rgba?|hsla?|hwb|(?:ok)?lab|(?:ok)?lch|color)\\(';
const FUNCTIONAL_HEX = `(?:(?<![A-Za-z0-9_$-])${FUNCTIONAL_NAME}|#[0-9a-f]{3,8}\\b)`;
const FUNCTIONAL_HEX_RE = new RegExp(FUNCTIONAL_HEX, 'gi');

/**
 * A `color-mix(` / `light-dark(` whose body (up to the matching-ish close) holds
 * a hex or rgb/hsl/oklch literal. A combinator over pure role tokens / keywords
 * introduces no literal and is NOT matched. Non-greedy body keeps it on one
 * call; the embedded literal alternation is the actual finding.
 *
 * NAMED-colour combinator arguments (`color-mix(in srgb, red, blue)`) are NOT this
 * regex's job — they are caught by `VALUE_NAMED_RE` below, which matches a colour
 * keyword in ANY value position (a combinator argument is flanked by `,`/whitespace/
 * `(`, all separators). So this regex covers ONLY the hex/functional case a bare
 * word-boundary match cannot see, and the two together leave no combinator gap.
 */
const COMBINATOR_RE =
  /(?:color-mix|light-dark)\([^)]*(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|(?:ok)?lch\(|(?:ok)?lab\()/gi;

/**
 * Named / system colour as a CSS VALUE — found in TWO stages so the match is both
 * a whole word AND in a genuine value position:
 *
 *   Stage 1 (lexical): a colour keyword bounded by a non-identifier character on BOTH
 *   sides, so a colour word that is merely a SUBSTRING of a property name or identifier
 *   is rejected — `white-space` → `white` is followed by `-`; `Fieldset` → `Field`
 *   followed by `s`; `salmonate` → `salmon` followed by `a`; `--my-tan-token` → `tan`
 *   flanked by `-`. The boundary delimiter set is `[A-Za-z0-9_$-]` (CSS identifier
 *   chars ∪ JS identifier chars).
 *
 *   Stage 2 (positional): the whole-word match is reported ONLY if it sits in a CSS
 *   VALUE POSITION (see `isColourValuePosition`). The lexical boundary alone cannot
 *   tell a CSS value from any ordinary colour-named JS/TS token — `const gold = 5`,
 *   `{ gold: 1 }` (colour is a KEY), `type Tone = 'red' | 'blue'` (string-union member),
 *   `import x from './red/thing'` (path segment), `[data-color="blue"]{}` (attribute
 *   SELECTOR), `.red {}` (class selector), `<Mark/>` / `const Field` / `enum { Mark }`
 *   (component / identifier / enum names) are all whole-word colour tokens that are NOT
 *   colour values. The positional gate is the disambiguator the bare boundary lacks.
 *
 * Why a value-POSITION gate, not the older `:\s*` colon-ADJACENCY anchor: colon
 * adjacency was too NARROW — a colour authored in a non-colon-adjacent value position
 * bypassed the guard entirely (`border: 1px solid red`, `linear-gradient(…, white,
 * black)`, `color-mix(in srgb, red, blue)`, `{ color: 'red' }`, `fill="red"`). The
 * positional predicate accepts ALL of those (value after a `:`, function/combinator
 * argument after `(`/`,`, colour-attribute/colour-key quoted value after `=`/`:`) while
 * rejecting the code-position collisions above — closing the WIDE value class without
 * re-opening the identifier false-positive class.
 *
 * Comments are stripped upstream (see `stripComments`), so a colour word in prose is
 * never seen. The valueless keywords `transparent` / `currentColor` are subtracted from
 * the alternation (see `FLAGGED_NAMED`), so they remain legal everywhere.
 *
 * CASE policy differs by colour kind:
 *   - NAMED colours (`red`, `rebeccapurple`, `black`, …) are colour-only words, matched
 *     case-INSENSITIVELY (`BLACK` is the same bug as `black`).
 *   - SYSTEM colours (`Field`, `Mark`, `Canvas`, `Highlight`, `SelectedItem`, …) are
 *     ordinary words that appear as lowercase identifiers in real source, so they are
 *     matched case-SENSITIVELY at their canonical (mostly Pascal) CSS casing.
 * (The positional gate already rejects the identifier collisions; the case policy is a
 * cheap second line of defence kept from the prior design.)
 */
const NAMED_BOUNDARY_BEFORE = '(?<![A-Za-z0-9_$-])';
const NAMED_BOUNDARY_AFTER = '(?![A-Za-z0-9_$-])';
const VALUE_NAMED_RE = new RegExp(
  `${NAMED_BOUNDARY_BEFORE}(?:${FLAGGED_NAMED.join('|')})${NAMED_BOUNDARY_AFTER}`,
  'gi',
);
const VALUE_SYSTEM_RE = new RegExp(
  `${NAMED_BOUNDARY_BEFORE}(?:${SYSTEM_COLOURS.join('|')})${NAMED_BOUNDARY_AFTER}`,
  'g',
);

/**
 * The property / attribute / object-key names whose VALUE is a colour. Used to license
 * a colour keyword that follows an `=` (JSX/SVG attribute) — `fill="red"`,
 * `stroke="Canvas"` are colour values; `label="Name"` / `data-color="blue"` (the latter
 * a CSS attribute selector) are not. Matched at the END of the text left of the `=`.
 */
const COLOUR_ATTR_RE =
  /(?:^|[^A-Za-z0-9_$-])(?:[A-Za-z-]*[Cc]olor|fill|stroke|background|stop-color|flood-color|lighting-color)$/;

/**
 * Decide whether a whole-word colour keyword at `index` in `text` is in a CSS VALUE
 * position. The discriminator is the nearest STRUCTURAL delimiter to the left:
 *   - `:`  CSS declaration value or CSS-in-JS object value — licensed iff an identifier
 *          (a property / key) sits immediately before the colon (rejects selector `::`,
 *          ` :` combinators). `color: red`, `border: 1px solid red`, `{ color: 'red' }`.
 *   - `(`  function / combinator argument. `linear-gradient(red)`, `light-dark(red, …)`.
 *   - `,`  multi-value or function argument — licensed ONLY inside an unclosed `(`
 *          (a function arg); a top-level `,` separates object KEYS / array members, not
 *          values (`{ gold: 1, silver: 2 }` → `silver` is a key, rejected).
 *   - `=`  JSX/SVG attribute value — licensed ONLY if the name before `=` is a colour
 *          attribute (`fill="red"`) AND we are not inside a CSS attribute selector
 *          `[ … ]` (`[data-color="blue"]` rejected). Rejects `const tone = 'red'`,
 *          `type Tone = 'red'` (LHS is not a colour attribute).
 *   - `;` `{` `}` `[`  declaration / block / selector boundaries — NOT value positions.
 * No structural delimiter to the left at all (bare leading token) → not a value.
 *
 * A COMPLETED function group `(…)` to the left is part of the surrounding value, not a
 * boundary: in `background: url("x.png") red` or `border-image: url(x.png) 30 round red`
 * the nearest literal char before `red` is the `)` that closes `url(…)`, yet `red` is
 * still the colour value of the `background` declaration. So when the backward scan meets
 * a `)`, it SKIPS the whole balanced group back to its matching `(` and keeps scanning —
 * the governing delimiter is whatever precedes the group (here the `:`), not the `)`.
 * This closes the "colour after any completed function call in a value" false-negative
 * class (`url(…) red`, `calc(…) red`, `linear-gradient(…) red`) uniformly.
 */
function isColourValuePosition(text: string, index: number): boolean {
  let delimiterAt = -1;
  let delimiter = '';
  for (let k = index - 1; k >= 0; k -= 1) {
    const ch = text[k];
    if (ch === ')') {
      // Skip the balanced (…) group: a completed function call is part of the value,
      // not a boundary. Walk back to the matching `(` and continue from before it.
      let depth = 1;
      k -= 1;
      for (; k >= 0 && depth > 0; k -= 1) {
        const inner = text[k];
        if (inner === ')') depth += 1;
        else if (inner === '(') depth -= 1;
      }
      // k now points one char before the matching `(` (or -1 if unbalanced); the
      // outer loop's `k -= 1` would over-step, so compensate to re-examine that char.
      k += 1;
      continue;
    }
    if (ch !== undefined && ':;{}([,='.includes(ch)) {
      delimiterAt = k;
      delimiter = ch;
      break;
    }
  }
  if (delimiterAt === -1) return false;
  if (delimiter === ';' || delimiter === '{' || delimiter === '}' || delimiter === '[') {
    return false;
  }
  if (delimiter === '(') return true;
  if (delimiter === ':') {
    const beforeColon = text.slice(0, delimiterAt);
    // An identifier char immediately before the colon = a property / object key, so the
    // colour after the colon is its value. `::before` / ` : ` (selector) have no such char.
    return /[A-Za-z0-9_$-]$/.test(beforeColon);
  }
  if (delimiter === ',') {
    let depth = 0;
    for (let k = 0; k < index; k += 1) {
      const ch = text[k];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
    }
    return depth > 0;
  }
  // delimiter === '='
  let brackets = 0;
  for (let k = 0; k < index; k += 1) {
    const ch = text[k];
    if (ch === '[') brackets += 1;
    else if (ch === ']') brackets -= 1;
  }
  if (brackets > 0) return false;
  return COLOUR_ATTR_RE.test(text.slice(0, delimiterAt).trimEnd());
}

/**
 * Scan one file's (comment-stripped) text for any free-standing colour literal.
 * An allowlisted path yields nothing. The `Violation` shape matches the fallback
 * scanner so one reporter formats both guards.
 */
export function scanSource(relPath: string, source: string): Violation[] {
  if (ALLOWLIST.includes(relPath)) return [];
  const isCss = relPath.endsWith('.css');
  const text = blankLicensedSpans(stripComments(source, isCss));
  const out: Violation[] = [];
  const lineAt = (index: number): number => text.slice(0, index).split('\n').length;
  // Hex/functional forms (`#fff`, `rgb(`, `color-mix(…#fff…)`) introduce a literal
  // colour and cannot occur innocently, so they are reported wherever they match. A
  // bare named/system colour keyword is ambiguous with ordinary code tokens, so it is
  // reported ONLY when `isColourValuePosition` confirms it sits in a CSS value position.
  const anywhere = [FUNCTIONAL_HEX_RE, COMBINATOR_RE];
  const valueGated = [VALUE_NAMED_RE, VALUE_SYSTEM_RE];
  for (const re of [...anywhere, ...valueGated]) {
    const gated = valueGated.includes(re);
    re.lastIndex = 0;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      if (gated && !isColourValuePosition(text, m.index)) continue;
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
      // Scratch / probe files (filename starts with `_`) are transient artifacts and
      // must not be scanned as governed component source.
      const basename = rel.split('/').at(-1) ?? '';
      if (basename.startsWith('_')) continue;
      seen.add(rel);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
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
