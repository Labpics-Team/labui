import * as combobox from '@zag-js/combobox';
import type { MachineModule, PropTypes, SchemaOf } from '../../behaviors/types.js';
import type { LabComboboxItem } from './lab-combobox.js';

export { filterComboboxItems } from './filter.js';

type BaseSchema = SchemaOf<combobox.Service<LabComboboxItem>>;
export type ComboboxSchema = BaseSchema & {
  props: BaseSchema['props'] & {
    sourceCollection?: BaseSchema['props']['collection'];
    onQueryChange?: (query: string) => void;
  };
  refs: BaseSchema['refs'] & { query?: string | null };
};

const baseComputed = combobox.machine.computed;
if (!baseComputed) throw new Error('Combobox requires the selection computations.');

/** The source collection resolves accepted values; the filtered collection is
 * only for navigation. A live query belongs to the editor until selection,
 * dismissal or reset, so delayed value/item updates cannot consume newer input. */
export const comboboxBehavior: MachineModule<
  ComboboxSchema,
  combobox.Api<PropTypes, LabComboboxItem>
> = {
  ...combobox,
  machine: {
    ...combobox.machine,
    refs(params) {
      return {
        liveRegion: null,
        ...combobox.machine.refs?.(params),
        query: null,
      };
    },
    computed: {
      ...baseComputed,
      selectedItems: ({ context, prop }) =>
        context.get('value').map(
          (value) =>
            (prop('sourceCollection') ?? prop('collection')).find(value) ?? {
              value,
              label: value,
            },
        ),
    },
    watch(params) {
      combobox.machine.watch?.(params);
      params.track([() => params.computed('valueAsString')], () => {
        params.action(['syncSelectedItems']);
      });
      params.track([() => params.prop('multiple')], () => {
        params.action(['revertInputValue']);
      });
    },
    states: {
      ...combobox.machine.states,
      closed: {
        ...combobox.machine.states.closed,
        states: {
          ...combobox.machine.states.closed.states,
          idle: {
            ...combobox.machine.states.closed.states?.idle,
            entry: ['scrollContentToTop', 'clearHighlightedValue', 'revertInputValue'],
          },
        },
      },
      open: {
        ...combobox.machine.states.open,
        on: {
          ...combobox.machine.states.open.on,
          'INPUT.BLUR': {
            target: 'closed.idle',
            actions: ['invokeOnClose'],
          },
        },
      },
    },
    implementations: {
      ...combobox.machine.implementations,
      actions: {
        ...combobox.machine.implementations?.actions,
        selectItem({ context, prop, event, action, flush }) {
          if (event.value == null) return;
          flush(() => {
            const value = toggleValue(context.get('value'), event.value, prop('multiple'));
            prop('onSelect')?.({ value, itemValue: event.value });
            context.set('value', value);
            action(['revertInputValue']);
          });
        },
        selectHighlightedItem({ context, prop, action, flush }) {
          const itemValue = context.get('highlightedValue');
          if (itemValue === null || !prop('collection').has(itemValue)) return;
          flush(() => {
            const value = toggleValue(context.get('value'), itemValue, prop('multiple'));
            prop('onSelect')?.({ value, itemValue });
            context.set('value', value);
            action(['revertInputValue']);
          });
        },
        clearItem({ context, event, action, flush }) {
          if (event.value == null) return;
          flush(() => {
            context.set(
              'value',
              context.get('value').filter((value) => value !== event.value),
            );
            action(['revertInputValue']);
          });
        },
        setValue({ context, event, action, flush }) {
          flush(() => {
            context.set('value', event.value);
            action(['revertInputValue']);
          });
        },
        clearSelectedItems({ context, action, flush }) {
          flush(() => {
            context.set('value', []);
            action(['revertInputValue']);
          });
        },
        setInputValue({ context, event, refs, prop }) {
          refs.set('query', event.value);
          prop('onQueryChange')?.(event.value);
          context.set('inputValue', event.value);
        },
        revertInputValue({ context, prop, computed, refs }) {
          refs.set('query', null);
          prop('onQueryChange')?.('');
          context.set('inputValue', prop('multiple') ? '' : computed('valueAsString'));
        },
        syncSelectedItems({ context, computed, action, refs }) {
          context.set(
            'selectedItemMap',
            new Map(computed('selectedItems').map((item) => [item.value, item])),
          );
          if (refs.get('query') == null) action(['revertInputValue']);
        },
        invokeOnOpen(params) {
          if ((params.event.previousEvent ?? params.event).src !== 'input-change') {
            params.refs.set('query', null);
            params.prop('onQueryChange')?.('');
          }
          combobox.machine.implementations?.actions?.invokeOnOpen?.(params);
        },
        setInitialFocus({ scope }) {
          const input = scope.getById<HTMLInputElement>(
            scope.ids?.input ?? `combobox:${scope.id}:input`,
          );
          if (!input || scope.isActiveElement(input)) return;
          input.focus({ preventScroll: true });
        },
        setFinalFocus({ scope }) {
          const trigger = scope.getById<HTMLElement>(
            scope.ids?.trigger ?? `combobox:${scope.id}:toggle-btn`,
          );
          const target =
            trigger?.dataset.focusable == null
              ? scope.getById<HTMLInputElement>(scope.ids?.input ?? `combobox:${scope.id}:input`)
              : trigger;
          // Both controls are persistent. Restoring now cannot override a user's
          // subsequent Tab/click or a consumer's focus change on the next frame.
          if (target && !scope.isActiveElement(target)) target.focus({ preventScroll: true });
        },
      },
    },
  },
};

function toggleValue(value: string[], itemValue: string, multiple: boolean | undefined): string[] {
  if (!multiple) return [itemValue];
  return value.includes(itemValue)
    ? value.filter((selected) => selected !== itemValue)
    : [...value, itemValue];
}

/** The dismissable layer is installed on a deferred frame. Escape must also work
 * between opening and that frame, and must not commit/cancel an IME composition. */
export function mountComboboxKeyboard(
  input: HTMLInputElement,
  state: () => {
    open: boolean;
    setOpen(open: boolean, reason?: 'escape-key'): void;
  },
): () => void {
  const window = input.ownerDocument.defaultView;
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !event.composedPath().includes(input) || !state().open) return;
    // Let the platform cancel the composition while preventing the deferred
    // document-level overlay listener from also closing the listbox.
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (event.defaultPrevented) return;
    event.preventDefault();
    state().setOpen(false, 'escape-key');
  };
  window?.addEventListener('keydown', handleEscape, true);
  return () => window?.removeEventListener('keydown', handleEscape, true);
}
