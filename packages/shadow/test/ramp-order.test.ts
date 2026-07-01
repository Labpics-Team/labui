import { describe, expect, it } from 'vitest';
import { SLOT_ALPHA, SLOT_ALPHAS, SHADOW_SLOTS } from '../src/domain/layer.js';

/**
 * Order-only ramp invariant — property test.
 *
 * The alpha values on the four shadow slots are PROVISIONAL (Figma stub; JND
 * calibration pending). This test asserts ONLY the relative order the owner
 * depends on: s1 > s2 > s3 > s4 (nearest/sharpest ply is heaviest; the diffuse
 * outer ply is lightest). It never pins an absolute magnitude.
 *
 * How="mutation": the test is GREEN at birth because SLOT_ALPHA already satisfies
 * the invariant. Bite-proof: a mutation that swaps any adjacent pair (e.g. s1 and
 * s2) makes the strict-descending check fail for the RIGHT reason ("s2 must be
 * less than s1" is the assertion; swapping the values violates it). The mutation
 * is applied to a local copy and tested inline — no file is modified.
 *
 * This closes the CLASS "ramp order silently inverts" (not a single value patch):
 * any permutation of the four values that is not strictly descending fails here.
 */

describe('shadow ramp — order-only invariant (property over full ramp)', () => {
  it('slot alphas are strictly descending: s1 > s2 > s3 > s4', () => {
    // Assert the ordering relation over the whole ramp without naming magnitudes.
    for (let i = 1; i < SHADOW_SLOTS.length; i++) {
      const prev = SHADOW_SLOTS[i - 1];
      const curr = SHADOW_SLOTS[i];
      if (!prev || !curr) throw new Error(`slot missing at index ${i}`);
      expect(
        SLOT_ALPHA[curr],
        `SLOT_ALPHA.${curr} must be strictly less than SLOT_ALPHA.${prev}`,
      ).toBeLessThan(SLOT_ALPHA[prev]);
    }
  });

  it('SLOT_ALPHAS array mirrors SLOT_ALPHA record in slot order', () => {
    const fromRecord = SHADOW_SLOTS.map((s) => SLOT_ALPHA[s]);
    expect(SLOT_ALPHAS).toEqual(fromRecord);
  });

  it('all slot alphas are positive and strictly below 1 (unit-alpha scale)', () => {
    for (const slot of SHADOW_SLOTS) {
      expect(SLOT_ALPHA[slot]).toBeGreaterThan(0);
      expect(SLOT_ALPHA[slot]).toBeLessThan(1);
    }
  });

  /**
   * Mutation-proof: feed the SAME ordering check over a locally-swapped copy and
   * confirm it FAILS. This is the in-test diode — a green run of the live test
   * means "invariant held", not "check is blind".
   *
   * Swap s1 ↔ s2: now SLOT_ALPHA[s1] < SLOT_ALPHA[s2], which inverts the
   * s1>s2 relation. The ordering loop above MUST detect this.
   */
  it('RED-proof: a swapped s1/s2 pair fails the ordering check (mutation)', () => {
    // Build a mutated copy — swap s1 and s2 alpha values.
    const mutated = { ...SLOT_ALPHA, s1: SLOT_ALPHA.s2, s2: SLOT_ALPHA.s1 };

    // Run the same ordering check over the mutated copy.
    let violations = 0;
    const slots = [...SHADOW_SLOTS] as const;
    for (let i = 1; i < slots.length; i++) {
      const prev = slots[i - 1];
      const curr = slots[i];
      if (!prev || !curr) continue;
      if (mutated[curr] >= mutated[prev]) violations++;
    }

    // The mutation MUST have produced at least one ordering violation.
    expect(
      violations,
      'swapping s1 and s2 must produce at least one ordering violation',
    ).toBeGreaterThan(0);
  });
});
