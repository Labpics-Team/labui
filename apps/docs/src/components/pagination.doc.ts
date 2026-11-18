import '@labpics/ui-core/pagination';
import type { ComponentDoc } from '../template/component-doc.js';

function makePagination(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-pagination');
  el.count = 60;
  el.defaultPage = 3;
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) el.setAttribute(key, value === true ? '' : value);
  return el;
}
export const paginationDoc: ComponentDoc = {
  slug: 'pagination',
  order: 11,
  tag: 'lab-pagination',
  title: 'Pagination',
  summary:
    'Нумерованные страницы и компактные точки. Выбор страницы меняет связанную выборку; ссылки сохраняют адрес назначения.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Вариант',
        attribute: 'variant',
        options: [
          { label: 'Страницы', value: 'numbered' },
          { label: 'Точки', value: 'compact' },
        ],
      },
      {
        name: 'Доступность',
        attribute: 'disabled',
        options: [
          { label: 'Доступно', value: false },
          { label: 'Недоступно', value: true },
        ],
      },
    ],
    make: makePagination,
  },
  anatomy: [
    {
      index: 1,
      name: 'Страницы',
      description:
        'Контролы 40 px, интервал 8 px, Geist Medium 16/24. Выбранная страница использует нейтральную поверхность.',
    },
    {
      index: 2,
      name: 'Стрелки',
      description:
        'Контуры Chevron-button. Недоступны за границами выборки; направление следует RTL.',
    },
    {
      index: 3,
      name: 'Пропуск',
      description:
        'Три авторские точки обозначают скрытые номера. Не являются действием и исключены из дерева доступности.',
    },
    {
      index: 4,
      name: 'Compact',
      description:
        'До пяти точек 8 px; крайние уменьшаются, если за ними есть страницы. Ambient добавляет материал Base, progress — трек длиной 20 px.',
    },
  ],
  meaning: {
    purpose:
      'Позволяет вернуться к определённому участку конечной коллекции. Для медиа компактный вариант показывает текущий кадр и прогресс его воспроизведения.',
    dos: [
      'Передавайте count и page-size из отображаемых данных.',
      'Обновляйте данные в ответ на page-change либо задайте href с {page}.',
      'В controlled-режиме обновляйте page только после принятия запроса.',
    ],
    donts: [
      'Не изображайте доступной отсутствующую страницу.',
      'Не используйте точки без связанного содержимого.',
      'Не запускайте автоматическую смену слайдов без доступной паузы в проигрывателе.',
    ],
  },
  liveExample: {
    make: () => {
      const section = document.createElement('section');
      const records = Array.from({ length: 24 }, (_, index) => `Исследование ${index + 1}`);
      const list = document.createElement('ul');
      const pagination = document.createElement('lab-pagination');
      pagination.count = records.length;
      pagination.pageSize = 3;
      pagination.page = 1;
      pagination.label = 'Страницы исследований';
      pagination.previousLabel = 'Предыдущая страница';
      pagination.nextLabel = 'Следующая страница';
      pagination.pageLabel = 'Страница {page}';
      const show = (page: number) => {
        list.replaceChildren(
          ...records.slice((page - 1) * 3, page * 3).map((text) => {
            const li = document.createElement('li');
            li.textContent = text;
            return li;
          }),
        );
      };
      pagination.addEventListener('page-change', (event) => {
        pagination.page = (event as CustomEvent<{ page: number }>).detail.page;
        show(pagination.page);
      });
      show(1);
      section.append(list, pagination);
      return section;
    },
    controls: [],
  },
  api: {
    props: [
      {
        name: 'count',
        type: 'number',
        default: '0',
        description: 'Число записей. Пустая выборка отключает оба направления.',
      },
      {
        name: 'page-size',
        type: 'number',
        default: '10',
        description: 'Записей на странице; положительное целое.',
      },
      {
        name: 'page',
        type: 'number | undefined',
        default: 'undefined',
        description: 'Controlled-вход через свойство или атрибут. Отказ не меняет выбор.',
      },
      {
        name: 'default-page',
        type: 'number',
        default: '1',
        description: 'Начальная неконтролируемая страница.',
      },
      {
        name: 'variant',
        type: "'numbered' | 'compact'",
        default: "'numbered'",
        description: 'Авторская анатомия страниц или точек.',
      },
      {
        name: 'sibling-count',
        type: 'number',
        default: '1',
        description: 'Соседние номера с каждой стороны, 0–4. Не размер компонента.',
      },
      {
        name: 'href',
        type: 'string',
        default: "''",
        description: 'Шаблон адреса, например ?page={page}. Пустой использует кнопки.',
      },
      {
        name: 'ambient',
        type: 'boolean',
        default: 'false',
        description: 'Материал Base под компактным вариантом.',
      },
      {
        name: 'progress',
        type: 'number | undefined',
        default: 'undefined',
        description:
          'Временной трек Compact, 0–1. Значение приходит из проигрывателя; таймера внутри нет.',
      },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Отключает переходы.' },
      {
        name: 'label / previous-label / next-label / page-label',
        type: 'string',
        default: 'English labels',
        description: 'Доступные имена. page-label поддерживает {page}.',
      },
    ],
    events: [
      {
        name: 'page-change',
        description:
          'CustomEvent<{page, pageSize}>: запрос страницы. React: onPageChange(page). Compose: onPageChange(Int).',
      },
    ],
    slots: [],
  },
};
