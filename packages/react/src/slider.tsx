/**
 * <Slider> — the native-React twin of the Lit `<lab-slider>` (ADR-0001).
 *
 * Same axes, same `@zag-js/slider` machine through the SAME Behaviors seam — here via
 * `useZag` (the React side) instead of the Lit `ZagController`. No Lit in this path;
 * Next's shallow WC-SSR never touches React. The machine owns the value (tuple for a
 * range), min/max/step, each thumb's `role="slider"` + value ARIA
 * (`aria-valuenow/valuemin/valuemax/valuetext/orientation`), Arrow/Home/End/PageUp-Down
 * keyboard stepping, pointer drag + track-click, multi-thumb collision, and a hidden
 * input per thumb for forms — the component only spreads the machine's prop-getters
 * onto native elements and paints with the SAME --lab-* roles, so parity is CSS, not a
 * second behaviour implementation.
 *
 * REUSES the field a11y seam: the GROUP label / helper / error association is the
 * SAME shared `field-a11y` helper from @labpics/ui-core that the Lit element and the
 * other fields use. The machine owns each thumb's slider role + value ARIA and points
 * the thumb's `aria-labelledby` at the label part; this twin renders the label as the
 * machine's label part (giving the thumbs their name) and ADDS the field's
 * describedby/errormessage on the label region so a reader announces the helper/error
 * with the group — ONE source of truth across both renderers.
 *
 * Compound, keyed by INDEX (the slider's stable thumb key): `getThumbProps({ index })`
 * is spread per thumb; React's key and the machine's index agree, so a thumb never
 * gets another's props.
 *
 * Client Component: a slider is interactive (value + drag + keyboard). It renders as a
 * leaf under a Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the Lit
 * and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import {
  type FieldControlAria,
  type LabSliderOrientation,
  type LabSliderSize,
  fieldControlAria,
  fieldErrorIsActive,
  fieldPartIds,
} from '@labpics/ui-core';
import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import * as sliderMachine from '@zag-js/slider';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './slider.css';

export type { LabSliderOrientation, LabSliderSize };

type SliderSchema = SchemaOf<sliderMachine.Service>;
type SliderApi = sliderMachine.Api;

const sliderModule: MachineModule<SliderSchema, SliderApi> = sliderMachine;

export interface SliderProps {
  /** Control size — drives track thickness and thumb diameter. */
  size?: LabSliderSize;
  /** Slider orientation. */
  orientation?: LabSliderOrientation;
  /** Visible group label text — rendered as the machine's label part (thumb name). */
  label: string;
  /** Visually hide the label, keeping it in the a11y tree. */
  labelHidden?: boolean;
  /** Helper / description text linked to the group via aria-describedby. */
  helper?: ReactNode;
  /** Error message; announced (role="alert") and linked only when `invalid`. */
  error?: ReactNode;
  /** Controlled value(s) — when set, the consumer owns the value. */
  value?: number[];
  /** Uncontrolled initial value(s) — read once by the machine at init. */
  defaultValue?: number[];
  /** Minimum value. */
  min?: number;
  /** Maximum value. */
  max?: number;
  /** Step the drag and Arrow keys move by. */
  step?: number;
  /** Value markers along the track. */
  marks?: number[];
  /** Show the live value text above the control. */
  showValue?: boolean;
  /** Non-editable: reads its value but cannot be changed. */
  readOnly?: boolean;
  /** Non-interactive and dimmed. */
  disabled?: boolean;
  /** Invalid — drives aria-invalid / aria-errormessage and danger styling. */
  invalid?: boolean;
  /** Native form field name for the hidden input(s). */
  name?: string;
  /** Fires when the machine changes the value (machine is source of truth). */
  onValueChange?: (value: number[]) => void;
  /** Fires when a value change gesture ends (drag release / key commit). */
  onValueChangeEnd?: (value: number[]) => void;
}

