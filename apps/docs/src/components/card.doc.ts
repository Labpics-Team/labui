import '@labpics/ui-core/card';
import '@labpics/ui-core/button';
import '@labpics/ui-core/sheet';
import '@labpics/ui-core/switch';
import type { ComponentDoc } from '../template/component-doc.js';

function makeCard(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const card = document.createElement('lab-card');
  card.heading = 'Исследование цвета';
  card.description = 'Новая коллекция оттенков и материалов.';
  card.lowerCaption = 'Обновлено сегодня';
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) card.setAttribute(key, value === true ? '' : value);
  }
  return card;
}

function makeNotificationSettings(): HTMLElement {
  const card = document.createElement('lab-card');
  card.heading = 'Уведомления';
  card.description = 'Выберите, какие новости проекта получать.';
  card.dataset.testid = 'notification-settings';

  const enabled = document.createElement('lab-switch');
  enabled.checked = true;
  enabled.textContent = 'Получать уведомления';
  enabled.dataset.material = 'solid';
  enabled.dataset.testid = 'notification-enabled';

  const sheet = document.createElement('lab-sheet');
  sheet.slot = 'footer';
  sheet.position = 'flex';
  sheet.heading = 'Настройки уведомлений';
  const trigger = document.createElement('lab-button');
  trigger.slot = 'trigger';
  trigger.type = 'neutral';
  trigger.kind = 'border';
  trigger.textContent = 'Настроить';
  trigger.dataset.material = 'solid';
  trigger.dataset.testid = 'settings-trigger';

  const body = document.createElement('div');
  body.slot = 'content';
  body.style.cssText = 'display:grid;gap:var(--lab-space-sheet-gap);margin:0';
  const comments = document.createElement('lab-switch');
  comments.checked = true;
  comments.textContent = 'Сообщать о комментариях';
  comments.dataset.material = 'solid';
  comments.dataset.testid = 'comments-enabled';
  const done = document.createElement('lab-button');
  done.textContent = 'Готово';
  done.dataset.material = 'solid';
  done.dataset.testid = 'settings-done';
  done.addEventListener('click', () => {
    sheet.open = false;
  });

  const updateSettings = (): void => {
    comments.disabled = !enabled.checked;
    sheet.description = enabled.checked
      ? 'Изменения применяются сразу.'
      : 'Сначала включите уведомления в карточке.';
    card.lowerCaption = enabled.checked
      ? `Комментарии ${comments.checked ? 'включены' : 'выключены'}`
      : 'Без уведомлений';
  };
  enabled.addEventListener('checked-change', updateSettings);
  comments.addEventListener('checked-change', updateSettings);
  updateSettings();
  body.append(comments, done);
  sheet.append(trigger, body);
  card.append(enabled, sheet);
  return card;
}

const variants = [
  { label: 'Elevated', value: 'elevated' },
  { label: 'Outlined', value: 'outlined' },
  { label: 'Filled', value: 'filled' },
];
const paddings = [
  { label: 'Без отступа', value: 'none' },
  { label: 'S', value: 's' },
  { label: 'M', value: 'm' },
  { label: 'L', value: 'l' },
];

