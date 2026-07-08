# ADR-0007. Контракт элевации: лестница уровней, канон колец, свечения, scrim, z

Статус: принято. Вкусовые решения — по делегации владельца (задача #123), каждое с обоснованием ниже.
Дата: 2026-07-09. База: origin/main @ 38b8e33, перепись — этот worktree.

## 1. Перепись фактов (2026-07-09)

Полная перепись `box-shadow` / `text-shadow` / `drop-shadow()` / `outline` / `z-index` /
scrim по `packages/{react,core,shadow,tokens,colors-stub,materials}`.

**Тени — движок здоров.** Единственный источник — `packages/shadow/src/generated/shadow.css`
(155 строк, генерат из `src/config.ts`): 5 размеров `--lab-shadow-{xs,s,m,l,xl}`, каждый —
стек из 4 слоёв с фиксированными слот-альфами `--lab-shadow-alpha-{s1..s4}` =
`0.12/0.04/0.02/0.01` (shadow.css:30-33), монотонный рост offset-y/blur по лестнице
(:36-61), якорь `--lab-shadow-color: #101012` (:19) с пер-поверхностным тинтом через
`color-mix` (`--lab-surface-shadow-tint`, :37), `--lab-light-angle: 0deg` (:15,
вертикальный свет — экспорт владельца 2026-06-13). Семантические роли :63-66:
`--lab-elevation-{resting→xs, raised→s, overlay→l, modal→xl}` (`m` намеренно без роли —
зазор лестницы). Потребление: 38/46 box-shadow-строк компонентов — `var(--lab-elevation-*)`;
литеральной геометрии теней **ноль** (гард `no-box-shadow-literal` уже в CI). Тесты:
ramp-order, slot-model, light-angle-contract, baseline-gate, стек-структура,
`apps/docs/tests/shadow.spec.ts` (shadow-only-diff). Тёмная тема: те же альфы
(`DARK_ALPHA_MULTIPLIER_DEFAULT = 1`, `packages/shadow/src/domain/alpha-contract.ts`;
theme-блоки shadow.css:131-154).

**Кольца — два конкурирующих идиома.** (а) Канон outline: 21 объявление
`outline: var(--lab-focus-ring-width) solid <роль>` + 17 `outline-offset:
var(--lab-focus-ring-offset)` + 4 инсет-варианта `calc(-1 * var(--lab-focus-ring-offset))`
(button, checkbox, radio, switch, tabs, menu item, accordion, link, …).
(б) Legacy box-shadow-кольцо `0 0 0 var(--lab-focus-ring-width) <роль>` — 8 оставшихся
строк-рецептов в полях: `packages/react/src/input.css:103-122` (focus/danger/warning/success),
`textarea.css`, `combobox.css:115-134`, `number-input.css:169-192`, `pin-input.css:151-160`,
`tags-input.css:117-129`, `slider.css:138-142` (thumb) — плюс core-близнецы
(`field-styles.ts`, `lab-pin-input.ts`, `lab-number-input.ts`, `lab-tags-input.ts`,
`lab-slider.ts`), в паре с `outline: none` (11 вхождений). Геометрия токенизирована:
`--lab-focus-ring-{width,offset}` = `0.125rem` (tokens.css:143-144); Figma-канон кольца —
2px stroke на 2px снаружи от края (frame −2,−2, strokeWeight 2 — комментарий
`packages/tokens/src/config/default-config.ts:217-227`).
Отдельно — сепарационное кольцо avatar: `0 0 0 var(--lab-stroke-thick) var(--lab-bg-primary)`
(lab-avatar.ts:176, avatar.css:90) — не фокус, вырез поверхности.

**Свечения.** `text-shadow`: 0 вхождений. `drop-shadow()`: 0. FX-группа контракта —
66 ролей (`roles.json` `/groups/FX`; 216 объявлений в contract.css по темам):
glow-семья 6 сентиментов × ступени base/subtle/bloom × {halo, core, α} = 54 —
**живая эмиссия движка** `@labpics/colors` ≥0.6 (`packages/colors/generate-contract.mjs`,
`fxBridgeEmission`: screen-солвер, α светлой темы = 0 по `role.degraded`), плюс
`--lab-fx-focus-ring-*` ×6, `--lab-fx-shadow-{minor,ambient,penumbra,major}` ×4
(до-стековое наследие, в эмиссии генератора отсутствуют — якорный мост), плюс
`--lab-fx-glow-inverted` и `--lab-fx-skeleton-highlight` (ADR-0005). Прямой потребитель
в компонентах один — fx-skeleton-highlight; косвенный якорь канона —
`--lab-border-focus: var(--lab-fx-focus-ring-brand)` внутри самого contract.css (:162).
Все упоминания `fx-shadow-*` в компонентах — только устаревшие комментарии до-стекового
времени (card.ts:37, combobox.ts:62, dialog.ts:55, kbd.ts:20, menu.ts:56, popover.ts:52,
select.ts:54, tooltip.ts:38); код везде потребляет `--lab-elevation-*`.

**z-index.** 15 уровней `--lab-z-*` с шагом 100, 0..1400 (tokens.css:69-83), закон в
`docs/dimension-contract.md` §7, гард `no-magic-zindex`; сирот-литералов ноль
(локальный `z-index: -1` в materials легализован списком `materialsZIndexLiterals`).

**Scrim.** Роли `--lab-bg-overlay-{ghost,soft,base,strong}` (contract.css:34-37 light /
:277-280 dark, «мост: Figma-якорь»). Потребители: `base` — lab-dialog.ts:114,
dialog.css:44, lab-popover.ts:187, popover.css:37; `strong` — только
`apps/docs/src/materials-flag-demo.css:121` (демо); `ghost`/`soft` — ноль.

**Медиа-режимы.** `forced-colors` / `prefers-reduced-transparency` обработаны только в
materials (material.css:280, :320). Box-shadow-кольца полей в Windows High Contrast
**невидимы** (forced-colors вырезает box-shadow, outline перекрашивается UA) — P0-дефект
доступности.

**Стейл.** `docs/external-deps/lab-colors.md:70-74` описывает досекторную схему теней
(имена альф `minor/ambient/penumbra/major`, `35deg`, старые номера строк) и :188 — старую
alpha-damped-геометрию. Исправлено этим же PR.

## 2. Решение — лестница элеваций

Уровень — это **связка** {роль тени, z-полоса, scrim-политика}. Компонент выбирает
уровень; сочинять собственное сочетание запрещено.

| Уровень | Семантика | Тень | z-полоса | Scrim |
| --- | --- | --- | --- | --- |
| L0 base | Контентные и группированные плоскости | нет | 0–600 (`--lab-z-{base..grouped-tertiary}`) + 700 `inverted` | нет |
| L1 resting | Покоящаяся карточная фактура (card, kbd) | `--lab-elevation-resting` | в потоке (без z) | нет |
| L2 raised | Приподнятое в потоке: hover-подъём, thumb, switch | `--lab-elevation-raised` | в потоке | нет |
| L3 overlay | Всплывающие без блокировки: dropdown, popover, sticky, skip-link | `--lab-elevation-overlay` | 800–1000 (`--lab-z-{skip-link,dropdown,sticky}`) | нет |
| L4 modal | Блокирующие: dialog | `--lab-elevation-modal` | 1200 (`--lab-z-modal`) | `--lab-bg-overlay-base` на `--lab-z-modal-underlay` (1100) |
| L5 transient | Мимолётные поверх всего: toast, tooltip | `--lab-elevation-overlay` | 1300–1400 (`--lab-z-{toast,tooltip}`) | нет |

Обоснования: (1) фактическое потребление уже ровно такое — лестница фиксирует практику
законом, ни один компонент не мигрирует по уровню; (2) L5 берёт тень overlay, не modal —
transient-поверхности маленькие, xl-стек на tooltip дал бы блюр больше самой поверхности
(геометрия xl рассчитана на модальные площади); (3) размер `m` остаётся резервом лестницы —
не сопоставляем роли, пока нет уровня-потребителя; (4) scrim существует ровно на одном
уровне (см. §5).

## 3. Решение — канон кольца: outline-first

| Назначение | Идиом | Закон |
| --- | --- | --- |
| Фокус-кольцо интерактива | `outline: var(--lab-focus-ring-width) solid var(--lab-border-focus); outline-offset: var(--lab-focus-ring-offset)` | единственный способ |
| Статусное кольцо поля (danger/warning/success) | тот же идиом, роль `--lab-border-{danger,warning-strong,success-strong}` | двухканально: кольцо **плюс** border-color, как сейчас (input.css:107,110) |
| Кольцо внутрь (обрезающие контейнеры: menu item, tabs) | `outline-offset: calc(-1 * var(--lab-focus-ring-offset))` | существующий инсет-вариант канона |
| Сепарация поверхности (avatar на стеке) | `box-shadow: 0 0 0 var(--lab-stroke-*) var(--lab-bg-*)` | декоративный вырез, не сигнал; в forced-colors законно исчезает |
| Фокус/статус через box-shadow | — | **запрещено**, гард (§8) |

Обоснования: (1) forced-colors — outline выживает и перекрашивается в SystemHighlight
нативно, box-shadow вырезается: сегодняшние поля слепы в High Contrast (перепись, P0);
(2) Figma-истина — фокус-кольцо задано как 2px stroke offset 2px
(default-config.ts:217-227), это ровно outline-геометрия; (3) 21 против 8 — канон уже
доминирует, мигрирует меньшинство. **Видимое изменение:** поля сегодня носят flush-кольцо
(spread вплотную к border), после миграции получат каноничный 2px-зазор — это соответствие
Figma-споку, прикладываю before/after светлой и тёмной темы в PR имплементации.

## 4. Решение — свечения

1. **Свечение никогда не эмитится теневым движком.** Вердикт владельца (shadow README):
   тень всегда темнее поверхности; движок конструктивно не умеет светлеть (color-mix от
   тёмного якоря `#101012`). Рукописные светлые/размытые box-shadow-свечения в компонентах
   запрещены (гард §8). Семантика «привлечь внимание/фокус» решается кольцами (§3) и
   elevation-осветлением тёмной темы (ADR-0002); тинт тени — только
   `--lab-surface-shadow-tint` + `--lab-shadow-tint-strength` (тень остаётся тенью).
2. **Glow-ярус — домен движка цвета; адопция отложена.** Glow-семья FX — не мёртвый мост,
   а живая эмиссия `@labpics/colors` (ADR-0002 §5 «свет, не краска»: base/subtle/bloom ×
   6 сентиментов, halo/core/α решены screen-солвером; перепись §1). Компоненты сегодня не
   потребляют ни одной glow-роли, и эта волна их не адоптирует: «когда продукту нужен
   brand/danger-glow» — продуктовое решение с владельцем, не побочка контракта элевации.
   Glow не входит в связки уровней §2; появление потребителя — через правку этого ADR.
3. **`fx-focus-ring-*` не трогаем.** `--lab-fx-focus-ring-brand` — якорь всего ring-канона
   (`--lab-border-focus` алиасится на него внутри contract.css:162).
4. **Снос `--lab-fx-shadow-{minor,ambient,penumbra,major}`** — единственные действительно
   мёртвые FX-роли: до-стековое наследие (старые альфы minor/ambient/penumbra/major),
   полностью вытеснены слот-моделью `packages/shadow` (s1..s4); ноль потребителей.
   Прецедент и механизм ADR-0005: deprecation-мост ради фантомов не тащим; снос через
   `packages/colors/generate-contract.mjs` + `roles.json` + регенерация (гейты
   contract-generated / contract.test / fx-family); чтение снесённого авто-ловится
   missing-role детекцией `consumed-contract`. Комментарий к `SEMANTIC_ROLE_PREFIXES`
   (`packages/core/src/css.ts:84`) обновить: FX = glow-эмиссия движка + focus-ring +
   skeleton-highlight. Стейл-комментарии `fx-shadow-*` в 8 компонентах вычищаются той же
   волной.
5. `text-shadow` и `drop-shadow()` — сегодня 0 вхождений; замораживаются гардом на нуле
   (§8): появление любого — через изменение этого ADR.

## 5. Решение — scrim-закон

Единственный scrim системы — `--lab-bg-overlay-base` на `--lab-z-modal-underlay`,
принадлежит уровню L4 и только ему. Новый scrim-ярус = правка этого ADR.
`ghost/soft/strong` — **не** scrim-ярусы и не сносятся этой волной: это colors-домен
(«мост: Figma-якорь», contract.css генерируется из passport `@labpics/colors`), `strong`
жив в демо; их судьба решается при высадке реального движка lab-colors
(docs/external-deps/lab-colors.md).

## 6. Решение — тёмная тема: три канала, без самодеятельности

1. Осветление поверхности по элевации — уже закон ADR-0002 (домен lab-colors).
2. Тень остаётся тёмной; альфы тем временно инвариантны
   (`DARK_ALPHA_MULTIPLIER_DEFAULT = 1`) — калибровка JND принадлежит движку lab-colors,
   до его высадки множитель не трогаем (научно-эмпирическая культура: не выдумываем
   числа без измерения).
3. Hairline-бордер оверлей-поверхностей (`--lab-stroke-hairline` + `--lab-border-soft`) —
   уже повсеместно (lab-menu.ts:256, lab-dialog.ts:172); он и несёт читаемость контура
   там, где тень на тёмном гаснет. Inner-glow — не вводим (§4.1).

## 7. Решение — деградации и materials

- **forced-colors:** тени и сепарационные кольца исчезают (UA) — глубину несут системно
  перекрашиваемые бордеры (у оверлеев уже есть, §6.3); фокус/статус — outline, выживает
  нативно (§3); scrim теряет полупрозрачность по воле UA. Закон: ни одно состояние не
  кодируется только тенью или box-shadow-кольцом.
- **prefers-reduced-transparency:** scrim — намеренное затемнение под блокирующей
  поверхностью, не translucency контента; не деградирует. Полупрозрачность materials уже
  деградирует (material.css:280, :320) — этого достаточно.
- **materials × elevation:** стеклянная поверхность уровня N несёт ту же роль
  `--lab-elevation-*`, что и непрозрачная; тень рисуется на хосте под вуалью и
  blur-containment (ADR-0003) её не задевает. Сегодня стеклянных компонентных
  поверхностей ноль (material.css: 0 box-shadow) — закон действует с первой высадки.

## 8. Гарды (волна имплементации)

Расширение существующего механизма `no-box-shadow-literal` (по образцу
`no-magic-dimension`/`no-magic-zindex`):

1. **ring-idiom:** box-shadow-форма `0 0 0 <w> <c>` в компонентных пакетах запрещена,
   кроме сепарации `0 0 0 var(--lab-stroke-*) var(--lab-bg-*)`.
2. **zero-freeze:** `text-shadow` и `drop-shadow(` — запрещены целиком.
3. **outline-roles:** `outline`/`outline-offset` на компонентной поверхности обязаны
   ссылаться на `--lab-focus-ring-*` и цветовые роли (литеральные толщины/цвета — фейл).

Существующие гарды (no-magic-zindex, shadow-wiring, fallback-drift) не тронуты.

## Отклонённые альтернативы

- **Композитный токен `--lab-ring-*`** (одна var на весь outline) — канон из двух токенов
  уже в 21 месте; композит добавил бы второй способ записи того же, гард дешевле словаря.
- **Перестройка лестницы теней или z** — перепись показала здоровые движки; закон
  фиксирует, а не реформирует.
- **box-shadow-канон колец + `outline: transparent`-хак для forced-colors** — хак
  воспроизводит то, что outline даёт нативно.
- **Снос `--lab-bg-overlay-{ghost,soft,strong}`** — чужой домен (colors-мост), см. §5.

## План имплементации (следующий PR)

Миграция 7 полей + slider (react + core-близнецы) на outline-канон; снос `fx-shadow-*`
×4 (`packages/colors/generate-contract.mjs` + `roles.json` + регенерация, гейты
contract-generated / contract.test / fx-family / consumed-contract); вычистка 8
стейл-комментариев; css.ts:84; гарды §8; before/after light+dark. Glow-семья и
`fx-focus-ring-*` не трогаются (§4.2–4.3). Размерные свойства
(width/height/padding/margin/radius/font-size) не трогаются — параллельная волна другого
агента.
