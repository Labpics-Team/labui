/*
 * `lab-switch` documentation config — the FIRST production component that
 * CONSUMES a Zag machine through the Behaviors seam (the inverse of Button).
 *
 * Матрица и настройки используют настоящий `<lab-switch>`. Атрибуты меняют
 * свойства элемента; checked передаётся машине как текущее значение.
 */
import '@labpics/ui-core/switch';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-switch>` with the given attribute map applied. */
function makeSwitch(attrs: Readonly<Record<string, string | boolean>>): HTMLElement {
  const el = document.createElement('lab-switch');
  el.textContent = 'Wi-Fi';
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  return el;
}

export const switchDoc: ComponentDoc = {
  slug: 'switch',
  order: 6,
  tag: 'lab-switch',
  title: 'Switch',
  summary:
    'Переключатель для настройки, которая применяется сразу. Элемент хранит checked, а машина взаимодействия обрабатывает ввод, клавиатуру, фокус и доступность. Оформление использует семантические роли --lab-*.',
  status: { kind: 'stable' },

  statesMatrix: {
    axes: [
      {
        name: 'State',
        attribute: 'checked',
        options: [
          { label: 'Off', value: false },
          { label: 'On', value: true },
        ],
      },
      {
        name: 'Type',
        attribute: 'type',
        options: [
          { label: 'Accent', value: 'accent' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
        ],
      },
      {
        name: 'Size',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      {
        name: 'Disabled',
        attribute: 'disabled',
        options: [
          { label: 'Enabled', value: false },
          { label: 'Disabled', value: true },
        ],
      },
    ],
    make: makeSwitch,
  },

  anatomy: [
    {
      index: 1,
      name: 'Root (label)',
      description:
        'The Zag root element — a <label> wrapping the whole control, so clicking the track OR the text toggles it. Reads --lab-label-primary for the label text.',
    },
    {
      index: 2,
      name: 'Track (control)',
      description:
        'The Zag control element. Off uses --lab-fill-primary; on uses --lab-fill-accent / -neutral / -danger by type. A pill via --lab-radius-full.',
    },
    {
      index: 3,
      name: 'Thumb',
      description:
        'The Zag thumb element. A circle filled with --lab-control-bg that slides across the track on the machine-driven checked state.',
    },
    {
      index: 4,
      name: 'Icon slots',
      description:
        'Optional icon-on / icon-off slots inside the track, revealed by the checked state. Decorative (aria-hidden); the role + aria-checked carry the meaning.',
    },
    {
      index: 5,
      name: 'Hidden input + focus ring',
      description:
        'The Zag hidden checkbox input keeps the control in the form + a11y tree. Focus is delegated to it; a :focus-visible ring drawn from --lab-border-focus shows on the track.',
    },
  ],

  meaning: {
    purpose:
      'A switch toggles a single setting that takes effect immediately, with no separate confirm step — like a physical light switch. Use it for instant, reversible on/off state (notifications on, dark mode on). It is NOT a checkbox: a checkbox selects an item or stages a choice for later submission; a switch applies right now.',
    dos: [
      'Use for an immediate, self-applying binary setting (on now, off now).',
      'Pair it with a short, static label that names the thing being toggled.',
      'Читайте checked-change и меняйте checked через свойство или атрибут; доступное состояние синхронизируется автоматически.',
    ],
    donts: [
      "Don't use it inside a form that needs an explicit Save — that is a checkbox's job.",
      "Don't use it for more than two states; a switch is strictly binary (a checkbox carries the mixed state).",
      "Don't hardcode colours against it — it only ever reads --lab-* roles bound by an ancestor.",
    ],
  },

  liveExample: {
    make: () => makeSwitch({ checked: true, 'label-start': 'Сеть' }),
    // Honest live controls. `disabled` is reflected and re-renders the machine;
    // `size` and `checked` are reflected attributes the machine reads on update,
    // so flipping them really drives the element. Clicking the switch itself runs
    // the Zag machine (Space/click) — that is the primary interaction.
    controls: [
      { kind: 'toggle', label: 'Checked', attribute: 'checked' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
      { kind: 'toggle', label: 'Hide left label', attribute: 'hide-label-start' },
      { kind: 'toggle', label: 'Hide right label', attribute: 'hide-label-end' },
      {
        kind: 'select',
        label: 'Size',
        attribute: 'size',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
        ],
      },
      {
        kind: 'select',
        label: 'Type',
        attribute: 'type',
        options: [
          { label: 'Accent', value: 'accent' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Danger', value: 'danger' },
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
        description: 'Semantic intent of the ON track surface.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description: 'Control size.',
      },
      {
        name: 'checked',
        type: 'boolean',
        default: 'false',
        description:
          'Текущее состояние. Обновляется при вводе и присваивании свойства, отражается для CSS и SSR. Явный checked=false до первого render имеет приоритет над default-checked. Удаление атрибута выключает переключатель.',
      },
      {
        name: 'default-checked',
        type: 'boolean',
        default: 'false',
        description:
          'Начальное состояние, если checked ещё не задан. Применяется один раз перед первым render; последующие изменения и переподключение не сбрасывают checked. Присваивание свойства не создаёт атрибут: SSR-адаптеры сохраняют вычисленный checked.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Whether the switch is non-interactive. Reflected for styling and a11y.',
      },
      {
        name: 'label-start',
        type: 'string',
        default: "''",
        description:
          'Подпись перед дорожкой. В React используйте labelStart; подпись после дорожки передаётся через children или default slot.',
      },
      {
        name: 'hide-label-start',
        type: 'boolean',
        default: 'false',
        description:
          'Скрывает левую подпись, исключая её из геометрии и доступного имени. React: hideLabelStart.',
      },
      {
        name: 'hide-label-end',
        type: 'boolean',
        default: 'false',
        description:
          'Скрывает правую подпись, исключая её из геометрии и доступного имени. React: hideLabelEnd.',
      },
      {
        name: 'aria-label',
        type: 'string',
        default: 'undefined',
        description:
          'Имя input, когда обе подписи скрыты или пусты. Показанные подписи имеют приоритет и читаются слева направо. В SSR-функциях используйте ariaLabel.',
      },
    ],
    events: [
      {
        name: 'checked-change',
        description:
          'CustomEvent<{ checked: boolean }> после пользовательского переключения. Свойство checked уже обновлено; обработчик может присвоить другое значение. Программное присваивание события не создаёт.',
      },
    ],
    slots: [
      {
        name: '(default)',
        description:
          'Подпись после дорожки. Пустой или пробельный текст и именованные icon slots не создают label box.',
      },
      { name: 'icon-on', description: 'Optional icon shown inside the track when ON.' },
      { name: 'icon-off', description: 'Optional icon shown inside the track when OFF.' },
    ],
  },
};
