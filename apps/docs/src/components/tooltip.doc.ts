import '@labpics/ui-core/tooltip';
import '@labpics/ui-core/button';
import type { ComponentDoc } from '../template/component-doc.js';
function makeTooltip(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const tooltip = document.createElement('lab-tooltip');
  tooltip.content = 'Hello, my name is Tooltip';
  const trigger = document.createElement('lab-button');
  trigger.textContent = 'Подробнее';
  trigger.kind = 'ghost';
  trigger.type = 'neutral';
  tooltip.append(trigger);
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) tooltip.setAttribute(key, value === true ? '' : String(value));
  return tooltip;
}
const types = [
  { label: 'Neutral', value: 'neutral' },
  { label: 'Inverted', value: 'inverted' },
  { label: 'Accent', value: 'accent' },
];
const placements = [
  'bottom-start',
  'bottom',
  'bottom-end',
  'right',
  'left',
  'top-start',
  'top',
  'top-end',
].map((value) => ({ label: value, value }));
export const tooltipDoc: ComponentDoc = {
  slug: 'tooltip',
  order: 9,
  tag: 'lab-tooltip',
  title: 'Tooltip',
  summary:
    'Краткое пояснение к существующему control. Открывается при наведении и клавиатурном фокусе; Escape закрывает подсказку, сохраняя фокус. Три авторских типа, восемь направлений и два вида хвоста.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Type', attribute: 'type', options: types },
      { name: 'Placement', attribute: 'placement', options: placements },
    ],
    make: makeTooltip,
  },
  anatomy: [
    {
      index: 1,
      name: 'Trigger',
      description:
        'Одна настоящая кнопка, ссылка или другой фокусируемый control. LabButton передаёт внутреннюю кнопку через interactionTarget. Текст без control получает фокусируемую текстовую опору.',
    },
    {
      index: 2,
      name: 'Positioner',
      description:
        'Manual popover в browser top layer. Сохраняет локальную тему и DOM-контекст dialog; Floating UI наблюдает геометрию только открытой подсказки.',
    },
    {
      index: 3,
      name: 'Body',
      description:
        'Geist Body 16/24, tracking −0.25; padding и radius 12, smoothing 0.6. Solid-поверхность Neutral, Inverted или Accent и авторская тень XL.',
    },
    {
      index: 4,
      name: 'Tail',
      description:
        'Исходный контур Chevron 28×8 или Bubble 17×15 внутри опоры 28×8. Поворот следует фактической стороне после автоматического переноса.',
    },
  ],
  meaning: {
    purpose:
      'Дополнительное пояснение к уже понятному действию. Имя icon-only кнопки остаётся в aria-label; Tooltip добавляет описание.',
    dos: [
      'Передавайте готовую Button или native control.',
      'Держите важные инструкции в основном интерфейсе.',
      'На touch Compose показывает подсказку долгим нажатием; web оставляет обычное touch-действие control.',
    ],
    donts: [
      'Не помещайте ссылки, поля и кнопки внутрь подсказки.',
      'Не делайте подсказку единственным доступным именем.',
      'Не перемещайте подсказку вручную в body: локальная тема должна сохраняться.',
    ],
  },
  liveExample: {
    make: () => makeTooltip({ placement: 'top' }),
    controls: [
      { kind: 'select', label: 'Type', attribute: 'type', options: types },
      { kind: 'select', label: 'Placement', attribute: 'placement', options: placements },
      {
        kind: 'select',
        label: 'Tail',
        attribute: 'tail',
        options: [
          { label: 'Chevron', value: 'chevron' },
          { label: 'Bubble', value: 'bubble' },
        ],
      },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },
  api: {
    props: [
      {
        name: 'type',
        type: "'neutral' | 'inverted' | 'accent'",
        default: "'neutral'",
        description: 'Авторский тип поверхности и текста.',
      },
      {
        name: 'placement',
        type: 'LabTooltipPlacement',
        default: "'bottom'",
        description: 'Предпочитаемая сторона; переносится и сдвигается у края viewport.',
      },
      {
        name: 'tail',
        type: "'chevron' | 'bubble'",
        default: "'chevron'",
        description: 'Авторский вид хвоста.',
      },
      {
        name: 'content',
        type: 'string',
        description: 'Короткий текст; slot content допускает неинтерактивную разметку.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'M воспроизводит Figma. S/L сохранены как дополнительные размеры.',
      },
      {
        name: 'open-delay',
        type: 'number',
        default: '400',
        description: 'Задержка hover в миллисекундах. Keyboard focus открывает сразу.',
      },
      {
        name: 'close-delay',
        type: 'number',
        default: '150',
        description: 'Время для перевода указателя на подсказку.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Отключает открывание и закрывает уже открытую подсказку.',
      },
      {
        name: 'arrow',
        type: 'boolean',
        default: 'true',
        description: 'Показывать хвост; attribute arrow="false" его скрывает.',
      },
    ],
    events: [
      {
        name: 'open-change',
        description: 'CustomEvent<{ open: boolean }> при изменении видимости.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description: 'Один native control или LabButton; React принимает ref-forwarding control.',
      },
      { name: 'content', description: 'Неинтерактивный текст подсказки, заменяющий content.' },
    ],
  },
};
