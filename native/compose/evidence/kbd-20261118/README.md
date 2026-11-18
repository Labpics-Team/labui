# Kbd: исходник и проверка

Исходная Lab UI v2.1 прочитана 18 ноября 2026 без изменения Figma.
`figma-source.json` содержит восемь masters `Keys=1…4 × Large=False/True`,
`figma-variables.json` — привязанные семантические переменные. SVG и PNG —
экспорт Small одной клавиши и Small/Large сочетания из четырёх клавиш.
PNG экспортированы в масштабе 3×.

Для смешанной обводки обычная сериализация Figma не возвращает `strokeWeight`.
Отдельное чтение живых свойств подтвердило `strokeTopWeight = strokeLeftWeight =
strokeRightWeight = 0`, `strokeBottomWeight = 1/2` для Small/Large и
`strokeAlign = OUTSIDE`. Вложенный Container имеет обводку 1 INSIDE.
У всех восьми masters отсутствует эффект тени.
Web явно использует `corner-shape: round`: глобальная форма Superellipse не
должна менять авторские круговые углы Kbd.

Общий профиль находится в `packages/tokens/src/components.json#kbd`.
`packages/tokens/test/kbd-profile.test.ts` сверяет размеры, отступы, радиусы,
типографику и число реальных текстовых узлов со всеми восемью исходными masters.

## Воспроизведение

Команды выполняются из корня рабочей копии на Windows x64. Проверенный JDK —
Zulu 21; browser binaries уже установлены в указанном каталоге.
Для `:desktopTest` не нужны Android SDK, `colorsRepository` или `colorsVersion`:
набор рисует `ImageComposeScene` на CPU без окна и без native Colors host.

```powershell
$env:JAVA_HOME = 'C:/Program Files/Zulu/zulu-21'
./native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.KbdRenderTest --console=plain

pnpm --filter @labpics/ui-docs... build
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/AgentWork/.playwright-browsers'
$env:PW_PORT = '4373'
pnpm --filter @labpics/ui-docs exec playwright test tests/kbd.spec.ts --project=chromium --project=webkit --workers=2

pnpm --filter @labpics/ui-core exec vitest run test/kbd-ssr.test.ts
pnpm --filter @labpics/ui-tokens exec vitest run test/kbd-profile.test.ts
pnpm --filter @labpics/adapter-codegen test
node native/compose/scripts/generate-components.mjs --check
pnpm catalog:check
```

После изменения Kotlin-исходников каталог обновляется после commit, чтобы его
ссылка указывала на реальный исходник. Web проверяется после сборки пакетов:
отдельная сборка docs использует уже имеющиеся `dist`.

## Что проверяется

- Playwright: все восемь вариантов на Lit и React, Geist Medium 500, настоящий
  `<kbd>` и вложенные клавиши, два размера, совместимость `m`, смена темы,
  семантические роли, длинные имена и масштаб 100/125/200%.
- Сравнение пикселей Lit/React ставит обе матрицы в одинаковую физическую точку.
  Это убирает различие сглаживания от дробной высоты предшествующих заголовков.
- Отдельная проверка сравнивает рамку, градиент и нижнюю грань Small с Figma SVG
  при 3×. Текст исключён из этой проверки формы; допустимая средняя разница
  канала — 1,25 из 255. Шрифт проверяется отдельно через его исходные контуры.
- Compose: восемь вариантов и длинные имена в light/dark при fontScale
  1/1,25/2, полные измеренные подписи, объединённый текст без интерактивной роли,
  высоты 16/24 при обычном масштабе. Матрицы используют настоящую начальную
  палитру темы; дополнительные `source-*-3x` изображения используют RGBA ролей
  из Figma для прямого сравнения поверхности и символа.
- SSR сохраняет single slot, пустой список и пустой JSON attribute, экранирует
  подписи списка. Сгенерированные Vue/Svelte/Solid/Astro передают `keys`.
  Список отражается JSON-атрибутом, поэтому сохраняется после гидратации DSD.
  Браузерная проверка запускает собранный Vue SSR в новом Node-процессе,
  загружает результат с тем же порядком импорта, что Astro, и меняет размер.

У Skia при `TextOverflow.Visible` ширина параграфа может оставаться шириной
доступного контейнера, хотя сам текстовый узел измерен по подписи.
`didOverflowWidth` в таком случае не означает обрезание. Проверка сравнивает
`maxIntrinsicWidth` с измеренной шириной и отдельно запрещает многоточие.

Происхождение текста и символа `⌘` описано в
[PROVENANCE.md](../../../../packages/fonts/PROVENANCE.md).

Источники: [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[семантика kbd](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/kbd).

## Результат 18 ноября

16 браузерных проверок Chromium/WebKit прошли; две Compose-проверки прошли
без окна. Сверка восьми masters, четыре Kbd SSR-проверки, 32 проверки генератора,
typecheck core/react/docs и актуальность каталога/нативного профиля прошли.
Fresh ESM import и CJS require собранного SSR-адаптера возвращают DSD;
уже существующий customElements registry и его определения сохраняются.
Причина прежней гонки и контракт bootstrap описаны в [SSR](../../../../docs/reference/ssr.md).

`comparison-small.png` ставит рядом Figma, Chromium и Compose. Контур `⌘`
соответствует Noto Sans Symbols 2: максимальное расстояние между образцами
контуров — 0,008485 px при реальных 12 px без подгонки масштаба.
В Compose границы сглаженного символа отличаются максимум на один физический
пиксель при 3×; смещения под отдельный символ не добавлены.
`command-shape-comparison.json` сохраняет также результаты сравнения с Inter
и Segoe UI Symbol, которые исходному контуру не соответствуют.
