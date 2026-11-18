import '@labpics/ui-core/progress';
import { progressProfile } from '@labpics/ui-tokens';
import type { ComponentDoc } from '../template/component-doc.js';
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-progress');
  element.label = 'Обработка фотографий';
  element.value = 25;
  element.showValueText = true;
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
export const progressDoc: ComponentDoc = {
  slug: 'progress',
  order: 14,
  tag: 'lab-progress',
  title: 'Progress',
  summary:
    'Ход работы в линейном или круглом представлении. Число задаёт реальную долю; null показывает ожидание без процента.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Представление',
        attribute: 'variant',
        options: [
          { label: 'Linear', value: 'linear' },
          { label: 'Circular', value: 'circular' },
        ],
      },
      {
        name: 'Размер',
        attribute: 'size',
        options: Object.keys(progressProfile.sizes).map((value) => ({ label: value, value })),
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Индикатор',
      description:
        'Дорожка использует brand quaternary с alpha 0.32, активная часть — brand primary. Круг сохраняет круглые окончания дуги.',
    },
    {
      index: 2,
      name: 'Доступное значение',
      description:
        'Один progressbar с именем работы, границами и текущим значением. При неизвестной доле aria-valuenow отсутствует.',
    },
  ],
  meaning: {
    purpose: 'Показать измеренный объём выполненной работы.',
    dos: ['Передавайте значение из настоящего процесса.', 'Назовите выполняемую работу.'],
    donts: ['Не увеличивайте процент по таймеру.'],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      {
        kind: 'select',
        label: 'Представление',
        attribute: 'variant',
        options: [
          { label: 'Linear', value: 'linear' },
          { label: 'Circular', value: 'circular' },
        ],
      },
      { kind: 'toggle', label: 'Процент', attribute: 'show-value-text' },
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
        description:
          'Linear: s2/m4/l8 px; Circular: s64/m96/l128 px с обводкой4. Авторский размер m.',
      },
      {
        name: 'variant',
        type: "'linear' | 'circular'",
        default: "'linear'",
        description: 'Представление одной и той же доли.',
      },
      {
        name: 'show-value-text',
        type: 'boolean',
        default: 'false',
        description: 'Показывает процент только известного значения. В React showValueText.',
      },
      {
        name: 'label',
        type: 'string | ReactNode',
        description: 'Видимая подпись работы и доступное имя.',
      },
    ],
    events: [],
    slots: [],
  },
};
