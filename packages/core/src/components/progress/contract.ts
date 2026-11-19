import { progressProfile } from '@labpics/ui-tokens';

/** Percent translation is relative to the range width from the common profile. */
export const progressUnknownGeometry = {
  widthPercent: progressProfile.unknown.fraction * 100,
  travelStart: -100,
  travelEnd: 100 / progressProfile.unknown.fraction,
  travelRest: 50 * (1 / progressProfile.unknown.fraction - 1),
} as const;

export type LabProgressSize = keyof typeof progressProfile.sizes;
export type LabProgressVariant = 'linear' | 'circular';
export type LabLoaderSize = LabProgressSize;
export interface ProgressState {
  readonly min: number;
  readonly max: number;
  readonly value: number | null;
  readonly fraction: number;
  readonly text: string;
  readonly status: 'indeterminate' | 'loading' | 'complete';
}

/** A finite value and increasing finite bounds describe progress; everything else is unknown. */
export function progressState(value: number | null | undefined, min = 0, max = 100): ProgressState {
  const validRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  if (!validRange || value == null || !Number.isFinite(value))
    return {
      min: validRange ? min : 0,
      max: validRange ? max : 100,
      value: null,
      fraction: 0,
      text: '',
      status: 'indeterminate',
    };
  const clamped = Math.min(max, Math.max(min, value));
  const span = max - min;
  const scale = Math.max(Math.abs(min), Math.abs(max));
  const fraction = Number.isFinite(span)
    ? (clamped - min) / span
    : (clamped / scale - min / scale) / (max / scale - min / scale);
  return {
    min,
    max,
    value: clamped,
    fraction,
    text: `${Math.round(fraction * 100)}%`,
    status: fraction === 1 ? 'complete' : 'loading',
  };
}

export const progressValueConverter = {
  fromAttribute(raw: string | null): number | null {
    if (raw === null || raw.trim() === '' || raw === 'null') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  },
  toAttribute(value: number | null): string | null {
    return value === null ? null : String(value);
  },
};
