import '@labpics/ui-core/choicebox';
import type { ComponentDoc } from '../template/component-doc.js';
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-choicebox');
  element.label = 'Рабочее пространство';
  element.items = [
    { value: 'personal', label: 'Личное', description: 'Материалы для самостоятельной работы' },
    { value: 'team', label: 'Команда', description: 'Общие проекты и участники' },
  ];
  element.defaultValue = ['personal'];
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
export const choiceboxDoc: ComponentDoc = {
  slug: 'choicebox',
  order: 16,
  tag: 'lab-choicebox',
  title: 'Карточки выбора',
  summary:
    'Сравните варианты по подписи и описанию. Карточка использует Radio для одного значения и Check для нескольких.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Вид',
        attribute: 'layout',
        options: [
          { label: 'Карточка', value: 'card' },
          { label: 'Строка', value: 'row' },
        ],
      },
      {
        name: 'Выбор',
        attribute: 'multiple',
        options: [
          { label: 'Один', value: false },
          { label: 'Несколько', value: true },
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
      name: 'Поверхность',
      description:
        'Радиус 12 px, внутренние отступы 16 px. Выбранную карточку обозначает акцентная рамка 2 px.',
    },
    {
      index: 2,
      name: 'Содержание',
      description:
        'Иконка, подпись и дополнительное описание. Растёт вместе с длинным текстом и системным масштабом.',
    },
    {
      index: 3,
      name: 'Контрол',
      description: 'Один Check или Radio большого размера. Вся карточка активирует этот контрол.',
    },
  ],
  meaning: {
    purpose: 'Выбор между вариантами, которым нужно больше контекста.',
    dos: ['Сохраняйте сопоставимую структуру вариантов.', 'Называйте группы и варианты.'],
    donts: ['Не вкладывайте кнопку или ссылку в активную карточку.'],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      { kind: 'toggle', label: 'Несколько значений', attribute: 'multiple' },
      {
        kind: 'select',
        label: 'Вид',
        attribute: 'layout',
        options: [
          { label: 'Карточка', value: 'card' },
          { label: 'Строка', value: 'row' },
        ],
      },
      { kind: 'toggle', label: 'Недоступен', attribute: 'disabled' },
    ],
  },
  api: {
    props: [
      {
        name: 'items',
        type: 'LabChoiceboxItem[]',
        description:
          'value, label, description, disabled; в React label, description и icon принимают ReactNode.',
      },
      {
        name: 'value / default-value',
        type: 'string[]',
        default: '[]',
        description:
          'Текущий и начальный набор. При одиночном выборе используется первое значение.',
      },
      {
        name: 'multiple',
        type: 'boolean',
        default: 'false',
        description: 'Один Radio или независимые Check.',
      },
      {
        name: 'layout',
        type: "'card' | 'row'",
        default: "'card'",
        description: 'Карточка с иконкой над подписью или компактная строка.',
      },
      {
        name: 'controlled / name / required / disabled',
        type: 'form attributes',
        description: 'Управляемое значение, отправка, минимум один вариант и отключение группы.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description: 'CustomEvent<{ value: string[] }>. React: onValueChange.',
      },
    ],
    slots: [
      { name: 'label-{value}', description: 'Составная подпись варианта.' },
      { name: 'description-{value}', description: 'Описание.' },
      { name: 'icon-{value}', description: 'Декоративная иконка.' },
    ],
  },
};
