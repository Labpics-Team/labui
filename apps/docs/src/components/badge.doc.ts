import '@labpics/ui-core/badge';
import { badgeProfile } from '@labpics/ui-tokens';
import type { ComponentDoc } from '../template/component-doc.js';

const colors = Object.keys(badgeProfile.colors).map((value) => ({ label: value, value }));
function makeBadge(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const badge = document.createElement('lab-badge');
  badge.textContent = 'Badge';
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) badge.setAttribute(key, value === true ? '' : value);
  }
  return badge;
}

export const badgeDoc: ComponentDoc = {
  slug: 'badge',
  order: 2,
  tag: 'lab-badge',
  title: 'Метка',
  summary:
    'Короткий статус, категория или счётчик рядом с предметом. Цвет и заливка помогают различать смысл и важность.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Цвет', attribute: 'color', options: colors },
      {
        name: 'Заливка',
        attribute: 'type',
        options: [
          { label: 'Fill', value: 'fill' },
          { label: 'Tinted', value: 'tinted' },
        ],
      },
      {
        name: 'Состояние',
        attribute: 'disabled',
        options: [
          { label: 'Обычный', value: false },
          { label: 'Недоступный', value: true },
        ],
      },
    ],
    make: makeBadge,
  },
  anatomy: [
    {
      index: 1,
      name: 'Поверхность',
      description:
        'Высота 20 px, отступы 4×8 px, круглый край. Fill выделяет метку, Tinted оставляет лёгкий оттенок. Недоступная метка использует общие серые роли.',
    },
    {
      index: 2,
      name: 'Подпись',
      description:
        'Geist Medium, 12/12 px. Цвет подписи вычисляется из авторских заливок вместе с поверхностью; у жёлтой метки он тёмный.',
    },
    {
      index: 3,
      name: 'Знаки',
      description:
        'Необязательные декоративные знаки по 12 px перед подписью и после неё. Интервал до текста — 4 px.',
    },
  ],
  meaning: {
    purpose:
      'Метка называет состояние предмета и не требует действия. Подпись сохраняет смысл без цвета.',
    dos: [
      'Используйте короткое слово или число.',
      'Добавляйте значение состояния в текст.',
      'Для повторяющейся категории сохраняйте один цвет.',
    ],
    donts: ['Не делайте метку кнопкой.', 'Не передавайте состояние только цветом.'],
  },
  liveExample: {
    make: () => makeBadge({ color: 'blue', type: 'fill' }),
    controls: [
      { kind: 'select', label: 'Цвет', attribute: 'color', options: colors },
      {
        kind: 'select',
        label: 'Заливка',
        attribute: 'type',
        options: [
          { label: 'Fill', value: 'fill' },
          { label: 'Tinted', value: 'tinted' },
        ],
      },
      { kind: 'toggle', label: 'Недоступна', attribute: 'disabled' },
    ],
  },
  api: {
    props: [
      {
        name: 'color',
        type: colors.map(({ value }) => `'${value}'`).join(' | '),
        default: "'blue'",
        description:
          'Авторское цветовое семейство. Прежние danger, warning, success, info разрешаются в red, orange, green, blue.',
      },
      {
        name: 'type',
        type: "'fill' | 'tinted'",
        default: "'fill'",
        description: 'Выраженность поверхности.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Общий серый вид без интерактивной семантики.',
      },
    ],
    events: [],
    slots: [
      { name: '(default) / children', description: 'Короткая подпись или счётчик.' },
      { name: 'icon / icon', description: 'Декоративный знак перед подписью, SVG с currentColor.' },
      { name: 'icon-end / iconEnd', description: 'Декоративный знак после подписи.' },
      { name: 'dot / dot', description: 'Совместимость с прежним индикатором-точкой.' },
    ],
  },
};
