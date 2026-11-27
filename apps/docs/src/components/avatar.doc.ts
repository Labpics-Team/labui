import '@labpics/ui-core/avatar';
import { avatarProfile } from '@labpics/ui-tokens';
import type { ComponentDoc } from '../template/component-doc.js';

const colorOptions = Object.keys(avatarProfile.colors).map((value) => ({ label: value, value }));
const sizeOptions = Object.keys(avatarProfile.sizes).map((value) => ({
  label: value.toUpperCase(),
  value,
}));
const statusOptions = [
  { label: 'None', value: 'none' },
  ...Object.entries(avatarProfile.statuses).map(([value, status]) => ({
    label: status.label,
    value,
  })),
];
const fallbackOptions = [
  { label: 'Initials', value: 'initials' },
  { label: 'Texture', value: 'texture' },
];

function makeAvatar(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const avatar = document.createElement('lab-avatar');
  avatar.name = 'Даниил';
  avatar.initials = 'Д';
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) avatar.setAttribute(key, value === true ? '' : value);
  }
  return avatar;
}

export const avatarDoc: ComponentDoc = {
  slug: 'avatar',
  order: 5,
  tag: 'lab-avatar',
  title: 'Avatar',
  summary:
    'Портрет, округлённые инициалы или авторская текстура в десяти цветах. Отдельная точка сообщает о присутствии; прозрачный вырез сохраняет любой фон.',
  status: {
    kind: 'beta',
    note: 'Web и Compose используют общий профиль. Для SF Pro Rounded Heavy поставляется открытая замена Sunghyun Sans ExtraBold; её контуры отличаются от исходного шрифта.',
  },
  statesMatrix: {
    axes: [
      { name: 'Color', attribute: 'color', options: colorOptions },
      { name: 'Fallback', attribute: 'fallback', options: fallbackOptions },
    ],
    make: makeAvatar,
  },
  anatomy: [
    {
      index: 1,
      name: 'Круг',
      description:
        'Размер M повторяет авторские 32 px. S и L пропорционально масштабируют геометрию до 24 и 48 px; rem учитывает увеличение текста браузером.',
    },
    {
      index: 2,
      name: 'Портрет',
      description:
        'Изображение заполняет круг с сохранением пропорций. Выбранный fallback остаётся виден до успешного декодирования и при ошибке URL.',
    },
    {
      index: 3,
      name: 'Инициалы и текстура',
      description:
        'name задаёт доступное имя. initials независимо задаёт до двух графем; fallback="texture" выбирает текстуру, сохраняя полное имя.',
    },
    {
      index: 4,
      name: 'Присутствие',
      description:
        'Точка 8 px с прозрачным зазором 2 px у M. Online использует Info Primary, Away — Warning Primary, DND — Danger Primary, Offline — Neutral Quaternary. Имя и статус объявляются вместе.',
    },
  ],
  meaning: {
    purpose:
      'Avatar помогает узнавать человека или команду в списке и рядом с сообщением. Фото имеет приоритет; отсутствие фото сохраняет выбранное представление.',
    dos: [
      'Передавайте полное name; initials меняет только видимую надпись.',
      'Выбирайте постоянный цвет для одного человека.',
      'Устанавливайте decorative, если соседний текст уже полностью передаёт имя и присутствие.',
      'Передавайте statusLabel для локализованного описания присутствия.',
    ],
    donts: [
      'Не сообщайте Online без актуальных данных о присутствии.',
      'Не заменяйте доступное имя буквенной аббревиатурой.',
      'Не используйте сам Avatar как кнопку: действие и его название задаёт внешний интерактивный элемент.',
    ],
  },
  liveExample: {
    make: () => makeAvatar({ color: 'blue', status: 'online' }),
    controls: [
      { kind: 'select', label: 'Size', attribute: 'size', options: sizeOptions },
      { kind: 'select', label: 'Color', attribute: 'color', options: colorOptions },
      { kind: 'select', label: 'Fallback', attribute: 'fallback', options: fallbackOptions },
      { kind: 'select', label: 'Status', attribute: 'status', options: statusOptions },
      { kind: 'toggle', label: 'Decorative', attribute: 'decorative' },
    ],
  },
  api: {
    props: [
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Диаметр 24 / 32 / 48 px при базовом тексте 16 px.',
      },
      {
        name: 'color',
        type: Object.keys(avatarProfile.colors)
          .map((c) => `'${c}'`)
          .join(' | '),
        default: "'blue'",
        description:
          'Цвет fallback. Прежние neutral/brand/danger/warning/success/info остаются совместимыми псевдонимами.',
      },
      {
        name: 'status',
        type: "'none' | 'online' | 'offline' | 'away' | 'dnd'",
        default: "'none'",
        description: 'Присутствие; none убирает точку и вырез.',
      },
      {
        name: 'src',
        type: 'string',
        description:
          'URL портрета. Во время загрузки, декодирования и при ошибке остаётся fallback.',
      },
      {
        name: 'name',
        type: 'string',
        default: "''",
        description: 'Полное доступное имя и источник инициалов первого и последнего слова.',
      },
      {
        name: 'initials',
        type: 'string',
        description:
          'До двух графем. Пустая строка выбирает текстуру; undefined вычисляет инициалы из name.',
      },
      {
        name: 'fallback',
        type: "'initials' | 'texture'",
        default: "'initials'",
        description: 'Вид без готового портрета. При отсутствии букв всегда используется текстура.',
      },
      {
        name: 'decorative',
        type: 'boolean',
        default: 'false',
        description: 'Скрывает весь Avatar от дерева доступности.',
      },
      {
        name: 'statusLabel / status-label',
        type: 'string',
        default: "''",
        description:
          'Локализованное описание статуса; по умолчанию используется русское имя из профиля.',
      },
    ],
    events: [],
    slots: [],
  },
};
