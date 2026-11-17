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
monotone-текстура под paints; её содержимое не генерируется в кадре.

Backdrop radius переводится в CSS blur делением на два, как в Figma
`getCSSAsync`. Glass frost — отдельный параметр; текущий web-перевод 1:1
сохраняет уровни 12/12/20/20/25, но ещё не является измеренным совпадением
с Figma Glass. Размер noise-текстуры и направленный внутренний блик также
являются параметрами web-перевода. Браузер без SVG backdrop transfer сейчас
получает frost и normal paint; полное воспроизведение второго blend paint
нуждается в отдельной проверке этого renderer.

Runtime перечитывает роли при изменении области или темы. Линза кешируется
по локальной геометрии и DPR; transform меняет координаты захвата без сборки
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
