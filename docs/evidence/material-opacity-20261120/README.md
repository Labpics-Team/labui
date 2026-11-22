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
сохраняют прежние SVG/native renderers. Capture, SVG transfer и grain DOM для
нейтрального affine не создаются.

Реальная квалификация `45044487985` выявила две ошибки прямой `background-color`
заливки. Отдельные опыты `45047656087`, `45048407147`, `45049106261` разделили причины:

- macOS WebKit на прокручиваемом host даёт 141 вместо 88.55 на чёрном фоне уже
  до прокрутки. Uniform gradient с тем же цветом даёт 89 до/после прокрутки;
  transform, isolation и background-attachment не исправляют результат.
- Linux Chromium с дисперсной Glass-линзой нарушает group alpha даже без stroke:
  ошибка изолированной полосы 20.4 RGB. Отключение линзы или dispersion убирает
  ошибку; принудительная alpha=1 фильтра ухудшает её. Авторская dispersion сохранена.
  Перенос цвета в CSS `contrast(c) brightness(k)` после линзы даёт ≤1.92 RGB.
- Linux WebKit не исполняет backdrop color filters; замена всей заливки таким
  фильтром теряет fallback. Поэтому Gecko/WebKit используют uniform gradient,
  Chromium — CSS transfer на том же host. Это существующая граница renderer,
  без нового определения ОС, дополнительных DOM-слоёв и покадрового JavaScript.

Обе формы выведены из одного точного affine fill: `m=1-a`, `b=color*a/255`,
`k=m+2b`, `c=m/k`; промежуточный contrast не клипует каналы. Полностью непрозрачная
заливка всегда остаётся gradient, сохраняя покрытие даже над прозрачным backdrop.
Эти опыты определяют выбор реализации; итоговую квалификацию см. ниже.

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
