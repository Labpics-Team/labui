/**
 * Recurrence guard — NO colour/FX-role token may carry a literal-colour fallback.
 *
 * The token contract (packages/core/src/css.ts §"cssVar") is explicit: a fallback is
 * legal ONLY for a DIMENSION token (a sensible default keeps a component usable before
 * tokens load) or when the fallback is ANOTHER `--lab-*` token (token → token). A
 * COLOUR / FX role (`--lab-label-*`, `--lab-fill-*`, `--lab-border-*`, `--lab-bg-*`,
 * `--lab-surface-*`, `--lab-overlay-*`, `--lab-fx-*`, `--lab-accent-*`, `--lab-badge-*`,
 * `--lab-control-*`, …) must NEVER bake a literal colour as its fallback — a missing role
 * is a contract bug to fix in the colour layer, not to paper over with a hardcoded
 * `rgb()/hsl()/#hex/named-colour/gradient`.
 *
 * This class of regression closed in #23/#24 and was reintroduced in #31
 * (`--lab-fx-shadow-major, rgb(0 0 0 / 0.25)`). This module is the scanner; the sibling
 * `no-literal-colour-fallback.test.ts` asserts ZERO violations across the design system
 * and so FAILS CI the moment the pattern returns — in BOTH authored forms:
 *   - CSS  : `var(--lab-<colour-role>, <colour-literal>)`
 *   - TS   : `litVar('--lab-<colour-role>', '<colour-literal>')`  (and `cssVar(...)`)
 *
 * It is intentionally framework-free (plain string scanning over file text) so the rule
 * is enforced uniformly across the Lit core, the React twin, and the docs fixtures.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** Repo root — colors is `packages/colors`, so two levels up. */
export const repoRoot = resolve(here, '..', '..', '..');

/**
 * Role-family prefixes whose tokens resolve to a COLOUR (or colour-bearing effect).
 * These are the families a literal-colour fallback is forbidden on. Mirrors the
 * semantic + primitive colour families named in packages/core/src/css.ts. DIMENSION
 * families (space/radius/z/font/line-height/duration) are deliberately ABSENT — a
 * literal dimension fallback there is allowed and must NOT be flagged.
 */
export const COLOUR_ROLE_PREFIXES = [
  'label',
  'fill',
  'border',
  'surface',
  'bg',
  'overlay',
  'fx', // glow / focus-ring / shadow / skeleton — all colour-bearing
  'accent',
  'badge', // --lab-badge-label-* (Misc group) — colour-bearing, consumed in lab-badge
  'control', // --lab-control-bg — colour-bearing, consumed in switch/slider
  'neutral', // primitive (must never be read, let alone fallback-baked)
] as const;

/** A `--lab-<colour-role>-…` token name (the part before the comma in a fallback). */
const COLOUR_TOKEN = `--lab-(?:${COLOUR_ROLE_PREFIXES.join('|')})-[a-z0-9-]+`;

/**
 * The full set of CSS named colours (CSS Color Module Level 4) plus the system
 * keywords that resolve to a COLOUR (`currentColor`, `transparent`). This is a CLOSED,
 * bounded set — it deliberately excludes CSS keywords that are NOT colours but can sit
 * in a fallback of a non-colour token in a colour-bearing family (e.g. a blend-mode
 * `screen` / `multiply` / `overlay`, or `inherit` / `none`), so the scanner never
 * false-positives on a legitimate keyword fallback. Maintaining the named-colour set is
 * cheap and exact; matching "any bare identifier" is what mis-flagged `screen`.
 */
export const NAMED_COLOURS = [
  'transparent',
  'currentcolor',
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
];

/**
 * CSS system-colour keywords (CSS Color Module Level 4 §"System Colors") — they resolve
 * to a platform COLOUR (e.g. `Canvas` is the OS canvas background). They are bare
 * identifiers, so they are matched as WHOLE WORDS (a `\b…\b`-bounded, case-insensitive
 * alternation) — never as substrings. This bounding is what keeps a legitimate
 * NON-colour keyword fallback on a colour-family role unflagged, in particular a
 * blend-mode `var(--lab-fx-blend, screen)` (`screen`/`multiply`/`overlay`/… are
 * absent from this set, so they are never matched).
 */
export const SYSTEM_COLOURS = [
  'Canvas',
  'CanvasText',
  'LinkText',
  'VisitedText',
  'ActiveText',
  'ButtonFace',
  'ButtonText',
  'ButtonBorder',
  'Field',
  'FieldText',
  'Highlight',
  'HighlightText',
  'SelectedItem',
  'SelectedItemText',
  'Mark',
  'MarkText',
  'GrayText',
  'AccentColor',
  'AccentColorText',
];

