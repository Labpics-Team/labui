import { describe, expect, it } from 'vitest';
import { type Rgba, compositeOverByte, parseRgb } from '../src/luminance';
import { MATERIAL_TIERS, type ThemeName, fillKey } from '../src/material-guarantee';
import { readContractMaterials } from './contract-values';

/*
 * Task #52 — BYTE-EXACT composite. The gap between the reference composite and the
 * prod byte path must be ZERO, compared byte-for-byte, with no "invisible-rounding"
 * tolerance anywhere.
 *
 * Three guards:
 *   A. DIFFERENTIAL vs the SSOT reference (lab-colors). `compositeOverByte` must
 *      reproduce lab-colors' own `composite_over_encoded` + `hex_from_srgb_encoded`
 *      byte-for-byte on the 12 live Figma-neutral pairs — the same corpus
 *      `crates/labcolors-core/src/alpha.rs::figma_neutral_ladder_pairs_roundtrip`
 *      proves in Rust. Two independent implementations, one byte. (Class C.)
 *   B. TIE-FREENESS invariant. `compositeOverByte` rounds half-to-even (the byte
 *      the browser & engine commit); lab-colors rounds half-away-from-zero. They
 *      agree byte-for-byte ONLY where no channel composite lands on an exact `.5`.
 *      This guard proves the whole material contract domain is tie-free, so the two
 *      rules are equivalent HERE — and turns any future contract value that lands
 *      on a tie into a loud finding instead of a silent 1-LSB drift. (Class C.)
 *   C. FROZEN byte-golden of the contract material composites — see
 *      `byte-composite-corridor-golden.test.ts`.
 *
 * RED-proof (do NOT commit): swap `compositeOverByte` to truncation (`| 0`),
 * round-half-up (`+0.5 | 0`), or a linear-light composite, and A fails on the
 * pairs; widen the tie window and B fails. Restore → GREEN.
 */

// The 12 live Figma-neutral pairs, lifted verbatim from
// crates/labcolors-core/src/alpha.rs (§2 alphas/tint, §4 composites). Tint is one
// colour for all 12: #787880. Format: [expected solid hex, alpha, backdrop hex].
const TINT_HEX = '#787880';
const BG_LIGHT = '#FFFFFF';
const BG_DARK = '#101012';
const FIGMA_PAIRS: ReadonlyArray<readonly [string, number, string]> = [
  ['#E4E4E6', 0.2, BG_LIGHT], // Fills/Neutral/Primary light
  ['#35353A', 0.36, BG_DARK], // Fills/Neutral/Primary dark
  ['#E9E9EB', 0.16, BG_LIGHT], // Fills/Neutral/Secondary light
  ['#313135', 0.32, BG_DARK], // Fills/Neutral/Secondary dark
  ['#EFEFF0', 0.12, BG_LIGHT], // Fills/Neutral/Tertiary light
  ['#29292C', 0.24, BG_DARK], // Fills/Neutral/Tertiary dark
  ['#F4F4F5', 0.08, BG_LIGHT], // Fills/Neutral/Quaternary light
  ['#212124', 0.16, BG_DARK], // Fills/Neutral/Quaternary dark
  ['#E9E9EB', 0.16, BG_LIGHT], // Border/Neutral/Base light
  ['#252528', 0.2, BG_DARK], // Border/Neutral/Base dark
  ['#F4F4F5', 0.08, BG_LIGHT], // Border/Neutral/Soft light
  ['#1C1C1F', 0.12, BG_DARK], // Border/Neutral/Soft dark
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function hexFromBytes(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Distance of a value to the nearest half-integer boundary (0 = exactly on a tie). */
function tieMargin(x: number): number {
  return Math.abs((((x % 1) + 1) % 1) - 0.5);
}

describe('#52.A byte-exact composite reproduces lab-colors SSOT (12 Figma pairs)', () => {
  const tint = hexToRgb(TINT_HEX);
  for (const [solid, alpha, bgHex] of FIGMA_PAIRS) {
    it(`${TINT_HEX}@${alpha} over ${bgHex} = ${solid} (byte-for-byte)`, () => {
      const bg = hexToRgb(bgHex);
      const out = compositeOverByte({ ...tint, a: alpha }, { ...bg, a: 1 });
      // Zero tolerance: the exact bytes lab-colors' Rust reference produces.
      expect(hexFromBytes(out.r, out.g, out.b)).toBe(solid);
    });
  }
});

describe('#52.B tie-freeness — half-even ≡ half-away over the material domain', () => {
  const TIE_EPS = 1e-6;

  it('no channel composite of the 12 Figma pairs lands on an exact .5 tie', () => {
    const tint = hexToRgb(TINT_HEX);
    for (const [, alpha, bgHex] of FIGMA_PAIRS) {
      const bg = hexToRgb(bgHex);
      for (const [tc, bc] of [
        [tint.r, bg.r],
        [tint.g, bg.g],
        [tint.b, bg.b],
      ] as const) {
        const composite = tc * alpha + bc * (1 - alpha);
        expect(tieMargin(composite)).toBeGreaterThan(TIE_EPS);
      }
    }
  });

  it('no material tint over the corridor extremes lands on a tie (live contract)', () => {
    const { fills } = readContractMaterials();
    const corners: Rgba[] = [
      { r: 0, g: 0, b: 0, a: 1 },
      { r: 255, g: 255, b: 255, a: 1 },
    ];
    for (const theme of ['light', 'dark'] as ThemeName[]) {
      for (const tier of MATERIAL_TIERS) {
        const fill = fills.get(fillKey(theme, tier));
        expect(fill, `missing fill for ${fillKey(theme, tier)}`).toBeDefined();
        if (fill === undefined) continue;
        const t = fill.tint;
        for (const corner of corners) {
          for (const [tc, bc] of [
            [t.r, corner.r],
            [t.g, corner.g],
            [t.b, corner.b],
          ] as const) {
            const composite = tc * t.a + bc * (1 - t.a);
            expect(
              tieMargin(composite),
              `${theme}/${tier} tint channel over ${corner.r === 0 ? 'black' : 'white'} sits on a .5 tie — round-half-even and lab-colors' round-half-away diverge here`,
            ).toBeGreaterThan(TIE_EPS);
          }
        }
      }
    }
  });

  it('parseRgb round-trips the tint used by the pairs (sanity of the fixture)', () => {
    expect(parseRgb('rgb(120 120 128 / 0.2)')).toEqual({ r: 120, g: 120, b: 128, a: 0.2 });
  });
});
