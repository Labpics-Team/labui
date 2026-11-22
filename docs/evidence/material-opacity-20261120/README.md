# Прозрачность декоративного материала

Figma и рецепты цветов не менялись. Нейтральные affine paints рисуются на
элементе с собственным blur. Его opacity объединяет материал и обводку;
непрозрачные предки сохраняют доступный backdrop.
Alert рисует только нижнюю и боковые границы, как исходный узел `7720:12484`.

WebKit не смешивает вложенные native paints с backdrop родителя. Это отдельно
подтверждено даже при opacity=1: [run 44732892568](https://github.com/Labpics-Team/labui/actions/runs/44732892568).
При этом обычные CSS filters после blur работают, а SVG URL там игнорируется:
[исторический run 44083835241](https://github.com/Labpics-Team/labui/actions/runs/44083835241).

Нейтральный аффинный перенос `m*x+b` точно выражается source-over:
alpha `1-m`, цвет `b/(1-m)`. Identity остаётся прозрачной заливкой.
Классификация использует концы и все точки перелома исходной формулы,
а не название темы, уровня или подбор коэффициентов. Нелинейные и цветные
рецепты сохраняют native blending. Все четыре авторских рецепта Base/Muted
относятся к аффинным; новый путь не обещает group alpha для произвольного
цветного или нелинейного пользовательского override.

Штатное зерно включается в affine-заливку как общий равномерный Screen midpoint
`s=max(grain.rgb)*maxAlpha/2`. Это приближение, **не пространственная текстура**.
Для каждого канала зерна `0≤g≤max(grain.rgb)*maxAlpha`, поэтому `|s-g|` не больше
половины диапазона. После paints ошибка ограничена `m*|s-g|`, а group opacity
может только уменьшить её. Верхняя ошибка по авторским recipes **≤0.057852 RGB**,
без учёта округления compositor. Runtime сообщает `uniform-bounded` и границу.
Неизвестные/усиленные текстуры не получают этот допуск. Color/нелинейные recipes
сохраняют прежние SVG/native renderers. Capture и grain DOM для нейтрального
affine не создаются. Все браузеры используют одну uniform gradient заливку.

Реальная квалификация `45044487985` выявила две ошибки прямой `background-color`
заливки. Отдельные опыты `45047656087`, `45048407147`, `45049106261` разделили причины:

- macOS WebKit на прокручиваемом host даёт 141 вместо 88.55 на чёрном фоне уже
  до прокрутки. Uniform gradient с тем же цветом даёт 89 до/после прокрутки;
  transform, isolation и background-attachment не исправляют результат.
- Linux Chromium с дисперсной Glass-линзой нарушает group alpha даже без stroke:
  ошибка изолированной полосы 20.4 RGB. Отключение линзы или dispersion убирает
  ошибку; принудительная alpha=1 фильтра ухудшает её. Авторская dispersion сохранена.
  Перенос цвета в CSS `contrast(c) brightness(k)` после линзы даёт ≤1.92 RGB,
  но последующая полная проверка `45051589486` выявила потерю живого Acrylic blur
  на Linux (response 1 RGB). SVG transfer восстанавливает blur, но нарушает alpha
  нижней обводки (5.64/6.56 RGB, run `45053285403`). Оба обхода удалены.
- Linux WebKit не исполняет backdrop color filters; замена всей заливки таким
  фильтром теряет fallback. Uniform gradient сохраняет его без определения ОС,
  дополнительных DOM-слоёв и покадрового JavaScript.

Причина Glass находится в самой dispersion: Screen-соединение отдельных каналов
даёт alpha `1-(1-a)^3`, хотя opaque RGB остаётся верным. Проба `45056776894`
заменила только соединение: alpha каждого канала /3, арифметическая сумма,
затем RGB×3. Промежуточная alpha не клипуется; итог однороден по общей alpha и
сохраняет независимые RGB samples для opaque source. Linux ошибка 20.4→1.32 RGB.
В итоговом коде исправлена эта граница, а цветовая заливка общая для всех engines.
Эти опыты определяют выбор реализации; итоговую квалификацию см. ниже.

Проверка source `878b33e4` (qualification `56215b5a`):
[run 45059660258](https://github.com/Labpics-Team/labui/actions/runs/45059660258)
полностью прошёл на macOS: paints, прокрутка, Alert и настоящий display compositor.
Ubuntu прошёл paints и backdrop; Alert остановился на сравнении
`2.000000000000014 <= 2` в Dark/Glass corner. Измеритель теперь сохраняет предел
2 RGB с допуском одного ULP шкалы 255; это не увеличение визуального допуска.
Оставшиеся проверки Ubuntu ещё не завершены.

Независимое ревью 22 ноября обнаружило незакрытый дефект этой версии линзы:
на прозрачном canvas displaced samples могут иметь разную alpha. Соединение
через среднюю alpha обрезает яркий premultiplied канал. Управляемый пример:
RGB `[255,128,64]`, alpha samples `[1,.25,.25]` теряют красный premultiplied
канал с 255 до 127. Применимость подтверждена public Materials runtime над
CSS-градиентом на прозрачном canvas без прозрачного предка; при авторском
frost 20px наблюдалась потеря до 9 RGB. Проверка uniform RGB и равной alpha
этого не выявляет. Этот source **не завершает** поддержку прозрачного фона.
Дополнительно first-paint `compileMaterialTheme()` всё ещё возвращает
`background-color`; scrolling SSR WebKit до mount пиксельно не проверен.
Основание: [неpremultiplied вычисления feColorMatrix](https://www.w3.org/TR/SVG11/filters.html#feColorMatrixElement).

Различающие опыты 22 ноября:

- Renderer `cb928709` на Firefox 141 с тем же исправленным трёхсторонним stroke:
  Light/Base center error 0.04, bottom 6.64 RGB; Light/Muted bottom 7.56 RGB;
  Dark/Muted side/corner до 13.88 RGB. Центр не измерял ошибку обводки.
  [Повтор старого renderer](stroke-before-firefox.json) использует исходники
  paint/runtime/base.css/material-paints из `cb928709`, современный Alert и тот же
  endpoint sampler. Ошибка alpha наблюдается и при немеряющем blur snapshot.
- Отдельный Screen-child над native fill оказался неверным: Chromium
  Light/Subtle/author-grain дал max error **4.17438 RGB** против ≤0.63554 без
  grain-child. На светлом фоне `[230.174,224.274,218.373]` стал `[226,221,215]`.
  Поэтому пространственная декорация не помечается как будто доказанно точная.
- Текущий [Alert snapshot](material-snapshot-win32.json) проверяет центр, низ,
  обе стороны, 128 пикселей углов и верх каждой полосы. Соседние alpha фиксированы;
  endpoints 0/1 сравниваются с авторской alpha. Удаление stroke не меняет центр
  и верх, меняет обе стороны, низ и углы. Прозрачный предок остаётся отрицательным
  контролем живого blur. Изменение scoped Light→Dark выполняет **1 rAF / 2 style
  reads**, без capture placement. Общий список runtime outputs используется
  одновременно очисткой и фильтром собственных style mutations.

Локально: 183 Materials tests, typecheck, source build; [Chromium paints](material-paints-snapshot-win32.json)
всех уровней, цветные/неизвестные grain inputs, прокрутка и opaque white/black;
8 Chromium и 1 WebKit сценариев смены темы/цветов, media, ресурсов и движения.
На текущем Chromium alpha error ≤1.48 RGB, на Firefox/WebKit snapshot ≤1.96 RGB.
Рендер просмотрен в [Light](alert-light-acrylic.png) и [Dark](alert-dark-acrylic.png).
Строки Firefox/WebKit snapshot не квалифицируют живой blur. Для нового renderer
ещё нужны независимое ревью и запуск на реальном macOS/Linux compositor.

В worktree с dependency junctions запуск использует собственный build:
`MATERIAL_LOCAL_BUILD=1 node apps/docs/tests/alert-material.mjs` после сборки
Materials и Core. Это исключает чужой `dist`; CI с обычной установкой использует
пакетные exports. `MATERIAL_IMAGES=1` дополнительно сохраняет четыре PNG Chromium.

[Диагностический run 44739094282](https://github.com/Labpics-Team/labui/actions/runs/44739094282)
на реальном macOS WebKit дал response задних слоёв 7–21 RGB, negative control 0,
ошибку alpha 0.04–0.36 RGB. Это опыт, не квалификация итогового production commit.
При измерении alpha соседи остаются неизменными: они входят в захватываемый фон.
Одновременное изменение прозрачности соседних слоёв не является линейным опытом.

Архив предыдущего renderer: полная проверка paints, scrolling, opaque white/black, контура и освобождения
ресурсов, затем actual Alert прошла на Ubuntu 24.04 и macOS 15:
[run 44753957406](https://github.com/Labpics-Team/labui/actions/runs/44753957406).
У production renderer `cb928709` в проверочной ветке `64122317` совпадают исходники;
workflow устанавливает публичный hash-verified Icons git dist вместо ещё
неопубликованного npm 0.4. Это не подтверждает готовность npm dependency/lockfile.

`material-display-darwin.json` подтверждает все 12 сочетаний Chromium/Firefox/
WebKit × Light/Dark × Acrylic/Glass на настоящем композиторе macOS.
`material-display-linux.json` подтверждает восемь сочетаний Chromium/Firefox;
Linux WebKit и немеряющие backdrop snapshots явно имеют `qualified:false`.
Snapshot-отчёты сохранены отдельно. Во всех отчётах один production bundle
SHA-256 `652049dea325d9bce7160ab70314d1209105333e56fb812090b5239dfc5033dd`.
Negative control с opacity общего предка действительно теряет реакцию на фон.
Независимое ревью затем выявило ошибку group alpha обводки. Эти четыре отчёта
сохранены как факты предыдущего renderer; они не квалифицируют новое изменение.

Основание: [CSS Filter Effects 2, compositing](https://drafts.csswg.org/filter-effects-2/#backdrop-filter-operation)
и [Compositing and Blending](https://www.w3.org/TR/compositing-1/).
