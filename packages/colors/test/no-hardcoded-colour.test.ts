import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, scanHardcoded, scanSource } from './no-hardcoded-colour.js';
import { type Violation, scanAll } from './no-literal-colour-fallback.js';

/**
 * No-hardcoded-colour CI guard — the SUPERSET of the fallback guard. Asserts
 * ZERO free-standing colour literals across `packages/*` outside the allowlist,
 * and proves the scanner DETECTS each authored colour-literal form + correctly
 * IGNORES allowlisted files and non-colour values (so a green run means "clean",
 * never "blind"). It strengthens, never weakens, the #23/#24/#31 fallback class
 * (cross-checked at the bottom).
 */
describe('no hardcoded colour in packages/* (superset guard)', () => {
  // ── (1) Live-tree assertion: ZERO free-standing colour literals. A real leak
  // is fixed by --lab-* role substitution upstream, never by widening ALLOWLIST.
  it('the live packages/* tree has ZERO hardcoded colour literals', () => {
    const violations = scanHardcoded();
    const report = violations
      .map((v: Violation) => `  ${v.file}:${v.line} → ${v.token}  ::  ${v.snippet}`)
      .join('\n');
    expect(
      violations,
      `hardcoded colour literals in a component (replace with the correct --lab-* role):\n${report}`,
    ).toEqual([]);
  });

  // ── (2) Detection proofs — each authored colour-literal form produces a hit.
  it('DETECTS a free-standing hex literal', () => {
    expect(scanSource('p.css', '.x{color:#fff}')).toHaveLength(1);
  });

  it('allows only the contour mask and SourceAlpha values, while retaining paint detection', () => {
    const path = 'packages/materials/src/engine/contour-surface.ts';
    const alphaSources =
      "rimPath.setAttribute('stroke', 'white');\ndrawing.setAttribute('fill', 'black');";
    expect(scanSource(path, alphaSources)).toEqual([]);
    expect(scanSource('component.ts', alphaSources)).toHaveLength(2);
    expect(scanSource(path, `${alphaSources}\nface.style.background = 'red';`)).toMatchObject([
      { token: 'red' },
    ]);
    expect(scanSource(path, "rimPath.setAttribute('stroke', 'red');")).toHaveLength(1);
    expect(scanSource(path, "drawing.setAttribute('fill', 'white');")).toHaveLength(1);
  });

  it('DETECTS rgb() / rgba() literals', () => {
    expect(scanSource('p.css', 'background: rgb(0 0 0);')).toHaveLength(1);
    expect(scanSource('p.css', 'background: rgba(0, 0, 0, 0.5);')).toHaveLength(1);
  });

  it('separates Switch mask coverage from visible paints', () => {
    const path = 'packages/core/src/components/switch/styles.ts';
    const mask = 'const svg = `<svg><rect fill="white"/><path fill="black"/></svg>`;';
    expect(scanSource(path, mask)).toEqual([]);
    expect(scanSource('component.ts', mask)).toHaveLength(2);
    expect(scanSource(path, mask.replace('black', 'red'))).toMatchObject([{ token: 'red' }]);
    expect(scanSource(path, `${mask}\nconst css = '.x { color: white }';`)).toMatchObject([
      { token: 'white' },
    ]);
  });

  it('permits achromatic coverage only in complete mask declarations', () => {
    for (const property of ['mask', 'mask-image', '-webkit-mask', '-webkit-mask-image']) {
      const rule = `.x { ${property}: linear-gradient(black, #000000, white, #FFF, transparent); }`;
      expect(scanSource('p.css', rule)).toEqual([]);
      expect(scanSource('p.ts', `const css = \`${rule}\`;`)).toEqual([]);
      expect(scanSource('p.ts', `const css = \`${rule}\${unknown}\`;`)).toEqual([]);
      expect(
        scanSource(
          'p.ts',
          `const css = \`${rule.replace('linear-gradient(', '${unknown}linear-gradient(')}\`;`,
        ),
      ).toHaveLength(4);
      expect(scanSource('p.css', `${rule} .y { background: white; color: #000; }`)).toHaveLength(2);
      expect(scanSource('p.css', `.x { ${property}: linear-gradient(red, #123); }`)).toHaveLength(
        2,
      );
      expect(
        scanSource('p.css', `.x { ${property}: linear-gradient(rgb(0 0 0), transparent); }`),
      ).toHaveLength(1);
    }
    expect(scanSource('p.css', '.x { --mask: linear-gradient(black, white); }')).toHaveLength(2);
    expect(
      scanSource('p.css', '.x { background-image: linear-gradient(black, white); }'),
    ).toHaveLength(2);
  });

  it.each([
    "const mask = (unused = paint('#fff')) => 'url(mask.svg)'; const css = `.x { mask-image: ${mask()}; }`;",
    "const mask = ([unused = paint('#fff')]) => 'url(mask.svg)'; const css = `.x { mask-image: ${mask([])}; }`;",
  ])('keeps paint visible when a mask call has an unknown default effect: %s', (source) => {
    expect(scanSource('p.ts', source).map((hit) => hit.token)).toEqual(['#fff']);
  });

  it('distinguishes numeric colour serialization and property access from hardcoded paints', () => {
    expect(scanSource('p.ts', 'const fill = `rgb(${c.r} ${c.g} ${c.b} / ${c.a})`;')).toEqual([]);
    expect(
      scanSource('p.ts', 'const fill = `rgb(${n(c.r)} ${n(c.g)} ${n(c.b)} / ${n(c.a)})`;'),
    ).toEqual([]);
    for (const literal of ['0', '-1', '(0)', '0x00', '1 - 1']) {
      expect(
        scanSource(
          'p.ts',
          `const fill = \`rgb(\$\{${literal}\} \$\{${literal}\} \$\{${literal}\})\`;`,
        ),
      ).toHaveLength(1);
      expect(
        scanSource(
          'p.ts',
          `const fill = \`rgb(\$\{c.r\} \$\{c.g\} \$\{c.b\} / \$\{${literal}\})\`;`,
        ),
      ).toHaveLength(1);
    }
    expect(scanSource('p.ts', 'const fill = `rgb(${c.r} ${c.g} ${c.b} / ${.5})`;')).toHaveLength(1);
    expect(scanSource('p.ts', 'const fill = `rgb(${c.r} ${c.g} 0 / ${c.a})`;')).toHaveLength(1);
    expect(scanSource('p.ts', 'const fill = `rgb(${c.r} ${c.g} ${c.b} / .5)`;')).toHaveLength(1);
    expect(scanSource('p.ts', 'const fill = `rgb(${0} ${0} ${0})`;')).toHaveLength(1);
    expect(scanSource('p.ts', 'const fill = `rgb(${c.r} ${c.g} ${c.b} / ${.5})`;')).toHaveLength(1);
    expect(scanSource('p.ts', 'const fill = `rgb(${0xff} ${c.g} ${c.b})`;')).toHaveLength(1);
    expect(scanSource('p.ts', 'const fill = { r: black.r / alpha, g: white[key] };')).toEqual([]);
  });

  it('DETECTS hsl() / oklch() / color-mix() / light-dark() literals', () => {
    expect(scanSource('p.css', 'border-color: hsl(0 0% 0%);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: oklch(0.5 0.1 200);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: color-mix(in srgb, #fff, #000);').length).toBeGreaterThan(0);
    expect(scanSource('p.css', 'color: light-dark(#fff, #000);').length).toBeGreaterThan(0);
  });

  it('DETECTS the CSS color() function but IGNORES a Color identifier SUFFIX', () => {
    // `color(` is a real CSS function (flagged), but the function NAME must carry a
    // non-identifier boundary so an ordinary JS call whose identifier merely ENDS in
    // "Color" is not a false positive — otherwise every `makeColor()` / `getTextColor()`
    // in a component file would fail the guard.
    expect(scanSource('p.css', 'color: color(display-p3 1 0 0);')).toHaveLength(1);
    expect(scanSource('p.tsx', "const tone = makeColor('x');")).toEqual([]);
    expect(scanSource('p.tsx', 'const c = getTextColor();')).toEqual([]);
    expect(scanSource('p.tsx', 'useColor();')).toEqual([]);
  });

  it('DETECTS a named colour and a system colour (whole-word)', () => {
    expect(scanSource('p.css', 'color: rebeccapurple;')).toHaveLength(1);
    expect(scanSource('p.css', 'background: Canvas;')).toHaveLength(1);
  });

  it('permits system colours only in active forced-colors, including nested rules', () => {
    expect(
      scanSource(
        'p.css',
        '@media (forced-colors: active) { .x { content: "{"; color: CanvasText; } } .y { color: CanvasText; }',
      ),
    ).toHaveLength(1);
    const source =
      '@media (forced-colors: active) { @supports (display: grid) { .x { outline: 1px solid CanvasText; } } .y { color: red; } }\n.z { color: CanvasText; }';
    expect(scanSource('p.css', source).map((hit) => hit.token)).toEqual(['red', 'CanvasText']);
    expect(
      scanSource('p.css', '@media (forced-colors: none) { .x { color: CanvasText; } }'),
    ).toHaveLength(1);
    expect(
      scanSource(
        'p.css',
        '@media (forced-colors: active), (min-width: 1px) { .x { color: CanvasText; } }',
      ),
    ).toHaveLength(1);
    expect(
      scanSource(
        'p.ts',
        'const css = `@media (forced-colors: active) { .x { color: CanvasText; } }`;',
      ),
    ).toEqual([]);
    expect(
      scanSource(
        'p.ts',
        'const css = `@media (forced-colors: active) { ${unknown} .x { color: CanvasText; } }`;',
      ),
    ).toHaveLength(1);
  });

  it('DETECTS case-insensitively (#FFF / RGB( / BLACK)', () => {
    expect(scanSource('p.css', 'color: #FFF;')).toHaveLength(1);
    expect(scanSource('p.css', 'background: RGB(0 0 0);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: BLACK;')).toHaveLength(1);
  });

  it('follows a private SVG producer only when every use is a mask', () => {
    const helper =
      'const image = (path: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg><path fill="white" d="${path}"/></svg>`)}")`;';
    const mask = 'const styles = `.x { mask-image: ${image("M0 0")}; }`;';
    expect(scanSource('p.ts', helper + mask)).toEqual([]);
    expect(
      scanSource('p.ts', helper.replace('white', 'red') + mask).map((hit) => hit.token),
    ).toEqual(['red']);
    expect(scanSource('p.ts', `export ${helper}${mask}`).map((hit) => hit.token)).toEqual([
      'white',
    ]);
    expect(
      scanSource(
        'p.ts',
        `${helper + mask}const visible = \`.y { background-image: \${image("M0 0")}; }\`;`,
      ).map((hit) => hit.token),
    ).toEqual(['white']);
    expect(
      scanSource('p.ts', `${helper + mask}window.icon = image("M0 0");`).map((hit) => hit.token),
    ).toEqual(['white']);
  });

  // ── (2b) Positional class lock — a named / system colour must be caught in EVERY
  // authoring position, not only the colon-adjacent `property: colour` form. These
  // are the exact positions that bypassed the guard before (colon-adjacency in
  // VALUE_NAMED_RE; named args invisible to COMBINATOR_RE): CSS shorthand /
  // multi-value, gradient args, CSS-in-JS / inline-style objects, JSX/SVG colour
  // attributes, and named color-mix() / light-dark() combinators. Each case asserts
  // ≥1 hit, so a future regex tweak that re-narrows the match fails RED here. The
  // table is data-driven so the position name appears in the failure message.
  const NAMED_LEAK_POSITIONS: ReadonlyArray<{ readonly position: string; readonly src: string }> = [
    { position: 'CSS shorthand (border)', src: '.x{border:1px solid red;}' },
    { position: 'CSS shorthand (box-shadow)', src: '.x{box-shadow:0 0 4px black;}' },
    {
      position: 'CSS multi-value gradient',
      src: '.x{background:linear-gradient(to bottom, white, black)}',
    },
    { position: 'CSS-in-JS object (single-quote)', src: "const s = { color: 'red' }" },
    { position: 'CSS-in-JS object (double-quote)', src: 'const s = { borderColor: "blue" }' },
    { position: 'JSX/SVG fill attribute', src: '<path fill="red" />' },
    { position: 'JSX/SVG stroke system-colour attribute', src: '<rect stroke="Canvas" />' },
    {
      position: 'named color-mix() combinator',
      src: '.x{background:color-mix(in srgb, red 50%, blue)}',
    },
    { position: 'named light-dark() combinator', src: '.x{color:light-dark(red, blue)}' },
    // Colour AFTER a completed function group `(…)` in the same value: the nearest
    // literal char before the colour is the group's closing `)`, but the colour is still
    // the declaration's value. The backward scan must skip the balanced group and find
    // the governing `:`. A bare nearest-delimiter check MISSED all of these.
    { position: 'colour after url() in background', src: '.x{background:url("a.png") red}' },
    {
      position: 'colour after url() in border-image shorthand',
      src: '.x{border-image:url(x.png) 30 round red}',
    },
    { position: 'colour after calc() in shorthand', src: '.x{background:calc(100%) red}' },
    { position: 'named colour as a CSS var() fallback', src: '.x{color:var(--primary, red)}' },
  ];

  it.each(NAMED_LEAK_POSITIONS)(
    'DETECTS a named/system colour in $position (positional class lock)',
    ({ position, src }) => {
      expect(
        scanSource('p.css', src).length,
        `a named colour in "${position}" must be flagged but was MISSED — the guard ` +
          `must catch a colour value in every authoring position, not only after a colon:\n  ${src}`,
      ).toBeGreaterThan(0);
    },
  );

  it('IGNORES a colour word that is only a SUBSTRING of a property name / identifier', () => {
    // The positional widening must NOT regress into substring false-positives: a
    // colour keyword glued to an identifier char on either side is not a value.
    expect(scanSource('p.css', '.x{white-space: nowrap;}')).toEqual([]); // "white" in white-space
    expect(scanSource('p.tsx', 'function Fieldset() {}')).toEqual([]); // "Field" in Fieldset
    expect(scanSource('p.css', '.x{animation: salmonate 1s;}')).toEqual([]); // "salmon" in salmonate
    expect(scanSource('p.css', '.lavender-bg {}')).toEqual([]); // "lavender" in a class name
    expect(scanSource('p.css', '.x{--my-tan-token: 1;}')).toEqual([]); // "tan" in a token name
    expect(scanSource('p.tsx', 'const redButton = 1;')).toEqual([]); // "red" at identifier start
    expect(scanSource('p.tsx', 'function makeBlue() {}')).toEqual([]); // "blue" at identifier end
  });

  // ── (2c) Code-position class lock — a whole-word colour keyword that is NOT a CSS
  // value (a JS/TS identifier, object KEY, string-union member, import-path segment,
  // enum member, JSX component name, or CSS selector word) must NEVER be flagged. These
  // are exactly the false positives a bare word-boundary match produced once the colon
  // anchor was dropped (a colour word flanked by separators looks identical to a value).
  // The positional gate (`isColourValuePosition`) is what distinguishes them; each case
  // below asserts ZERO hits so a future regex that re-drops the gate fails RED here.
  const CODE_POSITION_NON_VALUES: ReadonlyArray<{
    readonly position: string;
    readonly src: string;
  }> = [
    { position: 'named-colour const identifier', src: 'const gold = 5;' },
    { position: 'named-colour object KEYS (not values)', src: 'const p = { gold: 1, silver: 2 };' },
    { position: 'named-colour string-union members', src: "type Tone = 'red' | 'blue' | 'green';" },
    {
      position: 'named-colour value assigned to a non-colour identifier',
      src: "const tone = 'red';",
    },
    { position: 'named-colour import-path segment', src: "import x from './red/thing.js';" },
    { position: 'named-colour CSS attribute SELECTOR', src: '[data-color="blue"] {}' },
    { position: 'named-colour CSS class selector', src: '.red { padding: 0; }' },
    { position: 'system-colour JSX component (self-closing)', src: '<Mark />' },
    { position: 'system-colour component const', src: 'const Field = () => null;' },
    { position: 'system-colour component with non-colour attr', src: '<Field label="Name" />' },
    { position: 'system-colour component const (Canvas)', src: 'const Canvas = () => null;' },
    { position: 'system-colour named import', src: "import { Field } from './field.js';" },
    { position: 'system-colour enum member', src: 'enum Status { Active, Mark }' },
    { position: 'system-colour exported binding', src: 'export { SelectedItem };' },
    { position: 'system-colour const (ButtonFace)', src: 'const ButtonFace = 1;' },
    { position: 'system-colour function declaration', src: 'function Highlight() {}' },
  ];

  it.each(CODE_POSITION_NON_VALUES)(
    'IGNORES a colour-named token in a NON-value $position (code-position class lock)',
    ({ position, src }) => {
      expect(
        scanSource('p.tsx', src),
        `a colour-named token in "${position}" is NOT a CSS value and must NOT be flagged — the guard must distinguish a CSS value from an ordinary colour-named code token (identifier / key / union member / import segment / selector / component / enum), or it fires a misleading 'hardcoded colour' error on the React twins:\n  ${src}`,
      ).toEqual([]);
    },
  );

  it('IGNORES the valueless keywords transparent / currentColor in any position', () => {
    expect(scanSource('p.css', '.x{border:1px solid transparent;}')).toEqual([]);
    expect(scanSource('p.tsx', '<path fill="currentColor" />')).toEqual([]);
    expect(
      scanSource('p.css', '.x{background:color-mix(in srgb, transparent, var(--lab-x))}'),
    ).toEqual([]);
  });

  // ── (2d) Licensed spans (#109) — the @supports capability probe and the exact
  // recipe-D state-overlay combinator are licensed; EVERY deviation stays flagged.
  it('IGNORES the canonical color-mix @supports probe (a prelude never paints)', () => {
    expect(
      scanSource(
        'p.css',
        '@supports (color: color-mix(in oklab, red, blue)) { .x { color: var(--lab-label-primary); } }',
      ),
    ).toEqual([]);
    expect(
      scanSource(
        'p.css',
        '@supports not (color: color-mix(in oklab, red, blue)) { .x { filter: brightness(0.92); } }',
      ),
    ).toEqual([]);
    // Same probe inside a Lit template literal (the core twin).
    expect(
      scanSource(
        'p.ts',
        'css`@supports not (color: color-mix(in oklab, red, blue)) { button:hover { filter: brightness(0.7787); } }`',
      ),
    ).toEqual([]);
  });

  it('DETECTS a colour inside the @supports BLOCK (only the prelude is licensed)', () => {
    expect(scanSource('p.css', '@supports (display: grid) { .x { color: red; } }')).toHaveLength(1);
  });

  it('IGNORES the recipe-D overlay combinator in all three authored forms (#109)', () => {
    // CSS, single line.
    expect(
      scanSource(
        'p.css',
        '.x{background-color: color-mix(in oklab, var(--lab-fill-accent), black var(--lab-state-hover, 8%));}',
      ),
    ).toEqual([]);
    // CSS, biome multi-line layout.
    expect(
      scanSource(
        'p.css',
        '.x{background-color: color-mix(\n    in oklab,\n    var(--lab-fill-accent),\n    black var(--lab-state-pressed, 14%)\n  );}',
      ),
    ).toEqual([]);
    // Lit template literal (${litVar(…)} refs — the core twin).
    expect(
      scanSource(
        'p.ts',
        "background-color: color-mix(in oklab, ${litVar('--lab-fill-accent')}, black ${litVar('--lab-state-hover', '8%')});",
      ),
    ).toEqual([]);
  });

  it('DETECTS every deviation from the licensed recipe-D shape (RED-proof)', () => {
    // Literal fraction instead of a governed --lab-state-* token.
    expect(
      scanSource('p.css', '.x{background: color-mix(in oklab, var(--lab-fill-accent), black 30%);}')
        .length,
    ).toBeGreaterThan(0);
    // Non-achromatic tint in the same shape.
    expect(
      scanSource(
        'p.css',
        '.x{background: color-mix(in oklab, var(--lab-fill-accent), white var(--lab-state-hover, 8%));}',
      ).length,
    ).toBeGreaterThan(0);
    // Non-role base.
    expect(
      scanSource(
        'p.css',
        '.x{background: color-mix(in oklab, red, black var(--lab-state-hover, 8%));}',
      ).length,
    ).toBeGreaterThan(0);
    // Free-standing black remains a plain leak.
    expect(scanSource('p.css', '.x{background: black;}')).toHaveLength(1);
  });

  // ── (3) Allowlist proofs — a colour literal from an allowlisted file is fine.
  it('IGNORES colour literals in allowlisted files (contract / figma-reference / shadow)', () => {
    expect(scanSource('packages/colors/contract.css', '--lab-bg-primary: #ffffff;')).toEqual([]);
    expect(scanSource('packages/colors/figma-reference.css', 'color: rgba(0,0,0,0.04);')).toEqual(
      [],
    );
    expect(
      scanSource('packages/shadow/src/generated/shadow.css', '--lab-shadow-color: #101012;'),
    ).toEqual([]);
  });

  // ── (4) Negative proofs — no false positives on legitimate non-colour text.
  it('IGNORES a bare --lab-* token name (no colour literal in a custom-property name)', () => {
    expect(scanSource('p.css', 'color: var(--lab-label-primary);')).toEqual([]);
    expect(scanSource('p.ts', "color: ${cssVar('--lab-fill-brand-primary')};")).toEqual([]);
  });

  it('IGNORES dimension values (0.5rem / 2px) and blend-mode keyword (screen)', () => {
    expect(scanSource('p.css', 'padding: 0.5rem;')).toEqual([]);
    expect(scanSource('p.css', 'border-width: 2px;')).toEqual([]);
    expect(scanSource('p.css', 'mix-blend-mode: screen;')).toEqual([]);
  });

  // ── (5) Regression link: the existing fallback guard's scanAll() STILL returns
  // [] — the narrower #23/#24/#31 class stays closed while the superset is added.
  it('the existing fallback guard scanAll() still returns [] (non-regression cross-check)', () => {
    expect(scanAll()).toEqual([]);
  });

  // ── (6) CSS `//` URL false-negative regression lock. CSS has no `//` line comments.
  // A `//` in a CSS value is a URL protocol separator and must NOT blank the rest of
  // the line. Before this fix, `stripComments` applied `//` erasure to CSS files,
  // hiding any hardcoded colour that followed a URL on the same line.
  it('DETECTS a hardcoded colour on the same CSS line as a url(http://…) — CSS has no // comments', () => {
    // A `//` inside a url() must not blank the rest of the line; the trailing #ff0000 must be caught.
    expect(
      scanSource('p.css', '.x{ background:url(http://a/b.png) no-repeat; color:#ff0000 }'),
    ).toHaveLength(1);
  });

  it('DETECTS a hardcoded colour on the same CSS line as a protocol-relative url(//…)', () => {
    expect(scanSource('p.css', '.x{ background:url(//cdn/x.png); color:#ff0000 }')).toHaveLength(1);
  });
});

describe('allowlist integrity', () => {
  const repoRoot = resolve(import.meta.dirname, '..', '..', '..');

  it('every allowlisted hardcoded-colour file referenced by the guard is a real file', () => {
    // Cross-check that the guard's allowlist (the files holding gap values) all
    // resolve — a stale allowlist path is a silent hole.
    const unresolved = ALLOWLIST.filter((rel) => !existsSync(resolve(repoRoot, rel)));
    expect(unresolved, `allowlisted paths that do not resolve:\n${unresolved.join('\n')}`).toEqual(
      [],
    );
  });
});
