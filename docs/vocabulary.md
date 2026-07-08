# Словарь ролей labui

Источник истины: `packages/colors/labui.config.json` (паспорт).
Контрактная поверхность: `packages/colors-stub/roles.json` + `contract.css`
(отпечаток паспорта пинится в `packages/colors/engine.mjs`).

## Законы имён

- Схема: `--lab-<роль>[-<вариант>]`; сегменты контракта: Backgrounds, Labels,
  Fills, Border, FX, Misc, Component (`roles.json#groups`).
- **Labels владеют глифами.** Иконка — глиф: отдельной роли `icon` нет,
  иконки красятся `label-*` (по умолчанию `label-tertiary`).
- **Border владеет разделителями.** Роли `separator` нет — это
  `border-base` / `border-soft`.
- **`none` — честный ноль.** Невидимость by design: `fill-none`,
  `border-none` (kind: `zero`). Движок невидимое не эмитит — такие токены
  идут в контракте мостом.
- **`label-on-<поверхность>` — парный лейбл заливки (PairFill).** `on-` —
  не отдельная ось роли, а суффикс легального лейбла КОНКРЕТНОЙ несущей
  заливки (см. «Пары заливка × лейбл»). Больше `on-` в словаре нет.

## Пары «заливка × лейбл» (PairFill)

Часть Fill-поверхностей — **несущие лейбл**: заливка гарантирует, что её
парный лейбл `label-on-<поверхность>` читаем поверх неё. Это семантическое
свойство поверхности, а не совпадение: заливка выводится рецептом `pair-fill`
(сдвиг до строгой победы стороны в штатной полярности), лейбл — nested-resolve
на выведенной заливке. Контраст композита ≥ AA-text (4.5:1) в **обеих** темах
**по построению**.

| поверхность (заливка)     | парный лейбл                  | источник заливки        |
| ------------------------- | ----------------------------- | ----------------------- |
| `fill-accent`             | `label-on-accent`             | `badge-fill-brand`      |
| `fill-danger`             | `label-on-danger`             | `badge-fill-danger`     |
| `fill-neutral`            | `label-on-neutral`            | сплошная нейтраль (мост)|
| `badge-fill-<семья>`      | `badge-label-on-<семья>`      | `pair-fill` семьи       |

- Семьи бейджа: `brand`, `danger`, `warning`, `success`, `info`,
  `static-dark`, `static-light`.
- `fill-accent` / `fill-danger` — **канонические** семантические поверхности
  (компоненты читают их напрямую: кнопка, чекбокс, свитч, пагинация…), НЕ
  deprecated. Механически они — `passport.aliases` на `badge-fill-<семья>`
  (проекция закона пары: семантика→компонент, downward-only), а generate-contract
  деривирует из этого и заливку, и парный лейбл (одна истина, ноль дубля oklch).
- Гарантия неторгуема и застолблена гейтом
  `packages/colors/test/pair-legality.test.mjs` (WCAG-пол каждой пары в обеих
  темах, замер на сгенерированном `contract.css`). Семантика — ADR-0002 §4.

## Deprecated-мосты (не `passport.aliases`)

Токены ниже эмитятся НЕ из паспорта, а как **bridge-мосты** из замороженного
`packages/colors-stub/figma-reference.css` (по 3 скоупа) + `roles.json`. Записи в
`passport.aliases` для них были инертны (паспорт эмитит алиасы только для целей
`badge-fill-*`) и сняты как мёртвый конфиг (см. история сноса `icon`).

В новом коде НЕ используются — предпочитай цель. Все потребители переписаны на
цель (2026-07-08, `packages/react` + `apps/docs` + `proof.tsx`), потребителей **0**.
Сам снос строк из contract.css трогает замороженный референс + `roles.json` +
`accent-substrate-legality.test.mjs` — владельческая задача (#101).

| мост                  | цель              | статус                          |
| --------------------- | ----------------- | ------------------------------- |
| `border-ghost`        | `border-none`     | 0 потребителей, снос ждёт #101  |
| `border-neutral`      | `border-base`     | 0 потребителей, снос ждёт #101  |
| `fill-neutral-tinted` | `fill-primary`    | 0 потребителей, снос ждёт #101  |

`fx-skeleton-base` (ранее числился здесь) — **не deprecated**, а несущий вход
FX-контракта: из него `generate-contract.mjs` (`skeletonShimmerEmission`)
деривирует `fx-skeleton-highlight`. Его рецикл/переклассификация — владельческая
задача #100.
