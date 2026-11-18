import { scope } from '@labpics/motion';
import { motionSemanticRuntime, motionSpringRuntime } from '@labpics/ui-tokens';
export { switchAppearance } from './contract.js';

export interface SwitchMotion {
  update(): void;
  dispose(): void;
}

/** Native HTML owns activation. Motion owns only the visible pose and its interruption. */
export function mountSwitchMotion(root: HTMLElement, input: HTMLInputElement): SwitchMotion {
  const currentView = root.ownerDocument.defaultView;
  if (!currentView) throw new Error('Switch requires a document window');
  const view = currentView;
  const motion = scope(root);
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let hovered = false;
  let pointerPressed = false;
  let keyPressed = false;
  let last = '';
  let first = true;
  let generation = 0;

  function update(): void {
    if (disposed) return;
    const disabled = input.matches(':disabled');
    const pressed = pointerPressed || keyPressed;
    root.toggleAttribute('data-hovered', hovered && !pressed && !disabled);
    root.toggleAttribute('data-pressed', pressed && !disabled);
    const style = view.getComputedStyle(root);
    const progress = input.checked ? 1 : 0;
    const inset = Number(style.getPropertyValue('--_switch-padding'));
    const duration = style.getPropertyValue('--lab-motion-transition-duration').trim();
    const ms = duration
      ? Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000)
      : motionSemanticRuntime.transition.durationMs;
    const target = `${progress}/${inset}/${ms}/${reduced.matches}`;
    if (target === last) return;
    last = target;
    const current = ++generation;
    try {
      if (first) {
        root.style.setProperty('--_switch-progress', String(progress));
        root.style.setProperty('--_switch-inset', String(inset));
        first = false;
        return;
      }
      const spring = motionSpringRuntime.smooth;
      const playback = motion.animate(
        root,
        {
          '--_switch-progress': progress,
          '--_switch-inset': inset,
        },
        {
          spring: {
            response:
              spring.response * (ms > 0 ? ms / motionSemanticRuntime.transition.durationMs : 1),
            bounce: spring.bounce,
          },
          reducedMotion: reduced.matches || ms === 0 ? 'always' : 'user',
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
  motion.on(root, 'pointerenter', (event) => {
    if (event.pointerType !== 'touch') hovered = true;
    update();
  });
  motion.on(root, 'pointerleave', () => {
    hovered = false;
    pointerPressed = false;
    update();
  });
  motion.on(root, 'pointerdown', (event) => {
    if (event.isPrimary && event.button === 0) pointerPressed = true;
    update();
  });
  motion.on(view, 'pointerup', () => {
    if (pointerPressed) {
      pointerPressed = false;
      update();
    }
  });
  motion.on(view, 'pointercancel', () => {
    if (pointerPressed) {
      pointerPressed = false;
      update();
    }
  });
  motion.on(input, 'keydown', (event) => {
    if (event.key === ' ') {
      keyPressed = true;
      update();
    }
  });
  motion.on(input, 'keyup', (event) => {
    if (event.key === ' ') {
      keyPressed = false;
      update();
    }
  });
  motion.on(input, 'blur', () => {
    // Clicking a label can temporarily blur its already-focused input. The
    // pointer is still held, so only the keyboard press is canceled by blur.
    keyPressed = false;
    update();
  });
  motion.on(view, 'blur', () => {
    pointerPressed = false;
    keyPressed = false;
    hovered = false;
    update();
  });
  motion.on(reduced, 'change', update);
  root.setAttribute('data-lab-motion', '');
  update();

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    generation++;
    motion.dispose();
    root.style.removeProperty('--_switch-progress');
    root.style.removeProperty('--_switch-inset');
    root.removeAttribute('data-hovered');
    root.removeAttribute('data-pressed');
    root.removeAttribute('data-lab-motion');
  }
  return { update, dispose };
}
