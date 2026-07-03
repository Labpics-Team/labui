import { describe, expect, it } from 'vitest';
import { ELEVATION_LEVELS, ELEVATION_SHAPES, alphaVar } from '../src/domain/elevation.js';
import { SHADOW_SLOTS, SLOT_ALPHA, SLOT_ALPHAS } from '../src/domain/layer.js';

/**
 * Shadow unit suite — s1..s4 slot model.
 *
 * Verifies the coherent slot model: ELEVATION_LEVELS is the five-size owner
 * ladder (xs/s/m/l/xl), ELEVATION_SHAPES carries exactly four slot geometries
 * per level keyed by SHADOW_SLOTS, and alphaVar produces the contract names
 * --lab-shadow-alpha-s1..s4.
 *
 * How="red": the current production code has the OLD four-role model
 * (resting/raised/overlay/modal) not the five-size ladder. These tests FAIL
 * NOW for the right reason — the asserted exports have the wrong values, not a
 * compile error. The tests turn GREEN only when the domain is updated to the
 * owner's five-size model.
 *
 * RED-proof is implicit in the new-behavior contract: run `pnpm test` in
 * packages/shadow and observe the failures below are the EXACT assertions that
 * name the missing shape, not a generic import error.
 */

describe('slot model — five-size elevation ladder', () => {
  it('ELEVATION_LEVELS is the five owner-named sizes in order', () => {
    // NEW behavior: the ladder is xs < s < m < l < xl (not resting/raised/overlay/modal).
    expect(ELEVATION_LEVELS).toEqual(['xs', 's', 'm', 'l', 'xl']);
  });

  it('ELEVATION_SHAPES has exactly five entries matching ELEVATION_LEVELS', () => {
    expect(ELEVATION_SHAPES).toHaveLength(5);
    expect(ELEVATION_SHAPES.map((e) => e.name)).toEqual([...ELEVATION_LEVELS]);
  });

  it('every elevation level has EXACTLY four slot entries keyed s1..s4', () => {
    for (const level of ELEVATION_SHAPES) {
      // Each level must expose a `slots` record keyed by the four slot names.
      expect(
        Object.keys(level.slots as Record<string, unknown>).sort(),
        `level ${level.name} must have exactly four slots`,
      ).toEqual(['s1', 's2', 's3', 's4']);
    }
  });

  it('every slot geometry has a positive blur and a non-negative offsetY', () => {
    for (const level of ELEVATION_SHAPES) {
      for (const slot of SHADOW_SLOTS) {
        const geo = (level.slots as Record<string, { blur: number; offsetY: number }>)[slot];
        expect(geo, `level ${level.name} slot ${slot} must have a geometry object`).toBeDefined();
        expect(
          geo?.blur,
          `level ${level.name} slot ${slot}: blur must be positive`,
        ).toBeGreaterThan(0);
        expect(
          geo?.offsetY,
          `level ${level.name} slot ${slot}: offsetY must be non-negative`,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('XL casts a strictly larger shadow than XS (blur grows monotonically across the ladder)', () => {
    // The maximum per-slot blur across all slots must be larger for xl than xs.
    const maxBlur = (name: string): number => {
      const level = ELEVATION_SHAPES.find((e) => e.name === name);
      if (!level) return 0;
      const slots = level.slots as Record<string, { blur: number; offsetY: number }>;
      return Math.max(...Object.values(slots).map((g) => g.blur));
    };

    expect(maxBlur('xl')).toBeGreaterThan(maxBlur('xs'));
    // Also assert every adjacent pair increases (strict size ladder).
    for (let i = 1; i < ELEVATION_SHAPES.length; i++) {
      const prev = ELEVATION_SHAPES[i - 1]?.name;
      const curr = ELEVATION_SHAPES[i]?.name;
      if (!prev || !curr) throw new Error('elevation shape missing');
      expect(maxBlur(curr), `max blur at ${curr} must exceed max blur at ${prev}`).toBeGreaterThan(
        maxBlur(prev),
      );
    }
  });

  it('alphaVar produces --lab-shadow-alpha-s1..s4 (contract seam names)', () => {
    expect(alphaVar('s1')).toBe('--lab-shadow-alpha-s1');
    expect(alphaVar('s2')).toBe('--lab-shadow-alpha-s2');
    expect(alphaVar('s3')).toBe('--lab-shadow-alpha-s3');
    expect(alphaVar('s4')).toBe('--lab-shadow-alpha-s4');
  });

  it('slot alphas are fixed per-slot and strictly descending (owner law — depth by geometry, not opacity)', () => {
    // The owner's law: alphas are FIXED per-slot, the same regardless of which
    // elevation level they are applied to. Depth is communicated by geometry alone.
    //
    // We assert ORDER-ONLY here because the absolute magnitudes are PROVISIONAL
    // (Figma stub; final values come from lab-colors JND calibration, swapped in
    // at the same --lab-shadow-alpha-s* names). Pinning absolute values would
    // make the JND swap-in break this test for the wrong reason.
    // See ramp-order.test.ts for the canonical order-only property test.
    for (let i = 1; i < SHADOW_SLOTS.length; i++) {
      const prev = SHADOW_SLOTS[i - 1] as keyof typeof SLOT_ALPHA;
      const curr = SHADOW_SLOTS[i] as keyof typeof SLOT_ALPHA;
      expect(
        SLOT_ALPHA[curr],
        `SLOT_ALPHA.${curr} must be strictly less than SLOT_ALPHA.${prev} — depth by geometry alone`,
      ).toBeLessThan(SLOT_ALPHA[prev]);
    }
    // All values are in the unit-alpha range (0, 1).
    for (const slot of SHADOW_SLOTS) {
      expect(SLOT_ALPHA[slot]).toBeGreaterThan(0);
      expect(SLOT_ALPHA[slot]).toBeLessThan(1);
    }
  });

  it('SLOT_ALPHAS array mirrors SLOT_ALPHA record in slot order', () => {
    // Order-only: array === record traversed in SHADOW_SLOTS order.
    // No magnitude pins — see above.
    const fromRecord = SHADOW_SLOTS.map((s) => SLOT_ALPHA[s]);
    expect(SLOT_ALPHAS).toEqual(fromRecord);
  });
});
