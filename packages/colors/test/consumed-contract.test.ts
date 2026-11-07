import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { LabuiColorsState } from '../browser.mjs';
import {
  SEMANTIC_ROLE_PREFIXES,
  byBucket,
  classify,
  consumedNamesInSource,
  consumedRoles,
  consumedRolesWithSites,
  consumerFiles,
  knownColourRoles,
  missingColourRoles,
  repoRoot,
} from './consumed-contract.js';
import { themeVars } from './state-overlays-shared.mjs';

/**
 * Contract-pin test — the CONSUMER → contract direction.
 *
 * `contract.test.ts` pins the contract's INTERNAL shape (every role in
 * roles.json is declared in every scope; per-group counts). This suite pins the
 * complementary invariant: every `--lab-*` name labui actually CONSUMES that
 * looks like a colour role resolves to a present role in roles.json AND is
 * declared in contract.css, and EVERY consumed name classifies into exactly one
 * of the three buckets — an unclassified name fails CI naming the token + site.
 *
 * It does NOT assert colour VALUES (placeholder constants owned by the resolver;
 * `contract.test.ts` guards their shape) and does NOT duplicate the per-group
 * counts. A dropped/renamed colour role surfaces here as a "missing role" failure
 * naming the role.
 */

const css = readFileSync(resolve(repoRoot, 'packages/colors/contract.css'), 'utf8');

const lightBody = themeVars(css, 'light');
const darkBody = themeVars(css, 'dark');
const moreLightBody = themeVars(css, 'light', 'more');
const moreDarkBody = themeVars(css, 'dark', 'more');
const declares = (body: Map<string, string>, role: string) => body.has(role);

