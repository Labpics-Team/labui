# Проверка материалов по Figma, 17 ноября 2026

Figma `LuaiBd4anRi4DMZayKAnY2` только читалась. `figma-effects-scenes.json`
сохраняет исходные сцены Glass `7094:3307` и Progressive `6236:41494`;
соответствующие PNG экспортированы через `exportAsync` без изменения узлов.

В Glass сравнивались четыре круга 256×256 поверх исходной сетки точек.
`render-glass.mjs` воспроизводит геометрию и паттерн; подписи исключены из
расчёта. Sweep содержит 4 коэффициента frost × 4 refraction, его результат —
`glass-calibration.json`. При неизменном refraction переход от CSS sigma=frost
к sigma=frost/2 дал MAE каналов sRGB в полном Chromium (Playwright channel `chromium`):

| Исходный Glass | 1:1 | 1:2 |
| --- | ---: | ---: |
| Soft (material Subtle) | 7.456 | 5.952 |
| Muted (material Soft) | 9.563 | 5.356 |
| Base | 3.927 | 2.149 |
| Strong (material Elevated) | 3.185 | 3.450 |

Headless Shell дал иные пиксели при смене фильтров; для этих визуальных замеров
использован полный Chromium. Повторный прогон полного Chromium воспроизвёл
все 16×4 значения ошибки. В рендере 1:1 центральные точки почти исчезают.
Принят общий перевод frost/2;
refraction не перенастраивался по одной сцене. Линза, дисперсия и направленный
свет пока не совпадают с Figma; эта таблица не объявляет Glass завершённым.

`render-progressive.mjs` показывает действующие именованные профили поверх
линейного паттерна. Ghost/Soft сохраняют постепенное размытие, Strong выполняет
два прохода. В исходной Strong-сцене один эффект находится на самом frame с
PATTERN fill, второй — на его прозрачном дочернем Layout. Наш диагностический
паттерн находится под обоими проходами: это иной порядок заполнения, и более
сильное размытие в `web-progressive.png` не является точным сравнением всей
композиции. Для Overlay/Ghost предусмотрен отдельный одинарный профиль.

REST `figma-noise-rest.json` сохраняет Screen у Backdrop и Overlay/Ghost.
Plugin API это поле NOISE опускает. Исправление Normal→Screen убрало серый
налёт; в прежней Acrylic-сцене interior MAE (Subtle/Soft/Muted/Base/Elevated):

- Light: 2.309/2.294/1.968/.623/.748 → 1.108/1.405/1.285/.602/.695.
- Dark: 2.158/2.246/2.633/.790/2.568 → 1.322/1.466/1.930/.747/2.081.

Chrome, Firefox и WebKit: попытка перенести Normal paint на host с backdrop
и Overlay paint на дочерний псевдоэлемент дала серый пиксель 34/34/34 или
35/35/35 вместо цветного ожидаемого 27/29/53. Host stacking context не решил
захват. Поэтому этот вариант не заменяет SVG transfer и не заявлен fallback.

Повторить: собрать `@labpics/ui-materials`, установить Chromium Playwright,
затем выполнить из корня `node docs/evidence/materials-20261117/render-glass.mjs`
и `node docs/evidence/materials-20261117/render-progressive.mjs`. При отдельном
кеше браузеров задать `PLAYWRIGHT_BROWSERS_PATH`.

Независимое ревью `41504a1` выявило два дефекта, исправленных отдельно:
CSS `min/max/clamp` разрешаются по каждой оси (включая вложенные выражения),
а первый кадр наследует switches ближайшего `data-material` вместо зависимых
от порядка descendant selectors. Локальные paints и tier-параметры остаются
на поверхности. До runtime проверены все 3×3 вложения режимов и Shadow DOM
в Chromium/Firefox/WebKit; четыре CSS math-радиуса дали те же карты линзы,
что явно разрешённые px-радиусы. 157 unit PASS, typecheck/build PASS.
Браузерный прогон: 47 PASS, 39 ожидаемых skips; два оставшихся сравнения
проверяли пробелы внутренней CSS-переменной. Они переведены на фактический
`backdrop-filter` и повторно прошли в Chromium/WebKit: итог 49 PASS.
