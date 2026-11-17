import '@labpics/ui-core/input';
import type { ComponentDoc } from '../template/component-doc.js';

function makeInput(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-input');
  el.label = 'Электронная почта';
  el.placeholder = 'studio@example.com';
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) el.setAttribute(key, value === true ? '' : String(value));
  }
  return el;
}
const types = [
  { label: 'Обычное', value: 'neutral' },
  { label: 'Ошибка', value: 'danger' },
  { label: 'Предупреждение', value: 'warning' },
  { label: 'Успех', value: 'success' },
];
const sizes = [
  { label: 'S', value: 's' },
  { label: 'M', value: 'm' },
  { label: 'L', value: 'l' },
];

export const inputDoc: ComponentDoc = {
  slug: 'input',
  order: 9,
  tag: 'lab-input',
  title: 'Input',
  summary: 'Однострочный ввод с постоянной подписью в рамке, подсказкой и состояниями проверки.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Состояние', attribute: 'type', options: types },
      { name: 'Размер', attribute: 'size', options: sizes },
      {
        name: 'Доступность',
        attribute: 'disabled',
        options: [
          { label: 'Доступно', value: false },
          { label: 'Отключено', value: true },
        ],
      },
    ],
    make: makeInput,
  },
  anatomy: [
    {
      index: 1,
      name: 'Подпись',
      description:
        'Постоянное имя поля в прозрачном разрыве рамки. Нажатие переводит фокус во ввод.',
    },
    {
      index: 2,
      name: 'Ввод',
      description:
        'Одна строка текста. Размеры S/M/L — 36/48/56 px при базовом масштабе; масштаб страницы изменяет их вместе с типографикой.',
    },
    {
      index: 3,
      name: 'Знаки по краям',
      description:
        'Слоты leading/trailing по 32 px со знаком 16 px. Подпись и текст выравниваются по внутренней области.',
    },
    {
      index: 4,
      name: 'Подсказка и ошибка',
      description:
        'Связаны с полем для экранного доступа. Ошибка появляется при invalid и непустом error.',
    },
  ],
  meaning: {
    purpose:
      'Для имени, адреса и другого короткого свободного текста. Выбор готового значения оформляется через Select или Combobox.',
    dos: [
      'Назовите поле через label.',
      'Сообщите конкретную причину ошибки через error.',
      'Для формы задайте name и нужные ограничения ввода.',
    ],
    donts: ['Не заменяйте подпись одним placeholder.', 'Не обозначайте ошибку только цветом.'],
  },
  liveExample: {
    make: () =>
      makeInput({
        helper: 'Адрес для уведомлений команды',
        error: 'Проверьте адрес электронной почты',
      }),
    controls: [
      { kind: 'toggle', label: 'Обязательное', attribute: 'required' },
      { kind: 'toggle', label: 'Ошибка', attribute: 'invalid' },
      { kind: 'toggle', label: 'Отключено', attribute: 'disabled' },
      { kind: 'toggle', label: 'Только чтение', attribute: 'readonly' },
      { kind: 'select', label: 'Состояние', attribute: 'type', options: types },
      { kind: 'select', label: 'Размер', attribute: 'size', options: sizes },
    ],
  },
  api: {
    props: [
      {
        name: 'type',
        type: "'neutral' | 'danger' | 'warning' | 'success'",
        default: "'neutral'",
        description: 'Смысловое состояние рамки и подписи.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Авторская размерная ступень.',
      },
      { name: 'label', type: 'string', description: 'Доступное имя и видимая подпись.' },
      {
        name: 'label-hidden',
        type: 'boolean',
        default: 'false',
        description: 'Скрывает подпись визуально, сохраняя доступное имя. В React — labelHidden.',
      },
      { name: 'helper', type: 'string', description: 'Подсказка под полем.' },
      {
        name: 'error',
        type: 'string',
        description: 'Ошибка при invalid; участвует в проверке HTML-формы.',
      },
      {
        name: 'input-type',
        type: 'string',
        default: "'text'",
        description: 'Нативный тип: text, email, password и другие. В React — inputType.',
      },
      {
        name: 'value',
        type: 'string',
        default: "''",
        description: 'Текущее значение. React также принимает defaultValue.',
      },
      { name: 'placeholder', type: 'string', description: 'Пример значения в пустом поле.' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Обязательное поле.' },
      {
        name: 'invalid',
        type: 'boolean',
        default: 'false',
        description: 'Состояние ошибки; описание задаётся через error.',
      },
      {
        name: 'readonly',
        type: 'boolean',
        default: 'false',
        description: 'Чтение без изменения; в React — readOnly.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Отключает ввод и исключает значение из FormData.',
      },
      {
        name: 'name',
        type: 'string',
        description:
          'Имя значения в HTML-форме. Lit поддерживает FormData, reset, восстановление и disabled fieldset.',
      },
      {
        name: 'minlength / maxlength / pattern',
        type: 'number / number / string',
        description:
          'Ограничения нативного ввода; в свойствах JS — minLength / maxLength / pattern.',
      },
      {
        name: 'autocomplete',
        type: 'string',
        description: 'Подсказка браузеру для автозаполнения; в React — autoComplete.',
      },
    ],
    events: [
      {
        name: 'lab-input',
        description: 'CustomEvent<{ value: string }> при вводе. В React — onValueChange(value).',
      },
      {
        name: 'lab-change',
        description: 'CustomEvent<{ value: string }> при завершении изменения.',
      },
    ],
    slots: [
      {
        name: 'leading',
        description:
          'Знак перед текстом; декоративному знаку задайте aria-hidden. В React — одноимённое свойство.',
      },
      {
        name: 'trailing',
        description: 'Знак или подписанное действие после текста. В React — одноимённое свойство.',
      },
    ],
  },
};
