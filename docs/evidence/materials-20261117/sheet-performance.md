# Измерение живого Sheet

`profile-sheet.mjs` открывает production consumer scene `/experience.html`,
выполняет Home → Down → Down → Down → Up и drag на 20 кадров. Это пять смен,
четыре разных detents: Half встречается дважды. Flex 40 отдельно включён
в [сравнение пикселей](glass-resize.md). Сценарий работает только headless;
URL задаётся `MATERIAL_SCENE_URL`, полный raster trace — `MATERIAL_TRACE_ALL=1`.
В репозитории сохраняются числа и конечное изображение, без больших trace-файлов.

Условия: Chromium 140.0.7339.186, viewport 1000×812@2, Body 640 px, RTX 3080 Ti,
GPU composition/raster включены. Интервалы rAF в этом окружении с шагом 4.17 ms
не являются заявлением FPS других устройств; `RasterTask` — CPU recording,
не время завершения работы GPU. Screenshot снимается после остановки счётчиков.

| Путь | rAF p 95 | Максимум | Интервалы >25 ms | Style p 95 |
|---|---:|---:|---:|---:|
| Исходный Glass с пересчётом геометрии |50 ms|91.7 ms|65|см. baseline|
| Bounded Glass, последний прогон |20.8 ms|112.5 ms|2|1.283 ms|
| Bounded Acrylic, последний прогон |12.5 ms|70.8 ms|1|1.056 ms|

[Последний Glass](sheet-live-glass.json), [последний Acrylic](sheet-live-acrylic.json),
[сохранённые исходные измерения](sheet-motion-baseline.json).
В повторах bounded Glass p 95 был 16.7–20.8 ms, Acrylic 12.5–16.7 ms.
Редкая длинная пауза обоих материалов приходится на drag; источник паузы
не установлен. В полном trace максимум JS callback 3.21 ms, Style 1.71 ms,
MajorGC 2.98 ms: эти данные не обосновывают её приписывание расчёту поля.

За весь сценарий обоих материалов: **0 putImageData, 0 PNG encodes,
0 замен SVG-узлов, 0 изменений href, 0 veil mutations**. У Glass меняются
только числовые координаты сохранённых частей поля. Все границы Body остаются
на месте. Исходные 65 длинных интервалов устранены, но полное отсутствие пауз
и комфорт всех устройств не заявляется.

Промежуточный viewport-sized Glass дал 8.4 ms p 95, но был отклонён: нижняя линза
оказалась за экраном. Его числа сохранены только как опыт стоимости CSS
inheritance, с явной пометкой rejected. Сброс неиспользуемого motion scalar
на поверхности сократил Style sum 2342→437 ms в том опыте. Итоговое решение
совмещает этот сброс с настоящей bounded геометрией.
