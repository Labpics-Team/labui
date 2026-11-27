import '@labpics/ui-core/button';
import '@labpics/ui-core/snackbar';
import type { ComponentDoc } from '../template/component-doc.js';

function makeSnackbar(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const snackbar = document.createElement('lab-snackbar');
  snackbar.message = 'Проект добавлен в избранное';
  snackbar.duration = 0;
  snackbar.open = true;
  if (attrs.action === true) snackbar.actionLabel = 'Отменить';
  return snackbar;
}

function makeExample(): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'display:grid;gap:24px;justify-items:start;max-width:100%';
  const button = document.createElement('lab-button');
  const snackbar = document.createElement('lab-snackbar');
  let favorite = false;
  let previous = false;
  let notification = 0;
  const updateButton = () => {
    button.textContent = favorite ? 'Убрать из избранного' : 'Добавить в избранное';
  };
  button.addEventListener('click', () => {
    previous = favorite;
    favorite = !favorite;
    updateButton();
    snackbar.message = favorite ? 'Проект добавлен в избранное' : 'Проект убран из избранного';
    snackbar.actionLabel = 'Отменить';
    snackbar.notificationKey = ++notification;
    snackbar.open = true;
  });
  snackbar.addEventListener('lab-action', () => {
    favorite = previous;
    updateButton();
  });
  updateButton();
  root.append(button, snackbar);
  return root;
}

export const snackbarDoc: ComponentDoc = {
  slug: 'snackbar',
  tag: 'lab-snackbar',
  title: 'Snackbar',
  summary:
    'Краткий результат действия с необязательной отменой. Появляется без перемещения фокуса.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Без таймера',
        attribute: 'action',
        options: [
          { label: 'Сообщение', value: false },
          { label: 'С действием', value: true },
        ],
      },
    ],
    make: makeSnackbar,
  },
  anatomy: [
    {
      index: 1,
      name: 'Поверхность',
      description:
        'Компактная капсула на приподнятом материале; сохраняет тему окружающего интерфейса.',
    },
    {
      index: 2,
      name: 'Сообщение',
      description: 'Коротко называет получившийся результат. Объявляется один раз как status.',
    },
    {
      index: 3,
      name: 'Таймер',
      description:
        'Показывает оставшееся время. При наведении, фокусе внутри и скрытии вкладки отсчёт останавливается.',
    },
    {
      index: 4,
      name: 'Действие',
      description:
        'Необязательная кнопка малого размера. Например, отменяет только что выполненное действие.',
    },
  ],
  meaning: {
    purpose:
      'Подтверждайте завершённое действие, не прерывая работу. В примере отмена действительно восстанавливает предыдущее состояние избранного.',
    dos: [
      'Размещайте сообщение у нижнего края рабочей области.',
      'Сохраняйте постоянный путь к действию, если оно нужно и после исчезновения сообщения.',
    ],
    donts: [
      'Не прячьте ошибку, требующую исправления, во временном сообщении.',
      'Не перемещайте фокус к Snackbar при появлении.',
    ],
  },
  liveExample: { make: makeExample, controls: [] },
  api: {
    props: [
      { name: 'open', type: 'boolean', default: 'false', description: 'Показывает сообщение.' },
      { name: 'message', type: 'string', default: "''", description: 'Текст результата.' },
      {
        name: 'duration',
        type: 'number',
        default: '5000',
        description:
          'Время в миллисекундах. Ноль убирает таймер и оставляет сообщение до закрытия приложением.',
      },
      {
        name: 'actionLabel / action-label',
        type: 'string',
        default: "''",
        description: 'Подпись необязательного действия.',
      },
      {
        name: 'notificationKey / notification-key',
        type: 'string | number',
        description: 'Новое значение перезапускает сообщение, в том числе с тем же текстом.',
      },
    ],
    events: [
      {
        name: 'lab-open-change',
        description: 'CustomEvent<{ open: false }> при закрытии таймером или действием.',
      },
      {
        name: 'lab-action',
        description: 'Отменяемое событие действия. preventDefault() сохраняет сообщение открытым.',
      },
      { name: 'lab-error', description: 'CustomEvent<{ error: unknown }> при ошибке эффекта.' },
    ],
    slots: [],
  },
};
