import '@labpics/ui-core/drag-button';
import '@labpics/ui-core/button';
import type { ComponentDoc } from '../template/component-doc.js';

function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const button = document.createElement('lab-drag-button');
  button.label = 'Подтвердить перевод';
  button.helperText = 'Подтвердить перевод';
  button.pendingText = 'Отправляем';
  button.successText = 'Отправлено';
  button.dangerText = 'Не отправлено';
  button.style.width = '100%';
  for (const [name, value] of Object.entries(attrs))
    if (value !== false) button.setAttribute(name, value === true ? '' : String(value));
  return button;
}
export const dragButtonDoc: ComponentDoc = {
  slug: 'drag-button',
  tag: 'lab-drag-button',
  title: 'Drag Button',
  summary:
    'Подтверждение нажатием или движением до конца дорожки. Результат сохраняется до следующего действия.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Состояние',
        attribute: 'status',
        options: [
          { label: 'Ожидает действия', value: 'idle' },
          { label: 'Выполняется', value: 'pending' },
          { label: 'Успешно', value: 'success' },
          { label: 'Ошибка', value: 'danger' },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Дорожка',
      description:
        '56 px, радиус 20 px и отступ 4 px. Фон и подпись проходят через авторскую размытую маску.',
    },
    {
      index: 2,
      name: 'Растущая кнопка',
      description: 'Обычный Button medium: высота 48 px, радиус 16 px, шеврон на подвижном конце.',
    },
    {
      index: 3,
      name: 'Результат',
      description: 'Та же кнопка занимает всю дорожку; знак и сообщение располагаются по центру.',
    },
  ],
  meaning: {
    purpose: 'Действие с ощутимым подтверждением: перевод, отправка или завершение шага.',
    dos: [
      'Называйте действие в label.',
      'Обновляйте status по ответу приложения.',
      'Дайте человеку явно начать повтор через resetKey.',
    ],
    donts: [
      'Не используйте как защиту от автоматизации.',
      'Не требуйте перетаскивания как единственного способа ввода.',
    ],
  },
  liveExample: {
    make: () => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:grid;gap:1rem;width:100%;max-width:32rem';
      const button = make({}) as HTMLElementTagNameMap['lab-drag-button'];
      const reset = document.createElement('lab-button');
      reset.textContent = 'Новый перевод';
      reset.onclick = () => {
        button.status = 'idle';
        button.resetKey = String(Number(button.resetKey || 0) + 1);
      };
      button.addEventListener('complete', () => {
        button.status = 'success';
      });
      wrapper.append(button, reset);
      return wrapper;
    },
    controls: [],
  },
  api: {
    props: [
      {
        name: 'label',
        type: 'string',
        description: 'Обязательное понятное имя действия для клавиатуры и экранного диктора.',
      },
      {
        name: 'helperText / showHelper',
        type: 'string / boolean',
        description: 'Подпись дорожки; по умолчанию Swipe it, показана.',
      },
      {
        name: 'status',
        type: "'idle' | 'pending' | 'success' | 'danger'",
        default: "'idle'",
        description:
          'Результат приложения. После complete компонент немедленно блокирует повтор и показывает pending.',
      },
      {
        name: 'pendingText / successText / dangerText',
        type: 'string',
        description: 'Локализованные сообщения ожидания и результата, объявляемые в live region.',
      },
      {
        name: 'resetKey',
        type: 'string',
        description:
          'Новый ключ начинает новую попытку. Возврат status в idle после результата также сбрасывает попытку.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Отключает кнопку и отменяет активное перетаскивание.',
      },
    ],
    events: [
      {
        name: 'complete',
        description:
          "Один CustomEvent<{ source: 'drag' | 'press' }> после завершения жеста или обычного нажатия.",
      },
    ],
    slots: [],
  },
};
