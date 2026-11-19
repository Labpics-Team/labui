import { Accordion } from '@labpics/ui-solid/accordion';
import { Tabs } from '@labpics/ui-solid/tabs';
import { Textarea } from '@labpics/ui-solid/textarea';
import { Tooltip } from '@labpics/ui-solid/tooltip';
import { createComponent, createSignal, mergeProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
const element = (component, props = {}) =>
  createComponent(Dynamic, mergeProps({ component }, props));
export function App() {
  const [caption, setCaption] = createSignal('Draft');
  const [selected, setSelected] = createSignal('draft');
  const [events, setEvents] = createSignal(0);
  const [clicks, setClicks] = createSignal(0);
  const [fieldValue, setField] = createSignal('Server field');
  const [locked, setLocked] = createSignal(false);
  return element('main', {
    get children() {
      return [
        createComponent(Tabs, {
          id: 'tabs',
          'aria-label': 'Files',
          class: 'my-tabs active',
          label: null,
          size: 'l',
          variant: 'tinted',
          get items() {
            return [
              { value: 'draft', label: caption() },
              { value: 'history', label: 'History' },
            ];
          },
          get value() {
            return selected();
          },
          onValueChange(e) {
            setSelected(e.detail.value);
            setEvents((v) => v + 1);
          },
          get children() {
            return [
              element('div', {
                slot: 'draft',
                style: 'display:contents',
                get children() {
                  return [
                    element('textarea', {
                      id: 'editor',
                      'aria-label': 'Draft text',
                      children: 'Server draft',
                    }),
                    element('button', {
                      id: 'save',
                      onClick: () => setClicks((v) => v + 1),
                      children: 'Save',
                    }),
                    element('strong', {
                      id: 'caption',
                      get children() {
                        return caption();
                      },
                    }),
                  ];
                },
              }),
              element('div', {
                slot: 'history',
                get children() {
                  return element('p', { id: 'history', children: 'Saved versions' });
                },
              }),
              element('small', { id: 'footer', children: 'Solid default slot' }),
            ];
          },
        }),
        element('button', {
          id: 'rename',
          onClick: () => setCaption('Renamed'),
          children: 'Rename',
        }),
        element('output', {
          id: 'events',
          get children() {
            return String(events());
          },
        }),
        element('output', {
          id: 'clicks',
          get children() {
            return String(clicks());
          },
        }),
        createComponent(Textarea, {
          id: 'field',
          label: 'Message',
          get value() {
            return fieldValue();
          },
          get readonly() {
            return locked();
          },
        }),
        element('button', {
          id: 'lock-field',
          onClick: () => setLocked(true),
          children: 'Lock field',
        }),
        element('button', {
          id: 'set-field',
          onClick: () => setField('External update'),
          children: 'Set field',
        }),
        createComponent(Accordion, {
          id: 'accordion',
          items: [{ value: 'one', label: 'One' }],
          value: ['one'],
          collapsible: false,
          get children() {
            return element('div', { slot: 'one', children: 'Body' });
          },
        }),
        createComponent(Tabs, {
          id: 'null-tabs',
          items: [{ value: 'draft', label: 'Draft' }],
          value: null,
          defaultValue: 'draft',
        }),
        createComponent(Tooltip, {
          id: 'tooltip',
          content: 'Help',
          arrow: false,
          children: 'Trigger',
        }),
        createComponent(Tooltip, {
          id: 'default-tooltip',
          content: 'Default',
          children: 'Default trigger',
        }),
      ];
    },
  });
}
