import { describe, expect, it } from 'vitest';
import { type Rgba, compositeOverByte } from '../src/luminance';
import { MATERIAL_TIERS, type ThemeName, fillKey } from '../src/material-guarantee';
import { readContractMaterials } from './contract-values';

/*
 * Task #52 (Part C) — FROZEN byte-golden of the material composites the display
 * commits: every tier's tint quantised over the two corridor corners (black =
 * effLow, white = effHigh) and over its own opaque base (the solid canon). These
 * are the exact 8-bit pixels `compositeOverByte` (round-half-even, the browser/
 * engine byte) produces from the LIVE contract — no tolerance, byte-for-byte.
 *
 * ⚠️ REGENERATING these constants is a DELIBERATE act. A red here means the
 * contract's material tints/alphas changed → the pixels on screen changed. Do NOT
 * reflexively re-bless to green. Re-bless ONLY when the colours train intentionally
 * re-emits `--lab-bg-material-*` (e.g. provisional Figma-anchor alphas → engine-
 * derived), and when you do: bump GOLDEN_VERSION, add a CHANGELOG line with the
 * reason, and re-capture. Never a silent overwrite.
 *
 * PROVENANCE: captured 2026-07-06 from `packages/colors/contract.css`, whose
 * material emissions are still `мост: Figma-якорь` provisional alphas (see the
 * package README "Unguaranteed pairs"). Byte-identical to lab-colors' SSOT
 * quantiser on this domain — proven tie-free by `byte-composite-golden.test.ts`.
 *
 * CHANGELOG
 *   v1 (2026-07-06) — initial capture. Provisional Figma-anchor material alphas.
 */
const GOLDEN_VERSION = 1;

interface CompositeGolden {
  /** tint over pure black — the effLow corridor corner. */
  readonly overBlack: string;
  /** tint over pure white — the effHigh corridor corner. */
  readonly overWhite: string;
  /** tint over its own opaque `02` base — the solid canon. */
  readonly solid: string;
}

// theme/tier → frozen #RRGGBB of each committed composite byte.
const GOLDEN: Record<string, CompositeGolden> = {
  'light/base': { overBlack: '#949494', overWhite: '#9C9C9C', solid: '#979797' },
  'light/muted': { overBlack: '#939393', overWhite: '#C1C1C1', solid: '#9D9D9D' },
  'light/soft': { overBlack: '#747474', overWhite: '#C1C1C1', solid: '#838383' },
  'light/subtle': { overBlack: '#545454', overWhite: '#E3E3E3', solid: '#5B5B5B' },
  'light/elevated': { overBlack: '#CCCCCC', overWhite: '#FFFFFF', solid: '#D4D4D4' },
  'dark/base': { overBlack: '#212121', overWhite: '#3B3B3B', solid: '#2E2E2E' },
  'dark/muted': { overBlack: '#1E1E1E', overWhite: '#4C4C4C', solid: '#383838' },
  'dark/soft': { overBlack: '#1A1A1A', overWhite: '#676767', solid: '#494949' },
  'dark/subtle': { overBlack: '#141414', overWhite: '#878787', solid: '#5B5B5B' },
  'dark/elevated': { overBlack: '#686868', overWhite: '#9B9B9B', solid: '#6E6E6E' },
};

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

function hexFromBytes(o: { r: number; g: number; b: number }): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${h(o.r)}${h(o.g)}${h(o.b)}`;
}

describe(`#52.C material composite byte-golden (v${GOLDEN_VERSION})`, () => {
  const { fills } = readContractMaterials();

  it('covers every (theme, tier) pair — no silent gaps', () => {
    const expected = (['light', 'dark'] as ThemeName[])
      .flatMap((theme) => MATERIAL_TIERS.map((tier) => `${theme}/${tier}`))
      .sort();
    expect(Object.keys(GOLDEN).sort()).toEqual(expected);
  });

  for (const theme of ['light', 'dark'] as ThemeName[]) {
    for (const tier of MATERIAL_TIERS) {
      const key = fillKey(theme, tier);
      it(`${key} composites are byte-identical to the frozen golden`, () => {
        const fill = fills.get(key);
        expect(fill, `no contract fill for ${key}`).toBeDefined();
        if (fill === undefined) return;
        const g = GOLDEN[key];
        expect(g, `no golden entry for ${key}`).toBeDefined();
        expect(hexFromBytes(compositeOverByte(fill.tint, BLACK))).toBe(
          (g as CompositeGolden).overBlack,
        );
        expect(hexFromBytes(compositeOverByte(fill.tint, WHITE))).toBe(
          (g as CompositeGolden).overWhite,
        );
        expect(hexFromBytes(compositeOverByte(fill.tint, fill.base))).toBe(
          (g as CompositeGolden).solid,
        );
      });
    }
  }
});
