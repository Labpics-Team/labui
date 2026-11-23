import { mountMaterialRuntime, mountSurfaceShape } from '@labpics/ui-materials';
import { colorPickerProfile } from '@labpics/ui-tokens';
import {
  type ColorPickerInput,
  type ColorPickerState,
  type ColorPlane,
  type LabColorModel,
  type LabColorPickerVariant,
  type LabColorValue,
  colorChannelText,
  colorChannels,
  colorCoords,
  colorCss,
  colorDisplay,
  colorEditable,
  colorHex,
  colorModelSpace,
  colorPalette,
  colorPlaneAxes,
  colorTrackInset,
  copyColor,
  defaultColor,
  displayNumber,
  editColorChannel,
  editColorPlane,
  parseColor,
  parseColorChannelText,
  parseColorEdit,
  sameColor,
  serializeColor,
} from './contract.js';
import { mountColorGraphs } from './graphs.js';
export * from './contract.js';
export * from './icons.js';
export interface ColorPickerRuntimeInput extends ColorPickerInput {
  pickScreenColor?: (signal: AbortSignal) => Promise<LabColorValue | null>;
  onValueChange(value: LabColorValue | null): void;
  onValueChangeEnd(value: LabColorValue | null): void;
  onVariantChange?(value: LabColorPickerVariant): void;
  onModelChange?(value: LabColorModel): void;
  onClose?(): void;
  onUpdate(): void;
  onFormValue?(value: string, missing: boolean): void;
}
export function mountColorPicker(
  root: HTMLElement,
  state: ColorPickerState,
  getInput: () => ColorPickerRuntimeInput,
) {
  const browserView = root.ownerDocument.defaultView;
  if (!browserView) throw new Error('ColorPicker requires a browser document');
  const view = browserView;
  const removers: Array<() => void> = [];
  const shape = mountSurfaceShape(root, { smoothing: colorPickerProfile.cornerSmoothing });
  const material = mountMaterialRuntime(root);
  const graphs = mountColorGraphs(root);
  let disposed = false;
  let composing: HTMLInputElement | undefined;
  const dirty = new WeakSet<HTMLInputElement>();
  let gesture:
    | {
        id: number;
        start: LabColorValue | null;
        target: HTMLElement;
        plane?: ColorPlane;
        channel?: string;
        grab?: { x: number; y: number; valueX: number; valueY: number };
        lastX?: number;
        lastY?: number;
      }
    | undefined;
  let editStart: LabColorValue | null | undefined;
  const listen = (target: EventTarget, event: string, callback: EventListener, capture = false) => {
    target.addEventListener(event, callback, capture);
    removers.push(() => target.removeEventListener(event, callback, capture));
  };
  const value = () => state.value(getInput());
  const current = () => value() ?? defaultColor;
  const disabled = () =>
    !!getInput().disabled || !!root.querySelector('input')?.matches(':disabled');
  const editable = () => !disabled() && !getInput().readOnly;
  let observedValue = value();
  observedValue = observedValue && copyColor(observedValue);
  let sampling: AbortController | undefined;
  let observedModel = state.view(getInput()).model;
  function invalidateSampling() {
    sampling?.abort();
    sampling = undefined;
  }
  function update() {
    if (disposed) return;
    const input = getInput();
    const accepted = value();
    if (!editable() || !sameColor(observedValue, accepted)) invalidateSampling();
    observedValue = accepted && copyColor(accepted);
    const color = accepted ?? defaultColor;
    const { model, variant } = state.view(input);
    const changedModel = model !== observedModel;
    observedModel = model;
    if (changedModel) composing = undefined;
    root.toggleAttribute('data-disabled', disabled());
    root.toggleAttribute('data-readonly', !!input.readOnly);
    root.toggleAttribute('data-empty', !accepted);
    const picker = root.querySelector<HTMLButtonElement>('[data-action=eyedropper]');
    if (picker)
      picker.disabled = !editable() || (!getInput().pickScreenColor && !('EyeDropper' in view));
    const channels = colorChannels(color, model, variant, state.showRec2020);
    for (const field of root.querySelectorAll<HTMLInputElement>('input[data-channel]')) {
      if (
        field === composing ||
        ((root.getRootNode() as Document | ShadowRoot).activeElement === field &&
          field.type !== 'range')
      )
        continue;
      const channel = channels.find((c) => c.key === field.dataset.channel);
      if (channel)
        field.value = field.type === 'range' ? String(channel.value) : colorChannelText(channel);
    }
    for (const field of root.querySelectorAll<HTMLInputElement>(
      'input[data-color-text],input[data-coordinate]',
    )) {
      const focused = (root.getRootNode() as Document | ShadowRoot).activeElement === field;
      if (changedModel) {
        dirty.delete(field);
        reconcileText(field, focused);
      } else if (field !== composing && !focused) reconcileText(field);
    }
    for (const field of root.querySelectorAll<HTMLInputElement>('input[data-axis]')) {
      const surface = field.closest<HTMLElement>('[data-plane]');
      if (!surface) continue;
      const plane = surface.dataset.plane as ColorPlane;
      const axes = colorPlaneAxes(color, plane, state.showRec2020);
      field.value = String(field.dataset.axis === 'x' ? axes.x : axes.y);
    }
    const hidden = root.querySelector<HTMLInputElement>('[data-form-value]');
    const text = serializeColor(accepted);
    if (hidden) hidden.value = text;
    const validity = root.querySelector<HTMLInputElement>('[data-validity]');
    if (validity) {
      validity.value = text;
      validity.setCustomValidity(
        input.required && !accepted && !input.readOnly ? 'Choose a color.' : '',
      );
    }
    getInput().onFormValue?.(text, !!input.required && !accepted && !input.readOnly);
    graphs.update(color, state.showP3, state.showRec2020);
    shape.refresh();
  }
  function refresh() {
    if (disposed) return;
    getInput().onUpdate();
    queueMicrotask(update);
  }
  function request(next: LabColorValue | null) {
    invalidateSampling();
    if (!editable() || sameColor(next, value())) return;
    state.accept(getInput(), next);
    getInput().onValueChange(next);
    refresh();
  }
  function finish(start: LabColorValue | null | undefined, expected?: LabColorValue | null) {
    // Allow the consumer/framework's controlled update to settle before reading acceptance.
    queueMicrotask(() => {
      if (!disposed) {
        update();
        const accepted = value();
        if (
          start !== undefined &&
          !sameColor(start, accepted) &&
          (expected === undefined || sameColor(expected, accepted))
        )
          getInput().onValueChangeEnd(accepted);
      }
    });
  }
  function commitText(field: HTMLInputElement) {
    if (!editable() || field === composing || !dirty.has(field)) return;
    dirty.delete(field);
    const before = value();
    const { model, variant } = state.view(getInput());
    if (field.dataset.channel) {
      const channel = colorChannels(current(), model, variant, state.showRec2020).find(
        (c) => c.key === field.dataset.channel,
      );
      const number = channel ? parseColorChannelText(field.value, channel) : Number.NaN;
      if (channel && field.value.trim() && Number.isFinite(number))
        request(editColorChannel(current(), channel, number));
    } else if (field.hasAttribute('data-color-text')) {
      const parsed = parseColorEdit(field.value, current().alpha);
      if (parsed) request(parsed);
      else if (!field.value.trim()) request(null);
    } else if (field.dataset.coordinate) {
      const index = Number(field.dataset.coordinate) - 1;
      const number = Number(field.value.trim().replace(/[°%]$/, ''));
      if (field.value.trim() && Number.isFinite(number)) {
        const channel = colorChannels(current(), model, 'sliders', state.showRec2020)[index];
        if (channel) request(editColorChannel(current(), channel, number));
      }
    }
    queueMicrotask(() => {
      reconcileText(field, (root.getRootNode() as Document | ShadowRoot).activeElement === field);
      finish(before);
    });
  }
  function reconcileText(field: HTMLInputElement, exact = false) {
    const { model, variant } = state.view(getInput());
    if (field.hasAttribute('data-color-text'))
      field.value = value() ? (exact ? colorEditable : colorDisplay)(current(), model) : '';
    else if (field.dataset.coordinate) {
      const channel = colorChannels(current(), model, 'sliders', state.showRec2020)[
        Number(field.dataset.coordinate) - 1
      ];
      if (channel) field.value = exact ? String(channel.value) : displayNumber(channel.value);
    } else {
      const channel = colorChannels(current(), model, variant, state.showRec2020).find(
        (c) => c.key === field.dataset.channel,
      );
      if (channel) field.value = colorChannelText(channel, exact);
    }
  }
  listen(root, 'compositionstart', (event) => {
    composing = event.target as HTMLInputElement;
  });
  listen(root, 'compositionend', (event) => {
    const field = event.target as HTMLInputElement;
    composing = undefined;
    if (
      root.ownerDocument.activeElement !== field &&
      (root.getRootNode() as ShadowRoot).activeElement !== field
    )
      commitText(field);
  });
  const textSelector =
    'input[data-channel]:not([type=range]),input[data-color-text],input[data-coordinate]';
  listen(root, 'focusin', (event) => {
    const field = event.target as HTMLInputElement;
    if (field.matches('input')) editStart = value();
    if (field.matches(textSelector)) reconcileText(field, true);
  });
  listen(root, 'focusout', (event) => {
    const field = event.target as HTMLInputElement;
    if (field.matches(textSelector)) {
      commitText(field);
      if (field !== composing) reconcileText(field);
    }
  });
  listen(root, 'input', (event) => {
    const field = event.target as HTMLInputElement;
    if (
      field.matches(
        'input[data-color-text],input[data-coordinate],input[data-channel]:not([type=range])',
      )
    )
      dirty.add(field);
    if (!editable()) {
      update();
      return;
    }
    invalidateSampling();
    if (field.matches('input[type=range][data-channel]')) {
      const { model, variant } = state.view(getInput());
      const channel = colorChannels(current(), model, variant, state.showRec2020).find(
        (c) => c.key === field.dataset.channel,
      );
      if (channel) request(editColorChannel(current(), channel, field.valueAsNumber));
    } else if (field.dataset.axis) {
      const surface = field.closest<HTMLElement>('[data-plane]');
      if (!surface) return;
      const plane = surface.dataset.plane as ColorPlane;
      const axes = colorPlaneAxes(current(), plane, state.showRec2020);
      request(
        editColorPlane(
          current(),
          plane,
          field.dataset.axis === 'x' ? field.valueAsNumber / axes.xMax : axes.x / axes.xMax,
          field.dataset.axis === 'y' ? field.valueAsNumber / axes.yMax : axes.y / axes.yMax,
          state.showRec2020,
        ),
      );
    }
  });
  listen(root, 'change', (event) => {
    const field = event.target as HTMLInputElement;
    if (field.matches('input[type=range]') && !gesture) {
      finish(editStart);
      editStart = value();
    }
  });
  const cancel = () => {
    if (!gesture) return;
    const previous = gesture;
    gesture = undefined;
    if (previous.target.hasPointerCapture(previous.id))
      previous.target.releasePointerCapture(previous.id);
    request(previous.start);
    refresh();
  };
  listen(root, 'keydown', (event) => {
    const key = event as KeyboardEvent;
    const field = event.target as HTMLInputElement;
    if (key.key === 'Escape') {
      key.preventDefault();
      if (gesture) cancel();
      else if (field.matches('input') && field.type !== 'range') {
        dirty.delete(field);
        reconcileText(field, true);
      } else getInput().onClose?.();
    } else if (
      key.key === 'Enter' &&
      field.matches(
        'input[data-channel]:not([type=range]),input[data-color-text],input[data-coordinate]',
      )
    ) {
      key.preventDefault();
      commitText(field);
    } else if (key.key.startsWith('Arrow') && field.matches('[data-swatch]')) {
      key.preventDefault();
      const index = Number(field.dataset.swatch);
      const palette = colorPalette(state.view(getInput()).model);
      const delta =
        key.key === 'ArrowRight'
          ? 1
          : key.key === 'ArrowLeft'
            ? -1
            : key.key === 'ArrowDown'
              ? palette.columns
              : -palette.columns;
      const next = Math.max(0, Math.min(palette.colors.length - 1, index + delta));
      root.querySelector<HTMLButtonElement>(`[data-swatch="${next}"]`)?.focus();
      selectSwatch(next);
    }
  });
  function selectSwatch(index: number) {
    const before = value();
    const swatch = colorPalette(state.view(getInput()).model).colors[index];
    if (swatch) request({ ...swatch, alpha: current().alpha });
    finish(before);
  }
  const point = (event: PointerEvent) => {
    if (!gesture || (gesture.lastX === event.clientX && gesture.lastY === event.clientY)) return;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    const rect = gesture.target.getBoundingClientRect();
    const grab = gesture.grab;
    if (gesture.plane) {
      const x = grab
        ? grab.valueX + (event.clientX - grab.x) / rect.width
        : (event.clientX - rect.left) / rect.width;
      const y = grab
        ? grab.valueY - (event.clientY - grab.y) / rect.height
        : 1 - (event.clientY - rect.top) / rect.height;
      request(editColorPlane(current(), gesture.plane, x, y, state.showRec2020));
    } else if (gesture.channel) {
      const { model, variant } = state.view(getInput());
      const channel = colorChannels(current(), model, variant, state.showRec2020).find(
        (c) => c.key === gesture?.channel,
      );
      if (!channel) return;
      const inset =
        (colorTrackInset * Number.parseFloat(view.getComputedStyle(root).fontSize)) / 16;
      const span = Math.max(1, rect.width - 2 * inset);
      const fraction = grab
        ? grab.valueX + (event.clientX - grab.x) / span
        : (event.clientX - rect.left - inset) / span;
      request(editColorChannel(current(), channel, fraction * channel.max));
    }
  };
  listen(root, 'pointerdown', (event) => {
    const pointer = event as PointerEvent;
    if (!editable() || pointer.button !== 0) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-plane],input[type=range]',
    );
    if (!target || (target instanceof HTMLInputElement && target.dataset.axis)) return;
    gesture = {
      id: pointer.pointerId,
      start: value(),
      target,
      plane: target.dataset.plane as ColorPlane | undefined,
      channel: target.dataset.channel,
    };
    pointer.preventDefault();
    target.setPointerCapture(pointer.pointerId);
    (gesture.plane ? target.querySelector<HTMLInputElement>('input') : target)?.focus({
      preventScroll: true,
    });
    const marker = (
      gesture.plane
        ? target.querySelector('.lab-color-marker')
        : target.parentElement?.querySelector('.lab-color-channel-thumb')
    )?.getBoundingClientRect();
    if (
      marker &&
      Math.hypot(
        pointer.clientX - marker.x - marker.width / 2,
        pointer.clientY - marker.y - marker.height / 2,
      ) <=
        marker.width / 2
    ) {
      const axes = gesture.plane
        ? colorPlaneAxes(current(), gesture.plane, state.showRec2020)
        : undefined;
      const { model, variant } = state.view(getInput());
      const channel = gesture.channel
        ? colorChannels(current(), model, variant, state.showRec2020).find(
            (c) => c.key === gesture?.channel,
          )
        : undefined;
      gesture.grab = {
        x: pointer.clientX,
        y: pointer.clientY,
        valueX: axes ? axes.x / axes.xMax : channel ? channel.value / channel.max : 0,
        valueY: axes ? axes.y / axes.yMax : 0,
      };
      gesture.lastX = pointer.clientX;
      gesture.lastY = pointer.clientY;
    } else point(pointer);
  });
  listen(root, 'pointermove', (event) => {
    if ((event as PointerEvent).pointerId === gesture?.id) point(event as PointerEvent);
  });
  listen(view, 'pointerup', (event) => {
    if ((event as PointerEvent).pointerId !== gesture?.id) return;
    point(event as PointerEvent);
    const start = gesture.start;
    gesture = undefined;
    finish(start);
  });
  listen(root, 'pointercancel', cancel);
  listen(root, 'lostpointercapture', (event) => {
    if ((event as PointerEvent).pointerId === gesture?.id) cancel();
  });
  listen(root, 'click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-action],[data-swatch]',
    );
    if (!target) return;
    if (target.dataset.swatch) {
      selectSwatch(Number(target.dataset.swatch));
      return;
    }
    if (target.dataset.action === 'close') {
      getInput().onClose?.();
      return;
    }
    if (target.dataset.action === 'copy') {
      const model = state.view(getInput()).model;
      const copy =
        model === 'hex'
          ? colorHex(current())
          : colorCss({
              space: colorModelSpace(model),
              coords: colorCoords(current(), colorModelSpace(model)),
              alpha: current().alpha,
            });
      view.navigator.clipboard
        ?.writeText(copy)
        .then(() => {
          state.status = 'Color copied';
          refresh();
        })
        .catch(() => {
          state.status = 'Could not copy color';
          refresh();
        });
    }
    if (target.dataset.action === 'eyedropper' && editable()) {
      type EyeDropper = { open(options: { signal: AbortSignal }): Promise<{ sRGBHex: string }> };
      const Constructor = (view as unknown as { EyeDropper?: new () => EyeDropper }).EyeDropper;
      const before = value();
      const custom = getInput().pickScreenColor;
      if (!Constructor && !custom) return;
      invalidateSampling();
      const operation = new AbortController();
      sampling = operation;
      // Invoke synchronously to retain EyeDropper's transient user activation.
      try {
        const result = custom
          ? custom(operation.signal)
          : Constructor
            ? new Constructor()
                .open({ signal: operation.signal })
                .then((result) => parseColor(result.sRGBHex))
            : Promise.resolve(null);
        Promise.resolve(result)
          .then((next) => {
            if (disposed) return;
            update();
            if (sampling !== operation || operation.signal.aborted) return;
            sampling = undefined;
            if (!next) return;
            const selected = { ...next, alpha: current().alpha };
            request(selected);
            finish(before, selected);
          })
          .catch(() => {
            if (sampling === operation) sampling = undefined;
          });
      } catch {
        if (sampling === operation) sampling = undefined;
      }
    }
  });
  listen(
    root.ownerDocument,
    'reset',
    (event) => {
      const field = root.querySelector<HTMLInputElement>('[data-form-value]');
      if (field?.form !== event.target) return;
      invalidateSampling();
      setTimeout(() => {
        if (!disposed && !event.defaultPrevented) {
          gesture = undefined;
          composing = undefined;
          state.reset(getInput());
          refresh();
        }
      });
    },
    true,
  );
  function setModel(model: LabColorModel) {
    state.model = model;
    getInput().onModelChange?.(model);
    refresh();
  }
  function setVariant(variant: LabColorPickerVariant) {
    state.variant = variant;
    getInput().onVariantChange?.(variant);
    refresh();
  }
  update();
  return {
    update,
    setModel,
    setVariant,
    toggle(key: 'showGraphs' | 'showP3' | 'showRec2020', checked: boolean) {
      state[key] = checked;
      refresh();
    },
    reset() {
      invalidateSampling();
      gesture = undefined;
      composing = undefined;
      state.reset(getInput());
      refresh();
    },
    dispose() {
      invalidateSampling();
      disposed = true;
      for (const remove of removers) remove();
      graphs.dispose();
      material();
      shape.destroy();
    },
  };
}
export type ColorPickerRuntime = ReturnType<typeof mountColorPicker>;
