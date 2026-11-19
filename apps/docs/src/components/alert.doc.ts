import '@labpics/ui-core/alert';
import '@labpics/ui-core/button';
import type { ComponentDoc } from '../template/component-doc.js';

const types = [
  { label: 'Neutral', value: 'neutral' },
  { label: 'Danger', value: 'danger' },
];
const quantities = [1, 2, 3].map((n) => ({ label: String(n), value: String(n) }));
function makeAlert(attrs: Readonly<Record<string, string | boolean>>) {
  const el = document.createElement('lab-alert');
  el.heading = 'Изменения сохранены';
  el.description = 'Коллеги увидят новую версию проекта.';
  el.style.width = 'min(450px, 100%)';
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  return el;
}
export const alertDoc: ComponentDoc = {
  slug: 'alert',
  order: 35,
  tag: 'lab-alert',
  title: 'Alert',
  summary:
    'Важное сообщение с закрытием. Дополнительные слои показывают, что в очереди есть другие сообщения.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Тип', attribute: 'type', options: types },
      { name: 'Глубина', attribute: 'quantity', options: quantities },
    ],
    make: makeAlert,
  },
  anatomy: [
    {
      index: 1,
      name: 'Поверхность',
      description: 'Elevated, radius 24, padding 16. Цвет и материал следуют выбранной теме.',
    },
    {
      index: 2,
      name: 'Иконка',
      description: 'Знак 24. Danger окрашивает ведущую иконку в семантический цвет ошибки.',
    },
    {
      index: 3,
      name: 'Текст',
      description: 'Заголовок 16/24 Medium и описание 16/24 Regular. Длинный текст переносится.',
    },
    {
      index: 4,
      name: 'Закрытие',
      description: 'Кнопка 24 с доступным названием. Работает мышью, Enter и Space.',
    },
    {
      index: 5,
      name: 'Стопка',
      description:
        'Base и Muted добавляют по 8 высоты. Глубина не заменяет хранилище сообщений приложения.',
    },
  ],
  meaning: {
    purpose:
      'Сообщить об ошибке, подтверждении или состоянии системы без прерывания текущего действия.',
    dos: [
      'Пишите короткий заголовок и понятный следующий шаг.',
      'Сохраняйте сообщения очереди в состоянии приложения.',
      'Выбирайте assertive только для срочных событий.',
    ],
    donts: [
      'Не используйте Alert для полного текста инструкции.',
      'Не закрывайте важные сообщения по короткому таймеру.',
    ],
  },
  liveExample: {
    make: () => {
      const el = makeAlert({ quantity: '3' });
      el.controlled = true;
      const stage = document.createElement('div');
      stage.style.cssText = 'display:grid;gap:16px;justify-items:start;max-width:100%';
      const show = document.createElement('lab-button');
      show.textContent = 'Показать сообщения';
      show.kind = 'tinted';
      const messages = ['Изменения сохранены', 'Экспорт подготовлен', 'Доступ обновлён'];
      let index = 0;
      show.addEventListener('click', () => {
        index = 0;
        el.heading = messages[0] ?? '';
        el.quantity = messages.length;
        el.notificationKey = index;
        el.open = true;
      });
      el.addEventListener('dismiss', () => {
        index++;
        el.open = index < messages.length;
        el.quantity = messages.length - index;
        el.notificationKey = index;
        const next = messages[index];
        if (next !== undefined) el.heading = next;
      });
      stage.append(show, el);
      return stage;
    },
    controls: [],
  },
  api: {
    props: [
      {
        name: 'heading / description',
        type: 'string',
        description: 'Заголовок и необязательное описание.',
      },
      {
        name: 'type',
        type: "'neutral' | 'danger'",
        default: 'neutral',
        description: 'Цвет ведущей иконки.',
      },
      {
        name: 'quantity',
        type: 'number',
        default: '1',
        description: 'Видимая глубина стопки, максимум 3.',
      },
      {
        name: 'open / controlled',
        type: 'boolean',
        default: 'true / false',
        description:
          'Видимость и управление закрытием из приложения. В React наличие open включает управление.',
      },
      {
        name: 'showIcon',
        type: 'boolean',
        default: 'true',
        description: 'Показывает ведущую иконку.',
      },
      {
        name: 'closeLabel',
        type: 'string',
        default: 'Закрыть уведомление',
        description: 'Доступное имя закрытия.',
      },
      {
        name: 'announcement / notificationKey',
        type: "'polite' | 'assertive' / string | number",
        description: 'Срочность и идентичность объявления.',
      },
    ],
    events: [
      {
        name: 'dismiss',
        type: 'Event',
        description: 'Запрос закрытия. preventDefault сохраняет неконтролируемое сообщение.',
      },
    ],
    slots: [{ name: 'icon', description: 'Замена ведущей декоративной иконки.' }],
  },
};
