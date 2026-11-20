import '@labpics/ui-core/dialog';
import '@labpics/ui-core/alert-dialog';
import '@labpics/ui-core/popover';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-alert-dialog');
  element.heading = 'Удалить пространство?';
  element.description = 'Пространство и его данные будут удалены без возможности восстановления.';
  const trigger = document.createElement('lab-button');
  trigger.slot = 'trigger';
  trigger.textContent = 'Удалить пространство';
  element.append(trigger);
  element.confirmLabel = 'Удалить';
  element.addEventListener('confirm', () => {
    element.open = false;
  });
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  return element;
}
export const alertDialogDoc: ComponentDoc = {
  slug: 'alert-dialog',
  tag: 'lab-alert-dialog',
  title: 'AlertDialog',
  summary: 'Подтверждение с явными действиями Продолжить и Отмена.',
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
      name: 'Решение',
      description:
        'Продолжить сообщает намерение и ждёт завершения операции; Отмена закрывает подтверждение.',
    },
  ],
  meaning: {
    purpose: 'Подтверждение с явными действиями Продолжить и Отмена.',
    dos: [
      'Задайте понятный заголовок.',
      'Закрывайте подтверждение после успешной операции; при ошибке сохраняйте его открытым.',
    ],
    donts: ['Не выполняйте опасное действие при открытии или получении фокуса.'],
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
        name: 'confirmLabel / cancelLabel',
        type: 'string',
        default: 'Продолжить / Отмена',
        description: 'Названия двух встроенных действий. Начальный фокус получает Отмена.',
      },
      {
        name: 'pending',
        type: 'boolean',
        default: 'false',
        description: 'Показывает ожидание и блокирует повторное подтверждение.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description: 'CustomEvent<{ open: boolean }>: запрос изменить открытое состояние.',
      },
      {
        name: 'confirm',
        description: 'Намерение выполнить действие. Само событие не закрывает диалог.',
      },
      {
        name: 'cancel',
        description: 'Нажатие Отмена. Escape также закрывает подтверждение через open-change.',
      },
    ],
    slots: [
      {
        name: 'trigger',
        description:
          'Одна lab-button или button[type=button]. Пустой слот использует текст default как подпись.',
      },
      { name: 'content', description: 'Содержимое панели: форма или пояснение.' },
    ],
  },
};
