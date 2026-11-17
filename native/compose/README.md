# Lab UI для Compose

Один набор компонентов на Compose Foundation для Android, iOS, macOS, Windows
и Linux. UI не содержит WebView и не использует компоненты Material 3.
Geist поставляется с пакетом; размеры используют dp, типографика — sp.

## Текущее состояние

Реализованы Button, state-based Input, Switch, Card, Sheet и Snackbar,
генераторы общих токенов, геометрии компонентов и материалов, граница Colors
Program и сценарий настроек. Button, Input, Card и Sheet читают общий профиль
Figma. Input сохраняет подпись в разрыве рамки, Sheet поддерживает перетаскивание.
Button имеет description/icon/iconEnd/iconOnly, authored hover/pressed/disabled
и сегментный loader. Шум SCREEN, стек теней и progressive Ghost-overlay
проецируются из общих material/shadow-профилей. Обе темы и Sheet осмотрены
в настоящем Windows-окне.

Desktop/Android используют `pics.lab:ui-colors`: общий Kotlin-host над
платформенными Lab Colors artifacts. Реальный desktop solver проверен для
всех четырёх тем, включая increased contrast. Swift-host использует тот же
wire и output через самостоятельный SwiftPM-пакет. `SettingsScreen(host)`
сохраняет theme state при переключении настроек и позволяет повторить ошибку.

Последний завершённый CI собирает Android APK и iOS frameworks (device/simulator). На Windows,
macOS и Linux проходят UI-тесты и отдельный сценарий через Java Accessibility:
ввод, валидация, сохранение, Snackbar, события текста и возврат фокуса.
Это проверка исходников с явными composite-подстановками, ещё не проверка
опубликованных пакетов или системных screen readers.

**Пакет ещё не опубликован. NATIVE-01 не завершён.** До выпуска остаются:

- Завершить независимое визуальное сравнение материалов на всех платформах.
- Заменить явные Colors CI-артефакты публичной поставкой и проверить Swift-host
  в настоящем приложении. Платформенные runtime-тесты подготовлены; результат
  нового CI ещё не подтверждён.
- Получить полный опубликованный Maven-комплект Motion, включая Apple.
- Проверить реальные Android/iOS приложения, IME, масштаб 100/125/200%,
  VoiceOver/TalkBack и работу всех материалов.
- Завершить Linux Java Accessibility → AT-SPI bridge и подтвердить сценарий Orca.
- Собрать установщики, проверить отдельные consumers, пройти review и выпуск.

Эта запись описывает исполняемый остаток работы и не заменяет принятый
[план r1](https://github.com/Labpics-Team/agents-config/blob/main/plans/labui/r1.md).

## Разработка

JDK 21, Android SDK 37, Gradle wrapper 9.3.1. Android минимум API 33.
Kotlin/Compose/AGP определены в `gradle/libs.versions.toml` и разделяются с
consumer. Haze 2.1.0 содержит Apple klib ABI 2.4 и требует Kotlin 2.4.21.

```sh
node native/compose/scripts/generate-tokens.mjs
node native/compose/scripts/generate-components.mjs
node native/compose/scripts/generate-colors.mjs
node native/compose/scripts/generate-materials.mjs
bash native/compose/gradlew -p native/compose :desktopTest
```

`motionRepository` позволяет указать локальный Maven для разработки до
публикации Motion; `motionSource` — явный Gradle composite исходников.
`--source <checkout>` у генераторов Colors/components/materials
позволяет работать против ещё не интегрированного общего профиля. Обычный
путь генератора всегда находится в этом репозитории.
Генератор материалов читает `@labpics/ui-shadow/profile.json` и PNG-ресурсы
из `dist` общих пакетов: сначала выполните их `build`.

Desktop-пример использует отдельный Gradle build:

```sh
bash native/compose/gradlew -p native/compose/consumer run \
  -PuiRepository=/absolute/path/to/native/compose/build/repository
```

`uiSource` включает явную Gradle composite-подстановку для разработки.
Проверка опубликованного потребителя обязана оставлять `uiSource` и
`motionSource` unset. `run --args=--verify` проходит настоящий сценарий через
Java Accessibility и сохраняет события в `build/accessibility-events.txt`.
До публичного выпуска адаптер принимает `colorsRepository`/`colorsVersion`
или отдельные `colorsDesktopRepository`/`colorsDesktopVersion` и Android-аналоги.
Эти настройки должны ссылаться на настоящую Maven-поставку; фиктивной версии
по умолчанию нет. `:ui-colors:desktopTest` запускает сам native solver.

Для iOS установите XcodeGen, затем выполните
`python3 native/compose/consumer/iosApp/prepare.py --colors-archive /path/to/LabColors.swiftpm.zip`
и откройте созданный проект. Xcode вызывает `embedAndSignAppleFrameworkForXcode`;
framework, шрифты и Program-ресурсы доставляются штатным Compose-путём.
Пример содержит UI-тест сценария, но он не заменяет проверку VoiceOver.

## Границы

`ColorProgramHost` получает общие Program-байты и отдаёт `LabColorOutput` из
`outputRgb`/`outputOpacity`. Компоненты знают только роли. `LabThemeState`
атомарно принимает целый результат; ошибка или устаревший ответ сохраняют
последнее принятое состояние. Подготовленная начальная палитра генерируется
тем же Program API; это первый кадр, а не отдельный решатель.
JVM-host хранит не более четырёх Program для appearance/contrast и закрывает
native handles с жизненным циклом composition. Swift-host ограничивает доступ
последовательной очередью; callbacks возвращаются на main и не удерживают
native очередь при закрытии. Ошибки Swift/Kotlin проходят через `@Throws`.

`LabScene` ограничивает retained capture своим окном. Источники фона, формы
и Sheet имеют разные уровни; `HazeInput.Sources` выбирает только стоящие
позади источники. Геометрия формы не подменяет frost/depth материала.
Figma radius переводится в sigma и затем в радиус Haze с учётом density.
Тени сохраняют порядок слоёв и общий нейтральный цвет; вместо platform elevation
используется `dropShadow` с авторскими размерами. Overlay исключает из capture
себя и Sheet. Шум — один повторяемый bitmap shader, без набора drawImage на каждый grain.
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
