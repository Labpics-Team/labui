# Segmented Control — 19 ноября 2026

Источник — неизменённый [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1), версия наблюдения `2423213750570316842`. Read-only REST cache проверен скриптом `scripts/verify-segmented-source.mjs`: 42 групповых варианта и 24 внутренних контрола совпадают с общим профилем по размерам, радиусам, выбранному сегменту, иконкам и Caption/S. Результат — `source.txt`.

`figma-web-native.png` сопоставляет три формы Figma, Chromium и Compose при 100%, на одинаковом фоне. Файлы `chromium-*` и `webkit-*` показывают обе темы, 2–5 сегментов и 100/125/200% текста. `native/` содержит ту же матрицу Compose и реальный установленный consumer, меняющий показанный период. Все рендеры выполнены без окон: Playwright headless, Compose ImageComposeScene / Skiko SOFTWARE / Java headless.

`packed.json` содержит SHA256 11 установленных tgz, браузерные версии и проверенные сценарии. Проверка создаёт отдельного потребителя, устанавливает архивы, проверяет TypeScript API и загружает React + четыре серверных helper API адаптеров. Покрыты HTML без JS, сохранение input nodes и выбора до hydration, controlled/null/refusal, required, FormData, reset, fieldset, RTL/Home/End, icon-only имя, reorder/removal, изменение controlled value, 42 выбранных варианта в обеих темах, reduced motion и масштаб. Это проверка SSR helpers; ordinary framework CSR lifecycle проверяется отдельным общим участком адаптеров.

`selection-reset.json` проверяет общий React reset для Checkbox, RadioGroup, Choicebox single/multiple и SegmentedControl: uncontrolled и controlled refusal, reset+click в одном JS task, FormData и ровно один callback, позднюю отмену reset у предка и dispose до timer. Проверяются built public packages в Chromium/WebKit.

После независимого ревью добавлены различающие RED/GREEN-проверки. `selection-reset.json` также покрывает все пять React-вариантов с callback, который через `flushSync` принимает запрос, выбирает другое значение или удаляет компонент. `hydration.json` проверяет несколько ранних кликов в двух независимых unnamed Segmented, RadioGroup и Choicebox, раннее оформление, сохранение native input/name identity, пустой required standalone-компонент, отсутствие лишних FormData-полей, reset без имени и добавление/удаление `name`. Для Lit проверяется согласованность native/value/data-selected/tabindex сразу после одного `await updateComplete`, без дополнительного ручного `requestUpdate`.

Повторное ревью нашло отдельную required-регрессию multiple Choicebox: дочерние поля принимали ранний SSR-ввод, а родитель сохранял `defaultValue=[]`, поэтому reset мог не запустить повторную проверку группы. `choicebox-hydration-reset.json` подтверждает исправление в обычном и StrictMode roots: ранний B принят без callback, reset даёт пустое невалидное поле, следующий reset+click B даёт валидное значение и один callback; снятие B снова делает группу невалидной. Проверка использует стабильные `items`/`defaultValue` и built public React package в обоих браузерах.

При объединении с общей framework-реализацией адаптеры сгенерированы повторно:
начальные свойства Segmented передаются до подключения элемента. Установленные
Segmented и Vue/Solid/Svelte прошли совместно: полный packed-сценарий выше,
шесть обычных client mounts и шесть SSR/hydration-сценариев, reset и ранний ввод
в обеих браузерных реализациях. Прошли 158 unit-тестов, общая сборка, typecheck,
Biome и проекция каталога. Архивы в `packed.json` и соседнем
`framework-ssr-20261119/result.json` относятся к этой объединённой сборке.

Packed-проверки используют общий `packed-consumer-project.mjs`: версия pnpm
берётся из проекта, transitive overrides записываются в `pnpm-workspace.yaml`.
Так временный consumer не зависит от глобального выбора Corepack и сохраняет
проверяемые локальные архивы при pnpm 10 и 11.

После обновления каталога существующий `apps/docs/tests/selection.spec.ts` прошёл 40/40 сценариев в Chromium/WebKit за 23 секунды: mixed/required/reset/fieldset/FormData, отказ controlled-потребителя, SSR/no-JS, клавиатура, RTL и авторская типографика. Core/React typecheck, Segmented/Selection SSR (6 тестов), Biome для изменённых файлов и `catalog:check` также прошли.

`native.json` фиксирует SHA256 исходников и Maven-артефактов `0.1.0-segmented-20261119.2`. Три SegmentedRenderTest прошли; отдельный SegmentedConsumerTest потребляет установленную Maven-публикацию, меняет значение и проверяет фактический текст результата в обеих темах при 100/125/200% текста. Это desktop CPU qualification; Android/iOS и экранный диктор этим прогоном не проверяются.

Воспроизведение из собранного workspace:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/AgentWork/.playwright-browsers'
node apps/docs/tests/selection-reset.mjs
node apps/docs/tests/segmented-hydration.mjs
node apps/docs/tests/choicebox-hydration-reset.mjs
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
