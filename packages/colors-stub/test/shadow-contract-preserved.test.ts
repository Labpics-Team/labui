import { describe, expect, it } from 'vitest';
import { classify, byBucket, consumedRoles, LOCAL_OR_GAP_PREFIXES } from './consumed-contract.js';

/**
 * Consumed contract preserved — contract test.
 *
 * After the shadow package renames its contract tokens from the layer model
 * (--lab-shadow-alpha-minor/ambient/penumbra/major) to the slot model
 * (--lab-shadow-alpha-s1..s4), this suite verifies:
 *   1. Both the old names (layer model, currently in contract) AND the new
 *      names (slot model, target) classify as `local-or-gap` — neither falls
 *      into `unclassified`, which would fail the zero-unclassified gate.
 *   2. The `--lab-elevation-*` and `--lab-light-angle` names also classify
 *      correctly — the whole shadow namespace is covered.
 *   3. The live consumed surface has zero unclassified names — the guard is
 *      coherent with the current tree.
 *
 * How="mutation": the test is GREEN at birth — the existing LOCAL_OR_GAP_PREFIXES
 * already covers both token families. Bite-proof: removing the `'--lab-shadow-'`
 * entry from LOCAL_OR_GAP_PREFIXES would classify every `--lab-shadow-alpha-*`
 * name as `unclassified`, failing the test for the right reason. Proved inline.
 */

describe('shadow contract preserved — classification gate', () => {
  // ── (1) Old layer-model names classify as local-or-gap (currently in tree) ─
  it('the old layer-model shadow alpha names classify as local-or-gap', () => {
    for (const layer of ['minor', 'ambient', 'penumbra', 'major']) {
      const name = `--lab-shadow-alpha-${layer}`;
      expect(classify(name), `${name} must classify as local-or-gap (old layer model)`).toBe(
        'local-or-gap',
      );
    }
  });

  // ── (2) New slot-model names classify as local-or-gap (target after rename) ─
  it('the new slot-model shadow alpha names classify as local-or-gap', () => {
    for (const slot of ['s1', 's2', 's3', 's4']) {
      const name = `--lab-shadow-alpha-${slot}`;
      expect(
        classify(name),
        `${name} must classify as local-or-gap (new slot model — the guard must accept the rename)`,
      ).toBe('local-or-gap');
    }
  });

  // ── (3) Elevation and light-angle names classify correctly ──────────────────
  it('elevation role and light-angle token names classify as local-or-gap', () => {
    const shadowTokens = [
      '--lab-elevation-resting',
      '--lab-elevation-raised',
      '--lab-elevation-overlay',
      '--lab-elevation-modal',
      '--lab-elevation-xs',
      '--lab-elevation-xl',
      '--lab-light-angle',
      '--lab-shadow-color',
      '--lab-surface-shadow-tint',
    ];
    for (const name of shadowTokens) {
      expect(classify(name), `${name} must classify as local-or-gap`).toBe('local-or-gap');
    }
  });

  // ── (4) Zero unclassified names in the live tree ─────────────────────────────
  it('the live consumed surface has zero unclassified --lab-* names', () => {
    const unclassified = byBucket().unclassified;
    expect(
      unclassified,
      `Unclassified consumed names — add to contract, confirm as dimension, or document as gap:\n${unclassified.map((n) => `  ${n}`).join('\n')}`,
    ).toEqual([]);
  });

  // ── (5) Shadow namespace is fully covered in LOCAL_OR_GAP_PREFIXES ───────────
  it('LOCAL_OR_GAP_PREFIXES includes --lab-shadow- and --lab-elevation- prefixes', () => {
    const prefixes = LOCAL_OR_GAP_PREFIXES as readonly string[];
    expect(prefixes.some((p) => p === '--lab-shadow-' || p.startsWith('--lab-shadow'))).toBe(true);
    expect(prefixes.some((p) => p === '--lab-elevation-' || p.startsWith('--lab-elevation'))).toBe(
      true,
    );
  });

  // ── (6) Mutation-proof: removing --lab-shadow- from the prefix list would ────
  // make slot-model names unclassified. We don't mutate the module; we simulate
  // the check with a stripped prefix list.
  it('RED-proof: --lab-shadow-alpha-s1 would be unclassified without the shadow prefix', () => {
    // Simulate what happens if --lab-shadow- is removed from the allowlist.
    const prefixes = (LOCAL_OR_GAP_PREFIXES as readonly string[]).filter(
      (p) => !p.startsWith('--lab-shadow'),
    );

    const name = '--lab-shadow-alpha-s1';
    // With the prefix removed, the token must NOT match local-or-gap.
    const matchesLocalOrGap = prefixes.some((p) =>
      p.endsWith('-') ? name.startsWith(p) : name === p,
    );

    // The stripped allowlist must NOT cover the name (proving the prefix matters).
    expect(matchesLocalOrGap).toBe(false);
  });

  // ── (7) The live consumed set includes shadow contract names (sanity) ────────
  it('the live consumed surface includes at least some --lab-shadow-* or --lab-elevation-* names', () => {
    const names = consumedRoles();
    const shadowOrElevation = names.filter(
      (n) => n.startsWith('--lab-shadow-') || n.startsWith('--lab-elevation-'),
    );
    expect(shadowOrElevation.length).toBeGreaterThan(0);
  });
});
