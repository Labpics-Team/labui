import { Select } from '@labpics/ui-solid/select';
import { createComponent, createSignal, mergeProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { initialItems, renamedItems } from './client-mount-data.mjs';
const element = (component, props = {}) =>
  createComponent(Dynamic, mergeProps({ component }, props));
export function App() {
  const [items, setItems] = createSignal(initialItems);
  const [value, setValue] = createSignal(['a']);
  const [initial, setInitial] = createSignal(['b']);
  const [lastChange, setChange] = createSignal('');
  const shared = {
    multiple: true,
    placeholder: 'Choose',
    get items() {
      return items();
    },
    get defaultValue() {
      return initial();
    },
  };
  return element('main', {
    get children() {
      return [
        createComponent(
          Select,
          mergeProps(shared, {
            id: 'uncontrolled',
            label: 'Uncontrolled',
            onValueChange: (event) => setChange(event.detail.value.join(',')),
          }),
        ),
        createComponent(
          Select,
          mergeProps(shared, {
            id: 'controlled',
            label: 'Controlled',
            get value() {
              return value();
            },
          }),
        ),
        createComponent(
          Select,
          mergeProps(shared, {
            id: 'released',
            label: 'Explicit null',
            value: null,
          }),
        ),
        element('output', {
          id: 'client-events',
          get children() {
            return lastChange();
          },
        }),
        element('button', {
          id: 'rename-choice',
          children: 'Rename C',
          onClick: () => setItems(renamedItems),
        }),
        element('button', { id: 'select-c', children: 'Select C', onClick: () => setValue(['c']) }),
        element('output', {
          id: 'client-control',
          get children() {
            return value() === undefined ? 'omitted' : 'set';
          },
        }),
        element('button', {
          id: 'withdraw-controlled',
          children: 'Withdraw binding',
          onClick: () => setValue(undefined),
        }),
        element('button', {
          id: 'clear-controlled',
          children: 'Clear controlled',
          onClick: () => setValue([]),
        }),
        element('button', {
          id: 'change-default',
          children: 'Change default',
          onClick: () => setInitial(['a']),
        }),
      ];
    },
  });
}
