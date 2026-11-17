# Lab UI для Compose

Один набор компонентов на Compose Foundation для Android, iOS, macOS, Windows
и Linux. UI не содержит WebView и не использует компоненты Material 3.
Geist поставляется с пакетом; размеры используют dp, типографика — sp.

## Текущее состояние

Реализованы Button, state-based Input, Switch, Card, Sheet и Snackbar,
генераторы общих токенов и материалов, граница Colors Program и сценарий
настроек. Desktop-компиляция и проверки ввода, pending-состояния, Escape и
возврата фокуса выполняются. Первый настоящий desktop-рендер проверен.

**Пакет ещё не опубликован. NATIVE-01 не завершён.** До выпуска остаются:

- Привести геометрию и состояния к общему живому профилю Figma, накопительные
  тени и шум — к профилю материала; проверить изображение обеих тем.
- Подключить опубликованные платформенные Colors через ColorProgramHost,
  заменить использование подготовленной палитры в примере живым runtime.
- Получить полный опубликованный Maven-комплект Motion, включая Apple.
- Проверить реальные Android/iOS приложения, IME, масштаб 100/125/200%,
  VoiceOver/TalkBack и работу всех материалов.
- Завершить Linux Java Accessibility → AT-SPI bridge и подтвердить сценарий Orca.
- Собрать установщики, проверить отдельные consumers, пройти review и выпуск.

Эта запись описывает исполняемый остаток работы и не заменяет принятый
[план r1](https://github.com/Labpics-Team/agents-config/blob/main/plans/labui/r1.md).

## Разработка

JDK 21, Android SDK 37, Gradle wrapper 9.3.1. Android минимум API 33.

```sh
node native/compose/scripts/generate-tokens.mjs
node native/compose/scripts/generate-colors.mjs
node native/compose/scripts/generate-materials.mjs
bash native/compose/gradlew -p native/compose desktopTest
```

`motionRepository` позволяет указать локальный Maven для разработки до
публикации Motion. `--source <checkout>` у генераторов Colors/materials
позволяет работать против ещё не интегрированного общего профиля. Обычный
путь генератора всегда находится в этом репозитории.

Desktop-пример использует отдельный Gradle build:

```sh
bash native/compose/gradlew -p native/compose/consumer run \
  -PuiRepository=/absolute/path/to/native/compose/build/repository
```

`uiSource` включает явную Gradle composite-подстановку для разработки.
Проверка опубликованного потребителя обязана оставлять `uiSource` unset.

## Границы

`ColorProgramHost` получает общие Program-байты и отдаёт `LabColorOutput` из
`outputRgb`/`outputOpacity`. Компоненты знают только роли. `LabThemeState`
атомарно принимает целый результат; ошибка или устаревший ответ сохраняют
последнее принятое состояние. Подготовленная начальная палитра генерируется
тем же Program API; это первый кадр, а не отдельный решатель.

`LabScene` ограничивает retained capture своим окном. Источники фона, формы
и Sheet имеют разные уровни; `HazeInput.Sources` выбирает только стоящие
позади источники. Геометрия формы не подменяет frost/depth материала.
Figma radius переводится в sigma и затем в радиус Haze с учётом density.
Взаимодействие анимирует только Lab Motion; interaction-блоки Haze выключены.

`LabSheetHost` исключает фон из дерева доступности во время модальности,
удерживает Tab/Shift+Tab, обрабатывает Escape, учитывает IME и возвращает
фокус после удаления Sheet. Приложение владеет открытостью и содержимым.

## Источники

- [Lab UI — исходная Figma](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI)
- [Haze 2.1](https://chrisbanes.me/posts/haze-2.1.0/)
- [Haze Glass и radius/sigma](https://github.com/chrisbanes/haze/blob/2.1.0/haze-glass/src/commonMain/kotlin/dev/chrisbanes/haze/glass/SemanticBlurKernel.kt)
- [Compose — доступность](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-accessibility.html)
- [GNOME Java / AT-SPI](https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/toolkits.html#java-swing-via-java-atk-wrapper)

Шрифты Geist распространяются по SIL Open Font License; лицензия находится
рядом с файлами шрифтов. Код Lab UI — MIT.
