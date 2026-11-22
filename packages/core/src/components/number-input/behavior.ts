import { getNativeEvent } from '@zag-js/dom-query';
import * as numberInput from '@zag-js/number-input';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { numberInputValidity } from './validity.js';

export { numberInputValidity } from './validity.js';

const composing = new WeakSet<EventTarget>();
const blurTransition = numberInput.machine.states.focused.on?.['INPUT.BLUR'];
const commitTransitions = (Array.isArray(blurTransition) ? blurTransition : [blurTransition])
  .filter((transition) => transition !== undefined)
  .map((transition) => ({ ...transition, target: undefined }));

/** Native reset is cancellable at every ancestor. The machine owns parsing,
 * stepping and accepted values; this effect only observes the real form lifetime. */
export const numberInputBehavior: MachineModule<SchemaOf<numberInput.Service>, numberInput.Api> = {
  ...numberInput,
  connect(service, normalize) {
    const validity = numberInputValidity({
      value: service.context.get('value'),
      valueAsNumber: service.computed('valueAsNumber'),
      min: service.prop('min'),
      max: service.prop('max'),
      required: service.prop('required'),
      invalid: service.prop('invalid'),
      disabled: service.computed('isDisabled'),
      readOnly: service.prop('readOnly'),
    });
    // Normalizers are property proxies, not enumerable records. Retain their
    // complete prototype contract while decorating the raw input handlers.
    const wrapped: typeof normalize = Object.create(normalize);
    const reconcileControlledInput = (input: HTMLInputElement) => {
      if (service.prop('value') === undefined) return;
      queueMicrotask(() => {
        if (!input.isConnected || composing.has(input)) return;
        const accepted = service.context.get('value');
        if (input.value === accepted) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = accepted;
        if (start !== null && end !== null) input.setSelectionRange(start, end);
      });
    };
    wrapped.input = (props) => {
      const isComposing = (event: { currentTarget: EventTarget; nativeEvent?: Event }) =>
        composing.has(event.currentTarget) || (getNativeEvent(event) as InputEvent).isComposing;
      return normalize.input({
        ...props,
        // Native text pattern validation cannot express incomplete numeric
        // drafts; the shared numeric validity rule owns the commit boundary.
        pattern: undefined,
        'aria-invalid': validity.message ? true : undefined,
        'data-invalid': validity.message ? '' : undefined,
        onCompositionStart(event) {
          composing.add(event.currentTarget);
        },
        onBeforeInput(event) {
          if (!isComposing(event)) props.onBeforeInput?.(event);
        },
        onInput(event) {
          if (!isComposing(event)) {
            props.onInput?.(event);
            reconcileControlledInput(event.currentTarget);
          }
        },
        onCompositionEnd(event) {
          composing.delete(event.currentTarget);
          props.onInput?.(event);
          reconcileControlledInput(event.currentTarget);
        },
      });
    };
    return {
      ...numberInput.connect(service, wrapped),
      // Formatting an incomplete draft (for example "-") yields an empty
      // string. Forms and validation must observe what is actually being edited.
      value: service.context.get('value'),
      invalid: !!validity.message,
    };
  },
  machine: {
    ...numberInput.machine,
    states: {
      ...numberInput.machine.states,
      focused: {
        ...numberInput.machine.states.focused,
        on: {
          ...numberInput.machine.states.focused.on,
          // Enter commits by the same rule as blur, but retains focus.
          'INPUT.ENTER': commitTransitions,
        },
      },
    },
    implementations: {
      ...numberInput.machine.implementations,
      actions: {
        ...numberInput.machine.implementations?.actions,
        invokeOnValueCommit(params) {
          // React's service flush is a microtask. Read the accepted value after
          // that flush, still before HTML's keyboard default action.
          queueMicrotask(() =>
            numberInput.machine.implementations?.actions?.invokeOnValueCommit?.(params),
          );
        },
        setClampedValue(params) {
          params.flush(() =>
            numberInput.machine.implementations?.actions?.setClampedValue?.(params),
          );
          params.action(['syncInputElement']);
        },
        setFormattedValue(params) {
          params.flush(() =>
            numberInput.machine.implementations?.actions?.setFormattedValue?.(params),
          );
          params.action(['syncInputElement']);
        },
        syncInputElement(params) {
          if (params.event.type !== 'INPUT.ENTER' && params.event.type !== 'INPUT.BLUR') {
            numberInput.machine.implementations?.actions?.syncInputElement?.(params);
            return;
          }
          // HTML's Enter default action runs before the next animation frame.
          // Publish the accepted value now; a rejected controlled request keeps
          // its previously accepted value, including in FormData.
          const input = params.scope.getById<HTMLInputElement>(
            params.scope.ids?.input ?? `number-input:${params.scope.id}:input`,
          );
          const value = params.context.get('value');
          if (input && input.value !== value) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = value;
            if (start !== null && end !== null) input.setSelectionRange(start, end);
          }
        },
      },
      effects: {
        ...numberInput.machine.implementations?.effects,
        trackFormControl({ context, scope, prop }) {
          const input = scope.getById<HTMLInputElement>(
            scope.ids?.input ?? `number-input:${scope.id}:input`,
          );
          if (!input) return;
          const ancestors: HTMLFieldSetElement[] = [];
          for (let parent = input.parentElement; parent; parent = parent.parentElement)
            if (parent.tagName === 'FIELDSET') ancestors.push(parent as HTMLFieldSetElement);
          const syncDisabled = () =>
            context.set(
              'fieldsetDisabled',
              ancestors.some((fieldset) => {
                const legend = Array.from(fieldset.children).find(
                  (child) => child.tagName === 'LEGEND',
                );
                return fieldset.disabled && !legend?.contains(input);
              }),
            );
          syncDisabled();
          const observer = new MutationObserver(syncDisabled);
          for (const fieldset of ancestors)
            observer.observe(fieldset, {
              attributes: true,
              attributeFilter: ['disabled'],
              childList: true,
            });
          let connected = true;
          const reset = (event: Event) => {
            if (event.target !== input.form) return;
            setTimeout(() => {
              if (
                connected &&
                input.isConnected &&
                !event.defaultPrevented &&
                input.form === event.target &&
                prop('value') === undefined
              )
                context.set('value', context.initial('value'));
            });
          };
          input.ownerDocument.addEventListener('reset', reset, true);
          return () => {
            connected = false;
            observer.disconnect();
            input.ownerDocument.removeEventListener('reset', reset, true);
          };
        },
      },
    },
  },
};
