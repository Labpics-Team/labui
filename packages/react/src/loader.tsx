'use client';
import {
  type LabLoaderSize,
  mountProgressMotion,
  progressState,
} from '@labpics/ui-core/progress/runtime';
import { loaderProfile } from '@labpics/ui-tokens';
import {
  type CSSProperties,
  type HTMLAttributes,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import '@labpics/ui-core/progress.css';
export interface LoaderProps extends HTMLAttributes<HTMLOutputElement> {
  size?: LabLoaderSize;
  label?: string;
  value?: number | null;
  min?: number;
  max?: number;
}
export const Loader = forwardRef<HTMLOutputElement, LoaderProps>(function Loader(
  { size = 'm', label = 'Загрузка', value = null, min = 0, max = 100, style, ...rest },
  ref,
) {
  const root = useRef<HTMLOutputElement>(null);
  useImperativeHandle(ref, () => root.current as HTMLOutputElement);
  const motion = useRef<ReturnType<typeof mountProgressMotion>>();
  const state = progressState(value, min, max);
  const unknown = state.value === null;
  const center = loaderProfile.viewBox / 2;
  const medium = loaderProfile.determinate.medium;
  const large = loaderProfile.determinate.large;
  const fraction = unknown ? null : state.fraction;
  useEffect(() => {
    if (!root.current) return;
    motion.current = mountProgressMotion(root.current, 'loader');
    return () => {
      motion.current?.dispose();
      motion.current = undefined;
    };
  }, []);
  useEffect(() => {
    motion.current?.update(fraction);
  }, [fraction]);
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: progressbar has no keyboard interaction; focus remains with the task.
    <output
      {...rest}
      ref={root}
      className={['lab-loader', rest.className].filter(Boolean).join(' ')}
      data-lab-loader=""
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: progressbar is read-only and represents both known and unknown values.
      role="progressbar"
      data-size={size}
      data-state={state.status}
      style={{ ...style, '--_progress-target': state.fraction } as CSSProperties}
      aria-label={rest['aria-label'] ?? label}
      aria-valuemin={state.min}
      aria-valuemax={state.max}
      aria-valuenow={state.value ?? undefined}
      aria-valuetext={unknown ? undefined : state.text}
    >
      <svg
        viewBox={`0 0 ${loaderProfile.viewBox} ${loaderProfile.viewBox}`}
        aria-hidden="true"
        style={unknown ? undefined : { display: 'none' }}
      >
        <g className="lab-progress-spin">
          {loaderProfile.spokeOpacity.map((opacity, index) => (
            <rect
              key={opacity}
              x={loaderProfile.segment.x}
              y={loaderProfile.segment.y}
              width={loaderProfile.segment.width}
              height={loaderProfile.segment.height}
              rx={loaderProfile.segment.radius}
              fill="currentColor"
              opacity={opacity}
              transform={`rotate(${(index * 360) / loaderProfile.spokeOpacity.length} ${loaderProfile.viewBox / 2} ${loaderProfile.viewBox / 2})`}
            />
          ))}
        </g>
      </svg>
      <svg
        viewBox={`0 0 ${loaderProfile.viewBox} ${loaderProfile.viewBox}`}
        aria-hidden="true"
        style={unknown ? { display: 'none' } : undefined}
      >
        <circle
          className="lab-loader-medium"
          cx={center}
          cy={center}
          r={medium.ringRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={medium.stroke}
        />
        <g className="lab-loader-large">
          <circle
            cx={center}
            cy={center}
            r={large.ringRadius}
            fill="none"
            stroke={`var(--lab-${large.trackRole})`}
            strokeWidth={large.stroke}
          />
          <circle
            className="lab-progress-arc"
            cx={center}
            cy={center}
            r={large.ringRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth={large.stroke}
            pathLength="1"
            transform={`rotate(-90 ${center} ${center})`}
            visibility={state.fraction === 0 ? 'hidden' : 'visible'}
          />
        </g>
      </svg>
      <span
        className="lab-loader-sector"
        aria-hidden="true"
        style={unknown ? { display: 'none' } : undefined}
      />
    </output>
  );
});
