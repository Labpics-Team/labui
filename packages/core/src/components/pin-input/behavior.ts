import { getNativeEvent } from '@zag-js/dom-query';
import * as pin from '@zag-js/pin-input';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';

type Schema = SchemaOf<pin.Service>;
const computedPin = pin.machine.computed;
if (!computedPin) throw new Error('Pin Input requires Zag computed state.');

export function pinCount(count: number): number {
  return Number.isFinite(count) ? Math.max(1, Math.min(32, Math.trunc(count))) : 4;
}

function pinTextMatchesType(text: string, type: pin.Props['type']): boolean {
  return (
    type === 'numeric' ? /^[0-9]*$/ : type === 'alphabetic' ? /^[a-zA-Z]*$/ : /^[a-zA-Z0-9]*$/
  ).test(text);
}

/** The same character contract also applies to restored and controlled values. */
export function pinValueMatchesType(value: readonly string[], type: pin.Props['type']): boolean {
  return value.every((character) => character.length <= 1 && pinTextMatchesType(character, type));
}

/** Narrow Zag integration: keep its navigation/paste machine, repair platform seams.
 * Zag 1.41 freezes count at mount and does not observe form reset or IME composition.
 * These are shared once, before either renderer normalizes its DOM event handlers.
 */
export const pinInputBehavior: MachineModule<Schema, pin.Api> = {
  machine: {
    ...pin.machine,
    computed: {
      ...computedPin,
      isValueComplete: ({ computed, prop }) =>
        computed('valueLength') === computed('filledValueLength') &&
        pinValueMatchesType(computed('_value'), prop('type')),
    },
    watch(args) {
      pin.machine.watch?.(args);
      args.track([() => args.prop('count')], () => {
        const count = pinCount(args.prop('count') ?? 4);
        args.context.set('count', count);
        args.context.set('value', args.context.get('value').slice(0, count));
        const focused = args.context.get('focusedIndex');
        if (focused >= count) args.context.set('focusedIndex', count - 1);
      });
    },
  },
  connect(service, normalize) {
    const sync = () => {
      const api = pin.connect(service, normalize);
      const rootId = service.scope.ids?.root ?? `pin-input:${service.scope.id}`;
      const root = service.scope.getById<HTMLElement>(rootId);
      root?.querySelectorAll<HTMLInputElement>('[data-part="input"]').forEach((input, index) => {
        if (input.dataset.composing === 'true') return;
        input.value = api.value[index] ?? '';
      });
    };
    return pin.connect(
      service,
      Object.assign(Object.create(normalize) as typeof normalize, {
        input(props: Parameters<typeof normalize.input>[0]) {
          if (props['data-part'] !== 'input') return normalize.input(props);
          const mutable = (event: { currentTarget: HTMLInputElement }) => {
            const input = event.currentTarget as HTMLInputElement;
            return (
              !service.prop('readOnly') && !service.prop('disabled') && !input.matches(':disabled')
            );
          };
          const composing = (event: { currentTarget: HTMLInputElement; nativeEvent: Event }) =>
            (getNativeEvent(event) as InputEvent).isComposing ||
            (event.currentTarget as HTMLInputElement).dataset.composing === 'true';
          const change = (
            event:
              | Parameters<NonNullable<typeof props.onChange>>[0]
              | Parameters<NonNullable<typeof props.onCompositionEnd>>[0],
          ) => {
            if (!mutable(event) || composing(event)) return;
            const input = event.currentTarget as HTMLInputElement;
            // Some engines send a final input after compositionend. It belongs to
            // the same committed cell even if Zag has already advanced focus.
            if (input.dataset.compositionCommitted === input.value) {
              delete input.dataset.compositionCommitted;
              sync();
              return;
            }
            delete input.dataset.compositionCommitted;
            if (!pinTextMatchesType(input.value, service.prop('type'))) {
              service.send({ type: 'VALUE.INVALID', value: input.value });
              sync();
              return;
            }
            const native = getNativeEvent(event) as InputEvent;
            if (
              input.value.length > 1 &&
              (native.inputType === 'insertReplacementText' || (native.data?.length ?? 0) > 1)
            )
              service.send({ type: 'INPUT.PASTE', value: input.value });
            else props.onChange?.(event as Parameters<NonNullable<typeof props.onChange>>[0]);
            // A controlled consumer may decline the request. Restore its accepted value
            // after Zag has flushed; no timer or continuous animation loop is involved.
            queueMicrotask(sync);
          };
          return normalize.input({
            ...props,
            onBeforeInput(event) {
              if (!mutable(event)) {
                event.preventDefault();
                return;
              }
              if (!composing(event)) props.onBeforeInput?.(event);
            },
            onChange: change,
            onPaste(event) {
              delete event.currentTarget.dataset.compositionCommitted;
              if (!mutable(event)) {
                event.preventDefault();
                return;
              }
              props.onPaste?.(event);
            },
            onKeyDown(event) {
              delete event.currentTarget.dataset.compositionCommitted;
              if (!mutable(event)) return;
              props.onKeyDown?.(event);
            },
            onCompositionStart(event) {
              delete event.currentTarget.dataset.compositionCommitted;
              (event.currentTarget as HTMLInputElement).dataset.composing = 'true';
            },
            onCompositionEnd(event) {
              const input = event.currentTarget as HTMLInputElement;
              const committed = input.value;
              delete input.dataset.composing;
              change(event);
              input.dataset.compositionCommitted = committed;
            },
          });
        },
      }),
    );
  },
};

/** Observe the current native form, including an explicit form= association. */
export function listenPinReset(input: HTMLInputElement, reset: () => void): () => void {
  let connected = true;
  const onReset = (event: Event) => {
    if (event.target !== input.form) return;
    queueMicrotask(() => {
      if (connected && input.isConnected && !event.defaultPrevented && event.target === input.form)
        reset();
    });
  };
  input.ownerDocument.addEventListener('reset', onReset, true);
  return () => {
    connected = false;
    input.ownerDocument.removeEventListener('reset', onReset, true);
  };
}
