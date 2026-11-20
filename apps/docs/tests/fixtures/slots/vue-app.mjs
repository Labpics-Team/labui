import { Alert } from '@labpics/ui-vue/alert';
import { Card } from '@labpics/ui-vue/card';
import { Fragment, h, ref } from 'vue';

const shadow =
  '<style>:host{display:block}svg{display:block;width:100%;height:100%}</style><svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
export default {
  setup() {
    const shown = ref(true);
    const label = ref('Initial < & " text');
    return () => [
      h(
        'button',
        {
          'data-update': '',
          onClick: () => {
            label.value = 'Updated < & " text';
          },
        },
        'Update',
      ),
      h(
        'button',
        {
          'data-toggle': '',
          onClick: () => {
            shown.value = !shown.value;
          },
        },
        'Toggle',
      ),
      ...(shown.value
        ? [
            h(
              Alert,
              { heading: 'Custom SVG' },
              {
                icon: () =>
                  h('svg', { 'data-icon': '', width: 24, height: 24, viewBox: '0 0 24 24' }, [
                    h('circle', { cx: 12, cy: 12, r: 8 }),
                  ]),
              },
            ),
            h(
              Alert,
              { heading: 'Nested custom element' },
              {
                icon: () =>
                  h('demo-symbol', {
                    'data-nested': '',
                    innerHTML: `<template shadowrootmode="open">${shadow}</template>`,
                  }),
              },
            ),
          ]
        : []),
      h(
        Card,
        {},
        {
          default: () => h('span', { 'data-default': '' }, `Default ${label.value}`),
          footer: () =>
            h(Fragment, {}, [
              h('span', { 'data-first': '', style: 'display:inline-block;width:17px' }, 'A'),
              label.value,
              h('input', { 'data-draft': '' }),
              h('span', { 'data-last': '' }, 'B'),
            ]),
        },
      ),
    ];
  },
};
