import { getNativeEvent } from '@zag-js/dom-query';
import * as numberInput from '@zag-js/number-input';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';

const composing = new WeakSet<EventTarget>();

/** Native reset is cancellable at every ancestor. The machine owns parsing,
 * stepping and accepted values; this effect only observes the real form lifetime. */
export const numberInputBehavior: MachineModule<SchemaOf<numberInput.Service>, numberInput.Api> = {
  ...numberInput,
  connect(service, normalize) {
    // Normalizers are property proxies, not enumerable records. Retain their
    // complete prototype contract while decorating the raw input handlers.
    const wrapped: typeof normalize = Object.create(normalize);
    wrapped.input = (props) => {
      const isComposing = (event: { currentTarget: EventTarget; nativeEvent?: Event }) =>
        composing.has(event.currentTarget) || (getNativeEvent(event) as InputEvent).isComposing;
      return normalize.input({
        ...props,
        onCompositionStart(event) {
          composing.add(event.currentTarget);
        },
        onBeforeInput(event) {
          if (!isComposing(event)) props.onBeforeInput?.(event);
        },
        onInput(event) {
          if (!isComposing(event)) props.onInput?.(event);
        },
        onCompositionEnd(event) {
          composing.delete(event.currentTarget);
          props.onInput?.(event);
        },
      });
    };
    return numberInput.connect(service, wrapped);
  },
  machine: {
    ...numberInput.machine,
    implementations: {
      ...numberInput.machine.implementations,
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
