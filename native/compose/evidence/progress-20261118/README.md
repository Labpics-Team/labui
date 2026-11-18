# Loader и Progress — 18 ноября 2026

Исходная Figma не изменялась. Семантические источники:
`Loader/Loader` (6048:1615), `Progress/Linear progress` (6387:5567),
`Progress/Circular progress` (6467:113853) в
[Lab UI](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Три выбранных узла сохранены в [figma-source.json](figma-source.json).
Размеры, роли, градиент и периоды хранятся в общем `components.json`,
Kotlin-проекция генерируется штатным `generate-components.mjs`.

## Проверка изображения

Первым шагом сняты CPU master PNG; после осмотра выполнены acceptance-проверки.
`ImageComposeScene` не создаёт окон и не использует системную озвучку.
Для статичных кадров включён reduced motion, Geist предварительно загружен,
сохранение ждёт три одинаковых кадра.

- [Светлая тема, 100%](progress-light-100.png), [тёмная тема, 100%](progress-dark-100.png).
- [Светлая тема, текст 200%](progress-light-200.png), [тёмная тема, текст 200%](progress-dark-200.png).
- Loader 75%: [Figma 3×](figma-loader-medium-75-3x.png), [Compose 3×](loader-medium-75-3x.png).
- Circular 25%: [Figma 3×](figma-circular-medium-25-3x.png), [Compose 3×](circular-medium-25-3x.png).
- [Восемь неизвестных сегментов, 3×](loader-medium-unknown-3x.png).

Средняя абсолютная ошибка RGB относительно экспорта Figma на белом фоне:
Loader 1,48/255; Circular 1,24/255. Полные числа в
[comparison.json](comparison.json). У Circular границы чёрных букв совпадают
по x и верхнему y; нижний край отличается на один физический пиксель при 3×.
Ручные сдвиги шрифта не вводились.

Угловой градиент medium Loader проверен внутренними пикселями отдельно от краёв.
Figma переносит переход через конец углового диапазона: secondary сверху,
primary через 270°, затем secondary на полном обороте. Эквивалентная проекция
в профиле — from 0°, secondary 0%, primary 75%, secondary 100%.
Первая реализация с primary на 180° оказалась слишком тёмной снизу;
проверка пикселей выявила её до принятия результата. В исправленной версии
внутренние RGB отличаются не более чем на четыре уровня; допуск теста — пять.
Различия находятся в интерполяции прозрачного градиента и сглаживании краёв.

## Поведение и команда

Восемь тестов прошли, 0 failures / 0 errors; сами тесты заняли 3,08 с на Windows.
Проверены конечные/невалидные значения и диапазоны, clamp, диапазон
±Float.MAX_VALUE, единственный названный узел доступности, отсутствие повторного
объявления процента, немедленная семантика при анимированном переходе,
неизвестное движение, reduced motion, остановка lifecycle, LTR/RTL и пустая
активная полоса при нуле. Атласы покрывают S/M/L и значения null/0/25/50/75/100.

```powershell
$env:JAVA_HOME = 'C:/Program Files/Zulu/zulu-21'
node native/compose/scripts/generate-components.mjs --check
./native/compose/gradlew.bat -p native/compose :desktopTest `
  --tests pics.lab.ui.ProgressStateTest `
  --tests pics.lab.ui.ProgressRenderTest --console=plain
```

Новые PNG появляются в `native/compose/build/progress-render`.
Это проверка общего Compose-кода и CPU-рендера на desktop, а не отдельная
платформенная квалификация Android/iOS или screen reader.

Первичные справочники: [Compose semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics),
[кэширование рисования](https://developer.android.com/develop/ui/compose/graphics/draw/modifiers),
[Compose lifecycle](https://kotlinlang.org/docs/multiplatform/compose-lifecycle.html).
