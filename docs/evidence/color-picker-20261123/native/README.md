# Native ColorPicker — 23 ноября 2026

Проверка Windows, Compose `ImageComposeScene`, `SKIKO_RENDER_API=SOFTWARE`,
Geist 1.400. Окон, звука и стороннего screen reader не запускалось.

- [15 авторских представлений](all-views.png); отдельные PNG — в этой папке.
- [Узкая тёмная панель, текст 125%](sliders-lch-dark-narrow-125.png).
- [11 проверок ввода и рендера](TEST-pics.lab.ui.ColorPickerRenderTest.xml).
- [5 проверок значения и codec](TEST-pics.lab.ui.ColorPickerValueTest.xml).
- [2304 независимых численных вектора: максимальные ошибки](codec-errors.txt).
- [Измерения CPU-растера](raster-performance.txt).

Все 16 тестов прошли. Покрыты pointer/Escape, untouched focus/blur, точный LCH
Enter, controlled accept/reject, IME и её завершающий Enter, reset черновика и
активного жеста, save/restore Double-значений, clipboard, async picker success,
cancel, ошибка/повтор, disable и detach. Переключение Rec.2020 сохраняет raw и
согласованно меняет диапазон Chroma с 145 на 195 у плоскости и полосы.

```powershell
$env:SKIKO_RENDER_API='SOFTWARE'
.\gradlew.bat :desktopTest --tests '*ColorPicker*Test' :compileCommonMainKotlinMetadata --console=plain
```

Команда выполняется из `native/compose`. Common Kotlin metadata и desktop compile
прошли. Попытка `:compileAndroidMain` остановилась до компиляции: Android SDK не
установлен/не указан. Android/iOS runtime, OS sampling и внешний screen reader
этой проверкой не подтверждаются. Eyedropper выключен, если приложение не передало
настоящий поддержанный sampler; проверки используют suspend-provider и реальный
контракт его отмены, а не изображают проверку системного пикселя.

## Числа и стоимость

Codec использует публичный `colormath:3.7.1`. Oracle сгенерирован отдельно через
Color.js 0.7.1: 384 исходных цвета × 6 пространств, включая L=0/100 и C=195.
Максимум ошибки RGB/P3/Rec.2020 меньше 0.000002; обычных HSL/HSV/LCH — меньше
0.00015. Это наблюдение на сохранённых
векторах, не доказательство для всего диапазона Double. Тест допускает 0.00002
для RGB и 0.005 для цилиндрических каналов. Вне охвата HSL saturation бывает
выше 10000% и плохо обусловлена около L=0/1: максимальная абсолютная ошибка
её Float-проекции — 0.8584 п.п., но ошибка обратной RGB-проекции — лишь
0.000001811 при том же бюджете 0.00002. Hue около ахроматической оси и saturation
точного белого не сравниваются как значимые координаты; проверяется цвет RGB.

Исследование выявило два расхождения стандартных настроек библиотеки с CSS:
CAT02 вместо Bradford и camera BT.2020 вместо BT.1886 gamma 2.4. Для отрицательных
каналов sRGB/P3 нужен симметричный CSS transfer. Все три различия закрыты через
публичные API библиотеки; raw остаётся Double и не проходит через Float.

Дополнительная проверка границ обнаружила shortcut `LAB.toXYZ()` при L=0,
который игнорировал ненулевой a/b и создавал ложную чёрную линию на графике.
Локальная проекция передаёт `Float.MIN_VALUE` только вместо точного L=0/C≠0:
библиотека проходит свой обычный алгоритм, добавленная яркость округляется к нулю,
raw L остаётся нулём. Это узкий workaround для 3.7.1, а не собственная Lab-формула.
Отрицательная производная HSL saturation приводится к CSS-форме поворотом hue
на 180° и сменой знака saturation ([CSSWG #9222](https://github.com/w3c/csswg-drafts/issues/9222)).

Первоначальная half-resolution сетка давала видимые ступени. Финальный renderer
рисует полноразмерную сетку до 342×342 и сглаживает её при увеличении. Повторная
проекция одного пикселя отдельно для каждого охвата стоила 103.7 мс для 342×165;
одна проекция и кешируемые RGB-конвертеры снизили прогретую медиану до 38.5 мс
на этой машине (5 разных hue, максимум 51.6 мс). Время — диагностическое измерение,
не жёсткий порог теста. UI-работа асинхронна; отмена проверяется между строками.

## Сверка с исходником

Авторский set: [6387:45035](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6387-45035).
Исходные изображения Spectrum HEX, Sliders RGB, Grid LCH и Sliders LCH получены
из Figma без записи в файл. Общий профиль хранит точные размеры и 100 fills.
PNG показывают общий Elevated-контейнер, собственные controls и реальные цвета.

В самом исходнике есть противоречия между числом, образцом и цветовой полосой:
`lch(72.09 84.86 65.34)` соответствует примерно `#FF9500`, хотя часть рисунка
использует `#FFAA00`. При этих L/C реальное sRGB-сечение Hue — узкая зелёная полоса,
а сечение Lightness почти целиком вне охвата. Native показывает действительные
сечения всех трёх каналов и не изменяет остальные координаты ради похожего
рисунка. Поэтому эти полосы намеренно отличаются от статичного artwork.

Источники: [colormath adaptation](https://github.com/ajalt/colormath/blob/master/docs/usage.md#chromatic-adaptation),
[RGB converter API](https://github.com/ajalt/colormath/blob/master/colormath/src/commonMain/kotlin/com/github/ajalt/colormath/transform/RGBToRGBConverter.kt),
[CSS Rec.2020](https://github.com/color-js/color.js/blob/main/src/spaces/rec2020.js),
[реальные LCH-графики](https://lch.oklch.com/).

[Публичный контракт Compose](../../../reference/color-picker-native.md).
