'use client';
import {
  type LabProgressSize,
  type LabProgressVariant,
  mountProgressMotion,
  progressState,
} from '@labpics/ui-core/progress/runtime';
import { progressProfile } from '@labpics/ui-tokens';
import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react';
import '@labpics/ui-core/progress.css';
export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  min?: number;
  max?: number;
  size?: LabProgressSize;
  variant?: LabProgressVariant;
  label?: ReactNode;
  showValueText?: boolean;
}
export function Progress({
  value = null,
  min = 0,
  max = 100,
  size = 'm',
  variant = 'linear',
  label,
  showValueText = false,
  style,
  ...rest
}: ProgressProps): ReactNode {
  const root = useRef<HTMLDivElement>(null);
  const motion = useRef<ReturnType<typeof mountProgressMotion>>();
  const state = progressState(value, min, max);
  const unknown = state.value === null;
  const fraction = unknown ? null : state.fraction;
  useEffect(() => {
    if (!root.current) return;
    motion.current = mountProgressMotion(root.current, variant);
    return () => {
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, [variant]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new variant replaces the motion scope and needs the current fraction again.
  useEffect(() => {
    motion.current?.update(fraction);
  }, [fraction, variant]);
  const id = useId();
  const hasLabel = label != null;
  const showText = showValueText && !unknown;
  const circular = variant === 'circular';
  const metrics = progressProfile.sizes[size] ?? progressProfile.sizes.m;
  const radius = (metrics.circularDiameter - metrics.circularStroke) / 2;
  return (
    <div
      {...rest}
      ref={root}
      className={['lab-progress-root', rest.className].filter(Boolean).join(' ')}
      data-lab-progress=""
      data-size={size}
      data-variant={variant}
      data-state={state.status}
      style={{ ...style, '--_progress-target': state.fraction } as CSSProperties}
    >
      {hasLabel || (!circular && showText) ? (
        <div className="lab-progress-meta">
          {hasLabel ? (
            <span className="lab-progress-label" id={id}>
              {label}
            </span>
          ) : null}
          {showText && !circular ? (
            <span className="lab-progress-value-text">{state.text}</span>
          ) : null}
        </div>
      ) : null}
      {/* Progress is a read-only status, not an extra tab stop. */}
      {/* biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA progressbar is not an interactive control. */}
      <div
        className={circular ? 'lab-progress-circle' : 'lab-progress-track'}
        data-state={state.status}
        data-zero={!unknown && state.fraction === 0 ? '' : undefined}
        role="progressbar"
        aria-labelledby={hasLabel ? id : rest['aria-labelledby']}
        aria-label={hasLabel ? undefined : (rest['aria-label'] ?? 'Ход выполнения')}
        aria-valuemin={state.min}
        aria-valuemax={state.max}
        aria-valuenow={state.value ?? undefined}
        aria-valuetext={unknown ? undefined : state.text}
      >
        {circular ? (
          <>
            <svg
              viewBox={`0 0 ${metrics.circularDiameter} ${metrics.circularDiameter}`}
              aria-hidden="true"
            >
              <circle
                cx="50%"
                cy="50%"
                r={radius}
                fill="none"
                stroke={`var(--lab-${progressProfile.trackRole})`}
                strokeWidth={metrics.circularStroke}
              />
              <g className="lab-progress-spin">
                <circle
                  className="lab-progress-arc"
                  cx="50%"
                  cy="50%"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={metrics.circularStroke}
                  pathLength="1"
                  transform={`rotate(-90 ${metrics.circularDiameter / 2} ${metrics.circularDiameter / 2})`}
                />
              </g>
            </svg>
            {showText ? (
              <span className="lab-progress-value-text" aria-hidden="true">
                <span>{state.text}</span>
              </span>
            ) : null}
          </>
        ) : (
          <div className="lab-progress-range lab-progress-spin" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
