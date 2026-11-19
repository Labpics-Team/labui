import { type Playback, scope } from '@labpics/motion';
import { motionSemanticRuntime } from '@labpics/ui-tokens';

/** Native radio selection changes immediately; only the new decoration enters. */
export function mountSegmentedMotion(root: HTMLElement): { update(): void; dispose(): void } {
  const motion = scope(root);
  let previous: HTMLElement | null | undefined;
  let playback: Playback | undefined;
  let generation = 0;
  let disposed = false;
  function update(): void {
    const selected = root.querySelector<HTMLElement>(
      ':scope > [data-selected] > .lab-segment-active',
    );
    if (selected === previous) return;
    const initial = previous === undefined;
    playback?.stop();
    previous?.style.removeProperty('opacity');
    previous = selected;
    const current = ++generation;
    if (initial || !selected || disposed) return;
    try {
      playback = motion.animate(
        selected,
        { opacity: [0, 1] },
        {
          duration: motionSemanticRuntime.transition.durationMs,
          reducedMotion: 'user',
        },
      );
      void playback.finished.catch((error: unknown) => {
        if (!disposed && current === generation) fail(error);
      });
    } catch (error) {
      fail(error);
    }
  }
  function fail(error: unknown): void {
    dispose();
    root.dispatchEvent(
      new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
    );
  }
  function dispose(): void {
    disposed = true;
    generation++;
    playback?.stop();
    motion.dispose();
    previous?.style.removeProperty('opacity');
  }
  update();
  return { update, dispose };
}
