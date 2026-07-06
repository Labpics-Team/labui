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

## Deprecated-алиасы

Эмитятся для совместимости (`passport.aliases`); в новом коде не используются.

| алиас                 | цель                |
| --------------------- | ------------------- |
| `icon`                | `label-tertiary`    |
| `border-ghost`        | `border-none`       |
| `border-neutral`      | `border-base`       |
| `fill-neutral-tinted` | `fill-primary`      |
| `fx-skeleton-base`    | `fill-quaternary`   |
| `fill-accent`         | `badge-fill-brand`  |
| `fill-danger`         | `badge-fill-danger` |
