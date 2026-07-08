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

## Deprecated-алиасы

Эмитятся для совместимости (`passport.aliases`); в новом коде не используются —
предпочитай цель. Миграция ленивая (старое имя живёт алиасом).

| алиас                 | цель                |
| --------------------- | ------------------- |
| `icon`                | `label-tertiary`    |
| `border-ghost`        | `border-none`       |
| `border-neutral`      | `border-base`       |
| `fill-neutral-tinted` | `fill-primary`      |
| `fx-skeleton-base`    | `fill-quaternary`   |
