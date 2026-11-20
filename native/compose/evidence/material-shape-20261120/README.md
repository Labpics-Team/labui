# Форма native-материалов

Исходный дефект: у Acrylic AlertDialog при 200% текста за верхним левым
скруглением оставался синий участок captured backdrop. Он сохранён в
[`5b8cac46` — Light Acrylic 200%](https://github.com/Labpics-Team/labui/blob/5b8cac46/docs/evidence/dialog-family-20261120/native/alert-Light-Acrylic-2.0.png).
Dialog не задаёт отдельное исправление материала.

`LabSurface` ставил `hazeBlur` перед shape-clip. Blur рисует на собственном
этапе modifier, поэтому прежний clip ограничивал только последующие tint,
blend, noise и content. Теперь один clip Acrylic оборачивает эффект; `labShadow`
и `labOutsideStroke` остаются перед ним. Solid и Glass уже рисуют собственную
форму; порядок их слоёв сохранён, включая антиалиасинг границы. Такой же порядок clip → hazeBlur
использует [официальный пример Haze](https://github.com/chrisbanes/haze/blob/main/sample/shared/src/commonMain/kotlin/dev/chrisbanes/haze/sample/ImagesList.kt).

Различающая регрессия `MaterialShapeRenderTest.materialCannotPaintOutsideAnyRoundedCorner`
сравнивает фон без поверхности и пиксели вне всех четырёх круглых углов.
До изменения Acrylic Light 1× менял пиксель `(64,64)` с `0xffffffff` на
`0xff916297`; Solid проходил. Проверка внешней линии и тени уже проходила.
После изменения обе проверки проходят для Solid/Acrylic/Glass, Light/Dark,
density 1/2; два физических пикселя антиалиасинга исключены из сравнения.

Проверено 20 ноября 2026 только headless SOFTWARE, без окон и аудио:

```powershell
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true -Dskiko.renderApi=SOFTWARE'
.\gradlew.bat :desktopTest --tests pics.lab.ui.MaterialShapeRenderTest --tests pics.lab.ui.DialogFamilyRenderTest --tests pics.lab.ui.AlertRenderTest --no-daemon
```

12/12 PASS: MaterialShape 2, DialogFamily 5, Alert 5. Alert дополнительно
проверяет изменение captured backdrop у Acrylic и Glass, включая нижние слои.
Проверки заняли 25,783 с; полный Gradle-вызов — 1 мин 14 с. В матрице Dialog
изменились только два PNG Acrylic 200%; остальные 20 файлов побайтно совпали
с исходным committed evidence, включая границы Solid и Glass.

Здесь сохранены характерные рендеры формы и внешнего оформления. Исправленные
изображения реального Dialog находятся в
[`docs/evidence/dialog-family-20261120/native`](../../../../docs/evidence/dialog-family-20261120/native).
Платформенный GPU-рендеринг дополнительно проверяется общим native CI при интеграции.
