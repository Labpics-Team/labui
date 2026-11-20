import { describe, expect, it } from 'vitest';
import {
  blendChannel,
  compileMaterialPaint,
  materialPaintOver,
  materialPaintTables,
  neutralMaterialFilter,
  screenNoiseApproximation,
} from '../src/material-paints';
import { MATERIAL_TIERS, materialBlendMode, materialProfile } from '../src/profile';
import { readContractMaterials } from './contract-values';

describe('encoded sRGB author paints', () => {
  it('executes neutral affine paints as native filters without clipping or neutralising colour inputs', () => {
    const { fills } = readContractMaterials();
    const accepted: string[] = [];
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    for (const theme of ['light', 'dark'] as const)
      for (const tier of MATERIAL_TIERS) {
        const fill = fills.get(`${theme}/${tier}`);
        if (!fill?.blend) throw new Error('Missing author paints');
        const paints = {
          normal: fill.tint,
          blend: fill.blend,
          blendMode: materialBlendMode(theme),
        };
        const filter = neutralMaterialFilter(paints);
        if (!filter) continue;
        accepted.push(`${theme}/${tier}`);
        // RGB channels vary independently, including values between 8-bit knots.
        for (let i = 0; i <= 1024; i++) {
          const input = {
            r: (i / 1024) * 255,
            g: ((1024 - i) / 1024) * 255,
            b: (((i * 379) % 1025) / 1024) * 255,
            a: 1,
          };
          const expected = materialPaintOver(paints, input);
          for (const key of ['r', 'g', 'b'] as const) {
            const contrasted = clamp((input[key] / 255 - 0.5) * filter.contrast + 0.5);
            expect(clamp(contrasted * filter.brightness) * 255).toBeCloseTo(expected[key], 8);
          }
        }
      }
    expect(accepted).toContain('light/base');
    expect(accepted).toContain('light/muted');
    expect(accepted).toContain('dark/base');
    expect(accepted).toContain('dark/muted');
    expect(accepted).not.toContain('dark/elevated');
    expect(accepted).not.toContain('light/elevated');
    expect(
      neutralMaterialFilter({
        normal: { r: 20, g: 40, b: 60, a: 0.3 },
        blend: { r: 0, g: 0, b: 0, a: 0 },
        blendMode: 'overlay',
      }),
    ).toBeNull();
  });
  it('bounds the moved spatial Screen grain while changing blur and group alpha', () => {
    const { fills } = readContractMaterials();
    const maxAlpha = Math.round(materialProfile.noise.opacity * 255) / 255;
    const bound = Math.max(...materialProfile.noise.color) * maxAlpha;
    expect(bound).toBeLessThan(0.197);
    for (const theme of ['light', 'dark'] as const)
      for (const tier of MATERIAL_TIERS) {
        const fill = fills.get(`${theme}/${tier}`);
        if (!fill?.blend) throw new Error('Missing author paints');
        const paints = {
          normal: fill.tint,
          blend: fill.blend,
          blendMode: materialBlendMode(theme),
        };
        if (!neutralMaterialFilter(paints)) continue;
        for (const blurred of [0, 0.11, 0.49, 0.73, 1])
          for (const raw of [0, 0.19, 0.81, 1])
            for (const alpha of [0, 0.2, 0.52, 0.76, 1]) {
              for (const noise of materialProfile.noise.color) {
                const grain = (noise / 255) * maxAlpha;
                const screened = blurred + (1 - blurred) * grain;
                const before =
                  materialPaintOver(paints, {
                    r: screened * 255,
                    g: screened * 255,
                    b: screened * 255,
                    a: 1,
                  }).r / 255;
                const painted =
                  materialPaintOver(paints, {
                    r: blurred * 255,
                    g: blurred * 255,
                    b: blurred * 255,
                    a: 1,
                  }).r / 255;
                const expected = alpha * before + (1 - alpha) * raw;
                const base = alpha * painted + (1 - alpha) * raw;
                const actual = base + (1 - base) * grain * alpha;
                expect(Math.abs(actual - expected) * 255).toBeLessThanOrEqual(bound + 1e-10);
              }
            }
      }
  });
  it('does not classify the pure-white color-dodge discontinuity as affine', () => {
    const compiled = compileMaterialPaint({
      normal: { r: 0, g: 0, b: 0, a: 0 },
      blend: { r: 255, g: 255, b: 255, a: 1 },
      blendMode: 'color-dodge',
    });
    expect(compiled.affine).toBe(false);
    expect(compiled.fallbackError).toBeCloseTo(255, 8);
  });
  it('uses the source blend order and the W3C color-dodge boundary rules', () => {
    expect(blendChannel(0, 1, 'color-dodge')).toBe(0);
    expect(blendChannel(0.2, 1, 'color-dodge')).toBe(1);
    expect(blendChannel(0.2, 0.5, 'color-dodge')).toBe(0.4);
    expect(blendChannel(0.8, 0.5, 'color-dodge')).toBe(1);
    const out = materialPaintOver(
      {
        normal: { r: 102, g: 51, b: 204, a: 0.5 },
        blend: { r: 127.5, g: 0, b: 0, a: 1 },
        blendMode: 'color-dodge',
      },
      { r: 0, g: 0, b: 0, a: 1 },
    );
    expect(out).toEqual({ r: 102, g: 25.5, b: 102, a: 1 });
  });

  it('switches overlay branches at the backdrop midpoint, independently per channel', () => {
    expect(blendChannel(0.25, 0.8, 'overlay')).toBeCloseTo(0.4);
    expect(blendChannel(0.75, 0.8, 'overlay')).toBeCloseTo(0.9);
    expect(blendChannel(0.5, 0.8, 'overlay')).toBeCloseTo(0.8);
    const paints = {
      normal: { r: 0, g: 128, b: 255, a: 0.3 },
      blend: { r: 32, g: 150, b: 220, a: 0.7 },
      blendMode: 'overlay' as const,
    };
    const tables = materialPaintTables(paints);
    expect(new Set(tables).size).toBe(3);
  });

  it('represents current author transfers within 0.15 byte between knots', () => {
    const { fills } = readContractMaterials();
    for (const theme of ['light', 'dark'] as const) {
      for (const tier of MATERIAL_TIERS) {
        const fill = fills.get(`${theme}/${tier}`);
        if (!fill?.blend) throw new Error(`Missing author paints ${theme}/${tier}`);
        const paints = {
          normal: fill.tint,
          blend: fill.blend,
          blendMode: materialBlendMode(theme),
        };
        const tables = materialPaintTables(paints).map((table) => table.split(' ').map(Number));
        expect(tables.map((row) => row.length)).toEqual([256, 256, 256]);
        let maximumError = 0;
        for (let i = 0; i < 4096; i++) {
          const value = (i / 4096) * 255;
          const exact = materialPaintOver(paints, { r: value, g: value, b: value, a: 1 });
          const offset = (i / 4096) * ((tables[0]?.length ?? 1) - 1);
          const index = Math.floor(offset);
          for (const [channel, key] of ['r', 'g', 'b'].entries()) {
            const row = tables[channel] ?? [];
            const lo = row[index] ?? 0;
            const interpolated = lo + ((row[index + 1] ?? lo) - lo) * (offset - index);
            maximumError = Math.max(
              maximumError,
              Math.abs(interpolated * 255 - exact[key as 'r' | 'g' | 'b']),
            );
          }
        }
        expect(maximumError, `${theme}/${tier}`).toBeLessThan(0.15);
      }
    }
  });

  it('bounds uniform author grain against every opacity and backdrop through both paints', () => {
    const { fills } = readContractMaterials();
    const noise = {
      r: materialProfile.noise.color[0] ?? 0,
      g: materialProfile.noise.color[1] ?? 0,
      b: materialProfile.noise.color[2] ?? 0,
      a: Math.round(materialProfile.noise.opacity * 255) / 255,
    };
    for (const theme of ['light', 'dark'] as const)
      for (const tier of MATERIAL_TIERS) {
        const fill = fills.get(`${theme}/${tier}`);
        if (!fill?.blend) throw new Error('Missing author paints');
        const paints = {
          normal: fill.tint,
          blend: fill.blend,
          blendMode: materialBlendMode(theme),
        };
        const { screen, maxError } = screenNoiseApproximation(paints, noise);
        expect(maxError).toBeLessThan(1);
        const over = (value: number, alpha: number) =>
          materialPaintOver(paints, {
            r: value + ((255 - value) * noise.r * alpha) / 255,
            g: value + ((255 - value) * noise.g * alpha) / 255,
            b: value + ((255 - value) * noise.b * alpha) / 255,
            a: 1,
          });
        for (let value = 0; value <= 255; value += 0.25) {
          const midpoint = over(value, screen.a);
          for (const alpha of [0, noise.a]) {
            const endpoint = over(value, alpha);
            for (const key of ['r', 'g', 'b'] as const)
              expect(Math.abs(midpoint[key] - endpoint[key])).toBeLessThanOrEqual(maxError + 1e-9);
          }
        }
      }
  });

  it('factors all ten authored paints into a normal first frame and a bounded residual', () => {
    const { fills } = readContractMaterials();
    const nonlinear: string[] = [];
    for (const theme of ['light', 'dark'] as const)
      for (const tier of MATERIAL_TIERS) {
        const original = fills.get(`${theme}/${tier}`);
        if (!original?.blend) throw new Error('Missing source paints');
        const paints = {
          normal: original.tint,
          blend: original.blend,
          blendMode: materialBlendMode(theme),
        };
        const compiled = compileMaterialPaint(paints);
        if (!compiled.affine) nonlinear.push(`${theme}/${tier}`);
        const tables = compiled.tables.map((table) => table.split(' ').map(Number));
        let maximum = 0;
        const intervals = (tables[0]?.length ?? 1) - 1;
        for (let i = 0; i <= intervals; i++) {
          const input = (i / intervals) * 255;
          const exact = materialPaintOver(paints, { r: input, g: input, b: input, a: 1 });
          for (const [channel, key] of (['r', 'g', 'b'] as const).entries()) {
            const actual =
              (tables[channel]?.[i] ?? 0) * 255 * (1 - compiled.fill.a) +
              compiled.fill[key] * compiled.fill.a;
            expect(actual).toBeCloseTo(exact[key], 5);
            const fallback = input * (1 - compiled.fill.a) + compiled.fill[key] * compiled.fill.a;
            maximum = Math.max(maximum, Math.abs(fallback - exact[key]));
          }
        }
        expect(maximum).toBeLessThanOrEqual(compiled.fallbackError + 1e-8);
        expect(compiled.fallbackError).toBeLessThan(20);
      }
    expect(nonlinear).toEqual(['light/elevated', 'dark/subtle', 'dark/elevated']);
  });
});
