# Check, Radio и Choicebox — проверка 18 ноября 2026

Источник — [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Read-only дерево и variables проверены для `component-set/Check & Radio/Check`
(96 вариантов), `component-set/Check & Radio/Radio` (64) и
`component-set/Choicebox/Choicebox` (20). Figma не изменялась.
Авторская геометрия, цветовые роли и знаки сохранены в
`packages/tokens/src/components.json#selection`; смысл API — в
[справке selection](../../reference/selection.md).

## Рендеры

- `check-small-figma.png` и `check-small-web.png`: исходный и браузерный small Check.
- `selection-light-100.png`, `selection-dark-100.png`: Check/Radio tiny, s, m, l,
  accent/neutral, выбранное состояние, тема light/dark.
- `choicebox-row-100.png`: строка с rich-подписью, описанием и декоративной иконкой.
- `choicebox-row-rtl-200.png`: тот же узкий контейнер, RTL и текст 200%; содержание
  переходит под иконку и знак, высота растёт без обрезания. Слово, естественная ширина
  которого превышает всю доступную строку, переносится внутри слова.

Изображения просмотрены. Они подтверждают конкретные размеры, анатомию и reflow,
а не побайтовое равенство всей библиотеки Figma. Веб-набор не является полной
визуальной матрицей всех исходных вариантов. Полные native-листы и девять проверок
Compose находятся в [native evidence](../../../native/compose/evidence/selection-20261118/reference.json).
Рендеры получены без видимых окон: Playwright headless и Compose ImageComposeScene.

## Поведение и сборка

`playwright test selection.spec.ts checkbox.spec.ts radio-group.spec.ts
--project=chromium --project=webkit --workers=2`: **80/80**, без пропусков, 17.1 s.
Проверены оба веб-рендерера: формы и FormData, mixed/required, disabled/fieldset,
reset и отменённый reset, controlled rejection, Space, стрелки/Home/End,
пропуск недоступных radio, один Tab-вход, RTL, текст 200%, rich-слоты, обе темы.
Первый кадр проверен с выключенным JavaScript; отдельно проверены React hydration
и property-based Choicebox SSR с сохранением items/value, сменой выбора и reset.

Core: **41/41**; генератор: **32/32**; Astro: **45/45**;
Vue и Solid: **9/9** каждый; Svelte: **8/8**. Astro проверяет пустые props всех
SSR-функций и передачу динамических rich-слотов через реальный Container API.
Typecheck core/react/docs, генератора и всех четырёх адаптеров прошёл;
docs production build и catalog check прошли (46 семейств, 103 source references).
Отдельный Node-процесс с единственным импортом собранного Choicebox подтвердил
регистрацию дочерних Check/Radio и DSD обоих режимов single/multiple.
Compose `SelectionRenderTest`: **9/9**, включая Motion/reduced motion,
масштаб текста 2, RTL и произвольный `BoxWithConstraints` в содержимом.

Интеграционная проверка `ba5f4c1`: Selection и Kbd прошли **96/96**
Chromium/WebKit за 44 s после выноса масок и forced-colors в статические правила.
Типографика, расстояния и круговые радиусы используют общие tokens;
авторские размеры и responsive-порог Choicebox остаются в профиле.
Colors CSS/dimension проверки: **138/138**. Независимое ревью diff — CLEAR.

## Осознанные отличия от исходника

Согласованное исправление: non-tiny selected/mixed neutral Check использует
`label-inverted-primary` вместо исходного `label-static-light-primary`. Исходный
белый знак исчезает на светлом `bg-inverted` тёмной темы. Tiny и disabled сохраняют
свои авторские роли. Это единственная исправленная пара цветов Figma.

Runtime дополняет макет фокусом пустого tiny и Choicebox, доступным reflow,
Motion с reduced-motion, формами и клавиатурой. Danger остаётся прежним
семантическим расширением; в исходнике есть только accent и neutral.

Поведение сверено с [W3C Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
и [W3C Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
Пропуск undefined в SSR опирается на [Lit noChange](https://lit.dev/docs/templates/expressions/)
и проверен через опубликованный движок `@lit-labs/ssr`.
