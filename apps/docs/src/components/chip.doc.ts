import '@labpics/ui-core/chip';
import type { ComponentDoc } from '../template/component-doc.js';

function makeChip(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const chip = document.createElement('lab-chip');
  chip.textContent = 'Chip label';
  for (const [name, value] of Object.entries(attrs)) {
    if (name !== 'state' && value !== false) chip.setAttribute(name, value === true ? '' : value);
  }
  const state = String(attrs.state ?? 'default');
  if (['active', 'disabled', 'loading'].includes(state)) chip.setAttribute(state, '');
  if (['hover', 'pressed', 'focus'].includes(state)) {
    const attribute = { hover: 'data-hovered', pressed: 'data-pressed', focus: 'data-focused' }[
      state
    ];
    void chip.updateComplete.then(() => {
      if (attribute) chip.shadowRoot?.querySelector('button')?.setAttribute(attribute, '');
    });
  }
  return chip;
}

export const chipDoc: ComponentDoc = {
  slug: 'chip',
  tag: 'lab-chip',
  title: 'Chip',
  summary: 'Компактный фильтр, действие или удаляемая метка с одним понятным нажатием.',
  status: {
    kind: 'beta',
    note: 'Web и Compose используют общий авторский профиль. Семантика действий выбрана LabUI: в Figma она не задана.',
  },
  statesMatrix: {
    axes: [
      {
        name: 'Состояние',
        attribute: 'state',
        options: ['default', 'hover', 'pressed', 'focus', 'active', 'disabled', 'loading'].map(
          (value) => ({ label: value, value }),
        ),
      },
      {
        name: 'Размер',
        attribute: 'size',
        options: [
          { label: 'Small', value: 's' },
          { label: 'Medium', value: 'm' },
        ],
      },
      {
        name: 'Форма',
        attribute: 'sharp',
        options: [
          { label: 'Rounded', value: false },
          { label: 'Sharp', value: true },
        ],
      },
      {
        name: 'Выбор',
        attribute: 'selected',
        options: [
          { label: 'Не выбран', value: false },
          { label: 'Выбран', value: true },
        ],
      },
    ],
    make: makeChip,
  },
  anatomy: [
    {
      index: 1,
      name: 'Поверхность',
      description:
        'Small 28 px и Medium 40 px. Sharp — радиус 4 px; Rounded — 9999 px у Small и 12 px у Medium. Размеры растут вместе с текстом.',
    },
    {
      index: 2,
      name: 'Подпись и leading',
      description:
        'Geist Medium 14/12 или 16/24. Необязательный leading 12/16 px включается show-leading и не зависит от Avatar.',
    },
    {
      index: 3,
      name: 'Крестик',
      description:
        'Декоративный знак выбранного значения. В filter вся кнопка снимает выбор; в remove вся кнопка удаляет метку. Второй вложенной кнопки нет.',
    },
    {
      index: 4,
      name: 'Ожидание',
      description:
        'Skeleton скрывает содержимое через opacity, сохраняет его ширину, доступное имя и текущий фокус. Нажатия временно подавляются.',
    },
  ],
  meaning: {
    purpose:
      'Filter переключает значение и сообщает aria-pressed; action выполняет команду; remove просит удалить метку. Active независимо добавляет авторский акцент бренда и не означает pointer pressed.',
    dos: [
      'В filter сохраняйте подпись при выборе.',
      'Для remove задайте aria-label, например «Удалить Дизайн». После удаления приложение переводит фокус на соседнюю метку или поле ввода.',
      'Для формы передайте name и value. Controlled значение меняется только после подтверждения приложением.',
      'В loading сохраняйте настоящий текст и selected.',
    ],
    donts: [
      'Не помещайте кнопки, ссылки и другие интерактивные элементы внутрь Chip.',
      'Не используйте active как замену selected.',
      'Для редактирования списка тегов используйте TagsInput: его составной клавиатурный сценарий отдельный.',
    ],
  },
  liveExample: {
    make: () => {
      const chip = makeChip({ active: true });
      chip.textContent = 'Дизайн';
      return chip;
    },
    controls: [
      {
        kind: 'select',
        label: 'Размер',
        attribute: 'size',
        options: [
          { label: 'Small', value: 's' },
          { label: 'Medium', value: 'm' },
        ],
      },
      { kind: 'toggle', label: 'Акцент', attribute: 'active' },
      { kind: 'toggle', label: 'Sharp', attribute: 'sharp' },
      { kind: 'toggle', label: 'Ожидание', attribute: 'loading' },
      { kind: 'toggle', label: 'Недоступен', attribute: 'disabled' },
    ],
  },
  api: {
    props: [
      {
        name: 'mode',
        type: "'filter' | 'action' | 'remove'",
        default: "'filter'",
        description:
          'Одна семантика действия. Remove всегда показывает выбранную поверхность с крестиком.',
      },
      { name: 'size', type: "'s' | 'm'", default: "'m'", description: 'Два авторских размера.' },
      {
        name: 'sharp / active / selected',
        type: 'boolean',
        default: 'false',
        description: 'Независимые форма, акцент и значение выбора.',
      },
      {
        name: 'default-selected / defaultSelected',
        type: 'boolean',
        default: 'false',
        description: 'Начальное значение и значение после form.reset().',
      },
      {
        name: 'controlled',
        type: 'boolean (Lit)',
        default: 'false',
        description:
          'Lit запрашивает selected-change, приложение задаёт selected. В React controlled включается переданным selected.',
      },
      {
        name: 'loading / disabled',
        type: 'boolean',
        default: 'false',
        description: 'Loading сохраняет фокус и ширину; disabled исключает кнопку из Tab.',
      },
      {
        name: 'show-leading / showLeading',
        type: 'boolean',
        default: 'false',
        description: 'Показывает leading. Явная геометрия одинакова до и после SSR hydration.',
      },
      {
        name: 'name / value / form',
        type: 'string',
        description:
          'Выбранный filter участвует в FormData. Пустой value допустим; снятие value возвращает on. Сброс не отправляет selected-change.',
      },
      {
        name: 'aria-label',
        type: 'string',
        description: 'Доступное имя. В remove укажите действие и метку.',
      },
    ],
    events: [
      {
        name: 'selected-change / onSelectedChange',
        description:
          'Запрос boolean selected. Lit detail.selected; preventDefault отменяет локальное изменение. Controlled отказ сохраняет прежнее значение.',
      },
      { name: 'action / onAction', description: 'Активация action.' },
      { name: 'remove / onRemove', description: 'Запрос удаления. Сам компонент не удаляет DOM.' },
    ],
    slots: [
      { name: '(default) / children', description: 'Настоящая текстовая подпись.' },
      { name: 'leading', description: 'Декоративное содержимое, скрытое от accessibility tree.' },
    ],
  },
};
