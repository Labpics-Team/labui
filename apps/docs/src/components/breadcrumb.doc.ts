import '@labpics/ui-core/breadcrumb';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>> = {}): HTMLElement {
  const element = document.createElement('lab-breadcrumb');
  element.items = [
    { label: 'Пространства', href: '#spaces' },
    { label: 'Команда', href: '#team' },
    { label: 'Проекты', href: '#projects' },
    { label: 'Дизайн', href: '#design' },
    { label: 'Настройки' },
  ];
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  }
  return element;
}

const sizes = [
  { label: 'S', value: 's' },
  { label: 'M · макет', value: 'm' },
  { label: 'L', value: 'l' },
];
export const breadcrumbDoc: ComponentDoc = {
  slug: 'breadcrumb',
  order: 10,
  tag: 'lab-breadcrumb',
  title: 'Breadcrumb',
  summary: 'Путь от корня к текущему разделу. Длинная цепочка раскрывается через многоточие.',
  status: { kind: 'stable' },
  statesMatrix: { axes: [{ name: 'Размер', attribute: 'size', options: sizes }], make },
  anatomy: [
    { index: 1, name: 'Корень', description: 'Первый уровень остаётся видимым.' },
    {
      index: 2,
      name: 'Скрытые уровни',
      description: 'Многоточие раскрывает промежуточные разделы и переносит к ним фокус.',
    },
    {
      index: 3,
      name: 'Родительские страницы',
      description: 'Ссылки ведут к предыдущим уровням иерархии.',
    },
    {
      index: 4,
      name: 'Текущая страница',
      description: 'Основной цвет, тот же вес Medium. Повторного действия нет.',
    },
  ],
  meaning: {
    purpose: 'Помогает понять положение страницы и вернуться к нужному уровню разделов.',
    dos: [
      'Сохраняйте порядок от корня к текущему разделу.',
      'Используйте названия соответствующих страниц.',
    ],
    donts: [
      'Не подменяйте иерархию историей переходов.',
      'Не скрывайте единственный путь к предыдущим разделам без раскрытия.',
    ],
  },
  liveExample: {
    make: () => make(),
    controls: [
      { kind: 'select', label: 'Размер', attribute: 'size', options: sizes },
      {
        kind: 'select',
        label: 'Длина пути',
        attribute: 'max-items',
        options: [
          { label: 'Кратко', value: '4' },
          { label: 'Все разделы', value: '0' },
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'items',
        type: 'LabBreadcrumbItem[]',
        default: '[]',
        description:
          'Пункты { label, href? }. Последний обозначает текущую страницу; пункт без адреса остаётся текстом.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'M повторяет авторские 14/12 и шаг 8. S/L — расширения.',
      },
      {
        name: 'maxItems',
        type: 'number',
        default: '4',
        description:
          'Число видимых позиций вместе с многоточием. Ноль показывает всё. В Lit: max-items.',
      },
      {
        name: 'label',
        type: 'string',
        default: 'Навигационная цепочка',
        description: 'Доступное имя навигационной области.',
      },
      {
        name: 'expandLabel',
        type: 'string',
        default: 'Показать все разделы',
        description: 'Доступное имя кнопки раскрытия. В Lit: expand-label.',
      },
      {
        name: 'separator',
        type: 'string / ReactNode',
        default: 'Авторский шеврон',
        description: 'Необязательный собственный разделитель; скрыт от чтения.',
      },
    ],
    events: [],
    slots: [],
  },
};
