'use client';
import {
  type LabSliderOrientation,
  type LabSliderSize,
  type LabSliderVariant,
  type SliderRuntime,
  SliderState,
  sliderCircleGeometry as circle,
  mountSlider,
  sliderArc,
  sliderBounds,
  sliderFraction,
  sliderThumbStyle,
} from '@labpics/ui-core/slider/runtime';
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import '@labpics/ui-core/slider.css';
export type { LabSliderOrientation, LabSliderSize, LabSliderVariant };
export interface SliderProps {
  variant?: LabSliderVariant;
  orientation?: LabSliderOrientation;
  /** @deprecated Authored geometry is selected by variant. */
  size?: LabSliderSize;
  label: string;
  labelHidden?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  form?: string;
  dir?: 'ltr' | 'rtl';
  thumbLabels?: string[];
  onValueChange?: (value: number[]) => void;
  onValueChangeEnd?: (value: number[]) => void;
}
function thumbStyle(source: string): CSSProperties {
  return Object.fromEntries(
    source.split(';').map((part) => {
      const index = part.indexOf(':');
      return [
        part.slice(0, index).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()),
        part.slice(index + 1),
      ];
    }),
  );
}
export function Slider(props: SliderProps): ReactNode {
  const {
    variant = 'linear',
    orientation = 'horizontal',
    label,
    labelHidden = false,
    helper,
    error,
    min = 0,
    max = 100,
    step = 1,
    showValue,
    readOnly,
    disabled,
    invalid,
    name,
    form,
    dir,
    thumbLabels = [],
  } = props;
  const [state] = useState(() => new SliderState());
  const root = useRef<HTMLDivElement>(null);
  const runtime = useRef<SliderRuntime>();
  const current = useRef(props);
  current.current = props;
  const [, refresh] = useState(0);
  const id = useId();
  const input = { ...props, min, max, step, variant, orientation };
  const values = state.values(input);
  const fractions = values.map((value) => sliderFraction(value, input));
  const bounds = sliderBounds(input);
  const start = values.length === 2 ? (fractions[0] ?? 0) : 0;
  const end = fractions.at(-1) ?? 0;
  const large = variant === 'large';
  useEffect(() => {
    if (!root.current) return;
    runtime.current = mountSlider(root.current, state, () => ({
      ...current.current,
      onValueChange(value) {
        current.current.onValueChange?.(value);
        refresh((revision) => revision + 1);
      },
      onValueChangeEnd(value) {
        current.current.onValueChangeEnd?.(value);
      },
    }));
    return () => {
      runtime.current?.dispose();
      runtime.current = undefined;
    };
  }, [state]);
  useEffect(() => runtime.current?.update());
  const description = [helper ? `${id}-helper` : '', invalid && error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      ref={root}
      data-lab-slider=""
      data-variant={variant}
      data-orientation={orientation}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      data-invalid={invalid || undefined}
      data-range={values.length === 2 || undefined}
      data-empty={end === 0 || undefined}
      dir={dir}
      style={
        { '--_slider-start': `${start * 100}%`, '--_slider-end': `${end * 100}%` } as CSSProperties
      }
    >
      {!large && ((!labelHidden && label) || showValue) && (
        <div className="lab-slider-label-row">
          <span className={labelHidden ? 'lab-slider-hidden' : 'lab-slider-label'}>{label}</span>
          {showValue && <span className="lab-slider-value-text">{values.join(' – ')}</span>}
        </div>
      )}
      <div className="lab-slider-control">
        {variant === 'circular' ? (
          <svg
            className="lab-slider-circle"
            viewBox={`0 0 ${circle.diameter} ${circle.diameter}`}
            aria-hidden="true"
          >
            <circle cx={circle.center} cy={circle.center} r={circle.radius} />
            <path className="lab-slider-arc" d={sliderArc(start, end)} />
          </svg>
        ) : large ? (
          <>
            <span className="lab-slider-large-label" aria-hidden="true">
              <span>{label}</span>
            </span>
            <div className="lab-slider-large-fill" aria-hidden="true">
              <span className="lab-slider-large-label">
                <span>{label}</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="lab-slider-track" />
            <div className="lab-slider-range" />
          </>
        )}
        {values.map((value, index) => (
          <span
            key={index === 0 ? 'lower' : 'upper'}
            className="lab-slider-thumb"
            data-thumb-index={index}
            style={thumbStyle(
              sliderThumbStyle(fractions[index] ?? 0, variant, orientation === 'vertical'),
            )}
          >
            {large && <span className="lab-slider-large-mask" aria-hidden="true" />}
            <span className="lab-slider-thumb-visual" aria-hidden="true" />
            <input
              type="range"
              aria-label={
                thumbLabels[index] ||
                (values.length === 1 ? label : `${label} ${index === 0 ? 'minimum' : 'maximum'}`)
              }
              aria-orientation={orientation}
              aria-readonly={readOnly || undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={description || undefined}
              aria-errormessage={invalid && error ? `${id}-error` : undefined}
              min={index ? values[index - 1] : bounds.min}
              max={index < values.length - 1 ? values[index + 1] : bounds.max}
              step={step}
              defaultValue={value}
              disabled={disabled}
              name={name}
              form={form}
            />
          </span>
        ))}
      </div>
      {helper && (
        <span className="lab-slider-helper" id={`${id}-helper`}>
          {helper}
        </span>
      )}
      {invalid && error && (
        <span className="lab-slider-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
