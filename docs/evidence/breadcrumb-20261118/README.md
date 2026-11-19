# Breadcrumb: источник и проверка

Проверено 18–19 ноября 2026. Источник — Breadcrumb `6109:7452` в неизменённой
[Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Read-only REST вернул полное дерево компонента и PNG 4×; Figma не изменялась.
В исходнике один компонент, а не набор вариантов Size × Separator.

Размер M: Geist Medium 14/12, шаг 8, знаки 16, tracking 0. Текущая страница
сохраняет вес 500, меняется только роль цвета. Силуэты шеврона и многоточия
берутся из исходных векторных слоёв. `components.json#breadcrumb` — общий
профиль CSS и сгенерированных числовых Compose Path. S/L — расширения.

`chromium-source-4x.png` и `webkit-source-4x.png` показывают исходную
композицию Home / … / Services / Design. После наложения прозрачного source
PNG на белый основные RGB совпадают: secondary 114/114/119, primary 16/16/18.
Figma округляет ширину текстовых блоков до 39/58/46 px; браузер сохраняет
дробные advance. Поэтому полный путь в Chromium имеет 254.046875 вместо
255 px. Шрифт не растягивается ради целого числа. Попиксельная идентичность
разных растеризаторов не заявляется.

Снимки двух тем, масштабов 100/125/200% и LTR/RTL просмотрены на характерных
сочетаниях. `*-narrow-200.png` показывает обе web-реализации на ширине 320 px:
подписи переносятся целиком. Внешнее leading снимается, межстрочный шаг
увеличен: обычная строка сохраняет авторскую высоту, многострочная читается.
Рендер запускается после сборки; перед снимком проверяет загрузку Geist,
отсутствие ошибок ресурсов и Vite overlay. Первые снимки, полученные во время
пересборки и без CSS, были отвергнуты и заменены.

Поведение основано на [WAI-ARIA Breadcrumb Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/):
именованная навигация, иерархия ссылок, текущая страница как текст. Многоточие
раскрывает середину inline. Web переносит фокус к первому открытому пункту,
включая группирующий текст; Compose — к первому открытому пункту с действием.

Проверки:

- Chromium + WebKit: 41 passed, 3 skipped. Раскрытие, Enter, фокус, переход,
  группирующие пункты, размеры/цвета, длинные подписи, RTL, неверные свойства,
  снятие Lit-атрибутов, вставка/удаление предка с сохранением сфокусированной
  ссылки и адреса перехода. Forced colors проверены в Chromium; два соответствующих
  WebKit-case пропущены. Ещё один старый WebKit-case зависит от системного Tab.
- React SSR ESM/CJS: 2 passed, включая экранирование текста и override имени.
- `breadcrumb-packed.mjs`: изолированные tarball-пакеты, четыре SSR-адаптера
  и React в Chromium/WebKit; styled first paint без JS, сохранение DOM при
  hydration без ручной передачи массива клиенту, экранирование, фокус
  группирующего текста и настоящий переход. Версии браузеров и SHA256 архивов
  — `packed.generated.json`.
- `BreadcrumbRenderTest`: 3 passed, light/dark × 100/125/200% × LTR/RTL,
  раскрытие/фокус/переход и длинные подписи 320 px/200% без обрезания.
  Отдельная регрессия сохраняет действие и фокус при изменении предков.
- `BreadcrumbConsumerTest`: 1 passed, 12 сочетаний темы/масштаба/направления.
  Самостоятельный consumer установлен из локальных Maven-артефактов
  `0.1.0-breadcrumb-20261118.3`, без `uiSource` и includeBuild для LabUI.
  Переход меняет маршрут приложения и текущий пункт. Это проверка поставляемых
  байтов, не свидетельство публичного выпуска.
- Build и typecheck core/React/Vue/Solid/Svelte/Astro прошли. Colors: 255 tests.

Все browser/native сцены headless/offscreen, без окон и озвучки. Android/iOS
и системные screen readers этими локальными проверками не покрыты.

Повторение из корня репозитория, после сборки пакетов и запуска docs:

```sh
node apps/docs/tests/breadcrumb-render.mjs
node apps/docs/tests/breadcrumb-packed.mjs
node --test packages/react/test/breadcrumb-ssr.test.mjs
```

Для native нужен JDK 21. Из корня репозитория в PowerShell:

```powershell
./native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.BreadcrumbRenderTest
$env:ORG_GRADLE_PROJECT_publicationVersion = '0.1.0-breadcrumb-20261118.3'
$env:ORG_GRADLE_PROJECT_publicationRepository = "$PWD/native/compose/build/breadcrumb-repository"
./native/compose/gradlew.bat -p native/compose publishDesktopPublicationToDistributionRepository publishKotlinMultiplatformPublicationToDistributionRepository :ui-colors:publishDesktopPublicationToDistributionRepository :ui-colors:publishKotlinMultiplatformPublicationToDistributionRepository
$env:ORG_GRADLE_PROJECT_uiVersion = $env:ORG_GRADLE_PROJECT_publicationVersion
$env:ORG_GRADLE_PROJECT_uiRepository = $env:ORG_GRADLE_PROJECT_publicationRepository
$env:ORG_GRADLE_PROJECT_iconsVersion = '0.4.0-semantic.6'
$env:ORG_GRADLE_PROJECT_iconsRepository = '<icons-checkout>/native/compose/build/repository'
./native/compose/gradlew.bat -p native/compose/consumer :desktopTest --tests pics.lab.ui.sample.BreadcrumbConsumerTest
```

`ORG_GRADLE_PROJECT_uiSource` при проверке Maven не должен быть задан.
