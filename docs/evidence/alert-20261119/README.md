# Alert · 19–20 ноября 2026

Источник неизменяем: pinned Figma version `2423213750570316842`, Alert
`6109:6798`, шесть masters Neutral/Danger × Quantity 1/2/3. Геометрия и текстовые
роли прочитаны через REST; снимки источника — `source-*.png`, извлечение —
`source.json`. Figma не редактировалась. Поведение сверено с
[WAI APG Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/).

Реализация использует общий authored profile, Text roles, Icon, Colors и Material
renderer. Передний слой 450×80 при исходном тексте; Quantity 2/3 добавляет 8/16
высоты. Base и Muted экспонируют нижнюю половину материал-плоскости высотой 16.
Danger меняет только ведущую иконку. Длинный текст переносится. Скрытые icon и
description не оставляют пустых мест. Стопка — глубина, сообщения хранит приложение.

`source-master-text.svg` сохраняет SVG всего master с текстом: обе baseline
расположены на 17,68 внутри line box 24. Обычная CSS-строка Chromium давала 17,
поднимая ink на 1px. Общий `authoredTextBoxCss` в typography.ts использует
`text-box-trim` и симметричный leading из `lh`/`cap`: `(24 + 11,36) / 2 = 17,68`.
Ink heading Chromium теперь совпадает с Figma и Compose; `source-web-native.png` сохраняет
сравнение. Нет отдельного Alert offset или baseline-токена. Проверка установленного
пакета подтверждает, что wrapped lines сохраняют 24/30/48 line-height. WebKit
округляет trimmed cap-box до целого пикселя, тогда как `1cap` остаётся дробным:
проба с внешними margins давала 95,25 вместо 96. В окончательном общем helper
leading входит в padding, а `min-block-size:1lh` сохраняет полную однострочную
ячейку. Исходная анатомия 80/88/96 точна; у длинного многострочного абзаца
внешняя граница допускает округление <1px, без поправок по движку.

Проверено:

- Core SSR: 3 теста — материал, текст, нативное закрытие, explicit false до
  hydration, ограниченная глубина. Analyzer/golden: 14 тестов.
- Core, React, codegen typecheck и сборка — PASS. Docs typecheck на данной базе
  имеет известные ошибки `avatar.spec.ts:129–132`; исправление `2f6ac71` уже
  находится в общей ветке и проверяется при интеграции.
- `alert-packed.mjs`: изолированная установка npm-архивов, ESM/CJS и публичные
  декларации, SSR/hydration React и четырёх generated bindings. Chromium/WebKit,
  Neutral/Danger × Quantity 1/2/3 × Light/Dark × 100/125/200% × Solid/Acrylic/Glass.
  Нет потери ширины/пересечения с закрытием; узкий пример 280px при 200% сохраняет
  текст. Enter/Space, controlled/uncontrolled close, возврат фокуса, явное false,
  отсутствие глобального Escape и повторного объявления при смене глубины.
  После стабилизации — **0 idle RAF**. `packed.json` содержит архивы и измерения.
- `slots-packed.mjs`: настоящие Vue/Svelte mount и SSR/hydration из установленных
  архивов, четыре строковых SSR bindings. Chromium/WebKit: SVG и собственный
  shadow-root custom element имеют 24/30/48px при font-size 16/20/32; SSR при 200%
  работает с отключённым JavaScript. Fragments, несколько корней, обычный текст,
  escaping, реактивное обновление и повторное создание проходят без ошибок.
  Отложенная hydration сохраняет исходный input и введённый пользователем текст.
  Удаление соседнего именованного header сохраняет тот же footer input и draft.
  Сжатая строка Button сохраняет размер icon; Badge dot сохраняет заливку,
  скругление и отступ ещё до JavaScript.
  `slots/packed.json` хранит SHA256 архивов и измерения, `slots/*.png` — рендер.
- `slot-consumers.mjs`: 96 сравнений непосредственных и проецируемых корней в
  12 компонентах при font-size 16/32 в Chromium/WebKit. Вложенная передача
  Choicebox, несколько корней, Card с естественным aspect ratio 600×300 и
  пользовательским размером 600×80, flex/display/min/max-size, окраска и отступы
  Badge — PASS. Ещё две проверки подтверждают двухуровневую проекцию, local
  overrides и отсутствие утечки размера/background/flex в независимый slot.
  `slot-consumers.json` хранит размеры и вычисленные стили.
  Обе slot-проверки входят в `test:slots` и штатный `browser-check.sh`.
