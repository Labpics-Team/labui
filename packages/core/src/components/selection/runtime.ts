import { scope } from '@labpics/motion';
import { motionSemanticRuntime } from '@labpics/ui-tokens';
export * from './contract.js';

export interface SelectionMotion {
  update(): void;
  dispose(): void;
}

/** Native inputs own state. Motion only reveals the authored selected mark. */
export function mountSelectionMotion(root: HTMLElement, input: HTMLInputElement): SelectionMotion {
  const motion = scope(root);
  let last: boolean | undefined;
  let disposed = false;
  function update(): void {
    if (disposed) return;
    const selected = input.checked || input.indeterminate;
    if (selected === last) return;
    if (last === undefined) root.style.setProperty('--_selection-reveal', selected ? '1' : '0');
    else {
      const playback = motion.animate(
        root,
        { '--_selection-reveal': selected ? 1 : 0 },
        {
          duration: motionSemanticRuntime.transition.durationMs,
          reducedMotion: 'user',
        },
      );
      void playback.finished.catch((error: unknown) => {
        if (!disposed)
          root.dispatchEvent(
            new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
          );
      });
    }
    last = selected;
  }
  update();
  return {
    update,
    dispose() {
      disposed = true;
      motion.dispose();
      root.style.removeProperty('--_selection-reveal');
    },
  };
}

/** Reconcile after the form's default reset action and ancestor cancellation. */
export function listenSelectionReset(input: HTMLInputElement, reset: () => void): () => void {
  const form = input.form;
  const tasks = new Set<ReturnType<typeof setTimeout>>();
  const onReset = (event: Event): void => {
    const task = setTimeout(() => {
      tasks.delete(task);
      if (!event.defaultPrevented && input.isConnected) reset();
    }, 0);
    tasks.add(task);
  };
  form?.addEventListener('reset', onReset);
  return () => {
    for (const task of tasks) clearTimeout(task);
    form?.removeEventListener('reset', onReset);
  };
}
