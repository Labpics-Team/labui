import '@labpics/ui-core/switch';
import type { ComponentDoc } from '../template/component-doc.js';

function makeSwitch(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const element = document.createElement('lab-switch');
  element.textContent = 'Уведомления';
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false) element.setAttribute(key, value === true ? '' : value);
  }
  return element;
}

export const switchDoc: ComponentDoc = {
  slug: 'switch',
  order: 6,
  tag: 'lab-switch',
  title: 'Переключатель',
  summary: 'Включает и выключает настройку. Подпись называет её и сохраняется при смене состояния.',
  status: { kind: 'stable' },
  statesMatrix: {
    axes: [
      {
        name: 'Значение',
        attribute: 'checked',
        options: [
          { label: 'Выключен', value: false },
          { label: 'Включён', value: true },
        ],
      },
      {
        name: 'Тип',
        attribute: 'type',
        options: [
          { label: 'Акцент', value: 'accent' },
          { label: 'Нейтральный', value: 'neutral' },
          { label: 'Опасность', value: 'danger' },
        ],
      },
      {
        name: 'Размер',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
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
      {
        name: 'Знак',
        attribute: 'icon',
        options: [
          { label: 'Без знака', value: false },
          { label: 'Со знаком', value: true },
        ],
      },
    ],
    make: makeSwitch,
  },
  anatomy: [
    {
      index: 1,
      name: 'Подписи',
      description:
        'Одна подпись после дорожки и необязательная перед ней. Вся область нажимается; длинные подписи переносятся.',
    },
    {
      index: 2,
      name: 'Дорожка',
      description:
        'S — 28×16, M — 36×20, L — 44×24 при корневом размере 16 px. Акцентный выключенный переключатель нейтрален; опасный остаётся красным в обоих положениях.',
    },
    {
      index: 3,
      name: 'Бегунок',
      description:
        'Белый круг: отступ 2 px, при наведении 1 px, при нажатии 4 px. Движение следует общему LabMotion; при уменьшении движения значение меняется сразу.',
    },
    {
      index: 4,
      name: 'Знак',
      description:
        'Галочка или крестик вырезаны в бегунке: в отверстии видна дорожка. Пользовательские icon-on / icon-off заменяют знак для своего положения.',
    },
    {
      index: 5,
      name: 'Ввод и фокус',
      description:
        'Нативный checkbox с ролью switch. Space переключает значение, Tab перемещает фокус. Контур фокуса следует типу настройки.',
    },
  ],
  meaning: {
    purpose:
      'Бинарная настройка с устойчивой подписью. Может применяться сразу или сохраняться вместе с формой, если момент применения понятен из интерфейса.',
    dos: [
      'Называйте настройку, а не действие «включить / выключить».',
      'Оставляйте подпись одинаковой для обоих положений.',
      'Для переключателя без видимой подписи задавайте aria-label.',
    ],
    donts: [
      'Не используйте для трёх значений.',
      'Не передавайте значение одним цветом.',
      'Не помещайте ссылки и кнопки внутрь подписи.',
    ],
  },
  liveExample: {
    make: () => makeSwitch({ checked: true, icon: true }),
    controls: [
      { kind: 'toggle', label: 'Включён', attribute: 'checked' },
      { kind: 'toggle', label: 'Недоступен', attribute: 'disabled' },
      { kind: 'toggle', label: 'Знак', attribute: 'icon' },
      {
        kind: 'select',
        label: 'Размер',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      {
        kind: 'select',
        label: 'Тип',
        attribute: 'type',
        options: [
          { label: 'Акцент', value: 'accent' },
          { label: 'Нейтральный', value: 'neutral' },
          { label: 'Опасность', value: 'danger' },
        ],
      },
    ],
  },
  api: {
    props: [
      {
        name: 'type',
        type: "'accent' | 'neutral' | 'danger'",
        default: "'accent'",
        description: 'Назначение настройки и её цвет.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Размер дорожки и типографика.',
      },
      {
        name: 'checked',
        type: 'boolean',
        default: 'false',
        description:
          'Текущее значение. Lit отражает изменения в атрибут; React при переданном checked ожидает обновления от приложения.',
      },
      {
        name: 'default-checked',
        type: 'boolean',
        default: 'false',
        description:
          'Начальное значение и значение для reset. Изменение default-checked меняет следующий сброс, сохраняя текущий ввод. В React — defaultChecked.',
      },
      {
        name: 'controlled',
        type: 'boolean',
        default: 'false',
        description:
          'Lit: приложение принимает checked-change и само устанавливает checked. Пока обновления нет, значение сохраняется.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description:
          'Запрещает изменение и исключает значение из формы. disabled fieldset действует также.',
      },
      {
        name: 'required',
        type: 'boolean',
        default: 'false',
        description: 'Форма валидна, когда переключатель включён.',
      },
      {
        name: 'name / value',
        type: 'string',
        default: "value='on'",
        description:
          'FormData содержит поле только во включённом доступном состоянии. Lit поддерживает внешний form-атрибут.',
      },
      {
        name: 'icon',
        type: 'boolean',
        default: 'false',
        description: 'Авторский вырезанный знак в бегунке.',
      },
    ],
    events: [
      {
        name: 'checked-change',
        description:
          'CustomEvent<{ checked: boolean }> после действия пользователя. Reset и программное обновление не создают событие. В React — onCheckedChange(boolean).',
      },
    ],
    slots: [
      { name: '(default)', description: 'Подпись после дорожки; React children.' },
      {
        name: 'label-start',
        description: 'Необязательная подпись перед дорожкой; React labelStart.',
      },
      { name: 'icon-on', description: 'Содержимое бегунка во включённом состоянии; React iconOn.' },
      {
        name: 'icon-off',
        description: 'Содержимое бегунка в выключенном состоянии; React iconOff.',
      },
    ],
  },
};
