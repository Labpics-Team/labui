import '@labpics/ui-core/sheet';
import type { ComponentDoc } from '../template/component-doc.js';

const positions = [
  { label: 'Full', value: 'full' },
  { label: '2/3', value: 'two-thirds' },
  { label: 'Half', value: 'half' },
  { label: '1/3', value: 'one-third' },
  { label: 'Flex', value: 'flex' },
];

function makeSheet(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const sheet = document.createElement('lab-sheet');
  sheet.append(document.createTextNode('Настройки уведомлений'));
  sheet.heading = 'Уведомления';
  const body = document.createElement('form');
  body.slot = 'content';
  body.style.cssText = 'display:grid;gap:var(--lab-space-sheet-gap);margin:0';
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = true;
  label.append(input, document.createTextNode(' Сообщать о новых комментариях'));
  const apply = document.createElement('button');
  apply.type = 'submit';
  apply.textContent = 'Сохранить';
  body.append(label, apply);
  body.addEventListener('submit', (event) => {
    event.preventDefault();
    sheet.open = false;
  });
  sheet.append(body);
  for (const [attribute, value] of Object.entries(attrs)) {
    if (value === false) continue;
    sheet.setAttribute(attribute, value === true ? '' : value);
  }
  return sheet;
}

export const sheetDoc: ComponentDoc = {
  slug: 'sheet',
  order: 12,
  tag: 'lab-sheet',
  title: 'Sheet',
  summary:
    'Нижняя панель для короткой задачи. Меняет высоту по содержимому или выбранной позиции, сохраняет ввод при повторном открытии и возвращает фокус к точке входа.',
  status: { kind: 'beta', note: 'Web Component с общими адаптерами Vue, Solid, Svelte и Astro.' },
  statesMatrix: {
    axes: [{ name: 'Позиция', attribute: 'position', options: positions }],
    make: makeSheet,
  },
  anatomy: [
    {
      index: 1,
      name: 'Body',
      description:
        'Поверхность у нижнего края. Верхние углы, отступы и расстояния между блоками задаются токенами Sheet.',
    },
    {
      index: 2,
      name: 'Ручка',
      description:
        'Перетаскивание меняет позицию. Стрелки меняют высоту; Home выбирает Full, End — Flex. Нажатие ручки раскрывает следующую позицию.',
    },
    {
      index: 3,
      name: 'Содержимое',
      description:
        'Заголовок, описание и slot="content" находятся внутри модального focus trap. Длинное содержимое прокручивается отдельно от ручки.',
    },
    {
      index: 4,
      name: 'Ghost',
      description:
        'Отдельный слой прогрессивного размытия за панелью. Рецепт и допустимая деградация принадлежат material runtime.',
    },
  ],
  meaning: {
    purpose:
      'Sheet подходит для настроек, выбора и короткой формы поверх текущего экрана. Панель сохраняет контекст задачи, блокирует фон до закрытия и поддерживает мышь, touch и клавиатуру.',
    dos: [
      'Дайте панели заголовок или aria-label и оставьте явное действие завершения.',
      'Выберите Flex для короткого содержимого, а фиксированную позицию — для предсказуемой рабочей области.',
      'Сохраняйте смысл Enter и Tab у вложенных полей; перетаскивайте только ручку.',
    ],
    donts: [
      'Не используйте панель для длительного сценария, которому нужен самостоятельный экран.',
      'Не трактуйте названия 2/3 и 1/3 как точные доли любого viewport: это пресеты Lab UI v2.1.',
    ],
  },
  liveExample: {
    make: () => makeSheet({ position: 'half' }),
    controls: [
      { kind: 'select', label: 'Позиция', attribute: 'position', options: positions },
      { kind: 'toggle', label: 'Кнопка закрытия', attribute: 'closable' },
    ],
  },
  api: {
    props: [
      {
        name: 'open',
        type: 'boolean',
        default: 'false',
        description:
          'Открывает или закрывает панель. Ввод и фокус остаются у панели до завершения выхода.',
      },
      {
        name: 'position',
        type: "'full' | 'two-thirds' | 'half' | 'one-third' | 'flex'",
        default: "'half'",
        description:
          'Позиция Body. Полная, 2/3 и 1/3 используют масштабируемые пресеты; Half учитывает viewport и overlap, Flex измеряет содержимое.',
      },
      {
        name: 'heading',
        type: 'string',
        default: "''",
        description: 'Заголовок панели, связанный с доступным именем.',
      },
      {
        name: 'description',
        type: 'string',
        default: "''",
        description: 'Описание, связанное через aria-describedby.',
      },
      {
        name: 'closable',
        type: 'boolean',
        default: 'false',
        description:
          'Показывает дополнительную кнопку закрытия. Escape и нажатие вне модальной панели закрывают её.',
      },
      {
        name: 'modal',
        type: "'true' | 'false'",
        default: "'true'",
        description:
          'Модальный режим с удержанием фокуса, блокировкой прокрутки и недоступным фоном.',
      },
    ],
    events: [
      {
        name: 'open-change',
        type: 'CustomEvent<{ open: boolean }>',
        description:
          'Запрос открытия или закрытия из интерфейса. Событие всплывает и пересекает Shadow DOM.',
      },
      {
        name: 'position-change',
        type: 'CustomEvent<{ position: LabSheetPosition }>',
        description: 'Позиция, выбранная ручкой или клавиатурой.',
      },
      {
        name: 'motion-error',
        type: 'CustomEvent<{ error: unknown }>',
        description: 'Ошибка исполнения движения. Панель освобождает модальный контекст.',
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
          'Один прямой LabButton или native button с type="button". Заменяет встроенную кнопку целиком; события, ARIA и возврат фокуса относятся к этому control. Обёртки и вложенные controls отвергаются.',
      },
      {
        name: 'content',
        description:
          'Содержимое панели проецируется через native slots и остаётся в дереве потребителя. Состояние ввода сохраняется при закрытии и повторном открытии.',
      },
    ],
  },
};
