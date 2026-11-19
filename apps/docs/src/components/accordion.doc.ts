import '@labpics/ui-core/accordion';
import type { ComponentDoc } from '../template/component-doc.js';

function makeAccordion(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-accordion');
  el.items = [
    { value: 'details', label: 'Что входит в проект?' },
    { value: 'access', label: 'Кто получит доступ?' },
  ];
  el.defaultValue = attrs.expanded === false ? [] : ['details'];
  for (const [value, text] of [
    ['details', 'Макеты, компоненты и исходные файлы.'],
    ['access', 'Участники команды, которых вы пригласите.'],
  ] as const) {
    const panel = document.createElement('div');
    panel.slot = value;
    panel.textContent = text;
    el.append(panel);
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'expanded' || value === false) continue;
    el.setAttribute(key, value === true ? '' : String(value));
  }
  return el;
}

export const accordionDoc: ComponentDoc = {
  slug: 'accordion',
  order: 12,
  tag: 'lab-accordion',
  title: 'Accordion',
  summary:
    'Раскрывающиеся разделы страницы. Сохраняют содержимое и ввод при сворачивании; заголовок остаётся доступен с клавиатуры.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Состояние',
        attribute: 'expanded',
        options: [
          { label: 'Раскрыт', value: true },
          { label: 'Свёрнут', value: false },
        ],
      },
    ],
    make: makeAccordion,
  },
  anatomy: [
    {
      index: 1,
      name: 'Раздел',
      description:
        'Радиус 16 px и нейтральный фон при наведении. Между разделами нет рамок и разделителей.',
    },
    {
      index: 2,
      name: 'Заголовок',
      description:
        'Кнопка внутри заголовка страницы. Geist Medium 16/24, отступ 16 px; цвет не меняется при раскрытии.',
    },
    {
      index: 3,
      name: 'Шеврон',
      description:
        'Авторский контур 16 px у края заголовка. Показывает раскрытие; не дублирует доступную подпись.',
    },
    {
      index: 4,
      name: 'Содержимое',
      description:
        'Geist Regular 16/24, вторичная подпись, интервал 8 px после заголовка. Можно вставлять формы и другие компоненты.',
    },
  ],
  meaning: {
    purpose:
      'Используйте для независимых разделов одной страницы, которые читатель раскрывает по мере необходимости.',
    dos: [
      'Называйте раздел по его содержимому.',
      'Подбирайте headingLevel под иерархию страницы.',
      'Оставляйте введённые данные при сворачивании.',
    ],
    donts: [
      'Не прячьте обязательное действие в закрытом разделе.',
      'Не используйте Accordion как навигацию между страницами.',
    ],
  },
  liveExample: {
    make: () => makeAccordion({}),
    controls: [
      { kind: 'toggle', label: 'Несколько открытых разделов', attribute: 'multiple' },
      { kind: 'toggle', label: 'Отключён', attribute: 'disabled' },
      {
        kind: 'select',
        label: 'Плотность',
        attribute: 'size',
        options: [
          { label: 'S — расширение', value: 's' },
          { label: 'M — макет', value: 'm' },
          { label: 'L — расширение', value: 'l' },
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'items',
        type: 'LabAccordionItem[]',
        default: '[]',
        description:
          '{ value, label, disabled? }. Уникальный value также задаёт слот содержимого. JSON-атрибут сохраняет данные при SSR.',
      },
      {
        name: 'value',
        type: 'string[] | null',
        default: 'null',
        description:
          'Открытые разделы под управлением приложения. [] закрывает все; null включает внутреннее состояние.',
      },
      {
        name: 'defaultValue',
        type: 'string[] | null',
        default: 'null',
        description:
          'Начальные открытые разделы. Атрибут default-value принимает JSON-массив или перечень через запятую.',
      },
      {
        name: 'multiple',
        type: 'boolean',
        default: 'false',
        description: 'Разрешает раскрыть несколько разделов.',
      },
      {
        name: 'collapsible',
        type: 'boolean',
        default: 'true',
        description: 'Разрешает закрыть последний открытый раздел.',
      },
      {
        name: 'headingLevel',
        type: '1 | 2 | 3 | 4 | 5 | 6',
        default: '3',
        description: 'Уровень заголовков разделов в документе.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Отключает действия во всей группе.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'M соответствует макету; S/L — дополнительные плотности.',
      },
      {
        name: 'orientation',
        type: "'vertical' | 'horizontal'",
        default: "'vertical'",
        description:
          'В макете разделы вертикальны. Горизонтальная группа — расширение с навигацией влево/вправо.',
      },
    ],
    events: [
      {
        name: 'value-change',
        description:
          'CustomEvent<{ value: string[] }>: запрос нового набора разделов. При заданном value приложение принимает или отклоняет его.',
      },
    ],
    slots: [
      {
        name: '(value раздела)',
        description:
          'Содержимое раздела. Сохраняется в DOM при закрытии, но исключается из отображения и фокуса.',
      },
    ],
  },
};
