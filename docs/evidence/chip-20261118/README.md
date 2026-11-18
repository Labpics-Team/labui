# Chip: авторский профиль и проверка результата

Проверено 18 ноября 2026. Авторский источник: Chips / Chip в
[Lab UI v2.1 Community](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Chip перенесён в Lit, React, generated Vue/Solid/Svelte/Astro и Compose. Геометрия,
paint roles, baseline и точные контуры находятся в одном профиле
`packages/tokens/src/components.json#chip`; web CSS и native constants следуют ему.

Использованы сохранённые полные деревья всех 56 вариантов и 12 исходных
`SVG_STRING` exports. В ходе реализации Figma не открывалась и не изменялась.
SHA-256 входного `source.json`:
`6db99252497aff494fa114b78392b98b25424cd9ab37b990d578d0aad6b29f0f`.
`scripts/verify-chip-source.mjs` принимает этот файл явным аргументом и сверяет
все 56 вариантов: геометрию, шрифт, leading, close paths, роли, focus, glow и skeleton.

| Свойство | Small | Medium |
|---|---|---|
| Высота / padding Y / padding X | 28 / 8 / 8 | 40 / 8 / 12 |
| Gap / leading / close | 4 / 12 / 12 | 8 / 16 / 24 |
| Geist Medium / line height | 14 / 12 | 16 / 24 |
| Baseline внутри строки / root | 11 / 19 | 18 / 26 |
| Rounded radius / Sharp radius | 9999 / 4 | 12 / 4 |

`original-svg-and-web.png` сопоставляет исходные SVG и настоящий DOM в масштабе
1 CSS px на авторский px, DPR 2. SVG растеризованы локально Chromium;
это **не PNG-экспорт Figma**. SVG содержит outlined text, DOM использует Geist 1.400.
Границы web hug-content дробные: 82.719/98.719 и 100.25/132.25 px без/с выбором,
при авторских целых 83/99 и 101/133. Высоты и baseline совпадают; попиксельная
идентичность разных растеризаторов не заявляется. Измерения сохранены рядом в JSON.

У Medium обычный браузерный line box помещал baseline на 1 px выше авторского.
`text-box-trim` открывает настоящую alphabetic edge, а общие baseline и line height
задают её положение. Ручного translate или измерения текста при mount нет.
Small сохраняет native line box. Chromium и WebKit подтвердили baseline 19/26 px.
В браузере без `text-box-trim` остаётся обычная рабочая текстовая раскладка;
точное авторское положение Medium там не проверено. Основание:
[CSS Inline Layout: text box edges](https://drafts.csswg.org/css-inline-3/#text-edges).

Focus использует outline 2 px с offset 2: Figma frame расширен на 2 px,
его stroke находится снаружи. Glow 96×96 с opacity .2 и авторским blur 36
соответствует SVG stdDeviation 18 / CSS blur 18. Его logical center offset
32.5/45.5 следует выбранности; selected glow находится над текстом, как в source.

Loading сохраняет настоящий текст, selected, ширину и фокус. В source loading
подписан «Chip 1», а скрытый Medium close уменьшен до 16; runtime сохраняет
действующий close 24, поэтому pending не сужает кнопку. Проверка всех 56 выявила
исключение из исходной краткой сводки: Rounded Small skeleton имеет radius 9999,
остальные — 4. Роль `fx-skeleton-base` добавлена в общий Colors contract:
Light/Dark alpha .08/.12, increased contrast .12/.16. Skeleton статичен.

Семантика выбрана LabUI: Figma не содержит реакций и не задаёт поведения удаления.
Одна native button представляет filter (`aria-pressed`), action или remove.
Крестик декоративный; remove получает имя вроде «Удалить Дизайн», а приложение
удаляет элемент и переводит фокус. Active — отдельный brand accent, не pointer press.
Основание: [WAI-ARIA Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).
Общий SSR generator передаёт `aria-label` и `form` до JavaScript; уже объявленные
атрибуты не добавляются повторно.

В forced colors используются полные системные пары ButtonFace/ButtonText и
Highlight/HighlightText, GrayText для disabled. Локальный `forced-color-adjust:none`
сохраняет эти пары и предотвращает подложку UA, которая закрывала текст и leading.
Обычные brand/hover переменные не переопределяют системную палитру. Hover/pressed
подчёркивают подпись; focus получает явный outline, обычное состояние его не имеет.
`forced-before-light/dark.png` сохраняют исходный дефект, `forced-light/dark.png`
показывают все состояния Lit/React после исправления. Проверяются реальные пиксели
label/leading, поскольку одни computed colors не обнаруживали непрозрачную подложку.
Основание: [CSS Color Adjustment](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-mode).

Solid/Svelte используют общий `core/adapter-runtime`: несвязанный reactive update
не удаляет отсутствующие props и не повторяет неизменившиеся входные значения.
Проверены defaultSelected → loading → снятие loading → click, а также однократное
снятие ранее переданных name/active. `packed-runtime.json` сохраняет наблюдения
реального браузерного consumer из переустановленных архивов: высота остаётся 40,
pending сохраняет ширину, после click меняется выбор, defaults и внутреннее
состояние не теряются. Программный `host.click()` теперь даёт один bubbling click.

Chip задаёт `useDefault:true` для строковых mode/size/name/value. После снятия
атрибута Lit восстанавливает значение конструктора: filter/m/пустое имя/on.
Это проверено отдельно от первоначального отсутствия props: action/s → undefined
в обоих установленных адаптерах возвращает высоту 40 и aria-pressed без потери
selected. Явное `value=""` остаётся пустым значением формы; его снятие возвращает on.
Адаптеры не содержат перечня defaults. Основание:
[Lit: useDefault и отражённые атрибуты](https://lit.dev/docs/components/properties/#enabling-attribute-reflection).

Точный React-пример из how-to с `import '@labpics/ui-core/chip.css'` собран из
установленного архива и проверен без JavaScript: height 40, radius 12 и выбранная
поверхность доступны до hydration (`packed-react-ssr.png`).

Контур standalone Icons close отличается от Chip: проверенный master Icons
имеет оптические границы примерно 7…17 в box 24, Chip Medium — 5.7…18.3.
Профиль сохраняет точный авторский контур. Это сравнение исходных masters,
не утверждение о всех возможностях optical axes Icons. Compose компилирует
контур в два общих lazy Path во время генерации; runtime не разбирает SVG
и не создаёт отдельные Path/Matrix на mount.

`web-all-56-light.png` и `web-all-56-dark.png` показывают все семь состояний.
Строки: Rounded Small без/с выбором, Rounded Medium без/с выбором,
Sharp Small без/с выбором, Sharp Medium без/с выбором. `web-rtl-200.png`
показывает длинную реальную подпись в 190 px при 200% и RTL, без обрезания.

Проверки:

- Chromium + WebKit: 18 прошли; две проверки forced colors пропущены в WebKit,
  системные палитры проверены Chromium. Space/Enter, controlled отказ, FormData/reset и отмена
  reset; pending name/focus/width; одно действие, disabled; 56 сочетаний и равенство
  Lit/React; baseline; RTL/200%/reduced motion; одинаковая SSR/hydrated geometry;
  доступное имя generated SSR до JS и внешняя форма после hydration.
- Solid: 11/11; Svelte: 10/10, включая реальные reactive mount и withdrawal props.
- Colors: 255/255. Общие роли, generated CSS/native contract, отсутствие inline
  paint literals, непредусмотренных размеров, motion и неименованных z-index.
- Typecheck всех workspace packages и docs прошёл; Biome и source verification чисты.
- Адаптеры и каталог: 32/32; документация: 17/17. Обычная сборка docs с
  `catalog:check` прошла. На `/components.html?component=chip` проверены 56
  состояний и два живых примера; реальный click меняет `aria-pressed` на `true`,
  ошибок страницы нет. `catalog-page.png` показывает выбранный live example.
- Установленный isolated consumer из 11 npm tarballs: ESM/CJS core и React,
  восемь CSS exports, Vue/Solid imports, четыре renderChip SSR, browser bundle,
  Svelte client/server и Astro compile прошли. После исправления `exports.types`
  внутри `import`/`require` строгие `.mts` и `.cts` проекты TypeScript 5.9.3 прошли
  с `skipLibCheck:false`, включая недопустимые вызовы. TS 5.7.3 требует
  `skipLibCheck` из-за диагностики Zag TS1170 и CJS/Lit TS1479 в зависимостях;
  пользовательский API в этой версии проверен. Это архивы локальной сборки,
  не опубликованные npm-байты. Основание разделения деклараций:
  [TypeScript: ESM/CJS declarations](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html).
- Compose: 4/4, отдельный consumer: 1/1. 56 × Light/Dark × 100/200%, настоящий
  ввод и semantics, pending, отсутствие idle loop, RTL и длинный текст.
  [Native evidence](../../../native/compose/evidence/chip-20261118/README.md)
  содержит CPU-снимки и команды; Android/iOS и системная озвучка не проверялись.

Воспроизведение web из корня репозитория после сборки пакетов и docs:

```powershell
node scripts/verify-chip-source.mjs <saved-source.json>
pnpm --filter @labpics/ui-docs exec playwright test tests/chip.spec.ts --project=chromium --project=webkit --workers=1
node apps/docs/tests/chip-render.mjs <saved-source-directory> docs/evidence/chip-20261118
```

Render script использует preview `127.0.0.1:4338`; другой адрес можно передать
через `CHIP_BASE_URL`. Playwright использует `PW_PORT` для адреса preview.
