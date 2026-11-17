import { type MotionEase, type MotionScope, scope } from '@labpics/motion';
import { mountMaterialRuntime } from '@labpics/ui-materials';
import { motionSemanticRuntime, snackbarProfile } from '@labpics/ui-tokens';

export interface SnackbarState {
  open: boolean;
  message: string;
  duration: number;
  notificationKey?: string | number;
}

export interface SnackbarRuntime {
  update(state: SnackbarState): void;
  dispose(): void;
}

/** One deadline, suspended by focus, pointer or a hidden document. No frame loop. */
export function mountSnackbarRuntime(
  panel: HTMLElement,
  announcement: HTMLElement,
  options: { onTimeout(): void; onError(error: unknown): void },
): SnackbarRuntime {
  const doc = panel.ownerDocument;
  const windowCandidate = doc.defaultView;
  if (!windowCandidate) throw new Error('Snackbar requires a document window');
  const view = windowCandidate;
  function part<T extends Element>(selector: string): T {
    const found = panel.querySelector<T>(selector);
    if (!found) throw new Error(`Missing Snackbar part: ${selector}`);
    return found;
  }
  const timer = part<HTMLElement>('.lab-snackbar-timer');
  const count = part<HTMLElement>('.lab-snackbar-count');
  const ring = part<SVGCircleElement>('.lab-snackbar-ring');
  // Keep Lit's child-part markers and React's text node intact.
  const countText =
    [...count.childNodes].find((node) => node.nodeType === 3) ??
    count.appendChild(doc.createTextNode(''));
  const clock = view.performance;
  const paused = new Set<string>();
  let state: SnackbarState | undefined;
  let remaining = 0;
  let deadline = 0;
  let task: number | undefined;
  let disposed = false;
  let expired = false;
  let generation = 0;
  let motion: MotionScope | undefined;
  let disposeMaterial: (() => void) | undefined;
  let previousFocus: HTMLElement | null = null;
  let hadFocus = false;

  function restoreFocus(): void {
    const active = doc.activeElement;
    const root = panel.getRootNode();
    const host = 'host' in root ? (root as ShadowRoot).host : null;
    if (
      hadFocus &&
      (!active || active === doc.body || active === host || panel.matches(':focus-within')) &&
      previousFocus?.isConnected &&
      previousFocus.getClientRects().length &&
      !previousFocus.closest('[inert]')
    )
      previousFocus.focus({ preventScroll: true });
    hadFocus = false;
  }

  function cancelTask(): void {
    if (task !== undefined) view?.clearTimeout(task);
    task = undefined;
  }

  function tick(): void {
    cancelTask();
    if (disposed || !state?.open || expired) return;
    if (!paused.size) remaining = Math.max(0, deadline - clock.now());
    if (state.duration === 0) {
      timer.hidden = true;
      return;
    }
    timer.hidden = false;
    const seconds = Math.ceil(remaining / 1000);
    const pose = Math.min(5, Math.max(1, Math.ceil((remaining / state.duration) * 5)));
    countText.textContent = String(seconds);
    timer.toggleAttribute('data-warning', seconds <= snackbarProfile.timer.warningSeconds);
    ring.setAttribute(
      'stroke-dasharray',
      `${(snackbarProfile.timer.sweeps[5 - pose] ?? 0) / 360} 1`,
    );
    if (remaining <= 0) {
      expired = true;
      options.onTimeout();
      return;
    }
    if (!paused.size) {
      const untilSecond = remaining - (seconds - 1) * 1000;
      const untilPose = remaining - (pose - 1) * (state.duration / 5);
      task = view.setTimeout(tick, Math.max(1, Math.min(untilSecond, untilPose, remaining)));
    }
  }

  function pause(reason: string): void {
    if (paused.has(reason)) return;
    if (!paused.size && state?.open) remaining = Math.max(0, deadline - clock.now());
    paused.add(reason);
    cancelTask();
  }
  function resume(reason: string): void {
    if (!paused.delete(reason) || paused.size || !state?.open || expired) return;
    deadline = clock.now() + remaining;
    tick();
  }
  const pointerEnter = () => pause('pointer');
  const pointerLeave = () => resume('pointer');
  const focusIn = (event: FocusEvent) => {
    const from = event.relatedTarget as HTMLElement | null;
    if (!hadFocus && from && typeof from.focus === 'function' && !panel.contains(from))
      previousFocus = from;
    hadFocus = true;
    pause('focus');
  };
  const focusOut = () => {
    queueMicrotask(() => {
      if (!disposed && !panel.matches(':focus-within')) {
        hadFocus = false;
        resume('focus');
      }
    });
  };
  const visibility = () => {
    if (doc.hidden) pause('hidden');
    else resume('hidden');
  };
  panel.addEventListener('pointerenter', pointerEnter);
  panel.addEventListener('pointerleave', pointerLeave);
  panel.addEventListener('focusin', focusIn);
  panel.addEventListener('focusout', focusOut);
  doc.addEventListener('visibilitychange', visibility);
  visibility();

  return {
    update(next) {
      if (disposed) return;
      if (!Number.isFinite(next.duration) || next.duration < 0) {
        throw new RangeError('Snackbar duration must be finite and nonnegative');
      }
      const previous = state;
      // Lit properties live on accessors, not enumerable own fields.
      state = {
        open: next.open,
        message: next.message,
        duration: next.duration,
        notificationKey: next.notificationKey,
      };
      if (!next.open) {
        restoreFocus();
        generation++;
        cancelTask();
        announcement.textContent = '';
        motion?.dispose();
        motion = undefined;
        disposeMaterial?.();
        disposeMaterial = undefined;
        return;
      }
      if (
        previous?.open &&
        next.message === previous.message &&
        next.notificationKey === previous.notificationKey &&
        next.duration === previous.duration
      )
        return;
      expired = false;
      if (hadFocus && !panel.matches(':focus-within')) restoreFocus();
      remaining = next.duration;
      deadline = clock.now() + remaining;
      if (panel.matches(':hover')) paused.add('pointer');
      else paused.delete('pointer');
      if (panel.matches(':focus-within')) paused.add('focus');
      else paused.delete('focus');
      const current = ++generation;
      announcement.textContent = '';
      queueMicrotask(() => {
        if (!disposed && current === generation) announcement.textContent = next.message;
      });
      tick();
      try {
        disposeMaterial ??= mountMaterialRuntime(panel);
        if (!previous?.open) {
          motion ??= scope(panel);
          const entrance = motionSemanticRuntime.entrance;
          const style = view.getComputedStyle(panel);
          const durationCss = style.getPropertyValue('--lab-motion-entrance-duration').trim();
          const duration = durationCss
            ? Number.parseFloat(durationCss) * (durationCss.endsWith('ms') ? 1 : 1000)
            : entrance.durationMs;
          const easingCss = style.getPropertyValue('--lab-motion-entrance-easing').trim();
          const bezier = /^cubic-bezier\(([^)]+)\)$/.exec(easingCss);
          let ease: MotionEase = 'standard';
          if (bezier) {
            const values = (bezier[1] ?? '').split(',').map(Number);
            if (values.length !== 4 || !values.every(Number.isFinite))
              throw new TypeError('Invalid Snackbar easing');
            ease = values as [number, number, number, number];
          } else if (/^(linear|ease|ease-in|ease-out|ease-in-out)$/.test(easingCss)) {
            ease = easingCss as MotionEase;
          }
          const playback = motion.animate(
            panel,
            { y: [8, 0] },
            {
              duration,
              ease,
              reducedMotion: 'user',
            },
          );
          void playback.finished.catch((error: unknown) => {
            if (!disposed && current === generation) options.onError(error);
          });
        }
      } catch (error) {
        options.onError(error);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restoreFocus();
      generation++;
      cancelTask();
      panel.removeEventListener('pointerenter', pointerEnter);
      panel.removeEventListener('pointerleave', pointerLeave);
      panel.removeEventListener('focusin', focusIn);
      panel.removeEventListener('focusout', focusOut);
      doc.removeEventListener('visibilitychange', visibility);
      announcement.textContent = '';
      try {
        motion?.dispose();
      } finally {
        disposeMaterial?.();
      }
    },
  };
}
