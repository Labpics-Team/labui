/*
 * `lab-button` documentation config — the FIRST production component documented
 * through the closed docs template, and the EXEMPLAR every other component's
 * page is cloned from.
 *
 * Unlike `proof.doc.ts` (a proof of the scaffold seam), this documents a real
 * primitive: the Button has the full Figma axis model (type × kind × size, plus
 * icon / loading / disabled). The page is built from this data object alone —
 * the template renderer is untouched (craft-arch / OCP).
 *
 * Honesty rules (owner's iron rule on stop-gaps): the status badge says exactly
 * what the Button is; the live controls are ONLY the ones that truly mutate the
 * element (every attribute below is reflected and re-styles live), never a no-op
 * dressed as a control.
 */
import '@labpics/ui-core/button';
import buttonSymbol from '../assets/button-symbol.svg?raw';
import type { ComponentDoc } from '../template/component-doc.js';

/** Build a real `<lab-button>` with the given attribute map applied. */
function makeButton(
  attrs: Readonly<Record<string, string | boolean>>,
  withIcons = false,
): HTMLElement {
  const button = document.createElement('lab-button');
  button.textContent = 'Button';
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false) continue;
    if (value === true) button.setAttribute(key, '');
    else button.setAttribute(key, String(value));
  }
  if (withIcons) {
    const template = document.createElement('template');
    template.innerHTML = buttonSymbol;
    for (const slot of ['icon', 'end']) {
      const glyph = template.content.firstElementChild?.cloneNode(true);
      if (!(glyph instanceof SVGElement)) throw new Error('Missing Button symbol');
      glyph.setAttribute('slot', slot);
      glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph);
    }
  }
  return button;
}

