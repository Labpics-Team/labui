import {
  type SliderInput,
  type SliderState,
  circularSliderFraction,
  replaceSliderValue,
  sameSliderValues,
  sliderArc,
  sliderBounds,
  sliderFraction,
  sliderThumbStyle,
} from './contract.js';
export * from './contract.js';

export interface SliderRuntimeInput extends SliderInput {
  dir?: 'ltr' | 'rtl';
  onValueChange(values: number[]): void;
  onValueChangeEnd(values: number[]): void;
  onUpdate?(): void;
}
export interface SliderRuntime {
  update(): void;
  reset(): void;
  dispose(): void;
}

/** Native range inputs own keyboard, form and assistive input. This shared pointer
 * adapter projects the three authored geometries, without a render-loop or DOM rebuild. */
export function mountSlider(
  root: HTMLElement,
  state: SliderState,
  getInput: () => SliderRuntimeInput,
): SliderRuntime {
  const controlElement = root.querySelector<HTMLElement>('.lab-slider-control');
  const inputs = () => Array.from(root.querySelectorAll<HTMLInputElement>('input[type=range]'));
  const window = root.ownerDocument.defaultView;
  if (!controlElement || !window) throw new Error('Slider runtime requires its mounted control');
  const control = controlElement;
  const view = window;
  const removers: Array<() => void> = [];
  let disposed = false;
  let lastIndex = 0;
  let keyboardDraft = false;
  // Declarative-shadow and React hydration retain the actual native input nodes.
  // Adopt edits made before hydration only for an uncontrolled field.
  const mountedInput = getInput();
  if (mountedInput.value == null && inputs().length)
    state.accept(
      mountedInput,
      inputs().map((native) => native.valueAsNumber),
    );
  let committed = state.values(mountedInput);
  let gesture:
    | {
        id: number;
        index: number;
        start: number[];
        bounds: DOMRect;
        startPoint: number;
        startFraction: number;
        previousFraction: number;
        angleOffset: number;
        direct: boolean;
        thumbHalf: number;
      }
    | undefined;
  const listen = (target: EventTarget, name: string, fn: EventListener, capture = false) => {
    target.addEventListener(name, fn, capture);
    removers.push(() => target.removeEventListener(name, fn, capture));
  };
  const disabled = () => !!getInput().disabled || !!inputs()[0]?.matches(':disabled');
  const editable = () => !disabled() && !getInput().readOnly;
  const rtl = () => (getInput().dir ?? view.getComputedStyle(root).direction) === 'rtl';

  function update(): void {
    if (disposed) return;
    const input = getInput();
    const values = state.values(input);
    const fractions = values.map((value) => sliderFraction(value, input));
    const variant = input.variant ?? 'linear';
    const vertical = input.orientation === 'vertical';
    const limits = sliderBounds(input);
    const low = values.length === 2 ? (fractions[0] ?? 0) : 0;
    const high = fractions.at(-1) ?? 0;
    root.style.setProperty('--_slider-start', `${low * 100}%`);
    root.style.setProperty('--_slider-end', `${high * 100}%`);
    root.toggleAttribute('data-disabled', disabled());
    root.toggleAttribute('data-readonly', !!input.readOnly);
    root.toggleAttribute('data-empty', high === 0);
    root.querySelector('.lab-slider-arc')?.setAttribute('d', sliderArc(low, high));
    inputs().forEach((native, index) => {
      native.min = String(index ? values[index - 1] : limits.min);
      native.max = String(index < values.length - 1 ? values[index + 1] : limits.max);
      native.step = String(limits.step);
      native.value = String(values[index]);
      const thumb = native.parentElement;
      if (!thumb) return;
      thumb.style.cssText = sliderThumbStyle(fractions[index] ?? 0, variant, vertical);
    });
    const text = root.querySelector('.lab-slider-value-text');
    if (text) text.textContent = values.join(' – ');
    input.onUpdate?.();
    if (gesture && !editable()) cancel();
  }

  function request(index: number, value: number): void {
    const input = getInput();
    const current = state.values(input);
    const next = replaceSliderValue(current, index, value, input);
    if (!sameSliderValues(current, next)) {
      state.accept(input, next);
      input.onValueChange(next);
    }
    update(); // Restore a rejected controlled native input immediately.
  }
  function finish(): void {
    const current = state.values(getInput());
    if (!sameSliderValues(committed, current)) getInput().onValueChangeEnd(current);
    committed = current;
  }
  function release(): void {
    const previous = gesture;
    gesture = undefined;
    root.removeAttribute('data-dragging');
    if (previous && control.hasPointerCapture(previous.id))
      control.releasePointerCapture(previous.id);
  }
  function cancel(): void {
    if (!gesture) return;
    const original = gesture.start;
    release();
    const input = getInput();
    if (!sameSliderValues(state.values(input), original)) {
      state.accept(input, original);
      input.onValueChange(original);
    }
    committed = state.values(input);
    update();
  }
  function move(event: PointerEvent): void {
    const active = gesture;
    if (!active || event.pointerId !== active.id || !editable()) return;
    const input = getInput();
    const vertical = input.orientation === 'vertical';
    let fraction: number;
    if (input.variant === 'circular') {
      const angle = circularSliderFraction(
        event.clientX - active.bounds.left - active.bounds.width / 2,
        event.clientY - active.bounds.top - active.bounds.height / 2,
      );
      if (angle === undefined) return;
      const adjusted = angle + active.angleOffset;
      fraction = Math.max(
        0,
        Math.min(1, adjusted + Math.round(active.previousFraction - adjusted)),
      );
      active.previousFraction = fraction;
    } else {
      const point = vertical
        ? active.bounds.bottom - event.clientY
        : rtl()
          ? active.bounds.right - event.clientX
          : event.clientX - active.bounds.left;
      const length = vertical ? active.bounds.height : active.bounds.width;
      if (length <= 0) return;
      fraction = active.direct
        ? active.startFraction + (point - active.startPoint) / length
        : input.variant === 'large'
          ? point / length
          : point <= active.thumbHalf
            ? 0
            : (point + active.thumbHalf) / length;
    }
    const bounds = sliderBounds(input);
    request(
      active.index,
      bounds.min + Math.max(0, Math.min(1, fraction)) * (bounds.max - bounds.min),
    );
  }
  listen(control, 'pointerdown', ((event: PointerEvent) => {
    if (gesture || !event.isPrimary || event.button !== 0 || !editable()) return;
    const input = getInput();
    const values = state.values(input);
    const fractions = values.map((value) => sliderFraction(value, input));
    const bounds = control.getBoundingClientRect();
    const target = (event.target as Element).closest<HTMLElement>('[data-thumb-index]');
    const direct = !!target;
    const vertical = input.orientation === 'vertical';
    const point = vertical
      ? bounds.bottom - event.clientY
      : rtl()
        ? bounds.right - event.clientX
        : event.clientX - bounds.left;
    const angle = circularSliderFraction(
      event.clientX - bounds.left - bounds.width / 2,
      event.clientY - bounds.top - bounds.height / 2,
    );
    if (input.variant === 'circular' && angle === undefined) return;
    const pointFraction =
      input.variant === 'circular'
        ? (angle ?? 0)
        : point / (vertical ? bounds.height : bounds.width);
    let index = target ? Number(target.dataset.thumbIndex) : lastIndex;
    if (!direct) {
      let distance = Number.POSITIVE_INFINITY;
      fractions.forEach((fraction, i) => {
        const difference = Math.abs(fraction - pointFraction);
        const next =
          input.variant === 'circular' ? Math.min(difference, 1 - difference) : difference;
        if (next < distance || (next === distance && i === lastIndex)) {
          distance = next;
          index = i;
        }
      });
    }
    lastIndex = index;
    event.preventDefault();
    inputs()[index]?.focus({ preventScroll: true });
    committed = values;
    gesture = {
      id: event.pointerId,
      index,
      start: values,
      bounds,
      startPoint: point,
      startFraction: fractions[index] ?? 0,
      previousFraction: fractions[index] ?? 0,
      angleOffset:
        direct && input.variant === 'circular' ? (fractions[index] ?? 0) - (angle ?? 0) : 0,
      direct,
      thumbHalf: (inputs()[index]?.parentElement?.getBoundingClientRect().width ?? 0) / 2,
    };
    root.setAttribute('data-dragging', '');
    control.setPointerCapture(event.pointerId);
    if (!direct) move(event);
  }) as EventListener);
  listen(control, 'pointermove', ((event: PointerEvent) => move(event)) as EventListener);
  listen(control, 'pointerup', ((event: PointerEvent) => {
    if (gesture?.id !== event.pointerId) return;
    move(event);
    release();
    finish();
  }) as EventListener);
  listen(control, 'pointercancel', ((event: PointerEvent) => {
    if (gesture?.id === event.pointerId) cancel();
  }) as EventListener);
  listen(control, 'lostpointercapture', ((event: PointerEvent) => {
    if (gesture?.id === event.pointerId) cancel();
  }) as EventListener);
  listen(root, 'keydown', ((event: KeyboardEvent) => {
    if (event.key === 'Escape' && gesture) {
      event.preventDefault();
      cancel();
    } else if (!editable() && /^(Arrow|Home$|End$|Page)/.test(event.key)) event.preventDefault();
    // Browser range implementations disagree on RTL arrow direction. Mirror the
    // authored horizontal scale consistently; native input still owns focus/AT.
    else if (
      rtl() &&
      getInput().variant !== 'circular' &&
      getInput().orientation !== 'vertical' &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      const native = event.target as HTMLInputElement;
      if (native.type !== 'range') return;
      event.preventDefault();
      keyboardDraft = true;
      const index = Number(native.parentElement?.dataset.thumbIndex);
      request(
        index,
        (state.values(getInput())[index] ?? sliderBounds(getInput()).min) +
          sliderBounds(getInput()).step * (event.key === 'ArrowLeft' ? 1 : -1),
      );
    }
  }) as EventListener);
  listen(root, 'keyup', ((event: KeyboardEvent) => {
    if (keyboardDraft && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      keyboardDraft = false;
      finish();
    }
  }) as EventListener);
  listen(root, 'input', ((event: Event) => {
    const native = event.target as HTMLInputElement;
    if (native.type !== 'range') return;
    event.stopPropagation();
    if (editable()) request(Number(native.parentElement?.dataset.thumbIndex), native.valueAsNumber);
    else update();
  }) as EventListener);
  listen(root, 'change', ((event: Event) => {
    if ((event.target as HTMLInputElement).type === 'range') {
      event.stopPropagation();
      finish();
    }
  }) as EventListener);
  listen(view, 'blur', (() => cancel()) as EventListener);
  listen(root, 'focusin', ((event: Event) => {
    const index = Number((event.target as HTMLElement).parentElement?.dataset.thumbIndex);
    if (Number.isInteger(index)) lastIndex = index;
    committed = state.values(getInput());
  }) as EventListener);
  const resetTasks = new Set<ReturnType<typeof setTimeout>>();
  listen(
    root.ownerDocument,
    'reset',
    ((event: Event) => {
      if (!inputs().some((native) => native.form === event.target)) return;
      const task = setTimeout(() => {
        resetTasks.delete(task);
        if (!disposed && !event.defaultPrevented && root.isConnected) reset();
      }, 0);
      resetTasks.add(task);
    }) as EventListener,
    true,
  );
  // Native :disabled includes every disabled fieldset and its first-legend exception.
  const observer = new view.MutationObserver(update);
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement)
    if (ancestor.tagName === 'FIELDSET')
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ['disabled'],
        childList: true,
      });

  function reset(): void {
    release();
    state.reset(getInput());
    committed = state.values(getInput());
    update();
  }
  update();
  return {
    update,
    reset,
    dispose() {
      if (disposed) return;
      // Detach ends tracking, while the component's value state survives reparenting.
      release();
      disposed = true;
      observer.disconnect();
      for (const remove of removers) remove();
      for (const task of resetTasks) clearTimeout(task);
    },
  };
}
