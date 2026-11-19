import { getNativeEvent, isInternalChangeEvent } from '@zag-js/dom-query';
import * as select from '@zag-js/select';
import type { MachineModule, PropTypes, SchemaOf } from '../../behaviors/types.js';
import type { LabSelectItem } from './lab-select.js';

type Schema = SchemaOf<select.Service<LabSelectItem>>;
type Api = select.Api<PropTypes, LabSelectItem>;

/** Native HTML form semantics at the Select boundary. Navigation, positioning and
 * selection still use Zag. These replace the upstream form effect and input reader:
 * a real empty-string option is selected, reset is cancellable, and every disabled
 * ancestor fieldset observes its own first-legend exception.
 */
export const selectBehavior: MachineModule<Schema, Api> = {
  machine: {
    ...select.machine,
    implementations: {
      ...select.machine.implementations,
      effects: {
        ...select.machine.implementations?.effects,
        trackFormControlState({ context, scope, prop }) {
          const native = scope.getById<HTMLSelectElement>(scope.ids?.hiddenSelect);
          if (!native) return;
          const ancestors: HTMLFieldSetElement[] = [];
          for (let parent = native.parentElement; parent; parent = parent.parentElement) {
            if (parent.tagName === 'FIELDSET') ancestors.push(parent as HTMLFieldSetElement);
          }
          const disabled = () => {
            context.set(
              'fieldsetDisabled',
              ancestors.some((fieldset) => {
                const legend = Array.from(fieldset.children).find(
                  (child) => child.tagName === 'LEGEND',
                );
                return fieldset.disabled && !legend?.contains(native);
              }),
            );
          };
          disabled();
          const Observer = native.ownerDocument.defaultView?.MutationObserver;
          const observer = Observer ? new Observer(disabled) : undefined;
          for (const fieldset of ancestors)
            observer?.observe(fieldset, {
              attributes: true,
              attributeFilter: ['disabled'],
              childList: true,
            });
          let connected = true;
          const reset = (event: Event) => {
            if (event.target !== native.form) return;
            // Form reset default action and consumer cancellation finish before this
            // runs. A controlled field is never changed by a native reset request.
            queueMicrotask(() => {
              if (
                !connected ||
                !native.isConnected ||
                event.defaultPrevented ||
                event.target !== native.form
              )
                return;
              if (prop('value') === undefined) context.set('value', context.initial('value'));
              const accepted = new Set(context.get('value'));
              let selected = false;
              for (const option of native.options) {
                option.selected = accepted.has(option.value);
                selected ||= option.selected;
              }
              if (!selected) native.selectedIndex = -1;
            });
          };
          // The explicit form attribute may change without remounting the Select.
          // Resolve its current native association when the event is dispatched.
          const document = native.ownerDocument;
          document.addEventListener('reset', reset, true);
          return () => {
            connected = false;
            observer?.disconnect();
            document.removeEventListener('reset', reset, true);
          };
        },
      },
    },
  },
  connect(service, normalize) {
    const api = select.connect(service, normalize);
    return {
      ...api,
      getHiddenSelectProps() {
        const change = (event: Event) => {
          if (isInternalChangeEvent(getNativeEvent(event))) return;
          api.setValue(
            Array.from(
              (event.currentTarget as HTMLSelectElement).selectedOptions,
              (option) => option.value,
            ),
          );
        };
        return { ...api.getHiddenSelectProps(), onInput: change, onChange: change };
      },
    };
  },
};