/** Strip `undefined` ARIA so React omits the attribute instead of rendering "undefined". */
function describeProps(
  aria: Pick<FieldControlAria, 'aria-describedby' | 'aria-errormessage'>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(aria)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function Slider({
  size = 'm',
  orientation = 'horizontal',
  label,
  labelHidden = false,
  helper,
  error,
  value,
  defaultValue = [50],
  min = 0,
  max = 100,
  step = 1,
  marks = [],
  showValue = false,
  readOnly = false,
  disabled = false,
  invalid = false,
  name,
  onValueChange,
  onValueChangeEnd,
}: SliderProps): ReactNode {
  const baseId = useId();
  const ids = fieldPartIds(baseId);
  const hasHelper = helper != null && helper !== '';
  const hasError = error != null && error !== '';
  const showError = fieldErrorIsActive({ invalid, hasError });
  // A slider group is never `required` (no empty state); only the description wiring
  // is the field's responsibility — the machine owns the thumb role + value ARIA.
  const fieldAria = fieldControlAria({
    id: baseId,
    invalid,
    required: false,
    hasHelper,
    hasError,
  });

  const api = useZag(sliderModule, {
    id: baseId,
    value,
    defaultValue,
    min,
    max,
    step,
    orientation,
    // Centre the thumb on the value point (our CSS translates -50%): the standard
    // slider look, and — unlike the "contain" default — it does NOT hide the thumb
    // behind a thumb-size measurement (parity with the Lit element).
    thumbAlignment: 'center',
    disabled,
    readOnly,
    invalid,
    name,
    onValueChange: onValueChange ? (details) => onValueChange(details.value) : undefined,
    onValueChangeEnd: onValueChangeEnd ? (details) => onValueChangeEnd(details.value) : undefined,
  });

  return (
    <div
      {...api.getRootProps()}
      className="lab-slider"
      data-lab-slider=""
      data-size={size}
      data-orientation={orientation}
      data-label-hidden={labelHidden || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-invalid={invalid || undefined}
    >
      <div className="lab-slider-label-row">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: getLabelProps() spreads htmlFor → the first thumb's hidden input (the machine owns the association); Biome can't see through the spread. */}
        <label {...api.getLabelProps()} {...describeProps(fieldAria)} className="lab-slider-label">
          {label}
        </label>
        {showValue ? (
          <span {...api.getValueTextProps()} className="lab-slider-value-text">
            {api.value.join(' – ')}
          </span>
        ) : null}
      </div>
      <div {...api.getControlProps()} className="lab-slider-control">
        <div {...api.getTrackProps()} className="lab-slider-track">
          <div {...api.getRangeProps()} className="lab-slider-range" />
          {marks.length > 0 ? (
            <div {...api.getMarkerGroupProps()} className="lab-slider-marker-group">
              {marks.map((markValue) => (
                <span
                  key={markValue}
                  {...api.getMarkerProps({ value: markValue })}
                  className="lab-slider-marker"
                />
              ))}
            </div>
          ) : null}
          {api.value.map((_thumbValue, index) => (
            // Keyed by the STABLE thumb index: the machine keys its per-thumb getters
            // by index and the id it puts on the thumb is what aria-labelledby/roving
            // target. React's key and the machine's index agree, so a thumb never gets
            // another thumb's props — the index IS the thumb's identity here, not an
            // incidental list position.
            // biome-ignore lint/suspicious/noArrayIndexKey: the thumb index is the machine's stable thumb key (getThumbProps keys by index), not an incidental list order.
            <div key={index} {...api.getThumbProps({ index })} className="lab-slider-thumb">
              <input {...api.getHiddenInputProps({ index })} />
            </div>
          ))}
        </div>
      </div>
      {hasHelper ? (
        <span id={ids.helper} className="lab-slider-helper">
          {helper}
        </span>
      ) : null}
      {showError ? (
        <span id={ids.error} className="lab-slider-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
