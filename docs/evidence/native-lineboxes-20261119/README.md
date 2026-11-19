# Native lineboxes: 19 ноября 2026

Исправление относится к Compose **1.12.2**, Skiko **0.150.2**, Skia
**m150-a3f509bf52**. Исходная Figma `LuaiBd4anRi4DMZayKAnY2`, версия
`2423213750570316842`, не менялась. Geist остаётся **1.400** для всех ролей.

## Причина и различающие опыты

У исходного Geist при 16 px ascent −14.72, descent 3.52, leading 1.6.
Skia Run включает leading в ascent/descent и приводит их span к заданному
lineHeight. EmptyMetrics сохраняет leading; TextWrapper объединяет обе
структуры. Поэтому Body 16/24 даёт шаг 26 физических px при density 1.
Второе условие: Compose Skia принудительно выбирает DISABLE_ALL для
lineHeight ≤ fontSize. Mode.Fixed/Minimum/Tight этого поведения не меняют.

Первичные источники:

- [Точный исходный Compose artifact](https://repo.maven.apache.org/maven2/org/jetbrains/compose/ui/ui-text-desktop/1.12.2/ui-text-desktop-1.12.2-sources.jar), `ParagraphBuilder.skiko.kt:631–646`.
- [Run::calculateMetrics](https://github.com/JetBrains/skia/blob/m150-a3f509bf52/modules/skparagraph/src/Run.cpp#L66).
- [EmptyMetrics](https://github.com/JetBrains/skia/blob/m150-a3f509bf52/modules/skparagraph/src/ParagraphImpl.cpp#L1073).
- [Объединение метрик строк](https://github.com/JetBrains/skia/blob/m150-a3f509bf52/modules/skparagraph/src/TextWrapper.cpp#L333).
- [Paint baseline](https://github.com/JetBrains/skia/blob/m150-a3f509bf52/modules/skparagraph/src/TextLine.cpp#L382) и [reported baseline](https://github.com/JetBrains/skia/blob/m150-a3f509bf52/modules/skparagraph/src/TextLine.cpp#L1192) — разные формулы.
- [Skia revision в Skiko](https://github.com/JetBrains/skiko/blob/v0.150.2/skiko/gradle.properties#L11).

Матрицы `original-api-matrix.tsv` и `zero-leading-api-matrix.tsv` перебирают
четыре Alignment, два Trim, три Mode, размеры 16/24, 20/20, 12/12, density 1/2.
Mode не влиял на результат. Он не даёт обхода через публичный API.

| Опыт | Наблюдение по реальному H | Решение |
|---|---|---|
| Исходный font, только outer wrapper | Body сохраняет шаг 26 вместо 24 | Недостаточно |
| Только leading = 0 | Caption 12/12 при density 2 сохраняет шаг 12.5 | Недостаточно |
| Runtime lineHeight = H − leading | Caption при density 1 даёт шаг 11 вместо 12 | Отвергнуто |
| Skia-only метрики одного em с сохранением центра | Шаг 24/20/12/12 при density 1/2 и fontScale 1/2 | Принято |

`before-experiments.png`, `zero-leading-experiment.png`, `em-metrics-experiment.png`
сохраняют рисунки опытов. Колонки: raw BasicText, outer wrapper, wrapper с
H − leading. Строки: 16/24, 20/20, 12/12; в before/em добавлен 14/12.

## Общая граница

`LabText` заменяет частные wrappers Accordion, Chip, Tabs, Badge, Kbd и
используется остальным отображаемым native-текстом. Center/Trim.None/Tight —
общая политика. Для штатного семейства наружная высота равна числу строк × H;
для tight 14/12 внешний natural padding центрируется в authored linebox.
Ограничение maxHeight остаётся доступно native paragraph для ellipsis.

Android использует прежние common-файлы **байт в байт**. Skia получает три
производных файла с hhea/typo ascent 850, descent −150, gap 0. Формула выводится
из unitsPerEm и прежнего вертикального центра; ни контуры, ни ширины не меняются.
`build-symbols.py --check` воспроизводит ресурсы и проверяет все неизменяемые
таблицы. Дополнительный объём трёх TTF — 214312 bytes до сжатия.

`LabTheme(fontFamily=...)` сохраняет custom family. Для неё `LabText` оставляет
native layout; добавочной настройки темы нет. Более высокий системный fallback
внутри штатной семьи также сохраняет высоту. Опыт «東京🙂» обнаружил 57 физических
px вместо 48: общий guard не сокращает этот абзац. Он используется и при
расчёте места для многострочной подписи Input.

## Проверки и пределы

`TextLineBoxRenderTest` измеряет пиксельные полосы трёх букв H: у H нет нижнего
выноса, поэтому нижняя граница позволяет проверять paint step независимо от
`firstBaseline`. Матрица — четыре размера × density 1/2 × fontScale 1/2 ×
LabText/SelectionContainer/BasicTextField. Проверяются точный шаг, outer height,
полные первая и последняя буквы, редактирование через Semantics SetText.
Настоящее перетаскивание мышью выделяет обе строки в SelectionContainer.
Отдельно проверены custom Serif, CJK/emoji fallback и ограничение высоты с ellipsis.

Отрицательный опыт заменяет только три Skia derived TTF на исходные common TTF.
Тест падает: `First paint step 1.0/1.0/(16, 24)/0 expected 24 but was 26`.
`negative-control.png` сохраняет этот случай. После восстановления ресурсы
вновь проходят проверку. Ширины остаются в допуске прежнего shaping-теста 0.06 px.

Input проверяет реальный рендер подписи и редактора при 100/125/200%, LTR/RTL,
всех размерах, переносах и длинных словах. Сохраняются focus, selection и ввод.
Проверка подписи учитывает authored 14/12 вместо прежней raw высоты 14.

Полной визуальной идентичности этот patch не утверждает. Figma Body 16/24
имеет baseline 18 px; центр исходных метрик даёт 17.6 px, округляемые Skia до
физического пикселя. При density 2 / fontScale 1 видимый baseline — 17.5 px.
Headline 20/20 и Caption 12/12 дают 17 и 10 px. Смещение на компонент или
состояние не добавлено. Ранее опубликованные «18.6 px native baseline» были
ошибкой измерителя: reported baseline не равен paint baseline.

Полный native suite: **83 tests, 0 failures**, 103.713 s test runtime / 107 s wall.
После сохранения неявного alignment custom family повторены четыре linebox-теста;
все прошли, включая пиксельное равенство custom Serif со штатным BasicText.
Результат и область проверки записаны в `validation.json`.

Рендеры здесь получены headless SOFTWARE на Windows. Android и Apple runtime
этим опытом не проверялись; backend-граница сохраняет исходный Android font.

```powershell
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
$env:SKIKO_RENDER_API = 'SOFTWARE'
native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.TextLineBoxRenderTest
python packages/fonts/scripts/build-symbols.py --cache-dir <font-cache> --check
```

`paint-steps.tsv`, `authored-d2-s1.png`, `custom-and-accents.png`, `selection.png`
сохраняют результаты; полная матрица изображений воспроизводится в `build/lineboxes`.

## Поправка после независимого review: ellipsis и акценты

Freeze `3f22a8c` сохранял linebox и усечение, но срезал акценты узкого Badge.
У Medium Å, É, Й верхний ink превышает ascent 850. Когда строка переполняется,
Compose `TextAnnotatedStringNode.kt:533–539` обрезает paragraph по
`TextLayoutResult.size`; широкая строка без переполнения этого clip не имеет.
[Точный исходный Foundation artifact](https://repo.maven.apache.org/maven2/org/jetbrains/compose/foundation/foundation-desktop/1.12.2/foundation-desktop-1.12.2-sources.jar)
содержит эту ветку и штатный порядок рисования selection, brush, shadow и decoration.

Общая граница `LabText` теперь дорисовывает **тот же уже усечённый**
`MultiParagraph` с `ClipOp.Difference` за пределами внутреннего clip.
Его внутренняя часть не рисуется второй раз. Native shaping, усечение,
семантика полного текста и selection остаются штатными. Измерения, font
resources и положение glyph baseline не менялись; отдельного Badge offset нет.
Дополнительный paint выполняется только для переполненного ellipsis текста
штатной семьи. `TextLayoutResult` переиспользуется вместо прежнего счётчика
строк; повторного shaping/measure и дополнительного состояния для обычного
Visible-текста нет.

`TextEllipsisInkRenderTest` сравнивает все пиксели неизменённого префикса
`ÅÉЙ` у настоящего `LabBadge("ÅÉЙ ÅÉЙ ÅÉЙ ÅÉЙ")` шириной 400 и 110 dp.
Широкая строка калибрует измеритель; узкая обязана реально переполняться.

| Density / fontScale | Потеря пикселей на `3f22a8c` | После исправления |
|---|---:|---:|
| 1 / 1 | 11 | 0 |
| 1 / 1.25 | 14 | 0 |
| 1 / 2 | 33 | 0 |
| 2 / 1 | 33 | 0 |
| 2 / 1.25 | 30 | 0 |
| 2 / 2 | 84 | 0 |

Отрицательный опыт подменял только `LabText.kt` его версией `3f22a8c` и
воспроизвёл все шесть потерь. Дополнительные проверки сравнивают целый
префикс при полупрозрачном цвете, градиенте, shadow и underline; новая
дорисовка не удваивает альфу. Настоящий mouse drag по ellipsis тексту сохраняет
selection и непрозрачные пиксели глифов, accessibility получает полную строку.

`ellipsis/` содержит исходные отчёты before/after, рисунки и результаты
targeted проверки: TextEllipsisInkRenderTest, TextLineBoxRenderTest,
BadgeRenderTest, InputRenderTest. Включены прежние проверки плотности,
масштабирования, custom/fallback, редактирования и конечного maxHeight.
Android/Apple runtime этой поправкой не измерялся. Android сохраняет свой
paragraph painter; восстановление выступающего ink и измерение его границ
ограничены Skiko, где изменены font metrics.

## Ограничения потребителя и конечные границы ink

Следующее независимое review обнаружило недостаток `6e133f8`: Difference
дорисовывала и обычные части букв, намеренно обрезанные `maxHeight`, а также
тень за горизонтальным clip. У `Headline` / Body 16/24 / width 100 / height 5
native BasicText не рисовал ink, тогда как LabText возвращал 381 пиксель за
пределами высоты. Этот случай сохранён отрицательным контролем.

Теперь дополнительный paint разрешён только при полном размещении оставшегося
`MultiParagraph` в измеренной высоте. Частично обрезанная строка сохраняет native
clip; наружный clip также учитывает пространство tight linebox. `minHeight`
передаётся в native measure: его прежнее обнуление смещало короткий остаток
многострочного текста и меняло размещение `minLines`.

Восстанавливается только вертикальный ink внутри исходной ширины. Его конечную
границу Skiko получает из записи того же paragraph с `PictureRecorder` и
`RTreeFactory`; запись не растеризуется. В закреплённой версии Skia
[finishRecordingAsPicture](https://github.com/JetBrains/skia/blob/m150-a3f509bf52/src/core/SkPictureRecorder.cpp)
заменяет cullRect объединением bounds реальных draw-команд. Это включает
позиционированные combining marks, stroke и shadow. К геометрической границе
добавлен соседний local pixel для antialias fringe.

Публичный `TextLayoutResult` описывает layout, а не glyph ink; Skiko 0.150.2
не открывает `getLocalClipBounds`. Запас в один em не ограничивает произвольную
цепочку marks. Полоса до `Constraints.Infinity` была проверена и отвергнута:
при rotation 30° / scale 1.25 она отличалась от конечного rectangle oracle на
7269 пикселях. Большие координаты теперь существуют только как начальный cull
identity-space записи; на целевой Canvas применяется конечная измеренная граница.

Запись создаётся лишь у переполненного ellipsis штатной семьи и при изменении
paragraph/style. Кеш хранит ссылки на paragraph/style и четыре координаты;
Picture, Recorder и RTree закрываются в `use` до возврата. Проверка 220 записей
под Skiko `Stats` подтверждает нулевое число оставшихся native ресурсов без GC.
Время 200 прогретых измерений и итоговый targeted прогон сохранены в `clip/`.

`TextClipRenderTest` сравнивает с native BasicText высоты 5/12/24, многострочный
`maxLines=2`, `minLines=2`, tight 14/12 при density 1/2 и fontScale 1/1.25/2.
Оба BasicText используют `onTextLayout`: без него Foundation выбирает другой
renderer, и такой oracle давал неверный вывод о горизонтальном clip.
Два одинаковых transformed reference тоже были сверены: разница равна нулю.

Transform-проверка использует независимый полный paint уже усечённого paragraph
и проверяет сохранность ink/ширины при rotation 0°/30°/90°, scale .5/1/1.25/4.
Foundation сохраняет исходный antialias clip, поэтому его смешивание на границе
не тождественно одному полному paint: наблюдались max 13/255 и MAE .097/255
по paint bounds. На реальном размере видимого шва или утолщения нет. Проверка
допускает max 16/255, MAE .15/255; upright Badge и alpha/brush/decoration
по-прежнему требуют точного равенства. Поворот не стал причиной замены Foundation.

Поведенческая версия `6e133f8` (с неиспользуемыми helper declarations только
для компиляции нового теста) провалила все три новые проверки: height, width,
transforms. После восстановления исправления они проходят. Ресурсы шрифта,
контуры, ширины и baseline этой поправкой не менялись.
