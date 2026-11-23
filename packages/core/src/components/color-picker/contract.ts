import Color from 'colorjs.io';

import { colorPickerProfile as profile } from '@labpics/ui-tokens';

/** CSS coordinates: sRGB 0..1; HSL/HSV H degrees, S/L/V percent; CIELCH D50 L 0..100. */

export interface LabColorValue {
  readonly space: 'srgb' | 'hsl' | 'hsv' | 'lch';

  readonly coords: readonly [number, number, number];

  readonly alpha: number;
}

export type LabColorModel = 'hex' | 'hsb' | 'hsl' | 'rgb' | 'lch';

export type LabColorPickerVariant = 'grid' | 'spectrum' | 'sliders';

export const colorPickerModels: readonly LabColorModel[] = ['hex', 'hsb', 'hsl', 'rgb', 'lch'];

export const colorPickerVariants = [
  { value: 'grid', label: 'Grid' },
  { value: 'spectrum', label: 'Spectrum' },
  { value: 'sliders', label: 'Sliders' },
] as const;

export const defaultColor: LabColorValue = { space: 'srgb', coords: [1, 2 / 3, 0], alpha: 1 };

export function validateColor(value: LabColorValue): LabColorValue {
  if (
    !['srgb', 'hsl', 'hsv', 'lch'].includes(value.space) ||
    value.coords.length !== 3 ||
    !value.coords.every(Number.isFinite) ||
    !Number.isFinite(value.alpha) ||
    value.alpha < 0 ||
    value.alpha > 1
  )
    throw new RangeError('ColorPicker requires three finite coordinates and alpha between 0 and 1');

  return value;
}

export function copyColor(value: LabColorValue): LabColorValue {
  validateColor(value);

  return { space: value.space, coords: [...value.coords], alpha: value.alpha };
}

export function sameColor(a: LabColorValue | null, b: LabColorValue | null): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.space === b.space &&
      a.alpha === b.alpha &&
      a.coords.every((v, i) => v === b.coords[i]))
  );
}

/** Conversion is a projection. It never replaces the accepted structured value. */

export function colorCoords(
  value: LabColorValue,
  space: LabColorValue['space'] | 'p3' | 'rec2020',
): [number, number, number] {
  if (value.space === space) return [...value.coords];

  const converted = Color.Space.get(value.space).to(space, [...value.coords]);

  return converted.map((v) => (v == null || Number.isNaN(v) ? 0 : v)) as [number, number, number];
}

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** RGB8 is used only for hexadecimal display/export and platform eyedroppers. */