- После исправления общей проекции: core 97, Vue 10, Svelte 14 и codegen 32
  проверки — PASS; core/Vue/Svelte typecheck и четыре adapter builds — PASS.
- `AlertRenderTest`: 4 offscreen Compose-теста. Те же варианты, темы, три font
  scales и материала; измерение в свободном родителе, точная высота 80/88/96,
  семантика live region, настоящее keyboard interaction, скрытые элементы,
  длинное слово, reduced transparency и движущийся контрастный фон.
  Capture canvas 1800px вмещает все шесть вариантов при 200%; инвариант равной
  высоты front у всех вариантов не даёт последнему примеру сжать текст.
- `AlertConsumerTest`: отдельный Maven-потребитель `ui-compose:0.1.0-alert2-20261120`
  с публичным `icons-compose:0.4.0`, без development source substitution. При
  Enter сообщения сохраняются в очереди и закрываются по одному; после последнего
  фокус возвращается к кнопке показа. Обе темы × 100/125/200%, шесть PNG.
- Каталог: `catalog:check`, 14 catalog-тестов и docs build — PASS. Реальный
  `/components.html?component=alert` проверен на 1440/390px в Light/Dark.
  `alert-catalog.mjs` проходит очередь Enter/Space, возврат фокуса и повторный
  показ трёх сообщений; `catalog-*.png` и `catalog.json` сохраняют результат.

Все браузеры headless; Compose использует `-Djava.awt.headless=true` и software
Skiko. Видимые окна, screen reader и аудио не запускались. Accessibility здесь
проверена через DOM/Compose semantics и реальную клавиатуру, без заявления о
прослушивании конкретного screen reader.

Для npm Icons 0.4 использован точный release CI tarball из исходника `66bc8f0`,
SHA256 `d4962b817d19431393131f0aebb5d70f745e103e4062a6003a52926a8362c3bb`;
`publicIcons:false` честно сохраняет отличие от ещё не завершённой публикации.
Временный file override отсутствует в package.json и lockfile. Публичная npm
установка и macOS compositor входят в общий выпуск.

## Материал и граница доказательства

Первый рендер обнаружил ошибку размещения opacity на wrapper стопки: в Chromium
он создавал новый backdrop root, и материал не размывал реальную границу фона.
Opacity перенесена на саму материал-плоскость вместе с её внутренней рамкой;
clipping wrapper остался без opacity. `capture-chromium-wrapper-*` и
`capture-chromium-surface-*` сохраняют различающий опыт. Native повторяет 16→8
clipping через layout декоративной плоскости, сохраняя реальную высоту стопки.
`capture-native-*` показывает изменение всех трёх материал-плоскостей при сдвиге
контрастных полос. Никаких собственных paint-рецептов Alert не добавляет.

Windows headless WebKit **не квалифицирует точность полупрозрачных paints**.
Минимальный `_fixtures/alert-material.html` ставит рядом общий Elevated, Alert
и raw CSS Blur + Normal + Color Dodge над одинаковыми движущимися полосами.
WebKit даёт равномерный `[212,212,212]` во всех трёх случаях; raw CSS в Chromium
также даёт плоский цвет, тогда как его общий renderer и Alert следуют фону.
Это не специфическая ошибка wrapper Alert. `alert-material.mjs`, `capture.json`
и PNG сохраняют воспроизведение; WebKit behavioral/layout проверки не пропущены.
Причина различия display/snapshot не объявляется доказанной этим опытом.

Прежняя [квалификация общего материала](../materials-20261117/paint-renderers.md)
объясняет потребность в macOS display capture, но сама по себе новый Alert не
квалифицирует. Проверка текущего Alert на реальном macOS compositor остаётся
явной задачей общей интеграции. Новая общая система материалов не вводилась.

## Повторение

После сборки packages:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/AgentWork/.playwright-browsers'
$env:LAB_ICONS_TARBALL = 'D:/AgentWork/.scratch/icons040-ci-npm-20261120/package.tgz'
node apps/docs/tests/alert-packed.mjs
pnpm --filter @labpics/ui-docs test:slots
# Vite на 5377 либо LABUI_DOCS_URL:
node apps/docs/tests/alert-material.mjs
node apps/docs/tests/alert-catalog.mjs

$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
$env:SKIKO_RENDER_API = 'SOFTWARE'
# В native/compose:
./gradlew.bat :desktopTest --tests pics.lab.ui.AlertRenderTest
```
