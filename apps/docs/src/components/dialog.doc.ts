import '@labpics/ui-core/dialog';
import '@labpics/ui-core/alert-dialog';
import '@labpics/ui-core/popover';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-dialog');
  element.heading = 'Настройки пространства';
  element.description = 'Название изменится после сохранения.';
  const trigger = document.createElement('lab-button');
  trigger.slot = 'trigger';
  trigger.textContent = 'Изменить настройки';
  element.append(trigger);
  const field = document.createElement('input');
  field.slot = 'content';
  field.setAttribute('aria-label', 'Название');
  field.value = 'Моё пространство';
  element.append(field);
  const save = document.createElement('lab-button');
  save.slot = 'actions';
  save.textContent = 'Сохранить';
  save.addEventListener('click', () => {
    element.open = false;
  });
  element.append(save);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  return element;
}
export const dialogDoc: ComponentDoc = {
  slug: 'dialog',
  tag: 'lab-dialog',
  title: 'Dialog',
  summary: 'Диалог для отдельной задачи. Закрытие сохраняет черновик формы.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Размер',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
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
        'Скругление 24 px, заголовок, описание и содержимое. Вмещается в экран и прокручивается при увеличенном тексте.',
    },
    {
      index: 3,
      name: 'Содержимое',
      description: 'Содержимое остаётся в своём дереве: черновик и локальная тема сохраняются.',
    },
  ],
  meaning: {
    purpose: 'Диалог для отдельной задачи. Закрытие сохраняет черновик формы.',
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
        default: 'true',
        description: 'Ограничивает фокус панелью и блокирует прокрутку страницы.',
      },
      {
        name: 'closable / closeLabel',
        type: 'boolean / string',
        default: 'true / Закрыть',
        description: 'Кнопка закрытия и её имя для доступности.',
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
