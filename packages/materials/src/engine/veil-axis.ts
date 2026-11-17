/** Axis-aligned bands in a caller-supplied CSS length. The same cumulative
 * profile can resize every frame without changing its DOM, physical blur,
 * feather bounds, or retained tight capture boxes.
 */
export type VeilEdge = 'top' | 'bottom' | 'left' | 'right';

const opposite: Record<VeilEdge, VeilEdge> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};
const angle: Record<VeilEdge, number> = { top: 180, bottom: 0, left: 90, right: 270 };
const n = (value: number) => Number(value.toFixed(8));
const length = (fraction: number) => `calc(var(--lab-veil-axis-length) * ${n(fraction)})`;

export function axisBandStyle(
  edge: VeilEdge,
  t0: number,
  t1: number,
  radius: number,
  feather: string,
): Record<string, string> {
  const fadeIn = t0 > 1e-6;
  const fadeOut = t1 < 1 - 1e-6;
  const half =
    feather === 'auto'
      ? `clamp(4px, ${length(0.03)}, 24px)`
      : `${Math.max(0, Number.parseFloat(feather) || 0) / 2}px`;
  const bleed = n(radius + 2);
  const start = fadeIn
    ? `max(0px, calc(${length(t0)} - var(--_veil-half-feather) - ${bleed}px))`
    : '0px';
  const end = fadeOut
    ? `max(0px, calc(${length(1 - t1)} - var(--_veil-half-feather) - ${bleed}px))`
    : '0px';
  const at = (t: number, sign: '-' | '+') =>
    `calc(${length(t)} ${sign} var(--_veil-half-feather) - var(--_veil-start))`;
  const stops = [
    ...(fadeIn
      ? [`transparent ${at(t0, '-')}`, `currentColor ${at(t0, '+')}`]
      : ['currentColor 0px']),
    ...(fadeOut
      ? [`currentColor ${at(t1, '-')}`, `transparent ${at(t1, '+')}`]
      : ['currentColor 100%']),
  ];
  return {
    '--_veil-half-feather': `min(${length((t1 - t0) / 2)}, ${half})`,
    '--_veil-start': start,
    '--_veil-end': end,
    top: '0px',
    right: '0px',
    bottom: '0px',
    left: '0px',
    [edge]: 'var(--_veil-start)',
    [opposite[edge]]: 'var(--_veil-end)',
    ...(fadeIn || fadeOut
      ? {
          'mask-image': `linear-gradient(${angle[edge]}deg, ${stops.join(', ')})`,
          '-webkit-mask-image': `linear-gradient(${angle[edge]}deg, ${stops.join(', ')})`,
        }
      : {}),
  };
}