describe('consumed --lab-* contract (consumer → contract pin)', () => {
  it('browser state type preserves all Core outcomes and local lifecycle states', () => {
    expectTypeOf<LabuiColorsState['state']>().toEqualTypeOf<
      | 'waiting'
      | 'ready'
      | 'stale'
      | 'failed'
      | 'unsatisfied'
      | 'incomplete'
      | 'cancelled'
      | 'disposed'
    >();
  });
  it('enumerates a substantial consumed surface including known colour roles', () => {
    // Grounded baseline this session: 138 distinct consumed --lab-* names across
    // packages+apps (55 colour-contract, 42 dimension, 41 local-or-gap, 0
    // unclassified). The floor (>=120) bites a mass-drop in enumeration without
    // pinning an exact churn-prone count; the explicit role membership below is
    // the load-bearing assertion.
    const names = consumedRoles();
    expect(names.length).toBeGreaterThanOrEqual(120);
    expect(names).toContain('--lab-label-primary');
    expect(names).toContain('--lab-fill-brand-primary');
    expect(names).toContain('--lab-border-base');
  });

  it('classifies the bucket boundaries correctly', () => {
    expect(classify('--lab-label-primary')).toBe('colour-contract');
    expect(classify('--lab-space-sm')).toBe('dimension');
    // #109 state-overlay tint fractions: ui-tokens-owned dimensionless % scalars
    // (tokens.css), NOT colour roles and NOT engine gaps — the colour lives in the
    // component-layer color-mix() recipe-D pattern, only the fraction is a token.
    expect(classify('--lab-state-hover')).toBe('dimension');
    expect(classify('--lab-state-pressed')).toBe('dimension');
    expect(classify('--lab-surface-shadow-tint')).toBe('local-or-gap');
    expect(classify('--lab-bogus-xyz')).toBe('unclassified');
  });

  // ── (0) Provenance guard — test files and `_`-prefixed scratch files must NEVER
  // appear in the consumer surface. A raw-text scan cannot distinguish a probe token
  // inside a JS string literal from a real `var(--lab-x)` usage; including test files
  // either poisons the zero-unclassified gate or phantom-inflates the consumed surface.
  it('no *.test.ts or _-prefixed file appears in the consumer surface (provenance guard)', () => {
    const files = consumerFiles();
    const testFiles = files.filter((f) => f.endsWith('.test.ts'));
    const scratchFiles = files.filter((f) => (f.split('/').at(-1) ?? '').startsWith('_'));
    expect(
      testFiles,
      `test files must be excluded from the consumer surface — probe tokens inside string literals\nwould register as consumed names and poison the zero-unclassified gate:\n${testFiles.map((f) => `  ${f}`).join('\n')}`,
    ).toEqual([]);
    expect(
      scratchFiles,
      `scratch files (basename starts with \`_\`) must be excluded from the consumer surface:\n${scratchFiles.map((f) => `  ${f}`).join('\n')}`,
    ).toEqual([]);
  });

  // ── (1) Every consumed colour role is present in roles.json. A consumed name
  // that LOOKS like a semantic colour role (matches a SEMANTIC_ROLE_PREFIXES
  // prefix) but is ABSENT from the contract = a dropped/renamed role → fail,
  // naming the role. Uses the SAME pure detector the anti-blindness proof drives.
  it('every consumed colour role is present in roles.json', () => {
    const known = knownColourRoles();
    const missing = missingColourRoles(consumedRoles(), known);
    expect(
      missing,
      `consumed names matching a semantic colour-role prefix but ABSENT from roles.json (a dropped/renamed role — declare it through the LabUI contract owner):\n${missing.map((m) => `  ${m}`).join('\n')}`,
    ).toEqual([]);
  });

  // ── (2) Every consumed colour-contract role is also DECLARED in contract.css
  // in every theme scope. Binds the consumer set to the actual CSS, not just the
  // manifest.
  it('every consumed colour-contract role is declared in contract.css (all scopes)', () => {
    const consumed = byBucket()['colour-contract'];
    expect(consumed.length).toBeGreaterThan(0);
    for (const [scopeName, body] of [
      ['light', lightBody],
      ['dark', darkBody],
      ['media', darkBody],
      ['more-light', moreLightBody],
      ['more-dark', moreDarkBody],
    ] as const) {
      const missing = consumed.filter((r) => !declares(body, r));
      expect(
        missing,
        `consumed colour roles missing from the ${scopeName} scope of contract.css:\n${missing
          .map((m) => `  ${m}`)
          .join('\n')}`,
      ).toEqual([]);
    }
  });

  // ── (3) Zero unclassified consumed names — an undocumented token cannot enter
  // silently. Failure names each token + the file:line it was first seen.
  it('classifies every consumed name into exactly one bucket (zero unclassified)', () => {
    const unclassified = byBucket().unclassified;
    const sites = consumedRolesWithSites();
    const report = unclassified
      .map((name) => {
        const at = sites.get(name);
        return `  ${name}  (first seen ${at?.file}:${at?.line})`;
      })
      .join('\n');
    expect(
      unclassified,
      `unclassified consumed --lab-* names — for each: (a) add to the colour contract upstream, (b) confirm it is a dimension token, or (c) add it to the local-or-gap allowlist:\n${report}`,
    ).toEqual([]);
  });

  // ── (3б) Проза — не потребление: пример `var(--lab-X, …)` в doc-комментарии
  // (TS) или в CSS-блок-комментарии не должен регистрироваться как потреблённое
  // имя (класс: комментарии гардов/утилит травили zero-unclassified гейт).
  // Настоящее потребление в коде того же источника при этом видно.
  it('ignores --lab-* names in comments, keeps real consumption (prose is not consumption)', () => {
    const ts = [
      '/** Пример в прозе: `var(--lab-fake-doc-example, 1rem)`. */',
      "// и в строчном: litVar('--lab-fake-line-example')",
      "const real = `width: ${litVar('--lab-space-sm', '0.5rem')};`;",
    ].join('\n');
    const hits = consumedNamesInSource('p.ts', ts);
    expect(hits.map((s) => s.name)).toEqual(['--lab-space-sm']);
    // Срез комментариев сохраняет переносы строк: номер строки не плывёт.
    expect(hits[0]?.line).toBe(3);

    const css = '/* пример: var(--lab-fake-css-example) */\n.x { gap: var(--lab-space-sm); }';
    expect(consumedNamesInSource('p.css', css).map((s) => s.name)).toEqual(['--lab-space-sm']);
  });

  // ── (4) Anti-blindness: feed a FABRICATED consumed name into the pure
  // missing-role detector and assert the "missing role" path actually fires.
  // A green run of test (1) therefore means "pinned", never "blind". No live
  // tree is mutated — the fabricated name is passed directly into the pure fn.
  it('missing-role detection fires for a fabricated absent colour role (RED-proof)', () => {
    const known = knownColourRoles();
    const fabricated = '--lab-label-totally-fabricated-role';
    // sanity: the fabricated name DOES look like a semantic role and is NOT real.
    expect(SEMANTIC_ROLE_PREFIXES.some((p) => fabricated.startsWith(p))).toBe(true);
    expect(known.has(fabricated)).toBe(false);

    const hits = missingColourRoles([fabricated, '--lab-label-primary'], known);
    expect(hits).toEqual([fabricated]); // the fabricated one is flagged; the real one is not
  });
});