export function colorHex(value: LabColorValue, alpha = true): string {
  const channels = colorCoords(value, 'srgb').map((v) => Math.round(clamp(v) * 255));

  if (alpha && value.alpha !== 1) channels.push(Math.round(value.alpha * 255));

  return `#${channels
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function colorCss(value: LabColorValue): string {
  if (value.space === 'lch') return `lch(${value.coords.join(' ')} / ${value.alpha})`;

  const coords = colorCoords(value, 'srgb');

  return `color(srgb ${coords.join(' ')} / ${value.alpha})`;
}

/** Lossless form/attribute format; no display rounding or gamut mapping. */

export function serializeColor(value: LabColorValue | null): string {
  return value ? JSON.stringify(copyColor(value)) : '';
}

export function parseColor(raw: string | null): LabColorValue | null {
  return parseColorInput(raw);
}

export function parseColorEdit(raw: string | null, previousAlpha: number): LabColorValue | null {
  return parseColorInput(raw, previousAlpha);
}

function parseColorInput(raw: string | null, previousAlpha?: number): LabColorValue | null {
  if (!raw?.trim()) return null;

  try {
    if (raw.trim().startsWith('{')) return copyColor(JSON.parse(raw));

    const meta: NonNullable<NonNullable<Parameters<typeof Color.parse>[1]>['parseMeta']> = {};

    const parsed = Color.parse(raw, { parseMeta: meta });

    // Use the codec's format contract before its default alpha normalization.

    // Functional formats report an alpha argument; custom formats return their own alpha.

    const hasAlpha =
      'alphaType' in meta ||
      (meta.format?.type === 'custom' && meta.format.parse(raw.trim())?.alpha !== undefined);

    const c = new Color(parsed);

    const space = ['srgb', 'hsl', 'hsv', 'lch'].includes(c.space.id)
      ? (c.space.id as LabColorValue['space'])
      : 'srgb';

    const projected = c.space.id === space ? c : c.to(space);

    return validateColor({
      space,
      coords: projected.coords.map((v) => (v == null || Number.isNaN(v) ? 0 : v)) as [
        number,
        number,
        number,
      ],
      alpha: previousAlpha !== undefined && !hasAlpha ? previousAlpha : c.alpha,
    });
  } catch {
    return null;
  }
}

export function colorInGamut(value: LabColorValue, space: 'srgb' | 'p3' | 'rec2020'): boolean {
  return colorCoords(value, space).every((v) => v >= 0 && v <= 1);
}

export function colorModelSpace(model: LabColorModel): LabColorValue['space'] {
  return model === 'hsb' ? 'hsv' : model === 'hex' || model === 'rgb' ? 'srgb' : model;
}

export function colorDisplay(value: LabColorValue, model: LabColorModel): string {
  if (model === 'hex') return colorHex(value, false);

  const coords = colorCoords(value, colorModelSpace(model)).map((v) => displayNumber(v));

  return `${model === 'hsb' ? 'hsv' : model}(${coords.join(' ')}${value.alpha === 1 ? '' : ` / ${displayNumber(value.alpha)}`})`;
}

/** Full-precision editing text; compact display text must never become edit authority. */

export function colorEditable(value: LabColorValue, model: LabColorModel): string {
  if (model === 'hex') return colorHex(value, false);

  const space = colorModelSpace(model);

  if (space === 'hsv')
    return serializeColor({ space, coords: colorCoords(value, space), alpha: value.alpha });

  if (space === 'hsl') {
    const [h, s, l] = colorCoords(value, space);
    return `hsl(${h} ${s}% ${l}% / ${value.alpha})`;
  }

  return colorCss({ space, coords: colorCoords(value, space), alpha: value.alpha });
}

export const displayNumber = (value: number) => String(Number(value.toFixed(2)));

export interface ColorPickerInput {
  value?: LabColorValue | null;

  defaultValue?: LabColorValue | null;

  variant?: LabColorPickerVariant;

  model?: LabColorModel;

  defaultVariant?: LabColorPickerVariant;

  defaultModel?: LabColorModel;

  disabled?: boolean;

  readOnly?: boolean;

  required?: boolean;

  name?: string;

  form?: string | null;
}

/** State survives remounts and keeps input precision until an actual edit is accepted. */

export class ColorPickerState {
  private viewInitialized = false;

  private initialized = false;

  private initial: LabColorValue | null = null;

  private local: LabColorValue | null = null;

  variant: LabColorPickerVariant = 'spectrum';

  model: LabColorModel = 'hex';

  showGraphs = true;

  showP3 = false;

  showRec2020 = false;

  status = '';

  value(input: ColorPickerInput): LabColorValue | null {
    if (!this.initialized) {
      this.initialized = true;

      this.initial =
        input.defaultValue === null ? null : copyColor(input.defaultValue ?? defaultColor);

      this.local = this.initial;
    }

    return input.value === undefined
      ? this.local
      : input.value === null
        ? null
        : validateColor(input.value);
  }

  accept(input: ColorPickerInput, value: LabColorValue | null): void {
    if (input.value === undefined) this.local = value && copyColor(value);
  }

  reset(input: ColorPickerInput): void {
    this.value(input);
    this.accept(input, this.initial);
    this.status = '';
  }

  view(input: ColorPickerInput) {
    if (!this.viewInitialized) {
      this.variant = input.defaultVariant ?? this.variant;
      this.model = input.defaultModel ?? this.model;
      this.viewInitialized = true;
    }

    return { variant: input.variant ?? this.variant, model: input.model ?? this.model };
  }
}

export interface ColorChannel {
  key: string;
  label: string;
  space: LabColorValue['space'];
  index: number;
  max: number;
  value: number;
  suffix: string;
  hexadecimal?: boolean;
}

export function colorChannels(
  value: LabColorValue,
  model: LabColorModel,
  variant: LabColorPickerVariant,
  rec2020 = false,
): ColorChannel[] {
  const space = variant === 'spectrum' && model !== 'lch' ? 'hsv' : colorModelSpace(model);

  const coords = colorCoords(value, space);

  const labels: [string, string, string] =
    space === 'srgb'
      ? ['Red', 'Green', 'Blue']
      : space === 'lch'
        ? ['Lightness', 'Chroma', 'Hue']
        : space === 'hsl'
          ? ['Hue', 'Saturation', 'Lightness']
          : ['Hue', 'Saturation', 'Brightness'];

  const maximum: [number, number, number] =
    space === 'srgb'
      ? [255, 255, 255]
      : space === 'lch'
        ? [100, rec2020 ? profile.lch.chromaMaxRec2020 : profile.lch.chromaMax, 360]
        : [360, 100, 100];

  const base =
    variant === 'grid'
      ? []
      : (variant === 'spectrum' ? [space === 'lch' ? 2 : 0] : [0, 1, 2]).map((index) => ({
          key: `${space}-${index}`,
          label: labels[index as 0 | 1 | 2],
          space,
          index,
          max: maximum[index as 0 | 1 | 2],

          value: coords[index as 0 | 1 | 2] * (space === 'srgb' ? 255 : 1),
          hexadecimal: model === 'hex' && space === 'srgb',
          suffix: space === 'srgb' || space === 'lch' ? '' : index === 0 ? '°' : '%',
        }));

  return [
    ...base,
    {
      key: 'alpha',
      label: 'Opacity',
      space: value.space,
      index: 3,
      max: 100,
      value: value.alpha * 100,
      suffix: '%',
    },
  ];
}

export function colorChannelText(channel: ColorChannel, exact = false): string {
  return channel.hexadecimal
    ? Math.round(clamp(channel.value, 0, 255))
        .toString(16)
        .toUpperCase()
    : `${exact ? channel.value : displayNumber(channel.value)}${channel.suffix}`;
}

export function parseColorChannelText(text: string, channel: ColorChannel): number {
  const raw = text.trim().replace(/[°%]$/, '');

  return channel.hexadecimal
    ? /^(?:0x)?[0-9a-f]{1,2}$/i.test(raw)
      ? Number.parseInt(raw.replace(/^0x/i, ''), 16)
      : Number.NaN
    : raw
      ? Number(raw)
      : Number.NaN;
}

export function editColorChannel(
  value: LabColorValue,
  channel: ColorChannel,
  next: number,
): LabColorValue {
  if (channel.key === 'alpha') return { ...value, alpha: clamp(next / 100) };

  const coords = colorCoords(value, channel.space);

  coords[channel.index] = clamp(next, 0, channel.max) / (channel.space === 'srgb' ? 255 : 1);

  return { space: channel.space, coords, alpha: value.alpha };
}

export const colorTrackInset = profile.channel.thumb / 2 + 2;

function colorTrackGradient(stops: string[]): string {
  const inset = colorTrackInset / 16;

  return `linear-gradient(to right,${stops.map((color, index) => `${color} calc(${inset}rem + (100% - ${2 * inset}rem) * ${index / (stops.length - 1)})`).join(',')})`;
}

export function channelGradient(
  value: LabColorValue,
  channel: ColorChannel,
  p3 = false,
  rec2020 = false,
): string {
  if (channel.space === 'srgb' && channel.index < 3) {
    const end: [number, number, number] = [0, 0, 0];
    end[channel.index] = 1;

    return colorTrackGradient(['#000', colorCss({ space: 'srgb', coords: end, alpha: 1 })]);
  }

  if ((channel.space === 'hsv' || channel.space === 'hsl') && channel.index === 0)
    return colorTrackGradient(['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f', '#f00']);

  if (channel.space === 'lch' && channel.index < 3) {
    const stops = Array.from({ length: 73 }, (_, i) => {
      const next = editColorChannel({ ...value, alpha: 1 }, channel, (channel.max * i) / 72);

      return colorInGamut(next, 'srgb') ||
        (p3 && colorInGamut(next, 'p3')) ||
        (rec2020 && colorInGamut(next, 'rec2020'))
        ? colorCss(next)
        : 'transparent';
    });

    return colorTrackGradient(stops);
  }

  const count = channel.max === 360 ? 13 : 9;

  const stops = Array.from({ length: count }, (_, i) =>
    colorCss(editColorChannel({ ...value, alpha: 1 }, channel, (channel.max * i) / (count - 1))),
  );

  if (channel.key === 'alpha')
    return colorTrackGradient([colorCss({ ...value, alpha: 0 }), colorCss({ ...value, alpha: 1 })]);

  return colorTrackGradient(stops);
}

export const colorSwatches: readonly LabColorValue[] = profile.swatches.map((coords) => ({
  space: 'srgb',
  coords: coords as [number, number, number],
  alpha: 1,
}));

const lchSwatches: readonly LabColorValue[] = profile.lchSwatches.map((coords) => ({
  space: 'srgb',
  coords: coords as [number, number, number],
  alpha: 1,
}));

export function colorPalette(model: LabColorModel) {
  const colors = model === 'lch' ? lchSwatches : colorSwatches;
  const columns = model === 'lch' ? profile.grid.lchColumns : profile.grid.columns;
  return { colors, columns, rows: colors.length / columns };
}

export type ColorPlane = 'spectrum' | 'l' | 'c' | 'h';

export function colorPlaneAxes(value: LabColorValue, plane: ColorPlane, rec2020 = false) {
  const coords = colorCoords(value, plane === 'spectrum' ? 'hsv' : 'lch');

  const chromaMax = rec2020 ? profile.lch.chromaMaxRec2020 : profile.lch.chromaMax;

  if (plane === 'spectrum')
    return {
      x: coords[1],
      y: coords[2],
      xMax: 100,
      yMax: 100,
      xLabel: 'Saturation',
      yLabel: 'Brightness',
    };

  if (plane === 'l')
    return {
      x: coords[2],
      y: coords[1],
      xMax: 360,
      yMax: chromaMax,
      xLabel: 'Hue',
      yLabel: 'Chroma',
    };

  if (plane === 'c')
    return { x: coords[2], y: coords[0], xMax: 360, yMax: 100, xLabel: 'Hue', yLabel: 'Lightness' };

  return {
    x: coords[0],
    y: coords[1],
    xMax: 100,
    yMax: chromaMax,
    xLabel: 'Lightness',
    yLabel: 'Chroma',
  };
}

export function editColorPlane(
  value: LabColorValue,
  plane: ColorPlane,
  x: number,
  y: number,
  rec2020 = false,
): LabColorValue {
  const space = plane === 'spectrum' ? 'hsv' : 'lch';

  const coords = colorCoords(value, space);

  const axes = colorPlaneAxes(value, plane, rec2020);

  const a = clamp(x) * axes.xMax;
  const b = clamp(y) * axes.yMax;

  if (plane === 'spectrum') {
    coords[1] = a;
    coords[2] = b;
  } else if (plane === 'l') {
    coords[2] = a;
    coords[1] = b;
  } else if (plane === 'c') {
    coords[2] = a;
    coords[0] = b;
  } else {
    coords[0] = a;
    coords[1] = b;
  }

  return { space, coords, alpha: value.alpha };
}
