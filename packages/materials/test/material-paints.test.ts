import { describe, expect, it } from 'vitest';
import { blendChannel, materialPaintOver, materialPaintTables } from '../src/material-paints';
import { MATERIAL_TIERS, materialBlendMode } from '../src/profile';
import { readContractMaterials } from './contract-values';

describe('encoded sRGB author paints', () => {
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
        let maximumError = 0;
        for (let i = 0; i < 4096; i++) {
          const value = (i / 4096) * 255;
          const exact = materialPaintOver(paints, { r: value, g: value, b: value, a: 1 });
          const offset = (i / 4096) * 256;
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
});
