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
