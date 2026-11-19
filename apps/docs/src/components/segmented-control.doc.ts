import '@labpics/ui-core/segmented-control';
import type { ComponentDoc } from '../template/component-doc.js';

const shapes = [
  { label: 'Rounded', value: 'rounded' },
  { label: 'Regular', value: 'regular' },
  { label: 'Sharp', value: 'sharp' },
];
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-segmented-control');
  element.label = 'Период';
  element.items = [
    { value: 'day', label: 'День' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
  ];
  element.defaultValue = 'week';
  for (const [name, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(name, value === true ? '' : String(value));
  return element;
}
export const segmentedControlDoc: ComponentDoc = {
  slug: 'segmented-control',
  tag: 'lab-segmented-control',
  title: 'Segmented Control',
  summary:
    'Один короткий режим внутри текущего вида. Выбор работает с клавиатурой и участвует в форме.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Форма', attribute: 'shape', options: shapes },
      {
        name: 'Состояние',
        attribute: 'disabled',
        options: [
          { label: 'Доступен', value: false },
          { label: 'Отключён', value: true },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Оболочка',
      description: 'Высота 40 px, отступ 2 px и общий фон объединяют варианты в один выбор.',
    },
    {
      index: 2,
      name: 'Сегмент',
      description:
        'Caption/S 14/12; выбранный вариант получает поверхность control-bg и Shadow/XS.',
    },
    {
      index: 3,
      name: 'Разделитель',
      description: 'Появляется только между соседними невыбранными сегментами.',
    },
  ],
  meaning: {
    purpose:
      'Подходит для выбора периода, представления или единицы измерения без ухода из текущего вида.',
    dos: [
      'Давайте всей группе понятную подпись.',
      'Используйте короткие различимые названия.',
      'Сохраняйте label у варианта с одной иконкой.',
    ],
    donts: [
      'Не подменяйте этим компонентом навигацию между страницами.',
      'Не используйте его для независимых флагов.',
    ],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      { kind: 'select', label: 'Форма', attribute: 'shape', options: shapes },
      { kind: 'toggle', label: 'Отключить', attribute: 'disabled' },
    ],
  },
  api: {
    props: [
      {
        name: 'items',
        type: 'LabSegmentedItem[]',
        description: 'Уникальные value, обязательные label, disabled и декоративные иконки.',
      },
      {
        name: 'shape',
        type: "'rounded' | 'regular' | 'sharp'",
        default: "'rounded'",
        description: 'Авторская форма оболочки и сегментов.',
      },
      {
        name: 'value / defaultValue',
        type: 'string | null',
        description:
          'Controlled-значение или начальный uncontrolled-выбор; null оставляет группу пустой.',
      },
      {
        name: 'name / form / required / disabled',
        description: 'Штатное участие в HTML-форме и отключение действий.',
      },
      { name: 'label', type: 'string', description: 'Доступное имя всей группы.' },
    ],
    events: [
      {
        name: 'value-change',
        description: 'CustomEvent<{ value: string }>: запрос нового выбора.',
      },
    ],
    slots: [
      { name: 'item.icon / item.iconEnd', description: 'Имена декоративных слотов для иконок.' },
    ],
  },
};
