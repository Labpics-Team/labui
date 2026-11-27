import { type Playback, scope } from '@labpics/motion';
import { loaderProfile, motionSemanticRuntime, progressProfile } from '@labpics/ui-tokens';
import { progressUnknownGeometry as unknown } from './contract.js';
export * from './contract.js';

export interface ProgressMotion {
  update(fraction: number | null): void;
  dispose(): void;
}

/** One lifecycle for both renderers: target-value interpolation and an interruptible busy pose. */
export function mountProgressMotion(
  root: HTMLElement,
  kind: 'loader' | 'linear' | 'circular',
): ProgressMotion {
  const motion = scope(root);
  const view = root.ownerDocument.defaultView;
  if (!view) throw new Error('Progress requires a document window');
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  let value: number | null | undefined;
  let generation = 0;
  let disposed = false;
  let loop: Playback | undefined;
  let measured: Playback | undefined;
  const turn = root.querySelector<HTMLElement>('.lab-progress-spin');
  function report(error: unknown): void {
    if (!disposed)
      root.dispatchEvent(
        new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
      );
  }
  async function run(current: number): Promise<void> {
    if (!turn) return;
    while (
      !disposed &&
      current === generation &&
      value === null &&
      !reduced.matches &&
      !root.ownerDocument.hidden
    ) {
      loop = motion.animate(
        turn,
        kind === 'linear'
          ? { '--_progress-travel': [unknown.travelStart, unknown.travelEnd] }
          : { rotate: [0, 360] },
        {
          duration: kind === 'loader' ? loaderProfile.periodMs : progressProfile.unknown.periodMs,
          ease:
            kind === 'loader'
              ? (t: number) =>
                  Math.floor(t * loaderProfile.spokeOpacity.length) /
                  loaderProfile.spokeOpacity.length
              : 'linear',
          reducedMotion: 'user',
        },
      );
      await loop.finished;
    }
  }
  function refresh(): void {
    generation++;
    loop?.stop();
    loop = undefined;
    measured?.stop();
    measured = undefined;
    if (turn) {
      if (kind === 'linear')
        turn.style.setProperty('--_progress-travel', String(unknown.travelRest));
      else turn.style.transform = 'rotate(0deg)';
    }
    if (value === null) void run(generation).catch(report);
    else if (value !== undefined) {
      measured = motion.animate(
        root,
        { '--_progress-ratio': value },
        {
          duration: motionSemanticRuntime.transition.durationMs,
          reducedMotion: reduced.matches || root.ownerDocument.hidden ? 'always' : 'user',
        },
      );
      void measured.finished.catch(report);
    }
  }
  motion.on(reduced, 'change', refresh);
  root.ownerDocument.addEventListener('visibilitychange', refresh);
  return {
    update(fraction) {
      if (disposed || fraction === value) return;
      const first = value === undefined;
      value = fraction;
      if (first && fraction !== null) root.style.setProperty('--_progress-ratio', String(fraction));
      else refresh();
    },
    dispose() {
      disposed = true;
      generation++;
      loop?.stop();
      motion.dispose();
      root.ownerDocument.removeEventListener('visibilitychange', refresh);
    },
  };
}
