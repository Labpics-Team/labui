import type { TokensConfig } from './types.js';

/**
 * The default LabUI token config.
 *
 * Values are calibrated against Daniel's Figma Dimention/Typography/Z-index
 * collections (canonical "100%" mode of the snapshot) but expressed as a
 * controllable rem model — the broken Figma scale is replaced, not copied.
 *
 * Spacing: linear multiplier on a 0.25rem (4px) base, reproducing the clean
 * 4px-grid spine of the Dimention scale (4/8/12/16/20/24/28/32/40/48/64...).
 * Step 0 is the explicit zero token, closing the `pt/0 @ 133.3%` data gap.
 *
 * Typography: continuous fluid gradient. base 16px (= Figma font-size-m / px.7)
 * is identical at both anchors; step +7 reaches ~112px at the wide anchor
 * (= Figma font-size-6xl / px.25) and is damped to ~57px at the narrow anchor.
 */
export const defaultConfig: TokensConfig = {
  spacing: {
    // 4px on a 16px root. Multiplier N => N * 4px. Scales with root font-size.
    baseRem: 0.25,
    steps: {
      // Pure rem multiplier model. Hairline border-widths (1px) are a separate
      // border concern, not spacing — kept out so this scale stays unambiguous.
      '0': 0, //   0px — explicit zero token
      '1': 1, //   4px
      '2': 2, //   8px
      '3': 3, //  12px
      '4': 4, //  16px
      '5': 5, //  20px
      '6': 6, //  24px
      '7': 7, //  28px
      '8': 8, //  32px
      '9': 9, //  36px
      '10': 10, //  40px
      '11': 11, //  44px
      '12': 12, //  48px
      '14': 14, //  56px
      '16': 16, //  64px
      '18': 18, //  72px
      '20': 20, //  80px
      '22': 22, //  88px
      '24': 24, //  96px
      '26': 26, // 104px
      '28': 28, // 112px
      '30': 30, // 120px
      '32': 32, // 128px
    },
    aliases: {
      none: '0',
      xs: '1', //  4px
      sm: '2', //  8px
      md: '4', // 16px — default inset / gap
      lg: '6', // 24px
      xl: '8', // 32px
      '2xl': '12', // 48px
      '3xl': '16', // 64px
    },
  },

  sizes: {
    // Габариты контрол-бокса канонической оси размера компонента (s|m|l).
    // Заземлено ПРИВЯЗКАМИ живого Figma (2026-07-02, figma-console): боксы
    // Check и Radio во всех вариантах биндят «🟠 1.1 Dimention» Size/S=12,
    // Size/M=16, Size/L=20 (→ Unit px/6, px/7, px/8 @100%) — одна шкала на оба
    // сета и на каждый следующий квадратный контрол. Ось tiny в Figma сегодня
    // не определена (tiny-варианты привязаны к Size/M — побайтная копия medium),
    // поэтому шага tiny здесь НЕТ: пробел = открытый вопрос владельцу, не
    // выдуманное значение (docs/dimension-contract.md §2).
    steps: {
      'control-s': 0.75, // 12px — Figma Size/S (Unit px/6)
      'control-m': 1, // 16px — Figma Size/M (Unit px/7)
      'control-l': 1.25, // 20px — Figma Size/L (Unit px/8)
      // Ось ВЫСОТ контролов (аудит 2026-07-03): до неё высоты жили хардкодами
      // в компонентах ДВУМЯ несовместимыми семействами — button/pin-input
      // 32/40/48 против menu/select 30/36/44, где 30px вне 4px-сетки
      // (30/4 = 7.5 — прямое нарушение декларированного грида). Ступени ниже —
      // доминирующее семейство (button, эталон миграции гардов), все на
      // 4px-сетке. СТАТУС: DECLARED — Figma-якоря высот пока нет (ось Size
      // биндит только глиф-боксы 12/16/20); при появлении привязки значения
      // сверить и пометить как заземлённые. Миграция menu/select на ось —
      // отдельная волна (меняет их геометрию на +2/+4px).
      'control-h-s': 2, // 32px — высота контрола size=s
      'control-h-m': 2.5, // 40px — высота контрола size=m (дефолт)
      'control-h-l': 3, // 48px — высота контрола size=l
    },
    aliases: {},
  },

  radii: {
    // Форма угла: DECLARED-размен «G2-вход ценой 2.35px/R100 геометрии от
    // кривой Figma ζ=0.6» (см. RadiiConfig.cornerK; воспроизводимая деривация —
    // scripts/derive-corner-k.mjs: геометрический фит был бы K=1, круг).
    cornerK: 1.1,
    // Geometric rem progression (Tailwind v4 shape). Step 0 is the zero token.
    steps: {
      '0': 0, //   0px — explicit zero
      xs: 0.125, //   2px
      sm: 0.25, //   4px
      md: 0.375, //   6px
      lg: 0.5, //   8px
      xl: 0.75, //  12px
      '2xl': 1, //  16px
      '3xl': 1.5, //  24px
      '4xl': 2, //  32px
      '5xl': 3, //  48px
    },
    fullPx: 9999,
    aliases: {
      none: '0',
      control: 'lg', //  8px — inputs, buttons
      card: '2xl', // 16px — cards, panels
      pill: 'full',
      circle: 'full',
      // Floor of the concentric-radius law: an inner radius derived as
      // `outer - inset` never drops below this (2px), so a deeply nested corner
      // rounds instead of going square. See docs/dimension-contract.md §3.
      'concentric-min': 'xs',
    },
  },

  zIndex: {
    // Daniel's 15 Figma levels, re-mapped to a clean gapped sequence (gap 100)
    // so the collisions in the raw snapshot (e.g. Quaternary == Grouped-Primary
    // == 400) are resolved and a new layer can be inserted without renumbering.
    // Order is the intended stacking order, lowest first.
    startAt: 0,
    gap: 100,
    levels: [
      'primary', //    base content plane (was 0)
      'secondary', //    raised content
      'tertiary', //    further raised
      'quaternary', //    further raised
      'grouped-primary', //    grouped surface base
      'grouped-secondary',
      'grouped-tertiary',
      'inverted', //    inverted surface plane
      'skip-link', //    a11y skip-to-content
      'dropdown', //    menus, selects, comboboxes
      'sticky', //    sticky headers / bars
      'modal-underlay', //    modal scrim / backdrop
      'modal', //    dialogs
      'toast', //    transient notifications
      'tooltip', //    top-most hint layer
    ],
  },

  typography: {
    basePx: 16, // = Figma font-size-m (px.7). Identical at both anchors.
    minViewportPx: 320, // narrow gradient anchor
    maxViewportPx: 1240, // wide gradient anchor
    ratioMin: 1.2, // damped modular ratio at narrow anchor (16*1.2^7 = 57.3px)
    ratioMax: 1.32, // full modular ratio at wide anchor (16*1.32^7 = 111.7px ~= 112)
    stepsUp: 7, // step +7 ~= 112px wide / ~57px narrow (display-xl)
    stepsDown: 2, // step -2 ~= caption / fine print
    remBasePx: 16,
    stepLabels: {
      '-2': 'xxs',
      '-1': 'xs',
      '0': 'md', // base / body
      '1': 'lg',
      '2': 'xl',
      '3': '2xl',
      '4': '3xl',
      '5': '4xl',
      '6': '5xl',
      '7': '6xl', // display-xl
    },
    // Интерлиньяж выведен из отпечатков Geist оптическим законом
    // (lineHeightOptical), а не бэндами — поэтому здесь поля нет. См. типы.
    // Font-weight roles. `semibold` (600) is the emphasis weight every component
    // used as a literal before this scale existed; values match 1:1 so the scale
    // is value-preserving. A client re-weights its whole UI via one override.
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    // Гарнитура ДС — Geist / Geist Mono (пакет @labpics/fonts self-host'ит
    // вариативные woff2). Первым — фирменный шрифт, дальше метрически близкие
    // системные фолбэки и аварийный дженерик в хвосте, чтобы текст читался и без
    // подгруженного Geist (font-display: swap). Клиент меняет ребренд оверрайдом.
    fontFamily: {
      sans: [
        'Geist',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'sans-serif',
      ],
      mono: [
        'Geist Mono',
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Consolas',
        'Liberation Mono',
        'monospace',
      ],
    },
    // OpenType-фичи Geist (проверено чтением бинарников, GSUB): заведены только
    // существующие. tnum — табличные (моноширинные) цифры Sans, для выравнивания
    // чисел в таблицах/дашбордах (Mono уже табличный). frac — дробные глифы.
    // zero/calt/onum в Geist ОТСУТСТВУЮТ — токенов на них НЕТ (были бы no-op).
    fontFeatures: {
      tabular: '"tnum" 1',
      fractions: '"frac" 1',
    },
  },
  // Stroke widths + focus ring (rem). Grounded against Figma (🧪Lab UI v.1):
  // hairline = 1px — the universal component border (button/card/checkbox/radio/
  // input/menu strokeWeight=1 in Figma); thick = 2px (focus ring, tab indicator).
  // The focus ring is its own axis: Figma draws it as a 2px stroke offset 2px
  // outside the element edge (focus-ring frame at -2,-2, strokeWeight 2).
  borders: {
    widths: {
      hairline: 0.0625, //   1px — universal component border (Figma strokeWeight 1)
      thick: 0.125, //   2px — focus ring / tab indicator
    },
    focusRing: {
      width: 0.125, //   2px ring (Figma focus-ring strokeWeight)
      offset: 0.125, //   2px gap from the element edge (Figma -2px inset)
    },
  },
  // Стейт-оверлеи (#109, решение владельца — финальное): доли
  // color-mix(in oklab, <роль покоя>, <тинт рецепта D> p%). Единственные
  // ручки формы состояний; CI-гейты (contrast/muddiness в @labui/colors)
  // читают их из СГЕНЕРИРОВАННОГО tokens.css, не из литералов компонентов.
  states: {
    hover: 8, //   8% к тинту — заметный, не кричащий сдвиг
    pressed: 14, //  14% — глубже hover; ужесточение автоматически ужесточает гейты
  },
};
