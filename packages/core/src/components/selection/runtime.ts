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

/** Reconcile reset after default handling; a later native input supersedes it. */
export function listenSelectionReset(
  input: HTMLInputElement,
  reset: () => void,
  selection: EventTarget = input,
): () => void {
  const form = input.form;
  const tasks = new Set<ReturnType<typeof setTimeout>>();
  const cancelPending = (): void => {
    for (const task of tasks) clearTimeout(task);
    tasks.clear();
  };
  const onReset = (event: Event): void => {
    const task = setTimeout(() => {
      tasks.delete(task);
      if (!event.defaultPrevented && input.isConnected) reset();
    }, 0);
    tasks.add(task);
  };
  form?.addEventListener('reset', onReset);
  selection.addEventListener('input', cancelPending, true);
  return () => {
    cancelPending();
    form?.removeEventListener('reset', onReset);
    selection.removeEventListener('input', cancelPending, true);
  };
}
