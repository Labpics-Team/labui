# Segmented Control — 19 ноября 2026

Источник — неизменённый [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1), версия наблюдения `2423213750570316842`. Read-only REST cache проверен скриптом `scripts/verify-segmented-source.mjs`: 42 групповых варианта и 24 внутренних контрола совпадают с общим профилем по размерам, радиусам, выбранному сегменту, иконкам и Caption/S. Результат — `source.txt`.

`figma-web-native.png` сопоставляет три формы Figma, Chromium и Compose при 100%, на одинаковом фоне. Файлы `chromium-*` и `webkit-*` показывают обе темы, 2–5 сегментов и 100/125/200% текста. `native/` содержит ту же матрицу Compose и реальный установленный consumer, меняющий показанный период. Все рендеры выполнены без окон: Playwright headless, Compose ImageComposeScene / Skiko SOFTWARE / Java headless.

`packed.json` содержит SHA256 11 установленных tgz, браузерные версии и проверенные сценарии. Проверка создаёт отдельного потребителя, устанавливает архивы, проверяет TypeScript API и загружает React + четыре серверных helper API адаптеров. Покрыты HTML без JS, сохранение input nodes и выбора до hydration, controlled/null/refusal, required, FormData, reset, fieldset, RTL/Home/End, icon-only имя, reorder/removal, изменение controlled value, 42 выбранных варианта в обеих темах, reduced motion и масштаб. Это проверка SSR helpers; ordinary framework CSR lifecycle проверяется отдельным общим участком адаптеров.

`selection-reset.json` проверяет общий React reset для Checkbox, RadioGroup, Choicebox single/multiple и SegmentedControl: uncontrolled и controlled refusal, reset+click в одном JS task, FormData и ровно один callback, позднюю отмену reset у предка и dispose до timer. Проверяются built public packages в Chromium/WebKit.

После обновления каталога существующий `apps/docs/tests/selection.spec.ts` прошёл 40/40 сценариев в Chromium/WebKit за 23 секунды: mixed/required/reset/fieldset/FormData, отказ controlled-потребителя, SSR/no-JS, клавиатура, RTL и авторская типографика. Core/React typecheck, Segmented/Selection SSR (6 тестов), Biome для изменённых файлов и `catalog:check` также прошли.

`native.json` фиксирует SHA256 исходников и Maven-артефактов `0.1.0-segmented-20261119.2`. Три SegmentedRenderTest прошли; отдельный SegmentedConsumerTest потребляет установленную Maven-публикацию, меняет значение и проверяет фактический текст результата в обеих темах при 100/125/200% текста. Это desktop CPU qualification; Android/iOS и экранный диктор этим прогоном не проверяются.

Воспроизведение из собранного workspace:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/AgentWork/.playwright-browsers'
node apps/docs/tests/selection-reset.mjs
node apps/docs/tests/segmented-packed.mjs
node scripts/verify-segmented-source.mjs <read-only-nodes-cache.json>

# native/compose
$env:JAVA_HOME = 'C:/Program Files/Zulu/zulu-21'
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
$env:SKIKO_RENDER_API = 'SOFTWARE'
./gradlew.bat :desktopTest --tests pics.lab.ui.SegmentedRenderTest --no-daemon --console=plain
```

Для installed consumer сначала публикуют `desktop` и `kotlinMultiplatform` для корневого проекта и `ui-colors` в локальный DistributionRepository с `publicationVersion`/`publicationRepository`. В `native/compose/consumer` задают те же `uiVersion`/`uiRepository`, а также `iconsVersion=0.4.0-semantic.6`/`iconsRepository`, затем запускают `../gradlew.bat :desktopTest --tests pics.lab.ui.sample.SegmentedConsumerTest --no-daemon --console=plain`.

Ограничения рендера: у Regular источник использует corner smoothing 0.6 для оболочки и 0 для контрола. Web применяет системный superellipse к оболочке с round fallback; Compose использует round contour. Windows WebKit рисует Geist заметно тоньше Chromium/Skia, хотя прямой computed-style замер в `packed.json` подтверждает загруженный Geist 500, 14 px / 12 px в обоих браузерах. Эти отличия raster/contour не скрыты заменой авторской типографики.
