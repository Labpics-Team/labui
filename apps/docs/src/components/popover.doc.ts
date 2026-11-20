import '@labpics/ui-core/dialog';
import '@labpics/ui-core/alert-dialog';
import '@labpics/ui-core/popover';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-popover');
  element.heading = 'Настройки вида';
  element.description = 'Изменение применяется к текущему виду.';
  const trigger = document.createElement('lab-button');
  trigger.slot = 'trigger';
  trigger.textContent = 'Настроить вид';
  element.append(trigger);
  const field = document.createElement('input');
  field.slot = 'content';
  field.setAttribute('aria-label', 'Название');
  field.value = 'Моё пространство';
  element.append(field);

  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  return element;
}
export const popoverDoc: ComponentDoc = {
  slug: 'popover',
  tag: 'lab-popover',
  title: 'Popover',
  summary: 'Дополнительные настройки рядом с открывающей кнопкой.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Положение',
        attribute: 'placement',
        options: [
          { label: 'Сверху', value: 'top' },
          { label: 'Снизу', value: 'bottom' },
          { label: 'Сбоку', value: 'right' },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Кнопка открытия',
      description: 'Одна настоящая кнопка. После закрытия фокус возвращается к ней.',
    },
    {
      index: 2,
      name: 'Поверхность',
      description:
        'Скругление 24 px, заголовок, описание и содержимое. Положение следует кнопке и свободному месту у края экрана.',
    },
    {
      index: 3,
      name: 'Содержимое',
      description: 'Содержимое остаётся в своём дереве: черновик и локальная тема сохраняются.',
    },
  ],
  meaning: {
    purpose: 'Дополнительные настройки рядом с открывающей кнопкой.',
    dos: ['Задайте понятный заголовок.', 'Храните результат отдельно от редактируемого черновика.'],
    donts: ['Не открывайте панель без явного действия человека.'],
  },
  liveExample: { make: () => make({}), controls: [] },
  api: {
    props: [
      {
        name: 'open / controlled',
        type: 'boolean',
        default: 'false',
        description: 'Открытое состояние. controlled оставляет принятие open-change приложению.',
      },
      {
        name: 'heading / description',
        type: 'string',
        description: 'Видимый заголовок и пояснение; связаны с именем и описанием диалога.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description:
          'Предельная ширина поверхности. Узкий экран ограничивает её доступной шириной.',
      },
      {
        name: 'modal',
        type: 'boolean',
        default: 'false',
        description: 'Ограничивает фокус панелью и блокирует прокрутку страницы.',
      },
      {
        name: 'closable / closeLabel',
        type: 'boolean / string',
        default: 'false / Закрыть',
        description: 'Кнопка закрытия и её имя для доступности.',
      },
      {
        name: 'placement / arrow',
        type: 'Placement / boolean',
        default: 'bottom / true',
        description:
          'Предпочтительная сторона и указатель. У края окна сторона меняется автоматически.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description: 'CustomEvent<{ open: boolean }>: запрос изменить открытое состояние.',
      },
    ],
    slots: [
      {
        name: 'trigger',
        description:
          'Одна lab-button или button[type=button]. Пустой слот использует текст default как подпись.',
      },
      { name: 'content', description: 'Содержимое панели: форма или пояснение.' },
      { name: 'actions', description: 'Кнопки завершения задачи.' },
    ],
  },
};
