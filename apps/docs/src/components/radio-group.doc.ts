import '@labpics/ui-core/radio-group';
import { selectionProfile } from '@labpics/ui-tokens';
import type { ComponentDoc } from '../template/component-doc.js';
const sizes = Object.keys(selectionProfile.sizes).map((value) => ({ label: value, value }));
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-radio-group');
  element.label = 'Способ доставки';
  element.items = [
    { value: 'standard', label: 'Обычная' },
    { value: 'express', label: 'Срочная' },
  ];
  element.defaultValue = 'standard';
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
export const radioGroupDoc: ComponentDoc = {
  slug: 'radio-group',
  order: 15,
  tag: 'lab-radio-group',
  title: 'Одиночный выбор',
  summary:
    'Один вариант из группы. Выбранный Radio сохраняет прозрачную середину авторского кольца.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Размер', attribute: 'size', options: sizes },
      {
        name: 'Цвет',
        attribute: 'type',
        options: [
          { label: 'Accent', value: 'accent' },
          { label: 'Neutral', value: 'neutral' },
        ],
      },
      {
        name: 'Доступность',
        attribute: 'disabled',
        options: [
          { label: 'Доступен', value: false },
          { label: 'Недоступен', value: true },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Группа',
      description:
        'Одна подпись и одно выбранное значение. Стрелки, Home и End переводят выбор и фокус между доступными вариантами.',
    },
    {
      index: 2,
      name: 'Кольцо',
      description:
        'Малые размеры сохраняют авторскую толщину кольца; tiny использует отдельную точку.',
    },
    {
      index: 3,
      name: 'Подпись',
      description:
        'Текст и описание называют каждый вариант. Вся строка активирует один настоящий radio input.',
    },
  ],
  meaning: {
    purpose: 'Выбор одного взаимоисключающего значения.',
    dos: ['Дайте группе понятное имя.', 'Покажите варианты, которые удобно сравнить.'],
    donts: ['Не используйте радио для независимых флажков.'],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      { kind: 'toggle', label: 'Недоступна', attribute: 'disabled' },
      { kind: 'select', label: 'Размер', attribute: 'size', options: sizes },
    ],
  },
  api: {
    props: [
      {
        name: 'items',
        type: 'LabRadioItem[]',
        description:
          'Уникальные value, label, необязательные labelStart, description и disabled. React использует дочерние Radio.',
      },
      {
        name: 'value / default-value',
        type: 'string | null',
        description:
          'Текущее значение и начальное значение для reset. null означает отсутствие выбора; пустая строка — допустимое значение.',
      },
      {
        name: 'controlled',
        type: 'boolean',
        default: 'false',
        description: 'Lit: значение задаётся потребителем. React определяет режим наличием value.',
      },
      {
        name: 'name / required / disabled',
        type: 'native form attributes',
        description: 'Отправка одного значения, валидация и отключение группы.',
      },
      {
        name: 'size',
        type: "'tiny' | 's' | 'm' | 'l'",
        default: "'m'",
        description: 'Авторские размеры.',
      },
      {
        name: 'orientation',
        type: "'horizontal' | 'vertical'",
        default: "'horizontal'",
        description: 'Расположение вариантов.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description: 'CustomEvent<{ value: string }>. React: onValueChange.',
      },
    ],
    slots: [
      { name: 'label-start-{value}', description: 'Подпись перед знаком Radio.' },
      { name: 'label-{value}', description: 'Компоненты внутри подписи варианта.' },
      { name: 'description-{value}', description: 'Описание варианта.' },
      { name: 'icon-{value}', description: 'Декоративная иконка карточки.' },
    ],
  },
};
