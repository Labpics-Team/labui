/**
 * <Progress> — the native-React twin of the Lit `<lab-progress>` (ADR-0001). Same
 * axes, same `@zag-js/progress` machine through the SAME Behaviors seam — here via
 * `useZag` instead of the Lit `ZagController`. No Lit in this path. The machine
 * owns the value→percent maths, `role="progressbar"` + `aria-valuemin/max/now`, and
 * the determinate-vs-indeterminate state; the component only spreads the machine's
 * prop-getters onto native elements and paints with the SAME --lab-* roles, so
 * parity is CSS, not a second behaviour.
 *
 * ACCESSIBLE NAME: @zag-js/progress@1.41.2 names the track via `aria-label` set to
 * the formatted VALUE string (e.g. "60%"), NOT `aria-valuetext`, and emits no
 * `aria-labelledby`. When a visible label is present we override that: the track is
 * named by the label via `aria-labelledby` and the value `aria-label` is dropped
 * (see the render body). The numeric percent stays on `aria-valuenow`.
 *
 * HONEST two-mode contract (no fake progress, round-1 lesson 6): `value` is a real
 * number (determinate — the machine fills the range to the real percent and sets
 * `aria-valuenow`) or `null` (indeterminate — the machine drops `aria-valuenow`
 * and reports `data-state=indeterminate`; the bar animates an unknown-progress
 * segment). The component never fabricates a percent it does not have.
 *
 * Client Component: progress reflects changing state. It renders as a leaf under a
 * Server Component shell — never a `'use client'` page (dive-next P1).
 *
 * The axis types come from @labpics/ui-core (type-only — no Lit runtime), so the
 * Lit and React APIs share ONE source of truth and cannot drift.
 */
'use client';

import type { MachineModule, SchemaOf } from '@labpics/ui-core';
import type { LabProgressSize } from '@labpics/ui-core/progress';
import * as progressMachine from '@zag-js/progress';
import { type ReactNode, useId } from 'react';
import { useZag } from './use-zag.js';
import './progress.css';

type ProgressSchema = SchemaOf<progressMachine.Service>;
type ProgressApi = progressMachine.Api;

const progressModule: MachineModule<ProgressSchema, ProgressApi> = progressMachine;

export interface ProgressProps {
  /** The current value. A number is determinate; `null` is indeterminate. */
  value?: number | null;
  /** Lower bound of the value range. */
  min?: number;
  /** Upper bound of the value range. */
  max?: number;
  /** Track thickness. */
  size?: LabProgressSize;
  /** Optional visible label. */
  label?: ReactNode;
  /** Show the numeric value text (determinate only — empty for indeterminate). */
  showValueText?: boolean;
}

export function Progress({
  value = null,
  min = 0,
  max = 100,
  size = 'm',
  label,
  showValueText = false,
}: ProgressProps): ReactNode {
  const api = useZag(progressModule, {
    id: useId(),
    // `value === null` flows THROUGH as the indeterminate signal — no fake number.
    value,
    min,
    max,
  });

  const showText = showValueText && value !== null;
  const hasLabel = label != null;

  // ACCESSIBLE NAME (WCAG 4.1.2). The machine's getTrackProps() carries
  // `aria-label` = the formatted VALUE string ("60%", or "loading..." when
  // indeterminate), NOT the task this bar tracks — and it emits no
  // `aria-labelledby`, so the visible "Uploading" label is never the progressbar's
  // name. When a visible label is rendered, NAME the track by it: point
  // `aria-labelledby` at the label part's own id (the same id getLabelProps emits
  // onto the <span>) and drop the value `aria-label` so it cannot shadow the
  // labelledby name. With no visible label we leave the machine's value `aria-label`
  // as a degraded-but-present name. Identical semantics on the Lit twin ⇒ parity.
  const labelId = api.getLabelProps().id;
  const trackProps = api.getTrackProps();
  const namedTrackProps = hasLabel
    ? { ...trackProps, 'aria-label': undefined, 'aria-labelledby': labelId }
    : trackProps;

  return (
    <div {...api.getRootProps()} data-lab-progress="" data-size={size}>
      {hasLabel || showText ? (
        <div className="lab-progress-meta">
          {hasLabel ? (
            <span {...api.getLabelProps()} className="lab-progress-label">
              {label}
            </span>
          ) : null}
          {showText ? (
            <span {...api.getValueTextProps()} className="lab-progress-value-text">
              {api.percentAsString}
            </span>
          ) : null}
        </div>
      ) : null}
      <div {...namedTrackProps} className="lab-progress-track">
        <div {...api.getRangeProps()} className="lab-progress-range" />
      </div>
    </div>
  );
}
