import '@labpics/ui-core/button';
import '@labpics/ui-core/card';
import image from '../assets/card-source.png';
import type { ComponentDoc } from '../template/component-doc.js';

function makeCard(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const card = document.createElement('lab-card');
  card.setAttribute('heading', 'Рабочее пространство');
  card.setAttribute('description', 'Проекты и материалы команды');
  const action = document.createElement('lab-button');
  action.setAttribute('slot', 'footer');
  action.setAttribute('size', 's');
  action.textContent = 'Открыть пространство';
  card.append(action);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) card.setAttribute(key, value === true ? '' : value);
  }
  return card;
}

const variants = [
  { label: 'Elevated', value: 'elevated' },
  { label: 'Outlined', value: 'outlined' },
  { label: 'Filled', value: 'filled' },
];
const paddings = [
  { label: 'Без отступов', value: 'none' },
  { label: 'S', value: 's' },
  { label: 'M', value: 'm' },
  { label: 'L · 24', value: 'l' },
];

export const cardDoc: ComponentDoc = {
  slug: 'card',
  order: 13,
  tag: 'lab-card',
  title: 'Card',
  summary:
    'Изображение, описание и действия над одним предметом. Авторский вариант объединяет изображение высотой 200 и поверхность Content с отступами 24; форма и типографика следуют LabUI.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [{ name: 'Поверхность', attribute: 'variant', options: variants }],
    make: makeCard,
  },
  anatomy: [
    {
      index: 1,
      name: 'Карточка',
      description: 'Article объединяет содержимое. Радиус 16 и сглаживание 0.6 задают общую форму.',
    },
    {
      index: 2,
      name: 'Изображение',
      description:
        'image заполняет верхнюю область и продолжается под Content. При заданной высоте карточки растёт изображение; Content сохраняет естественную высоту. Произвольный media сохраняет собственную высоту.',
    },
    {
      index: 3,
      name: 'Content',
      description:
        'Отдельная поверхность Elevated с отступами 24 и интервалом 16. Материал наследуется от темы.',
    },
    {
      index: 4,
      name: 'Заголовок и описание',
      description:
        'Заголовок Geist 20/20 Medium, описание 16/24 Regular. Верхняя и нижняя подписи — 14/12 Medium. Header заменяет эту готовую композицию.',
    },
    {
      index: 5,
      name: 'Содержимое и действия',
      description:
        'Default slot содержит произвольное содержимое, footer — кнопки, ссылки или метаданные. Пустые области не добавляют интервалов.',
    },
  ],
  meaning: {
    purpose:
      'Card помогает прочитать одну сущность целиком: проект, материал или группу настроек. Заголовок, описание и действия находятся на общей поверхности.',
    dos: [
      'Используйте heading, description и подписи для согласованной типографики.',
      'Передавайте image для авторской композиции с изображением под материалом.',
      'Добавляйте настоящую кнопку или ссылку для действия; interactive выделяет фокус внутри карточки.',
    ],
    donts: [
      'Не добавляйте role="button" карточке с несколькими действиями.',
      'Не объединяйте несвязанные предметы одной поверхностью.',
    ],
  },
  liveExample: {
    make: () => makeCard({ image }),
    controls: [
      { kind: 'select', label: 'Поверхность', attribute: 'variant', options: variants },
      { kind: 'select', label: 'Отступы', attribute: 'padding', options: paddings },
      { kind: 'toggle', label: 'Выделять фокус внутри', attribute: 'interactive' },
    ],
  },
  api: {
    props: [
      {
        name: 'variant',
        type: "'elevated' | 'outlined' | 'filled'",
        default: "'elevated'",
        description: 'Материал Elevated, контурная или залитая поверхность.',
      },
      {
        name: 'padding',
        type: "'none' | 's' | 'm' | 'l'",
        default: "'l'",
        description: 'Отступы Content. Авторское значение l — 24 при базовом масштабе.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        default: 'false',
        description:
          'Рамка при фокусе на вложенном действии. Карточка сохраняет семантику article.',
      },
      {
        name: 'image',
        type: 'string',
        default: "''",
        description:
          'URL изображения. Верхняя область — 200 при базовом масштабе; при заданной высоте карточки заполняет оставшееся место.',
      },
      {
        name: 'imageAlt',
        type: 'string',
        default: "''",
        description:
          'Текст изображения; атрибут image-alt. Декоративная копия под Content скрыта от доступности.',
      },
      { name: 'heading', type: 'string', default: "''", description: 'Заголовок h2.' },
      {
        name: 'headingHint',
        type: 'string',
        default: "''",
        description: 'Вторичный текст рядом с заголовком; атрибут heading-hint.',
      },
      {
        name: 'description',
        type: 'string',
        default: "''",
        description: 'Описание под заголовком.',
      },
      { name: 'caption', type: 'string', default: "''", description: 'Подпись над заголовком.' },
      {
        name: 'lowerCaption',
        type: 'string',
        default: "''",
        description: 'Подпись под описанием; атрибут lower-caption.',
      },
    ],
    events: [],
    slots: [
      {
        name: 'media',
        description:
          'Произвольное содержимое до Content, включая изображение естественных пропорций. В React — свойство media.',
      },
      {
        name: 'header',
        description: 'Заменяет готовую композицию заголовка и подписей. В React — свойство header.',
      },
      { name: 'badge', description: 'Знак рядом с heading. В React — свойство badge.' },
      {
        name: '(default)',
        description: 'Произвольное содержимое после заголовка. В React — children.',
      },
      { name: 'footer', description: 'Действия или метаданные. В React — свойство footer.' },
    ],
  },
};
