import '@labpics/ui-core/dialog';
import type { ComponentDoc } from '../template/component-doc.js';

function makeDialog(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const dialog = document.createElement('lab-dialog');
  dialog.append(document.createTextNode('Открыть диалог'));
  dialog.heading = 'Настройки';
  dialog.description = 'Короткая задача поверх текущего экрана.';
  const body = document.createElement('p');
  body.slot = 'content';
  body.textContent = 'Закройте диалог, чтобы вернуться к работе. Escape также закрывает окно.';
  dialog.append(body);
  for (const [attribute, value] of Object.entries(attrs)) {
    if (value !== false) dialog.setAttribute(attribute, value === true ? '' : value);
  }
  return dialog;
}

const sizes = [
  { label: 'S', value: 's' },
  { label: 'M', value: 'm' },
  { label: 'L', value: 'l' },
];
const modalModes = [
  { label: 'Модальный', value: 'true' },
  { label: 'Немодальный', value: 'false' },
];

export const dialogDoc: ComponentDoc = {
  slug: 'dialog',
  order: 11,
  tag: 'lab-dialog',
  title: 'Dialog',
  summary:
    'Диалог для короткой задачи в текущем контексте. Модальный режим удерживает фокус и блокирует фон до закрытия.',
  status: { kind: 'beta', note: 'Core и native React используют общий владелец поведения.' },
  statesMatrix: {
    axes: [
      { name: 'Размер', attribute: 'size', options: sizes },
      { name: 'Режим', attribute: 'modal', options: modalModes },
    ],
    make: makeDialog,
  },
  anatomy: [
    {
      index: 1,
      name: 'Кнопка открытия',
      description:
        'Один native control получает события, aria-haspopup, aria-expanded, связь с управляемой поверхностью и возврат фокуса.',
    },
    {
      index: 2,
      name: 'Модальная плоскость',
      description:
        'Manual popover выходит в browser top layer и сохраняет CSS-предков. Собственный shadow root содержит поверхность диалога.',
    },
    {
      index: 3,
      name: 'Подложка',
      description: 'Показывается в модальном режиме; обозначает блокировку фонового интерфейса.',
    },
    {
      index: 4,
      name: 'Диалог',
      description:
        'Поверхность с role="dialog". Заголовок и описание связываются с доступным именем и пояснением в том же shadow root.',
    },
    {
      index: 5,
      name: 'Содержимое',
      description:
        'slot="content" проецирует исходные узлы потребителя. Вложенные controls участвуют в общем modal focus lifecycle.',
    },
    {
      index: 6,
      name: 'Закрытие',
      description:
        'Необязательная кнопка закрывает диалог и возвращает фокус к актуальной кнопке открытия.',
    },
  ],
  meaning: {
    purpose:
      'Подходит для ограниченной задачи поверх текущего экрана. Если решение требует явного подтверждения и защиты от случайного outside click, используйте Alert Dialog.',
    dos: [
      'Дайте диалогу заголовок и понятное действие завершения.',
      'Передайте настоящий LabButton через slot="trigger", если нужны варианты Button.',
      'Помещайте поля и действия в slot="content"; компонент сохраняет их узлы и состояние.',
    ],
    donts: [
      'Не вкладывайте controls в текст встроенной кнопки открытия.',
      'Не переносите длинный многошаговый сценарий в модальное окно.',
    ],
  },
  liveExample: {
    make: () => makeDialog({ size: 'm' }),
    controls: [
      { kind: 'select', label: 'Размер', attribute: 'size', options: sizes },
      { kind: 'select', label: 'Режим', attribute: 'modal', options: modalModes },
      { kind: 'toggle', label: 'Кнопка закрытия', attribute: 'closable' },
    ],
  },
  api: {
    props: [
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Размерный диапазон поверхности и отступов.',
      },
      {
        name: 'modal',
        type: "'true' | 'false'",
        default: "'true'",
        description:
          'Модальный режим удерживает фокус, блокирует прокрутку и делает фон недоступным.',
      },
      {
        name: 'closable',
        type: 'boolean',
        default: 'true',
        description: 'Показывает встроенную кнопку закрытия.',
      },
      { name: 'heading', type: 'string', description: 'Заголовок и доступное имя диалога.' },
      {
        name: 'description',
        type: 'string',
        description: 'Пояснение, связанное через aria-describedby.',
      },
    ],
    events: [
      {
        name: 'open-change',
        type: 'CustomEvent<{ open: boolean }>',
        description: 'Запрос открытия или закрытия. Событие всплывает и пересекает Shadow DOM.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description: 'Текст и неинтерактивная подпись встроенной кнопки открытия.',
      },
      {
        name: 'trigger',
        description:
          'Один прямой LabButton или native button с type="button". Заменяет встроенную кнопку целиком; обёртки и вложенные controls отвергаются.',
      },
      {
        name: 'content',
        description:
          'Содержимое диалога остаётся в дереве потребителя и проецируется native slots.',
      },
    ],
  },
};
