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

CI `44040655728` подтвердил desktop-сценарий с настоящими Colors и Icons на
Windows, macOS и Linux: ввод, валидация, сохранение, Snackbar, события текста
и возврат фокуса. Android потребовал core library desugaring от Colors AAR.
iOS-приложение собралось, но проверка на iPhone Pro выявила отсутствующий
`CADisableMinimumFrameDurationOnPhone`; оба требования исправлены в host.
Это проверка исходников с явными composite-подстановками, ещё не проверка
опубликованных пакетов или системных screen readers.

**Пакет ещё не опубликован. NATIVE-01 не завершён.** До выпуска остаются:

- Завершить независимое визуальное сравнение материалов на всех платформах.
- Заменить явные Colors CI-артефакты публичной поставкой и проверить Swift-host
  в настоящем приложении. Новый CI должен подтвердить весь UI-сценарий.
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
Обычный путь уже использует публичный `pics.lab:motion-compose:0.1.0`,
включая Apple, из `maven-compose-v0.1.0`; CI не подставляет исходники Motion.
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
Пример использует опубликованный `pics.lab:icons-compose` через `iconsVersion`;
до выпуска `iconsSource` явно подключает принятый native-каталог исходников.
До публичного выпуска адаптер принимает `colorsRepository`/`colorsVersion`
или отдельные `colorsDesktopRepository`/`colorsDesktopVersion` и Android-аналоги.
Эти настройки должны ссылаться на настоящую Maven-поставку; фиктивной версии
по умолчанию нет. `:ui-colors:desktopTest` запускает сам native solver.
Android-приложение включает core library desugaring и `desugar_jdk_libs:2.1.5`,
как требует поставка Colors AAR; готовая конфигурация находится в `consumer/androidApp`.

Для iOS установите XcodeGen, затем выполните
`python3 native/compose/consumer/iosApp/prepare.py --colors-archive /path/to/LabColors.swiftpm.zip`
и откройте созданный проект. Xcode вызывает `embedAndSignAppleFrameworkForXcode`;
framework, шрифты и Program-ресурсы доставляются штатным Compose-путём.
`Info.plist` включает `CADisableMinimumFrameDurationOnPhone=true` для iPhone Pro;
проверка Compose не отключается. В XCTest editable semantics имеют тип `TextView`.
Пример содержит UI-тест сценария, но он не заменяет проверку VoiceOver.

### Графический backend desktop host

Пример и его установщики выбирают OpenGL на Windows x64 до создания первого
окна. Явные `SKIKO_RENDER_API` и `-Dskiko.renderApi` сохраняют приоритет.
На остальных платформах остаётся штатный выбор Skiko; Windows ARM не принимает
OpenGL в Skiko 0.150.2. Компоненты Lab UI не меняют backend приложения.
Для своего desktop host используйте тот же порядок из
`consumer/src/desktopMain/kotlin/pics/lab/ui/sample/DesktopRendering.kt`.
Стартовое окно ограничено рабочей областью монитора в логических координатах,
поэтому изменение системного масштаба не оставляет его нижнюю границу за экраном.

Причина выбора воспроизведена 17 ноября 2026 на Windows x64, RTX 3080 Ti,
Skiko 0.150.2/Haze 2.1.0: пустой Solid Sheet с progressive overlay тратил
26 209 мс на первый кадр Direct3D, затем 2–52 мс; OpenGL — 225 мс, затем
3–60 мс. В полном сценарии сообщение валидации появлялось через 29 219 мс
с Direct3D и 42 мс с OpenGL. Стек первого запуска находился в
`Direct3DContextHandler.flush`, занимая CPU; состояние формы не терялось.
Увеличение ожидания подтвердило причину, но осталось только диагностическим
опытом: рабочая проверка сохраняет прежнее ожидание 5 секунд.
Skiko сам переключает OpenGL на software при невозможности создать контекст;
полный сценарий с явным SOFTWARE также проверен (валидация 1181 мс).
Другие GPU и Windows ARM требуют отдельного измерения перед заявлением их
производительности. Пересмотр выбора — после исправления первого Direct3D
кадра в Skiko/Haze и повторения этого же опыта.

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
- [Skiko 0.150.2: выбор backend и fallback](https://github.com/JetBrains/skiko/blob/v0.150.2/skiko/src/jvmMain/kotlin/org/jetbrains/skiko/SkikoProperties.kt)
- [Compose — доступность](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-accessibility.html)
- [GNOME Java / AT-SPI](https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/toolkits.html#java-swing-via-java-atk-wrapper)

Шрифты Geist распространяются по SIL Open Font License; лицензия находится
рядом с файлами шрифтов. Код Lab UI — MIT.