export const buttonDoc: ComponentDoc = {
  slug: 'button',
  order: 1,
  tag: 'lab-button',
  title: 'Button',
  summary:
    'Кнопка действия с основной надписью, описанием в строке и иконками по краям. Три назначения, четыре вида поверхности, три размера; цвета приходят из семантических ролей LabUI.',
  // Beta, honestly: the API and behaviour are production and frozen, but two
  // colour roles it pairs (the SOLID neutral fill + its on-fill label) are
  // PROVISIONAL in the generated colour contract, awaiting the owner's visual sign-off. That
  // is a calibration, not an API risk — hence beta, not stable.
  status: {
    kind: 'beta',
    note: 'Анатомия доступна в Lit и React. Полное соответствие цветов, материалов и эффектов эталону проходит отдельную приёмку.',
  },

  statesMatrix: {
    // Columns = Kind (the surface treatment). Rows = the cartesian product of
    // Type (intent) × Size — so the grid shows every intent at every size for
    // each surface. Interactive states (hover / focus / disabled / loading) are
    // exercised live in the Live example below, where they are genuinely
    // interactive rather than a frozen screenshot.
    axes: [
      {
        name: 'Kind',
        attribute: 'kind',
        options: [
          { label: 'Fill', value: 'fill' },
          { label: 'Tinted', value: 'tinted' },
          { label: 'Border', value: 'border' },
          { label: 'Ghost', value: 'ghost' },
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
    ],
    make: makeButton,
  },

  anatomy: [
    {
      index: 1,
      name: 'Container (button)',
      description:
        'The native <button>. Its surface and label come from the type×kind pair: fill reads --lab-fill-{type} with --lab-label-on-{type}; tinted reads --lab-fill-{type}-tinted with --lab-label-{type}; border reads --lab-border-{type}; ghost is text-only. Separation is always by surface, never a border drawn on top.',
    },
    {
      index: 2,
      name: 'Label slot',
      description:
        'The default slot (Lit) / children (React) carrying the action text. Server-rendered into the declarative shadow DOM on the Lit path so first paint is meaningful before any JS.',
    },
    {
      index: 3,
      name: 'Области иконок',
      description:
        'Начальная icon/iconSlot и завершающая end/endSlot. Кнопка отводит каждой область 20 px в S и 24 px в M/L при root 16 px. Явный размер рисунка сохраняется; width/height 100% заполняют область и растут вместе с ней. Один slot принимает одну композицию рисунка.',
    },
    {
      index: 4,
      name: 'Spinner',
      description:
        'Всегда присутствует в DOM и показывается при loading. Текст становится прозрачным, рисунки обрезаются на уровне paint: размеры и доступное имя сохраняются.',
    },
    {
      index: 5,
      name: 'Focus ring',
      description:
        'A :focus-visible outline drawn from --lab-border-focus. delegatesFocus on the Lit host moves focus to the inner button; the React button is the focus target directly. Keyboard activation (Enter / Space) is the platform default — never re-implemented.',
    },
    {
      index: 6,
      name: 'Описание',
      description:
        'Необязательный description после основной надписи с промежутком 8 px. В S обе надписи используют 500, 14/12 px; в M/L описание использует 400, 16/24 px и tracking −0.25 px. Цвет определяется secondary-ролью выбранной поверхности.',
    },
  ],

  meaning: {
    purpose:
      'Button triggers an action. Its type carries intent (accent = the primary action, neutral = a secondary one, danger = a destructive one); its kind carries emphasis (fill is loudest, then tinted, then border, then ghost — quietest). Pick exactly one accent-fill action per view and let everything else step down in kind, so the eye lands on the one thing you want pressed.',
    dos: [
      'Use one accent fill as the primary action in a view; step secondary actions down to tinted, border, or ghost.',
      'Use type="danger" for destructive actions (delete, remove) so the intent reads before the label does.',
      'Set loading while an action is in flight — it blocks repeated button activation and keeps the button size fixed.',
      'Give icon-only buttons an accessible name (aria-label) — the square icon carries no text for a screen reader.',
    ],
    donts: [
      "Don't put two accent fill buttons next to each other — competing primary actions leave the user unsure where to click.",
      "Don't use danger for a non-destructive action just because it should stand out — intent must be truthful.",
      "Don't hardcode a colour against the button; it only ever reads --lab-* roles bound by the active theme on an ancestor.",
      "Don't disable a button as the only feedback for a blocked action — pair it with a reason the user can read.",
    ],
  },

  liveExample: {
    // Every control below mutates a REFLECTED attribute the element re-styles on,
    // so each one genuinely changes the live button (owner's iron rule: no no-op
    // controls). Click states (hover / active / focus) are exercised by actually
    // interacting with the rendered button — they need no synthetic control.
    make: () =>
      makeButton({ type: 'accent', kind: 'fill', size: 'm', description: 'Description' }, true),
    controls: [
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
      {
        kind: 'select',
        label: 'Kind',
        attribute: 'kind',
        options: [
          { label: 'Fill', value: 'fill' },
          { label: 'Tinted', value: 'tinted' },
          { label: 'Border', value: 'border' },
          { label: 'Ghost', value: 'ghost' },
        ],
      },
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
      { kind: 'toggle', label: 'Loading', attribute: 'loading' },
      { kind: 'toggle', label: 'Disabled', attribute: 'disabled' },
    ],
  },

  api: {
    props: [
      {
        name: 'type',
        type: "'accent' | 'neutral' | 'danger'",
        default: "'accent'",
        description: 'Semantic intent of the action. Reflected attribute; styles key off it.',
      },
      {
        name: 'kind',
        type: "'fill' | 'tinted' | 'border' | 'ghost'",
        default: "'fill'",
        description: 'Surface treatment / emphasis. Separation is by surface, not a border on top.',
      },
      {
        name: 'size',
        type: "'s' | 'm' | 'l'",
        default: "'m'",
        description:
          'Control size. Drives padding, font size, and minimum height from --lab-* tokens.',
      },
      {
        name: 'description',
        type: 'string',
        default: "''",
        description:
          'Дополнительный текст в строке после основной надписи. Отсутствующая или пустая строка не занимает места. Без aria-label входит в естественное доступное имя вместе с основной надписью.',
      },
      {
        name: 'icon',
        type: 'boolean',
        default: 'false',
        description: 'Квадратная кнопка с основной иконкой. Подпись и завершающая иконка скрыты.',
      },
      {
        name: 'loading',
        type: 'boolean',
        default: 'false',
        description:
          'Shows the spinner and blocks interaction (aria-busy) without collapsing layout.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        default: 'false',
        description: 'Non-interactive (aria-disabled). Reflected for styling and a11y.',
      },
      {
        name: 'html-type (Lit) / htmlType (React)',
        type: "'button' | 'submit' | 'reset'",
        default: "'button'",
        description:
          'HTML button type. React uses a native button; Lit sets the type inside Shadow DOM and does not submit or reset an outer form automatically.',
      },
    ],
    events: [
      {
        name: 'click',
        description:
          'Native click on the inner button. Suppressed while loading or disabled (the underlying button is disabled). React exposes the standard onClick; both renderers use the platform event.',
      },
    ],
    slots: [
      {
        name: '(default) / children',
        description: 'The label content. Lit uses the default <slot>; React uses children.',
      },
      {
        name: 'icon / iconSlot',
        description:
          'Начальная иконка. Потребитель задаёт одну композицию и её размер. Декоративный SVG маркируется aria-hidden="true", img — alt="". При отсутствии явного aria-label смысловое содержимое иконки сохраняется в доступном имени.',
      },
      {
        name: 'end / endSlot',
        description:
          'Завершающая иконка с тем же размерным контрактом; скрыта в квадратном режиме icon. Отсутствующее назначение не занимает места; пустой обычный элемент резервирует область. Пустая обёртка display:contents может схлопнуться.',
      },
    ],
  },
};
