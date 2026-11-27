import '@labpics/ui-core/checkbox';
import { selectionProfile } from '@labpics/ui-tokens';
import type { ComponentDoc } from '../template/component-doc.js';

const sizes = Object.keys(selectionProfile.sizes).map((value) => ({ label: value, value }));
function make(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-checkbox');
  element.textContent = 'Получать новости проекта';
  for (const [key, value] of Object.entries(attrs))
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  return element;
}
export const checkboxDoc: ComponentDoc = {
  slug: 'checkbox',
  order: 7,
  tag: 'lab-checkbox',
  title: 'Флажок',
  summary:
    'Независимый выбор. Авторский Check сохраняет отмеченное, пустое и частично отмеченное состояния.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      { name: 'Размер', attribute: 'size', options: sizes },
      {
        name: 'Цвет',
        attribute: 'type',
        options: [
          { label: 'Accent', value: 'accent' },
          { label: 'Neutral', value: 'neutral' },
        ],
      },
      {
        name: 'Выбор',
        attribute: 'checked',
        options: [
          { label: 'Нет', value: false },
          { label: 'Да', value: true },
        ],
      },
      {
        name: 'Доступность',
        attribute: 'disabled',
        options: [
          { label: 'Доступен', value: false },
          { label: 'Недоступен', value: true },
        ],
      },
    ],
    make,
  },
  anatomy: [
    {
      index: 1,
      name: 'Контрол',
      description:
        'Авторский квадрат и заполненный знак. Tiny показывает только знак; остальные размеры — подложку с внутренней тенью.',
    },
    {
      index: 2,
      name: 'Подписи',
      description:
        'Geist, необязательная подпись перед контролом и основная после него. Длинные подписи переносятся.',
    },
    {
      index: 3,
      name: 'Нативный ввод',
      description:
        'Настоящий checkbox хранит checked и indeterminate. Форма получает значение только отмеченного доступного флажка.',
    },
  ],
  meaning: {
    purpose: 'Выбор независимого пункта или нескольких пунктов перед сохранением.',
    dos: ['Называйте предмет выбора.', 'Используйте mixed для частично выбранной группы.'],
    donts: ['Не используйте флажок вместо команды.', 'Не скрывайте смысл выбора только в цвете.'],
  },
  liveExample: {
    make: () => make({ checked: true }),
    controls: [
      { kind: 'toggle', label: 'Отмечен', attribute: 'checked' },
      { kind: 'toggle', label: 'Частично', attribute: 'indeterminate' },
      { kind: 'toggle', label: 'Недоступен', attribute: 'disabled' },
      { kind: 'select', label: 'Размер', attribute: 'size', options: sizes },
    ],
  },
  api: {
    props: [
      {
        name: 'type',
        type: "'accent' | 'neutral' | 'danger'",
        default: "'accent'",
        description:
          'Accent и neutral авторские; danger сохраняет совместимость как семантическое расширение.',
      },
      {
        name: 'size',
        type: "'tiny' | 's' | 'm' | 'l'",
        default: "'m'",
        description: 'Tiny — отдельный знак; остальные размеры 12, 16 и 20 px.',
      },
      {
        name: 'checked / indeterminate',
        type: 'boolean',
        default: 'false',
        description: 'Текущее значение. React checked принимает также indeterminate.',
      },
      {
        name: 'controlled',
        type: 'boolean',
        default: 'false',
        description:
          'Lit: событие запрашивает изменение, значение задаёт вызывающий код. React определяет режим наличием checked.',
      },
      {
        name: 'default-checked / default-indeterminate',
        type: 'boolean',
        default: 'false',
        description: 'Начальное значение и значение после form.reset().',
      },
      {
        name: 'name / value / required / disabled',
        type: 'native form attributes',
        description: 'Нативные отправка, валидация и отключение, включая fieldset.',
      },
    ],
    events: [
      {
        name: 'checked-change',
        description: 'CustomEvent<{ checked: boolean | "indeterminate" }>. React: onCheckedChange.',
      },
    ],
    slots: [
      { name: '(default) / children', description: 'Основная подпись.' },
      { name: 'label-start / labelStart', description: 'Подпись перед контролом.' },
      { name: 'description', description: 'Дополнительное описание.' },
      { name: 'icon', description: 'Декоративная иконка для Choicebox.' },
    ],
  },
};