export const cardDoc: ComponentDoc = {
  slug: 'card',
  order: 13,
  tag: 'lab-card',
  title: 'Card',
  summary:
    'Карточка с изображением, заголовком, описанием и дополнительным содержимым. Передайте данные — компонент сам задаст их расположение и типографику.',
  status: { kind: 'beta', note: 'Соответствие материалов Blur и Glass эталону уточняется.' },
  statesMatrix: {
    axes: [
      { name: 'Вариант', attribute: 'variant', options: variants },
      { name: 'Отступ', attribute: 'padding', options: paddings.slice(1) },
    ],
    make: makeCard,
  },
  anatomy: [
    {
      index: 1,
      name: 'Поверхность',
      description: 'Общая рамка карточки. Обводка рисуется внутри и не меняет размеры содержимого.',
    },
    {
      index: 2,
      name: 'Изображение',
      description:
        'imageSrc задаёт переднее изображение и декоративную подложку материала. При заданной высоте изображение занимает место, оставшееся после Content; без неё сохраняет естественные пропорции.',
    },
    {
      index: 3,
      name: 'Текст',
      description:
        'Caption, заголовок с Title Hint и Badge, описание и нижняя подпись. Пустые данные не создают промежутков. Header заменяет эту группу целиком.',
    },
    {
      index: 4,
      name: 'Дополнительное содержимое',
      description:
        'Default slot располагается после текста, footer — последним. Материал применяется к общей области Content.',
    },
  ],
  meaning: {
    purpose:
      'Объединяет изображение и сведения об одном предмете: статье, проекте или товаре. Ссылку или кнопку действия передавайте обычным вложенным компонентом.',
    dos: [
      'Используйте heading и description для стандартной композиции; header — для собственного содержимого.',
      'Задавайте headingLevel по структуре страницы: он меняет уровень заголовка, сохраняя его оформление.',
      'Передавайте imageAlt, если изображение сообщает что-то помимо соседнего текста.',
    ],
    donts: [
      'Не задавайте фиксированную высоту верхнего изображения для всех карточек: она зависит от рамки и содержимого.',
      'Не используйте interactive вместо настоящей ссылки или кнопки: свойство добавляет только оформление hover и focus.',
    ],
  },
  liveExample: {
    make: makeNotificationSettings,
    controls: [
      { kind: 'select', label: 'Вариант', attribute: 'variant', options: variants },
      { kind: 'select', label: 'Отступ', attribute: 'padding', options: paddings },
      { kind: 'toggle', label: 'Hover и focus', attribute: 'interactive' },
    ],
  },
  api: {
    props: [
      {
        name: 'imageSrc / image-src',
        type: 'string',
        default: "''",
        description: 'Источник изображения. Непустое значение имеет приоритет над media.',
      },
      {
        name: 'imageAlt / image-alt',
        type: 'string',
        default: "''",
        description:
          'Описание переднего изображения; декоративная подложка всегда скрыта от скринридера.',
      },
      {
        name: 'heading',
        type: 'string',
        default: "''",
        description: 'Заголовок. Одна видимая строка; полный текст остаётся доступным.',
      },
      {
        name: 'headingLevel / heading-level',
        type: '1 | 2 | 3 | 4 | 5 | 6',
        default: '2',
        description: 'Уровень HTML-заголовка.',
      },
      {
        name: 'titleHint / title-hint',
        type: 'string',
        default: "''",
        description: 'Дополнительный текст рядом с заголовком, без ограничения строк.',
      },
      {
        name: 'badge',
        type: 'string',
        default: "''",
        description: 'Метка стандартного Badge в строке заголовка.',
      },
      { name: 'caption', type: 'string', default: "''", description: 'Подпись над заголовком.' },
      {
        name: 'description',
        type: 'string',
        default: "''",
        description: 'Описание, до двух видимых строк.',
      },
      {
        name: 'lowerCaption / lower-caption',
        type: 'string',
        default: "''",
        description: 'Нижняя подпись, до двух видимых строк.',
      },
      {
        name: 'variant',
        type: "'elevated' | 'outlined' | 'filled'",
        default: "'elevated'",
        description:
          'Elevated использует текущий материал; outlined и filled — статическое оформление.',
      },
      {
        name: 'padding',
        type: "'none' | 's' | 'm' | 'l'",
        default: "'l'",
        description: 'Отступ всей области Content: 0, 8, 16 или 24 px при корневом кегле 16 px.',
      },
      {
        name: 'interactive',
        type: 'boolean',
        default: 'false',
        description: 'Добавляет оформление hover и focus для карточки с вложенным действием.',
      },
    ],
    events: [],
    slots: [
      {
        name: 'media',
        description:
          'Произвольная передняя композиция при пустом imageSrc; подложка автоматически не создаётся.',
      },
      {
        name: 'header',
        description: 'Заменяет собственную текстовую группу целиком, включая Title Hint и Badge.',
      },
      { name: '(default)', description: 'Дополнительное содержимое после текстовой группы.' },
      { name: 'footer', description: 'Последняя область Content для действий или метаданных.' },
    ],
  },
};
