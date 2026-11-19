import '@labpics/ui-core/icon';
import { symbol as bookmark } from '@labpics/icons/symbols/bookmark';
import type { ComponentDoc } from '../template/component-doc.js';

const variants = [
  { label: 'Outline', value: 'outline' },
  { label: 'Filled', value: 'filled' },
];
function make(attrs: Readonly<Record<string, string | boolean>>) {
  const icon = document.createElement('lab-icon');
  icon.symbol = bookmark;
  icon.size = 32;
  for (const [name, value] of Object.entries(attrs))
    if (value !== false) icon.setAttribute(name, String(value));
  return icon;
}
export const iconDoc: ComponentDoc = {
  slug: 'icon',
  tag: 'lab-icon',
  title: 'Icon',
  summary:
    'Авторский символ: оптический размер, вес, смысловое состояние и движение без загрузки полного каталога.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Вариант', attribute: 'variant', options: variants },
      {
        name: 'Вес',
        attribute: 'weight',
        options: [300, 400, 500, 600].map((weight) => ({
          label: String(weight),
          value: String(weight),
        })),
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Авторский рисунок',
      description: 'Импортированный optical packet; currentColor, Outline по умолчанию.',
    },
    {
      index: 2,
      name: 'Оптический размер',
      description: 'opsz следует фактическим CSS px, поддержка 16–48.',
    },
  ],
  meaning: {
    purpose: 'Дополняет понятное действие или состояние узнаваемым авторским знаком.',
    dos: [
      'Импортируйте только нужные символы.',
      'Называйте действие на кнопке.',
      'Передавайте общий scale для rem/em.',
    ],
    donts: [
      'Не используйте имя файла вместо доступной подписи.',
      'Не запускайте бесконечное движение декоративных знаков.',
    ],
  },
  liveExample: {
    make: () => make({}),
    controls: [
      {
        kind: 'select',
        label: 'Состояние',
        attribute: 'state',
        options: [
          { label: 'Не выбрано', value: 'unselected' },
          { label: 'Выбрано', value: 'selected' },
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'date / timeZone',
        type: 'Date / string',
        description:
          'Явный момент и IANA-зона для calendar-number; часы приложения управляют обновлением.',
      },
      {
        name: 'symbol',
        type: 'IconSymbol',
        description: 'Импорт из @labpics/icons/symbols/<name>; ресурс не сериализуется в SSR HTML.',
      },
      {
        name: 'size / scale',
        type: 'number | px | rem | em / TypographyScale',
        default: '24',
        description:
          'Числа — CSS px. Относительные размеры требуют общего масштаба текстовой области.',
      },
      {
        name: 'variant / state',
        type: 'outline | filled / string',
        description: 'selected выбирает Filled, если variant явно не задан.',
      },
      {
        name: 'weight / opsz',
        type: '300–600 / 16–48 | auto',
        default: '400 / auto',
        description: 'Вес и оптический размер авторского рисунка.',
      },
      {
        name: 'effect / effectKey',
        type: 'string / string | number',
        description:
          'Авторский жест; изменение ключа повторяет его. playEffect() возвращает controls.',
      },
      {
        name: 'label',
        type: 'string',
        description:
          'Только для самостоятельного смыслового изображения; декоративный Icon скрыт по умолчанию.',
      },
    ],
    events: [],
    slots: [],
  },
};
