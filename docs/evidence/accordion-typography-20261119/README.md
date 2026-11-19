# Accordion и формирование текста — 19 ноября 2026

Источник: неизменённый [Lab UI 2.1](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6088-4234),
REST version `2423213750570316842`. `source-text.json` сохраняет семейство,
PostScriptName, стиль, tracking, line height, обычные и видимые bounds.
`source/` содержит прямые SVG с контурами. Figma-console не использовалась.

## Исправление

При tracking −0.25 Compose оставлял необязательные лигатуры. Поэтому строка
`Yes. It adheres to the WAI-ARIA design pattern.` имела ширину 332.948 px,
а тот же Geist 1.400 в Chromium — 334.203 px, WebKit — 334.202 px.
После общей `TextStyle.withTypography` native даёт 334.202 px.
Функция выбирает shaping после конечного tracking компонента; tracking 0
восстанавливает обычные лигатуры. Все существующие переопределения tracking
проходят через неё. Дополнительных копий шрифта или TextStyle не появилось:
она заменяет прежний `copy` одним вызовом `copy`.

На Skia запись `'liga' 0` с кавычками молча игнорировалась. Независимый опыт
с шестью формами строки установил рабочую форму `liga 0, clig 0`.
Android Minikin передаёт её в `hb_feature_from_string`; обязательные лигатуры
`rlig` остаются включены. Android/Apple runtime для этого изменения не повторялись.

`browser-shaping.json` — 9 случаев в двух браузерах, `native-shaping.txt` —
та же матрица при 100/200% и настоящий Accordion. Проверены кириллица,
четыре общие роли, нулевой, отрицательный и положительный tracking,
а также переход body → заголовок с восстановлением лигатур.
Допуск 0.06 px учитывает измеренную разницу статического Medium и variable
Medium; максимальное наблюдение — 0.0564 px на длинном Headline.
У Body Accordion расхождение после исправления меньше 0.002 px.
При временном снятии правила регрессия упала на 332.948 против 334.203 px.
Все 79 desktop-тестов прошли; подробности — `validation.json`.

## Выбор одного Geist

Полный переход на 1.800 ухудшает все четыре общие роли. Сравнение использует
исходный кегль без подгонки модели: tight SVG отдельного TextNode возвращается
к независимым REST `absoluteRenderBounds`; полный SVG Accordion уже имеет
авторский масштаб. Для сравнения рисунка снимается только перенос начала
очертаний. `font-choice.json` содержит хеши файлов, ширины и пересечение
заполненных контуров при 16×. Внутренние пересекающиеся контуры variable font
не считаются видимой ошибкой. Измеритель даёт 1 для идентичного изображения
и обнаруживает контрольный сдвиг на 1 px.

| Исходный текст | Ошибка ширины очертаний 1.400 | Ошибка 1.800 |
| --- | ---: | ---: |
| Card Description `6225:42454` | −0.014 px | −1.150 px |
| Snackbar `6109:5889` | −0.044 px | −3.212 px |
| Card Title `6225:42451` | −0.002 px | −1.122 px |
| Caption Badge `6225:1048` | −0.025 px | −0.392 px |
| Button `6227:8350` | −0.031 px | −0.367 px |
| Input `6050:2314` | −0.002 px | −0.482 px |
| Accordion open/rest title `6088:4196` | −0.038 px | −1.535 px |
| Accordion body `8980:2154` | +5.631 px | −0.097 px |
| Accordion hover title `8980:2187` | +1.276 px | −0.222 px |

Первые семь образцов имеют пересечение заполненных контуров 0.980–0.995
с 1.400; с 1.800 оно хуже во всех семи. Body и hover title ближе к новой
ветке, но не совпадают с ней полностью. Проверенные статические 1.500–1.800
дают одинаковый advance этих строк. По REST заголовки имеют один и тот же
Geist Medium 16/24, tracking 0 и стиль `2008:12592`, без override отдельных
символов, но open/rest содержит 22 контура и ink width 118.355 px,
остальные три состояния — 23 контура и 117.041 px.

Сохраняется один Geist 1.400 на web/native. Шрифт не меняется по состоянию
или роли; Figma и бинарники не изменены. `font-choice-comparison.png`
показывает именно сравнение контуров. `platform-comparison.png` — реальный
компонент после исправления: исходник, Chromium, WebKit, Compose.

## Вертикальное размещение остаётся отдельным расхождением

`source-baselines.json` выводит baseline из исходных ink bounds и высоты
совпадающих глифов. Для 16/24 Figma даёт 18 px от верха строки, оба браузера
дают 17 px. Для 20/20 baseline равен 17 px, для 12/12 — 10 px на обеих сторонах.
Явное задание исходных hhea 92%/22%/10% не меняет browser result.
Эксперимент с Win metrics 97.6%/26.2%/0% меняет только Chromium; WebKit эти
descriptors игнорирует. Он не принят в продукт.

Compose 1.12.2 по умолчанию обрезает внешнее пространство строки через
`Trim.Both`: общая Body 16/24 даёт paragraph около 20 px, Headline 20/20 —
25 px, Caption 12/12 — 15 px. Это не проверка совпадения line box с Figma.
Поправка к первоначальному отчёту: `TextLayoutResult.firstBaseline` у Skia
не является paint baseline. Прежний расчёт «эффективный baseline 18.6 px»
был неверным; старый однострочный Accordion при плотности 2× рисовал baseline
на 18 px. Отдельный пиксельный опыт обнаружил лишний межстрочный шаг и привёл
к [общему исправлению native linebox](../native-lineboxes-20261119/README.md).
Совпадение ширины не обозначает полного совпадения вертикального рисунка.

## Воспроизведение

```powershell
node apps/docs/tests/typography-shaping-render.mjs
# Только при осознанном обновлении browser reference:
node apps/docs/tests/typography-shaping-render.mjs --update-fixtures
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
$env:SKIKO_RENDER_API = 'SOFTWARE'
native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.TypographyShapingRenderTest
```

Для контуров нужны FontTools, Brotli и uharfbuzz. `--font-cache` содержит
`Geist-{Regular,Medium}-1.4.2.ttf`, `Geist-{Regular,Medium}-v1.7.2.ttf`
и `Geist-Variable-v1.7.2.woff2` из официальных закреплённых источников ниже.
Текущий WOFF2 берётся из пакета; ожидаемые хеши записаны в `font-choice.json`.

```powershell
python docs/evidence/accordion-typography-20261119/compare-outlines.py --font-cache <cache> --output <scratch>/outlines.json
node apps/docs/tests/font-outline-raster.mjs <scratch>/outlines.json <scratch>/comparison
```

Основания: [CSS Text — letter spacing](https://www.w3.org/TR/css-text-4/#propdef-letter-spacing),
[Figma text properties](https://help.figma.com/hc/en-us/articles/360039956634-Explore-text-properties),
[Geist 1.4.2](https://github.com/vercel/geist-font/tree/4d655731f83507f0258ce5541c297b6553d5d081),
[Geist v1.7.2](https://github.com/vercel/geist-font/tree/a73329da8fc62afc917f796555202e4997f79b7c),
[Android Minikin feature parsing](https://android.googlesource.com/platform/frameworks/minikin/+/refs/heads/main/libs/minikin/FontFeatureUtils.cpp),
[Compose Skia paragraph conversion](https://github.com/JetBrains/compose-multiplatform-core/blob/jb-main/compose/ui/ui-skiko/src/nonAndroidMain/kotlin/androidx/compose/ui/text/platform/SkikoParagraphBuilder.nonAndroid.kt).