/**
 * A literal COLOUR value used as a fallback. Token → token fallbacks (`var(--lab-…)`)
 * are explicitly NOT colour literals and are allowed, so they are absent here.
 *   - functional: rgb()/rgba()/hsl()/hsla()/hwb()/lab()/lch()/oklab()/oklch()/color()
 *               + color-mix()/light-dark() (modern colour-producing functions)
 *               + device-cmyk() (a colour-producing function)
 *               + linear-/radial-/conic-gradient() (colour-bearing <image> values — a
 *                 gradient fallback bakes literal colour stops just like a flat colour)
 *   - hex: #rgb … #rrggbbaa
 *   - any CSS named colour (the full Level-4 set + currentColor/transparent)
 *   - any CSS system-colour keyword (Canvas / ButtonFace / Field / …), whole-word only
 * Case is irrelevant (`RGB(`, `BLACK`, `Black`, `canvas` are the same bug), so both REs
 * carry the `i` flag and the named/system-colour alternations are matched
 * case-insensitively. `color-mix(`/`light-dark(` are listed BEFORE the bare `color(`
 * alternative purely for readability — alternation is order-independent for these
 * since each carries its own trailing `(` and `-` is not a word char. Each function
 * alternative is anchored on its full name + `(`, so it matches ONLY in the
 * fallback-value position (right after `var(--lab-<role>, ` / the TS string opener),
 * never on a bare `gradient` substring or an unrelated declaration value. The gradient
 * names carry a `(?<!repeating-)` negative lookbehind so `repeating-linear-gradient(`
 * (and the radial/conic repeating forms) is intrinsically excluded — a `\b` left-anchor
 * is NOT sufficient here, since `-` is a non-word char and a word boundary sits between
 * `repeating-` and `linear`, which would let a bare `\blinear-gradient\(` match the inner
 * substring. `repeating-*-gradient` paints a tiling pattern of the SAME baked colour
 * stops, so it is just as much a literal-colour fallback — but the recurrence class this
 * guard exists for is a single flat colour/gradient, and a repeating gradient is vanishing
 * in role fallbacks; excluding it keeps the scanner precise and matches the documented
 * intent. (A future tightening could drop the lookbehind to also flag repeating forms.)
 */
export const COLOUR_LITERAL = `(?:rgba?\\(|hsla?\\(|hwb\\(|(?:ok)?lab\\(|(?:ok)?lch\\(|color-mix\\(|light-dark\\(|device-cmyk\\(|(?<!repeating-)(?:linear|radial|conic)-gradient\\(|color\\(|#[0-9a-f]{3,8}\\b|\\b(?:${NAMED_COLOURS.join('|')})\\b|\\b(?:${SYSTEM_COLOURS.join('|')})\\b)`;

/** CSS form: `var(--lab-<colour-role>, <colour-literal>)`. */
const CSS_RE = new RegExp(`var\\(\\s*(${COLOUR_TOKEN})\\s*,\\s*${COLOUR_LITERAL}`, 'gi');

/**
 * TS form: `litVar('--lab-<colour-role>', '<colour-literal>')` (and `cssVar(...)`). The
 * second argument is a quoted string whose CONTENT is a colour literal; a token-name
 * second arg (`'--lab-…'`) is a token → token fallback and is allowed, so the literal
 * sub-pattern (which never starts with `--`) excludes it.
 */
const TS_RE = new RegExp(
  `(?:lit|css)Var\\(\\s*['"\`](${COLOUR_TOKEN})['"\`]\\s*,\\s*['"\`]\\s*${COLOUR_LITERAL}`,
  'gi',
);

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly token: string;
  readonly snippet: string;
}

/** Scan one file's text for both authored forms; return every violation found. */
export function scanSource(relPath: string, source: string): Violation[] {
  const out: Violation[] = [];
  const lineAt = (index: number): number => source.slice(0, index).split('\n').length;
  for (const re of [CSS_RE, TS_RE]) {
    re.lastIndex = 0;
    for (let m = re.exec(source); m !== null; m = re.exec(source)) {
      out.push({
        file: relPath,
        line: lineAt(m.index),
        token: m[1] ?? '',
        snippet: m[0].trim(),
      });
    }
  }
  return out;
}

/** The files the rule governs: every component-authored .ts/.tsx/.css across the
 * design system (the React twins live in .tsx, which `**​/*.ts` does NOT match), plus
 * the docs .ts/.tsx/.css fixtures. Build output and deps are excluded. The scanner and
 * its own test are excluded so their pattern literals do not self-match. */
export function targetFiles(): string[] {
  const patterns = [
    'packages/**/*.ts',
    'packages/**/*.tsx',
    'packages/**/*.css',
    'apps/docs/**/*.{ts,tsx}',
    'apps/docs/**/*.css',
  ];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    for (const abs of globSync(resolve(repoRoot, pattern))) {
      const rel = relative(repoRoot, abs).split('\\').join('/');
      if (rel.includes('/dist/')) continue;
      if (rel.includes('/node_modules/')) continue;
      if (rel.includes('/src/generated/')) continue;
      if (rel.endsWith('test/no-literal-colour-fallback.ts')) continue;
      if (rel.endsWith('test/no-literal-colour-fallback.test.ts')) continue;
      seen.add(rel);
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Scan the whole governed surface; return every violation across all files. */
export function scanAll(): Violation[] {
  const out: Violation[] = [];
  for (const rel of targetFiles()) {
    const source = readFileSync(resolve(repoRoot, rel), 'utf8');
    out.push(...scanSource(rel, source));
  }
  return out;
}
