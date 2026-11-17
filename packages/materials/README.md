# Материалы LabUI

`src/profile.json` — общий сериализуемый авторский профиль для web и native.
Он хранит параметры эффектов и ссылки на роли Colors. RGB и opacity цветовых
ролей поступают из Colors; геометрию поверхности задаёт компонент.
Пакет экспортирует тот же файл как `@labpics/ui-materials/profile.json`.

В профиле пять исходных уровней: Subtle, Soft, Muted, Base, Elevated.
`normalRole` применяется первым, затем `blendRole`: color-dodge в светлой теме
и overlay в тёмной. `Material/02` не является непрозрачной подложкой.
`solidRole` у каждого уровня указывает на отдельный слой Solid из Figma.

Для CSS подключаются Colors и `@labpics/ui-materials/material.css`.
Один `mountMaterialRuntime(root)` обслуживает область и возвращает disposer.
Атрибут `data-material="solid|acrylic|glass"` выбирает режим; классы
`lab-material lab-material--soft` выбирают поверхность и уровень.
Для ShadowRoot, включая закрытый, вызывается тот же mount при подключении
компонента и disposer при завершении его жизненного цикла.

Web сначала размывает настоящий backdrop, затем применяет необязательную
линзу и авторский paint-тон. SVG transfer в Chromium выполняется внутри
`backdrop-filter`, в encoded sRGB, с независимыми таблицами RGB и непрозрачным
выходом. Обычный `filter` на host для этого не применяется: он затронул бы
контент и изменил бы границу захвата. Текст, внешняя тень и шесть накопительных
полос progressive veil сохраняют собственные слои. Noise — одна запечённая
monotone-текстура со Screen под paints; её содержимое не генерируется в кадре.
Режим Screen подтверждён REST-выгрузкой: Plugin API не возвращает это поле.
CSS до runtime и браузеры без SVG transfer опускают это слабое зерно; обычная
заливка текстурой меняла бы яркость всей поверхности.

Backdrop radius переводится в CSS blur делением на два, как в Figma
`getCSSAsync`. Glass frost — отдельный параметр; web sigma = frost / 2 выбран
по прямому сравнению с Figma Effects/Glass. Линза и направленный внутренний
блик ещё не воспроизводят весь исходный световой рисунок. Размер noise-текстуры
также задаётся web-переводом. Браузер без SVG backdrop transfer получает
frost и normal-композицию между концами авторской функции. Она точна для семи
из десяти сочетаний темы/уровня; Light/Elevated и Dark/Subtle/Elevated нелинейны,
их ошибка без SVG остаётся менее 20 единиц канала sRGB. Это ограничение renderer,
а не полное совпадение с Figma.

Первый кадр стандартных Colors готов в CSS: normal-композиция и остаточный
SVG data-URL сгенерированы из `@labui/colors/contract.css`. Runtime обновляет
результат по живым scoped-ролям и делит один неизменяемый фильтр между одинаковыми
рецептами в Document/ShadowRoot. При произвольном переопределении цветовых ролей
до mount начальный CSS ещё соответствует стандартным Colors. Native получает
тот же deterministic grain из `@labpics/ui-materials/noise.png` (48×48,
масштаб 9.6 logical px) и параметры noise из профиля.

`progressive` в том же профиле хранит исходные стили Ghost/Soft/Strong
(radius 4/12/24), ось и состав сцен. Strong в Effects — два вложенных прохода
Strong; компонент Layers/Overlay/Ghost — один Strong, несмотря на его имя.
Это разные композиции: `strong` и `overlay-ghost`. Радиусы остаются Figma
logical px; web переводит их в sigma делением на два. Noise opacity у Ghost
.04, у Soft/Strong .06; цвет и размер зерна берутся из общего `noise`.
`data-veil="top" data-veil-profile="strong"` строит оба прохода;
`overlay-ghost` оставляет один. Каждый проход содержит до шести накопительных
полос и отдельное зерно из `veil-noise.png`. Геометрия пересчитывается при
изменении размера или профиля; движение не выполняет JS. Без имени профиля
сохраняется произвольная конфигурация `--lab-veil-*`. Если у исходного frame
есть собственный paint между его эффектом и вложенным эффектом, он задаётся
дочерним `[data-veil-paint]`. Runtime размещает первый blur/noise перед ним,
вложенные проходы — после, и сохраняет порядок при resize/замене paint.

Runtime перечитывает роли при изменении области или темы. Линза кешируется
по локальной геометрии и DPR; учитывает все четыре пары радиусов, проценты
`calc/min/max/clamp` и общее уменьшение перекрывающихся углов CSS. Лучи идут
по нормали края через выпуклое сечение, по закону Снеллиуса; прямой край длинной
панели не тянет фон к её центру. Одна небольшая таблица оптики обслуживает
все глубины. Для круглых симметричных углов
сохраняется расчёт четверти карты. Transform меняет координаты захвата без сборки
карты, чтения профиля и изменения SVG. ResizeObserver обновляет размер.
Перенос между деревьями пересоздаёт ссылки на локальные SVG defs. Пока область
отсоединена, временный observer ждёт её подключения без сканирования документа.
Последний disposer освобождает фильтры, наблюдателей и подписки.

`evaluateTier` использует независимый Solid для выбора полярности надписи
и оба paints для расчёта контраста. `resolveOnMaterial(label, paints)` также
принимает полный `MaterialPaints`; вариант с `Rgba` описывает только одну
normal-заливку. Коридор — вход о доступных пикселях, а не утверждение, что
живое видео или область Gaussian blur были измерены. Increased contrast,
reduced transparency и forced colors снимают эффекты и возвращают Solid.

Проверки: `pnpm --filter @labpics/ui-materials test`, `typecheck`, `build`,
`check-generated`; браузерные `acrylic-live.spec.ts` и
`material-lifecycle.spec.ts` проверяют реальные пиксели, темы, области,
переносы, движение и освобождение ресурсов.

Основания: [неизменяемая выгрузка Figma](../../docs/evidence/materials-20261117/figma-source.json),
[W3C color-dodge](https://www.w3.org/TR/compositing-1/#blendingcolor-dodge),
[W3C overlay](https://www.w3.org/TR/compositing-1/#blendingoverlay),
[Backdrop Root](https://drafts.csswg.org/filter-effects-2/#BackdropRoot),
[Figma GlassEffect](https://developers.figma.com/docs/plugins/api/Effect/#glasseffect).

Сравнение оптики и порядок progressive paint:
[исходные изображения, числа и ограничения](../../docs/evidence/materials-20261117/glass-optics.md).
