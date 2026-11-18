import '@labpics/ui-core/loader';
import { loaderProfile } from '@labpics/ui-tokens';
import type { ComponentDoc } from '../template/component-doc.js';
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-loader');
  element.label = 'Обработка фотографий';
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
export const loaderDoc: ComponentDoc = {
  slug: 'loader',
  order: 4,
  tag: 'lab-loader',
  title: 'Loader',
  summary:
    'Компактное ожидание или измеренная доля работы. Medium показывает сектор внутри кольца, large — дугу; неизвестная доля отображается восемью спицами.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Доля',
        attribute: 'value',
        options: [
          { label: 'Неизвестна', value: 'null' },
          { label: '75%', value: '75' },
        ],
      },
      {
        name: 'Размер',
        attribute: 'size',
        options: Object.keys(loaderProfile.sizes).map((value) => ({ label: value, value })),
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Индикатор',
      description: 'Авторские размеры m24/l48, нейтральные роли цвета и круглая геометрия.',
    },
    {
      index: 2,
      name: 'Доступное значение',
      description:
        'Один progressbar с именем работы, границами и текущим значением. При неизвестной доле aria-valuenow отсутствует.',
    },
  ],
  meaning: {
    purpose: 'Краткая обратная связь рядом с выполняемым действием.',
    dos: ['Передавайте значение из настоящего процесса.', 'Назовите выполняемую работу.'],
    donts: ['Не увеличивайте процент по таймеру.'],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      {
        kind: 'select',
        label: 'Значение',
        attribute: 'value',
        options: [
          { label: 'Неизвестно', value: 'null' },
          ...['0', '25', '50', '75', '100'].map((value) => ({ label: `${value}%`, value })),
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'value',
        type: 'number | null',
        default: 'null',
        description:
          'Измеренное значение; null — неизвестная доля. Ноль остаётся известным значением.',
      },
      {
        name: 'min / max',
        type: 'number',
        default: '0 / 100',
        description:
          'Конечные возрастающие границы. Значение ограничивается ими. Невалидные границы дают неизвестное состояние.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'm24 и l48 — авторские размеры; s16 — уменьшенное расширение medium.',
      },

      { name: 'label', type: 'string', description: 'Доступное имя, по умолчанию «Загрузка».' },
    ],
    events: [],
    slots: [],
  },
};
