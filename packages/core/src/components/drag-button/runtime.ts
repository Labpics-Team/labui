import { type Playback, scope } from '@labpics/motion';
import { motionSemanticRuntime } from '@labpics/ui-tokens';

export type LabDragButtonStatus = 'idle' | 'pending' | 'success' | 'danger';
export type LabDragButtonSource = 'drag' | 'press';
export interface DragButtonOptions {
  status: LabDragButtonStatus;
  disabled: boolean;
  resetKey: unknown;
  complete(source: LabDragButtonSource): void;
  size(pixels: number): void;
  change(status: LabDragButtonStatus): void;
}

/** One logical attempt survives listener teardown when the same control is reconnected. */
export class DragButtonAttempt {
  private controlledStatus: LabDragButtonStatus = 'idle';
  private resetKey: unknown;
  private committed = false;
  private resetVersion = 0;
  get status(): LabDragButtonStatus {
    return this.controlledStatus === 'idle' && this.committed ? 'pending' : this.controlledStatus;
  }
  get version(): number {
    return this.resetVersion;
  }
  update(status: LabDragButtonStatus, resetKey: unknown): void {
    if (resetKey !== this.resetKey || (this.controlledStatus !== 'idle' && status === 'idle')) {
      this.committed = false;
      this.resetVersion++;
    }
    this.controlledStatus = status;
    this.resetKey = resetKey;
  }
  commit(): void {
    this.committed = true;
  }
}

/** A button with an optional horizontal gesture. Native click owns keyboard and AT activation. */
export function mountDragButton(
  button: HTMLButtonElement,
  initial: DragButtonOptions,
  attempt = new DragButtonAttempt(),
) {
  let options = initial;
  attempt.update(initial.status, initial.resetKey);
  let attemptVersion = attempt.version;
  let disposed = false;
  let pointer:
    | { id: number; start: number; direction: number; travel: number; moved: boolean }
    | undefined;
  let progress = 0;
  let suppressClick = false;
  let playback: Playback | undefined;
  let motionGeneration = 0;
  const element = button.querySelector<HTMLElement>('.lab-drag-fill');
  if (!element) throw new Error('Drag Button requires its fill element');
  const fill = element;
  const motion = scope(button);
  const view = () => attempt.status;
  const blocked = () => options.disabled || button.matches(':disabled') || view() !== 'idle';
  function stopMotion() {
    motionGeneration++;
    playback?.stop();
    fill.style.removeProperty('width');
  }
  function paint(value: number) {
    progress = Math.max(0, Math.min(1, value));
    button.style.setProperty('--lab-drag-progress', String(progress));
    button.dataset.dragging = pointer?.moved ? '' : 'false';
  }
  function release() {
    const id = pointer?.id;
    pointer = undefined;
    button.dataset.dragging = 'false';
    if (id !== undefined && button.hasPointerCapture(id)) button.releasePointerCapture(id);
  }
  function cancel(animate = true) {
    const oldWidth = fill.getBoundingClientRect().width;
    suppressClick ||= !!pointer;
    release();
    stopMotion();
    paint(view() === 'idle' ? 0 : 1);
    if (!animate || view() !== 'idle' || oldWidth <= fill.getBoundingClientRect().width) return;
    try {
      playback = motion.animate(
        fill,
        { width: [oldWidth, fill.getBoundingClientRect().width] },
        {
          duration: motionSemanticRuntime.transition.durationMs,
          reducedMotion: 'user',
        },
      );
      const generation = motionGeneration;
      void playback.finished
        .then(() => {
          if (!disposed && generation === motionGeneration) {
            playback?.stop();
            fill.style.removeProperty('width');
          }
        })
        .catch((error: unknown) => {
          if (!disposed)
            button.dispatchEvent(
              new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
            );
        });
    } catch (error) {
      button.dispatchEvent(
        new CustomEvent('motion-error', { detail: { error }, bubbles: true, composed: true }),
      );
    }
  }
  function activate(source: LabDragButtonSource) {
    if (blocked()) return;
    attempt.commit(); // Before notifying consumers: synchronous/repeated events cannot submit twice.
    release();
    stopMotion();
    paint(1);
    options.change(view());
    options.complete(source);
  }
  const direction = () => (getComputedStyle(button).direction === 'rtl' ? -1 : 1);
  function down(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || pointer || blocked()) return;
    suppressClick = false;
    stopMotion();
    paint(0);
    const style = getComputedStyle(button);
    const inner =
      button.clientWidth -
      Number.parseFloat(style.paddingLeft) -
      Number.parseFloat(style.paddingRight);
    const travel = inner - fill.getBoundingClientRect().height;
    if (travel <= 0) return;
    pointer = {
      id: event.pointerId,
      start: event.clientX,
      direction: direction(),
      travel,
      moved: false,
    };
    button.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (blocked() || direction() !== pointer.direction) {
      cancel();
      return;
    }
    const delta = (event.clientX - pointer.start) * pointer.direction;
    pointer.moved ||= Math.abs(delta) > 4;
    if (pointer.moved) paint(delta / pointer.travel);
  }
  function up(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    move(event);
    if (!pointer) return;
    const moved = pointer.moved;
    suppressClick = moved;
    const bounds = button.getBoundingClientRect();
    const complete =
      moved && progress >= 1 && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    release();
    if (complete) activate('drag');
    else if (moved) cancel();
  }
  function click(event: MouseEvent) {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    if (pointer?.moved) {
      event.preventDefault();
      return;
    }
    activate('press');
  }
  function cancelled(event: PointerEvent) {
    if (pointer?.id === event.pointerId) cancel();
  }
  function key(event: KeyboardEvent) {
    if ((event.key === 'Escape' || event.key === 'Tab') && pointer) {
      if (event.key === 'Escape') event.preventDefault();
      cancel();
    }
  }
  function blur() {
    if (pointer) cancel();
  }
  // Safari blurs a keyboard-focused button on a normal mouse press. That is not a cancelled gesture.
  function controlBlur() {
    if (pointer?.moved) cancel();
  }
  function hidden() {
    if (button.ownerDocument.hidden) blur();
  }
  const controller = new AbortController();
  const listener = { signal: controller.signal };
  button.addEventListener('pointerdown', down, listener);
  button.addEventListener('pointermove', move, listener);
  button.addEventListener('pointerup', up, listener);
  button.addEventListener('pointercancel', cancelled, listener);
  button.addEventListener('lostpointercapture', cancelled, listener);
  button.addEventListener('click', click, listener);
  button.addEventListener('keydown', key, listener);
  button.addEventListener('blur', controlBlur, listener);
  button.ownerDocument.addEventListener('visibilitychange', hidden, listener);
  button.ownerDocument.defaultView?.addEventListener('blur', blur, listener);
  const measureIcon = () =>
    options.size(Number.parseFloat(getComputedStyle(button).fontSize) * 1.5);
  measureIcon();
  let size = button.getBoundingClientRect().width;
  const resize = new ResizeObserver(() => {
    measureIcon();
    const next = button.getBoundingClientRect().width;
    if (next !== size && pointer) cancel(false);
    size = next;
  });
  resize.observe(button);
  paint(view() === 'idle' ? 0 : 1);
  return {
    update(next: DragButtonOptions) {
      attempt.update(next.status, next.resetKey);
      const reset = attempt.version !== attemptVersion;
      attemptVersion = attempt.version;
      options = next;
      if (reset || blocked()) cancel(false);
      options.change(view());
    },
    dispose() {
      disposed = true;
      release();
      controller.abort();
      resize.disconnect();
      stopMotion();
      motion.dispose();
    },
  };
}
