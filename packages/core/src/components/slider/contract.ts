import { sliderProfile as profile } from '@labpics/ui-tokens';
export type LabSliderVariant = 'linear' | 'circular' | 'large';
export type LabSliderOrientation = 'horizontal' | 'vertical';
export const sliderCircleGeometry = {
  diameter: profile.circular.diameter,
  center: profile.circular.diameter / 2,
  radius: (profile.circular.diameter - profile.circular.stroke) / 2,
} as const;
/** Retained for source compatibility. Authored geometry is selected by variant. */
export type LabSliderSize = 's' | 'm' | 'l';

export interface SliderInput {
  value?: readonly number[] | null;
  defaultValue?: readonly number[];
  min?: number;
  max?: number;
  step?: number;
  variant?: LabSliderVariant;
  orientation?: LabSliderOrientation;
  disabled?: boolean;
  readOnly?: boolean;
}
export interface SliderBounds {
  min: number;
  max: number;
  step: number;
}

export function sliderBounds(input: SliderInput): SliderBounds {
  const min = input.min ?? 0;
  const max = input.max ?? 100;
  const step = input.step ?? 1;
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= min ||
    !Number.isFinite(max - min) ||
    !Number.isFinite(step) ||
    step <= 0
  )
    throw new RangeError('Slider requires finite min < max and a positive step');
  return { min, max, step };
}

/** Step is anchored at the global minimum, including for the second range thumb. */
export function snapSliderValue(value: number, bounds: SliderBounds): number {
  const { min, max, step } = bounds;
  const bounded = Math.max(min, Math.min(max, value));
  const ticks = (bounded - min) / step;
  // A step smaller than this value's representable spacing has no visible effect.
  if (!Number.isFinite(ticks)) return bounded;
  const snapped = min + Math.round(ticks) * step;
  const decimalPlaces = (number: number) => {
    const [coefficient, exponent = '0'] = String(number).toLowerCase().split('e');
    return Math.max(0, (coefficient?.split('.')[1]?.length ?? 0) - Number(exponent));
  };
  const precision = Math.max(decimalPlaces(min), decimalPlaces(step));
  const clean = (number: number) => (precision <= 100 ? Number(number.toFixed(precision)) : number);
  const candidate = clean(snapped);
  // A non-divisible maximum is not an extra off-grid value: native range
  // inputs cannot represent it, so select the final reachable step.
  return Math.max(min, candidate > max ? clean(snapped - step) : candidate);
}

export function sliderValues(input: SliderInput, values: readonly number[]): number[] {
  const bounds = sliderBounds(input);
  if (values.length < 1 || values.length > 2 || values.some((value) => !Number.isFinite(value)))
    throw new RangeError('Slider requires one value or an ordered pair of finite values');
  if (values[0] !== undefined && values[1] !== undefined && values[0] > values[1])
    throw new RangeError('Slider range values must be ordered');
  if (input.variant === 'large' && values.length !== 1)
    throw new RangeError('The authored large Slider accepts one value');
  if (input.variant && input.variant !== 'linear' && input.orientation === 'vertical')
    throw new RangeError('Only the linear Slider has a vertical orientation');
  return values.map((value) => snapSliderValue(value, bounds));
}

export function replaceSliderValue(
  values: readonly number[],
  index: number,
  next: number,
  input: SliderInput,
): number[] {
  const bounds = sliderBounds(input);
  const copy = [...values];
  copy[index] = Math.max(
    values[index - 1] ?? bounds.min,
    Math.min(values[index + 1] ?? bounds.max, snapSliderValue(next, bounds)),
  );
  return copy;
}

export function sameSliderValues(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Value lifetime is independent of DOM listeners, so detach/reparent cannot reset a field. */
export class SliderState {
  private initial?: number[];
  private local?: number[];
  values(input: SliderInput): number[] {
    this.initial ??= [...(input.defaultValue ?? [50])];
    this.local ??= [...this.initial];
    return sliderValues(input, input.value ?? this.local);
  }
  accept(input: SliderInput, values: readonly number[]): void {
    if (input.value == null) this.local = [...values];
  }
  reset(input: SliderInput): void {
    this.values(input);
    if (input.value == null && this.initial) this.local = [...this.initial];
  }
}

export function parseSliderValues(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'number') return [parsed];
  } catch {
    /* HTML also accepts a comma-separated pair. */
  }
  return raw
    .trim()
    .split(/[\s,]+/)
    .map(Number);
}

export function sliderFraction(value: number, input: SliderInput): number {
  const bounds = sliderBounds(input);
  return (value - bounds.min) / (bounds.max - bounds.min);
}

/** Clockwise from twelve o'clock. Unwrap against the last accepted angle before clamping. */
export function circularSliderFraction(
  x: number,
  y: number,
  previous?: number,
): number | undefined {
  if (Math.hypot(x, y) < 1) return undefined;
  const angle = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1;
  if (previous === undefined) return angle;
  return Math.max(0, Math.min(1, angle + Math.round(previous - angle)));
}

/** The source aligns a linear thumb's trailing edge to its active track. */
export function linearSliderPosition(
  fraction: number,
  length: number,
  diameter = profile.thumb,
): number {
  return Math.max(diameter, length * fraction) - diameter / 2;
}

export function sliderThumbStyle(
  fraction: number,
  variant: LabSliderVariant,
  vertical = false,
): string {
  if (variant === 'circular') {
    const angle = fraction * Math.PI * 2;
    const radius =
      (profile.circular.diameter - profile.circular.stroke) / (2 * profile.circular.diameter);
    return `left:${50 + Math.sin(angle) * radius * 100}%;top:${50 - Math.cos(angle) * radius * 100}%`;
  }
  if (variant === 'large') {
    const inset = (profile.large.indicatorInset + profile.large.indicatorWidth / 2) / 16;
    return `inset-inline-start:clamp(${inset}rem,calc(${fraction * 100}% - ${inset}rem),calc(100% - ${inset}rem))`;
  }
  const thumb = profile.thumb / 16;
  return vertical
    ? `bottom:calc(max(${thumb}rem,${fraction * 100}%) - ${thumb / 2}rem);left:50%`
    : `inset-inline-start:calc(max(${thumb}rem,${fraction * 100}%) - ${thumb / 2}rem);top:50%`;
}

export function sliderArc(start: number, end: number): string {
  const center = profile.circular.diameter / 2;
  const radius = center - profile.circular.stroke / 2;
  const point = (fraction: number) => [
    center + radius * Math.sin(fraction * Math.PI * 2),
    center - radius * Math.cos(fraction * Math.PI * 2),
  ];
  const a = point(start);
  if (end <= start) return '';
  if (end - start >= 1)
    return `M${center} ${center - radius}A${radius} ${radius} 0 1 1 ${center} ${center + radius}A${radius} ${radius} 0 1 1 ${center} ${center - radius}`;
  const b = point(end);
  return `M${a[0]} ${a[1]}A${radius} ${radius} 0 ${end - start > 0.5 ? 1 : 0} 1 ${b[0]} ${b[1]}`;
}
