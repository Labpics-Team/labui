import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCAL_OR_GAP_PREFIXES } from './consumed-contract.js';
import { type Violation, scanAll } from './no-literal-colour-fallback.js';
import { ALLOWLIST, scanHardcoded, scanSource } from './no-hardcoded-colour.js';

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

  it('DETECTS rgb() / rgba() literals', () => {
    expect(scanSource('p.css', 'background: rgb(0 0 0);')).toHaveLength(1);
    expect(scanSource('p.css', 'background: rgba(0, 0, 0, 0.5);')).toHaveLength(1);
  });

  it('DETECTS hsl() / oklch() / color-mix() / light-dark() literals', () => {
    expect(scanSource('p.css', 'border-color: hsl(0 0% 0%);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: oklch(0.5 0.1 200);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: color-mix(in srgb, #fff, #000);').length).toBeGreaterThan(0);
    expect(scanSource('p.css', 'color: light-dark(#fff, #000);').length).toBeGreaterThan(0);
  });

  it('DETECTS a named colour and a system colour (whole-word)', () => {
    expect(scanSource('p.css', 'color: rebeccapurple;')).toHaveLength(1);
    expect(scanSource('p.css', 'background: Canvas;')).toHaveLength(1);
  });

  it('DETECTS case-insensitively (#FFF / RGB( / BLACK)', () => {
    expect(scanSource('p.css', 'color: #FFF;')).toHaveLength(1);
    expect(scanSource('p.css', 'background: RGB(0 0 0);')).toHaveLength(1);
    expect(scanSource('p.css', 'color: BLACK;')).toHaveLength(1);
  });

  // ── (3) Allowlist proofs — a colour literal from an allowlisted file is fine.
  it('IGNORES colour literals in allowlisted files (contract / materials / shadow)', () => {
    expect(scanSource('packages/colors-stub/contract.css', '--lab-bg-primary: #ffffff;')).toEqual(
      [],
    );
    expect(scanSource('packages/core/src/materials.css', 'color: rgba(0,0,0,0.04);')).toEqual([]);
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
});

/**
 * Engine-gaps doc consistency — the `local-or-gap` allowlist (CH-01) and
 * `docs/external-deps/lab-colors.md` (CH-03) must never drift apart: every gap
 * prefix in the classifier appears in the doc, and the doc references real files.
 *
 * NOTE (RED-first): the doc is authored in CH-03 and does not exist yet, so this
 * suite FAILS now for the RIGHT reason — the asserted artifact is missing. It
 * turns GREEN only when CH-03 lands a doc that names every gap token.
 */
describe('engine-gaps doc consistency (classifier ⇄ docs/external-deps/lab-colors.md)', () => {
  const docPath = 'docs/external-deps/lab-colors.md';
  const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
  const docAbs = resolve(repoRoot, docPath);

  it('the external-deps gap doc exists', () => {
    expect(
      existsSync(docAbs),
      `${docPath} must exist (CH-03): the call-site-anchored record of every engine gap`,
    ).toBe(true);
  });

  it('every local-or-gap allowlist token appears in the gap doc', () => {
    const doc = existsSync(docAbs) ? readFileSync(docAbs, 'utf8') : '';
    const missing = LOCAL_OR_GAP_PREFIXES.filter((p) => !doc.includes(p));
    expect(
      missing,
      `local-or-gap tokens absent from ${docPath} (the classifier allowlist and the gap ` +
        `record must stay in sync):\n${missing.map((m) => `  ${m}`).join('\n')}`,
    ).toEqual([]);
  });

  it('every allowlisted hardcoded-colour file referenced by the guard is a real file', () => {
    // Cross-check that the guard's allowlist (the files holding gap values) all
    // resolve — a stale allowlist path is a silent hole.
    const unresolved = ALLOWLIST.filter((rel) => !existsSync(resolve(repoRoot, rel)));
    expect(unresolved, `allowlisted paths that do not resolve:\n${unresolved.join('\n')}`).toEqual(
      [],
    );
  });
});

/**
 * Engine-gaps capability-class completeness — locks the gap doc against the
 * `colors-contract-pin` exit criterion, which mandates EXACTLY five
 * EXTERNAL-blocker capability classes. The `local-or-gap` allowlist test above
 * only covers classes 3+4 (the `--lab-*` token families); classes 1, 2, and 5
 * are a package-delivery capability, a dimension/geometry capability, and an
 * anticipated theme respectively, so NO `--lab-*` token guards them. Without
 * this test the doc could silently drop any of the three (the exact gap that
 * left 3 of 5 classes undocumented) and only human review would catch it.
 *
 * Each class is asserted by a STABLE anchor string the doc must contain — a
 * heading or capability name, chosen so a rename of one class without updating
 * the others fails CI rather than passing blindly.
 */
describe('engine-gaps capability-class completeness (exit criterion ⇄ docs/external-deps/lab-colors.md)', () => {
  const docPath = 'docs/external-deps/lab-colors.md';
  const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
  const docAbs = resolve(repoRoot, docPath);

  /**
   * The five capability classes the chapter exit criterion enumerates verbatim,
   * each with the anchor substring(s) that prove it is documented. A class is
   * "present" only if ALL its anchors appear — so a partial mention (e.g. the
   * token name without its capability framing) does not satisfy the class.
   */
  const CAPABILITY_CLASSES: ReadonlyArray<{ readonly label: string; readonly anchors: string[] }> =
    [
      {
        label: 'published @labpics/colors CSS+JS entry',
        anchors: ['Published `@labpics/colors` CSS+JS entry'],
      },
      {
        label: 'frozen decorative floor / separator / shadow-ramp magnitudes',
        anchors: ['Decorative floor / separator / shadow-ramp magnitudes', '--lab-stroke-hairline'],
      },
      { label: '--lab-surface-shadow-tint', anchors: ['--lab-surface-shadow-tint'] },
      { label: '--lab-shadow-alpha-* JND alphas', anchors: ['--lab-shadow-alpha-'] },
      {
        label: 'IC (inclusive / contrast) theme calibration',
        anchors: ['IC (inclusive / contrast) theme calibration'],
      },
    ];

  it('the gap doc documents all five mandated capability classes', () => {
    const doc = existsSync(docAbs) ? readFileSync(docAbs, 'utf8') : '';
    const missing = CAPABILITY_CLASSES.filter((c) => !c.anchors.every((a) => doc.includes(a))).map(
      (c) => c.label,
    );
    expect(
      missing,
      `capability classes from the colors-contract-pin exit criterion absent from ${docPath} (the doc MUST record all five EXTERNAL blockers — do NOT remove a class to make this pass; document the gap):\n${missing.map((m) => `  - ${m}`).join('\n')}`,
    ).toEqual([]);
  });

  it('detects an omitted capability class (RED-proof)', () => {
    // Drive the SAME completeness check over a doc with one class stripped and
    // prove it flags exactly that class — a green completeness run therefore
    // means "all five documented", never "blind".
    const doc = readFileSync(docAbs, 'utf8');
    const stripped = doc.split('IC (inclusive / contrast) theme calibration').join('IC-REMOVED');
    const missing = CAPABILITY_CLASSES.filter(
      (c) => !c.anchors.every((a) => stripped.includes(a)),
    ).map((c) => c.label);
    expect(missing).toEqual(['IC (inclusive / contrast) theme calibration']);
  });
});
