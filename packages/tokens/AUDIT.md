# Аудит токенов LabUI (задача #12)

Дата: 2026-07-09. Ветка: `tokens-audit`. Метод: скан `packages/tokens/src` +
сгенерированных артефактов (`tokens.css`, `motion.css`), контрактов соседних
пакетов (`colors-stub/contract.css`, `shadow/shadow.css`, `materials`) и всех
потребителей `var(--lab-*)` в `packages/*/src` (core Lit, react, vue).

## Сводные числа

| Метрика | Значение |
| --- | --- |
| Определено `--lab-*` в ui-tokens (tokens.css + motion.css) | 170 |
| Различных потребляемых имён `var(--lab-*)` в `packages/*/src` | 157 |
| Определено в ui-tokens, но не потреблено в `packages/*/src` | 94 (см. класс «в») |
| `fx-glow-*` в contract.css: определено / потреблено | 55 / 3 |
| Голых `opacity:`-литералов состояния (0.4 / 0.45 / 0.5) | 44 |

Дыры по классам: **а) 7 групп** · **б) 2** · **в) 2 группы (94 + 52 имён)** ·
**г) 3 группы** · **д) 2 оси** (обе закрыты задачей #13).

## Реестр дыр

Класс: **а** — компонентный хардкод вместо ссылки на семантик; **б** — семантик
не на примитиве; **в** — примитив-сирота; **г** — дубль значения под разными
именами; **д** — отсутствующая ось/слот.

| № | Дыра | Класс | Файл:строка | Предлагаемый фикс |
| --- | --- | --- | --- | --- |
| 1 | `transition: … 120ms ease` — proof не мигрирован на motion-ось (единственный компонент вне волны wiring) | а | `core/src/proof/lab-proof.ts:104-106`; `react/src/proof.tsx:53` | `var(--lab-motion-transition-duration)` + `var(--lab-motion-transition-easing)` (волна wiring) |
| 2 | 44 голых `opacity:`-литерала состояний: `0.45` (disabled) ×25, `0.5` (muted/placeholder) ×17, `0.4` ×2 — в ~30 файлах core/react (badge, button, checkbox, combobox, field, input, menu, number-input, pin-input, progress, radio-group, select, slider, switch, tags-input, textarea, proof…) | а, д | см. приложение Б | ось **opacity** (добавлена задачей #13: `--lab-opacity-45/50` + роли `disabled`/`muted`); миграция компонентов — отдельная волна; `0.4` в number-input выровнять на `disabled` (решение владельца) |
| 3 | rem-литералы — двойники существующих `--lab-size-overlay-*`: menu `11rem/20rem`, select `12rem/16rem`, popover `11/14/18/22/28rem` | а, г | `lab-menu.ts:247-248`; `lab-select.ts:271,334`; `lab-popover.ts:144-159` (+ react-близнецы) | подключить `var(--lab-size-overlay-11/12/14/16/18/20/22/28)` — токены уже есть, потребителей нет |
| 4 | Высоты контролов вторым семейством 30/36/44px: menu/select `--_h: 1.875/2.25/2.75rem`, pagination `--_size: 1.75/2.25/2.75rem` — мимо оси `control-h-*` (32/40/48) | а | `lab-menu.ts:175-188`; `lab-select.ts:231-247`; `lab-pagination.ts:127-139` | миграция на `--lab-size-control-h-*` — отдельная волна (меняет геометрию +2/+4px; статус зафиксирован владельцем в `default-config.ts`) |
| 5 | slider: `--_track-thickness: 0.375/0.25rem`, `--_thumb: 1.125/0.875rem` — thumb дублирует `switch-thumb-m/s` | а, г | `lab-slider.ts:224-239` | завести ступени `slider-track-*` в оси size; thumb — на `var(--lab-size-switch-thumb-*)` либо общая роль `thumb-*` |
| 6 | popover `--arrow-size: 0.625rem` ×2 — значение = `avatar-dot-s` | а, г | `lab-popover.ts:202,273` | ступень `arrow` оси size (не алиас на avatar-dot: семантически чужая роль) — вопрос владельцу |
| 7 | shadow-пакет: `SHADOW_TRANSITION_DURATION='160ms'`, `EASING='cubic-bezier(0.4,0,0.2,1)'` — литералы; 160ms вне шкалы motion, кривая = M2 standard, не `--lab-motion-easing-standard` | а, б | `shadow/src/config.ts:38-39` → `shadow.css:23-24` | алиасить `--lab-shadow-transition-*` на motion-ось (волна в @labpics/shadow — там golden-гейты) |
| 8 | Семантический слой оси size пуст: `sizes.aliases = {}` — компонентные роли (checkbox-tiny, avatar-*, switch-*) заведены примитивами-ступенями | б | `tokens/src/config/default-config.ts` (`sizes.aliases`) | завести роли-алиасы поверх ступеней (вопрос владельцу: какие совпадения из №10 — осознанные роли) |
| 9 | 94 определённых `--lab-*` без потребителя в `packages/*/src`. Законная полнота шкалы (space-шаги, верх font-size/line-height/letter-spacing, z-реестр слоёв) — не дыра. Настоящие немые: `overlay-11/20/28` (двойники — №3), `switch-thumb-*` (№5), `font-feature-fractions`, `measure-narrow/wide/base`, **вся motion-ось (20 имён: duration/easing/spring/entrance/exit/emphasis) кроме transition-роли** | в | см. приложение А | motion: волна wiring (№1 — proof; entrance/exit — overlay-компоненты); fractions/measure — потребители в docs-типографике; overlay/thumb — №3/№5 |
| 10 | `fx-glow-*`: 52 из 55 переменных contract.css без потребителя (жив только `brand`/`brand-alpha`/`brand-core` в прототипе glow) | в | `colors-stub/contract.css` | ось цвета готова; потребителей даст компонент glow (бэклог); не удалять — контракт опубликован |
| 11 | `switch-thumb-s` = `checkbox-tiny` = 0.875rem — один глиф-бокс двумя именами | г | `default-config.ts` (sizes.steps) | при заполнении sizes.aliases (№8) свести к одной ступени + роли |
| 12 | Совпадения значений ступеней size: `avatar-dot-m`=`control-s` (0.75), `avatar-dot-l`=`control-m` (1), `switch-track-h-s`=`control-l` (1.25), `switch-track-h-m`=`control-xl` (1.5), `switch-track-h-l`=`avatar-s` (1.75) | г | `default-config.ts` (sizes.steps) | осознанные роли-совпадения (ADR-0006); формализовать алиасами при №8, не схлопывать молча |
| 13 | Ось **opacity** отсутствовала целиком (единственная ось, где состояние жило только литералами — №2) | д | — | **закрыто задачей #13**: шкала `--lab-opacity-*` (примитивы 0/45/50/100 + роли none/disabled/muted/full) |
| 14 | Геометрия glow не токенизирована: радиусы ядра/ореола прототип берёт из space-шкалы руками (`space-2`/`space-8`), роли нет | д | `prototypes/glow/index.html:34-35` | **закрыто задачей #13**: алиасы `--lab-space-glow-core` → space-2, `--lab-space-glow-halo` → space-8 |

## Сводка покрытия осей

| Ось | Владелец | Примитивы | Семантики | Потребление | Вердикт |
| --- | --- | --- | --- | --- | --- |
| color | @labpics/colors → colors-stub | ✓ | ✓ роли (label/fill/border/bg/badge) | ✓ | покрыто |
| space | ui-tokens | ✓ 23 ступени | ✓ 8 алиасов (+2 glow, #13) | ✓ | покрыто |
| size | ui-tokens | ✓ 33 ступени | ✗ aliases пуст | частично (overlay-двойники) | дыры №3–6, 8 |
| radius | ui-tokens | ✓ 10 + full + corner-k | ✓ 6 алиасов | ✓ | покрыто |
| z-index | ui-tokens | ✓ 15 уровней (сам семантический) | — | частично (реестр слоёв) | покрыто |
| typography | ui-tokens | ✓ size/line-height/weight/letter-spacing/measure/family/features | оптический закон | ✓ | покрыто; сироты №9 |
| stroke / focus-ring | ui-tokens | ✓ | — | ✓ | покрыто |
| state (overlays) | ui-tokens | ✓ hover/pressed | — | ✓ (гейты в colors) | покрыто |
| motion | ui-tokens/motion | ✓ duration/easing/spring | ✓ transition/entrance/exit/emphasis + reduced-motion | ✗ только transition | дыра wiring №1, 7, 9 |
| shadow / elevation | @labpics/shadow | ✓ | ✓ | ✓ | transition-литералы №7 |
| glow / luminosity | @labpics/colors (fx-glow) | ✓ 55 | ✓ роли | 3/55 (№10) | цвет покрыт; геометрия — №14 → #13 |
| surface / material | @labpics/materials + bg-material-* | ✓ | ✓ | ✓ | покрыто |
| opacity | ui-tokens | — → ✓ (#13) | — → ✓ disabled/muted (#13) | литералы №2 | **закрыто #13**, миграция — волна |

## Приложение А — 94 неупотреблённых имени (ui-tokens)

`font-feature-fractions`, `font-size-{xl,2xl,3xl,4xl,5xl,6xl}`,
`font-weight-{regular,medium,bold}`, `letter-spacing-{xl,2xl,3xl,4xl,5xl,6xl}`,
`line-height-{xxs,lg,xl,2xl,3xl,4xl,5xl,6xl}`, `measure-{narrow,base,wide}`,
`motion-duration-{instant,fast,base,slow,slower}`,
`motion-easing-{standard,accelerate,decelerate,emphasized}`,
`motion-emphasis-{duration,easing,spring}`, `motion-entrance-{duration,easing}`,
`motion-exit-{duration,easing}`,
`motion-spring-{expressive,expressive-duration,smooth,smooth-duration}`,
`radius-{0,xl,2xl,3xl,4xl,5xl,none,pill,concentric-min}`,
`size-overlay-{11,20,28}`, `size-switch-thumb-{s,m,l}`,
`space-{0,1,2,4,8,9,10,11,12,14,16,18,20,22,26,28,30,32,none,2xl,3xl}`,
`z-{primary,secondary,tertiary,quaternary,grouped-primary,grouped-secondary,grouped-tertiary,inverted,skip-link,sticky,toast}`.

Большинство — законная полнота шкал; действенные пункты вынесены в №9.

## Приложение Б — opacity-литералы по файлам (0.4/0.45/0.5)

core: `lab-tags-input.ts` ×3, `lab-select.ts` ×2, `lab-proof.ts` ×2,
`lab-menu.ts` ×2, `lab-combobox.ts` ×2, `lab-number-input.ts` ×2,
`lab-pin-input.ts`, `lab-progress.ts`, `lab-radio-group.ts`, `lab-button.ts`,
`lab-checkbox.ts`, `field-styles.ts`, `lab-slider.ts`, `lab-switch.ts`,
`lab-badge.ts` — по ×1.
react: `tags-input.css` ×3, `combobox.css` ×3, `select.css` ×2, `menu.css` ×2,
`number-input.css` ×2, `textarea.css`, `switch.css`, `input.css`,
`radio-group.css`, `slider.css`, `pin-input.css`, `progress.css`, `badge.css`,
`button.css`, `checkbox.css` — по ×1.

Целевая карта миграции: `0.45` → `var(--lab-opacity-disabled)`,
`0.5` → `var(--lab-opacity-muted)`, `0.4` → выровнять на `disabled`
(2 места в number-input; решение владельца).
