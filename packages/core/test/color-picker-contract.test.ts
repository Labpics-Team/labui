import { describe, expect, it } from 'vitest';
import {
  ColorPickerState,
  type LabColorValue,
  colorChannels,
  colorCoords,
  colorEditable,
  colorHex,
  colorInGamut,
  colorPalette,
  colorPlaneAxes,
  colorSwatches,
  editColorChannel,
  editColorPlane,
  parseColor,
  parseColorEdit,
  serializeColor,
} from '../src/components/color-picker/contract.js';
const raw: LabColorValue = {
  space: 'hsv',
  coords: [35.123456789, 83.987654321, 91.123456789],
  alpha: 0.5019607843137255,
};
describe('ColorPicker precision and accepted values', () => {
  it('uses explicit alpha from every codec format, preserving previous alpha only when omitted', () => {
    for (const text of [
      'rgba(255, 0, 0, 0.25)',
      'hsla(0, 100%, 50%, 0.25)',
      'rgb(255 0 0 / 25%)',
      'lch(50 40 20 / .25)',
      serializeColor({ ...raw, alpha: 0.25 }),
    ])
      expect(parseColorEdit(text, 0.7)?.alpha).toBe(0.25);
    expect(parseColorEdit('transparent', 0.7)?.alpha).toBe(0);
    expect(parseColorEdit('#1234', 0.7)?.alpha).toBe(68 / 255);
    expect(parseColorEdit('#11223344', 0.7)?.alpha).toBe(68 / 255);
    for (const text of ['#123', '#112233', 'rgb(255 0 0)', 'hsl(0 100% 50%)', 'lch(50 40 20)'])
      expect(parseColorEdit(text, 0.7)?.alpha).toBe(0.7);
  });
  it('round-trips editable LCH text without quantizing untouched coordinates or alpha', () => {
    const source: LabColorValue = {
      space: 'lch',
      coords: [72.09123456789, 84.86123456789, 65.34123456789],
      alpha: raw.alpha,
    };
    expect(parseColor(colorEditable(source, 'lch'))).toEqual(source);
    expect(parseColor(colorEditable(source, 'lch').replace('72.09123456789', '50'))).toEqual({
      ...source,
      coords: [50, source.coords[1], source.coords[2]],
    });
  });
  it('retains all supplied coordinates and alpha through all view/model projections and JSON', () => {
    const state = new ColorPickerState();
    expect(state.value({ defaultValue: raw })).toEqual(raw);
    for (const model of ['hex', 'rgb', 'hsb', 'hsl', 'lch'] as const)
      for (const variant of ['grid', 'spectrum', 'sliders'] as const) {
        state.model = model;
        state.variant = variant;
        colorChannels(state.value({}) ?? raw, model, variant);
        colorHex(raw);
        expect(state.value({})).toEqual(raw);
      }
    expect(parseColor(serializeColor(raw))).toEqual(raw);
    expect(parseColor('#FFAA0080')?.alpha).toBe(128 / 255);
  });
  it('reset restores the initial value; controlled requests are not accepted', () => {
    const state = new ColorPickerState();
    state.value({ defaultValue: raw });
    const changed = { ...raw, alpha: 0.123456789 };
    state.accept({}, changed);
    expect(state.value({})).toEqual(changed);
    state.reset({});
    expect(state.value({})).toEqual(raw);
    state.accept({ value: raw }, changed);
    expect(state.value({ value: raw })).toEqual(raw);
  });
  it('uses CSS CIELCH D50, independently known CSS red vector, without mapping out-of-gamut values', () => {
    const red = colorCoords({ space: 'srgb', coords: [1, 0, 0], alpha: 1 }, 'lch');
    expect(red[0]).toBeCloseTo(54.29054, 4);
    expect(red[1]).toBeCloseTo(106.83719, 4);
    expect(red[2]).toBeCloseTo(40.85767, 4);
    const outside: LabColorValue = { space: 'lch', coords: [60, 150, 145], alpha: 0.123456789 };
    expect(colorCoords(outside, 'srgb').some((c) => c < 0 || c > 1)).toBe(true);
    expect(colorInGamut(outside, 'srgb')).toBe(false);
    expect(parseColor(serializeColor(outside))).toEqual(outside);
  });
  it('edits both plane axes, preserving the fixed coordinate and full alpha', () => {
    const source: LabColorValue = { space: 'lch', coords: [72.09, 84.86, 65.34], alpha: raw.alpha };
    expect(editColorPlane(source, 'h', 0.5, 0.5)).toEqual({
      space: 'lch',
      coords: [50, 72.5, 65.34],
      alpha: raw.alpha,
    });
    expect(editColorPlane(source, 'l', 0.5, 0.5)).toEqual({
      space: 'lch',
      coords: [72.09, 72.5, 180],
      alpha: raw.alpha,
    });
    expect(editColorPlane(source, 'c', 0.5, 0.5)).toEqual({
      space: 'lch',
      coords: [50, 84.86, 180],
      alpha: raw.alpha,
    });
    expect(colorPlaneAxes(source, 'h').xLabel).toBe('Lightness');
  });
  it('preserves non-edited coordinates exactly and exposes both authored palettes', () => {
    const alpha = colorChannels(raw, 'hsb', 'sliders').at(-1);
    if (!alpha) throw new Error('Opacity channel missing');
    expect(editColorChannel(raw, alpha, 12.3456789)).toEqual({ ...raw, alpha: 0.123456789 });
    expect(colorSwatches).toHaveLength(120);
    expect(colorPalette('lch').colors).toHaveLength(100);
    expect(colorPalette('lch').columns).toBe(10);
    expect(colorPalette('hex').columns).toBe(12);
    expect(colorSwatches[35]?.coords.some((c) => c !== Math.round(c * 255) / 255)).toBe(true);
  });
});
