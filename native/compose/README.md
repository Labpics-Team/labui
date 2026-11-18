# Lab UI для Compose

Один набор компонентов на Compose Foundation для Android, iOS, macOS, Windows
и Linux. UI не содержит WebView и не использует компоненты Material 3.
Geist поставляется с пакетом; размеры используют dp, типографика — sp.

## Текущее состояние

Реализованы Button, Badge, state-based Input, Switch, Card, Sheet, Snackbar, Loader и Progress,
генераторы общих токенов, геометрии компонентов и материалов, граница Colors
Program и сценарий настроек. Button, Input, Switch, Card и Sheet читают общий профиль
Figma. Input сохраняет подпись в разрыве рамки, Sheet поддерживает перетаскивание.
Badge переносит 15 цветов, Fill/Tinted, общий disabled и два декоративных знака;
геометрия и цветовые роли общие с вебом. [Контракт и проверки Badge](../../docs/reference/badge.md).
Button имеет description/icon/iconEnd/iconOnly, authored hover/pressed/disabled
и сегментный loader. Шум SCREEN, стек теней и progressive Ghost-overlay
проецируются из общих material/shadow-профилей. Обе темы и Sheet осмотрены
в настоящем Windows-окне.

Desktop/Android используют `pics.lab:ui-colors`: общий Kotlin-host над
платформенными Lab Colors artifacts. Реальный desktop solver проверен для
всех четырёх тем, включая increased contrast. Swift-host использует тот же
wire и output через самостоятельный SwiftPM-пакет. `SettingsScreen(host, store)`
сохраняет theme state при переключении настроек и позволяет повторить ошибку.

[CI `44173002727`](https://github.com/Labpics-Team/labui/actions/runs/44173002727)
на `3856712` подтвердил Windows/macOS/Linux, MSI/DMG/DEB, упакованные launcher,
Android API 33/35 и полный iOS-сценарий: редактирование → валидация → сохранение
→ Undo → сохранение → настоящий перезапуск. Android также пересоздаёт Activity.
Linux дополнительно прошёл внешнее редактирование, отмену, валидацию, сохранение
и перезапуск через AT-SPI на установленном DEB со штатным мостом;
реальная Orca произнесла кнопку и подпись поля. Этот внешний сценарий Orca
не проверяет Undo: его проверяет отдельный packaged Java Accessibility путь.

Geist 1.400 из официального tag 1.4.2 соответствует геометрии светлого авторского
каталога; одинаковая версия поставляется во всех native-темах. Контуры, размеры
строк и хеши сохранены в [исследовании шрифта](evidence/fonts-20261117/README.md).
Отсчёт Snackbar начинается после первого рендера и entrance; холодный кадр
не отнимает время Undo. Причина прежнего длинного первого кадра iOS окончательно
не установлена, а скорость физического устройства не измерена.
Проверки Java Accessibility и XCTest не подтверждают NVDA/VoiceOver/TalkBack.
Полный native-каталог, системные screen readers и выпуск остаются открытыми.

Consumer хранит сохранённое пространство отдельно от черновика Sheet.
Рабочая область — одна колонка до 640 dp: имя и описание пространства,
связанные данные уведомлений и редактирование. Кнопка «Оформление» открывает
отдельную панель темы, материала и доступности. Sheet принимает естественную
высоту содержимого и прокручивается при нехватке места, включая открытую IME.
Отмена, Escape и закрытие не записывают черновик. Черновик и открытая панель
восстанавливаются при пересоздании Android Activity. Save закрывает панель и
показывает Snackbar только после атомарной записи DataStore; ошибка сохраняет
ввод. Настройки вида записываются отдельно от полей пространства той же
транзакционной моделью и восстанавливаются после перезапуска.
Android использует filesDir, iOS — Application Support в sandbox, desktop —
AppData/Roaming, Application Support или XDG_CONFIG_HOME. Это хранение приложения,
а не обязанность библиотеки компонентов. Snackbar исчезает автоматически с
учётом системного времени чтения; ручное закрытие не требуется.

**Пакет ещё не опубликован. NATIVE-01 не завершён.** До выпуска остаются:

- Завершить независимое визуальное сравнение материалов на всех платформах.
- Проверить чистых потребителей всех платформ с опубликованным Colors SDK;
  временные Colors CI-артефакты уже заменены публичной поставкой.
- Довести композицию первого опыта; проверить IME, масштаб 100/125/200%,
  VoiceOver/TalkBack и работу всех материалов.
- Пройти независимое review и выпуск после проверок реального потребителя.

Эта запись описывает исполняемый остаток работы и не заменяет принятый
[план r1](https://github.com/Labpics-Team/agents-config/blob/main/plans/labui/r1.md).

## Loader и Progress

`LabLoader` и `LabProgress` получают геометрию и цветовые роли из общего
`packages/tokens/src/components.json`. Loader M — 24 dp, L — 48 dp; S 16 dp
расширяет исходный набор. Измеряемый medium Loader содержит внешнее кольцо
и внутренний сектор с угловым градиентом, large — кольцо с круглым концом.
Неизвестное значение показывает восемь авторских сегментов.

```kotlin
LabLoader(label = "Подключение")
LabLoader(value = 75f, size = LabControlSize.Large)
LabProgress(value = 25f, label = "Отправка файла", showValueText = true)
LabProgress(value = 25f, variant = LabProgressVariant.Circular, showValueText = true)
```

У обоих компонентов `value: Float? = null`, `min = 0f`, `max = 100f`.
Конечное значение ограничивается диапазоном; `null`, NaN, бесконечности и
неверный диапазон означают неизвестный прогресс. `showValueText` управляет
только видимым процентом и не придумывает значение при неизвестной длительности.
`label` у Progress виден над индикатором; у Loader это имя для доступности.
Один native semantic node сообщает актуальные границы и измеренное значение,
а неизвестное состояние использует `ProgressBarRangeInfo.Indeterminate`.

Авторский Linear M имеет толщину 4 dp, Circular M — 96 dp со штрихом 4 dp
и Geist 16/24/500. S/L расширяют линейную толщину до 2/8 dp и диаметр до
64/128 dp. Полоса заполняется от логического начала в LTR/RTL; окружность —
сверху по часовой стрелке. Круг с текстом растёт при системном увеличении шрифта,
сохраняя весь процент. Цвет трека уже включает альфу семантической роли.

Общий Lab Motion интерполирует измеряемую долю и вращает неизвестную позу.
Reduced motion и неактивный lifecycle останавливают ожидание; неизвестная
линейная полоса остаётся по центру. Рисование читает анимируемые значения
без перестройки композиции, кисти и контуры кэшируются, Loader обновляет
видимую позу только при смене одного из восьми шагов.

`ProgressStateTest` и `ProgressRenderTest` проверяют диапазоны, семантику,
промежуточные кадры, остановку движения, RTL, обе темы и масштаб текста 200%.
Источник, CPU PNG и сравнение находятся в
[evidence/progress-20261118](evidence/progress-20261118/README.md).

## Tabs

`LabTabs` переносит Tinted и Underlined из общего профиля Figma. `value` строго
управляется приложением; отказ `onValueChange` сохраняет выбранную панель,
пока фокус перемещается стрелками. `automatic = false` оставляет выбор Enter/Space.
Панели сохраняют обычный `remember`, а скрытая панель исключается из фокуса
и accessibility tree. Значения вкладок должны быть уникальными.

```kotlin
LabTabs(value = section, onValueChange = { section = it }, items = listOf(
    LabTabItem("project", "Проект"),
    LabTabItem("notes", "Заметки"),
), variant = LabTabsVariant.Tinted) { value ->
    val editor = remember { TextFieldState() }
    LabInput(editor, if (value == "project") "План проекта" else "Заметки", singleLine = false)
}
```

`orientation` задаёт Horizontal/Vertical; `edge` — Start/End линии Underlined,
где Start/End у Vertical зеркалятся в RTL. Icon/iconEnd получают цвет и размер,
а icon-only сохраняет доступное имя из `label`. При 200% горизонтальный список
прокручивается к фокусу; вертикальный становится над панелью, если рядом
недостаточно места. Панель и её фокус при этом не пересоздаются.

[Источник, CPU PNG и проверка установленного consumer](evidence/tabs-20261118/README.md)
покрывают обе темы, 100/125/200%, Solid/Acrylic/Glass и общий Lab Motion.

## Switch

`LabSwitch` читает единственный общий профиль `packages/tokens/src/components.json`:
трек S 28×16, M 36×20, L 44×24; Geist 16/24/400 для S/M и 20/20/500 для L.
Подписи сохраняют цвет в disabled, фокус рисуется снаружи с отступом 2 dp.
Тени ссылаются на общий профиль Shadow; Check/X действительно вырезаются из
ползунка, поэтому через знак виден текущий градиент трека. Hover, pressed,
disabled и сочетание neutral/icon учитывают авторские различия.

```kotlin
LabSwitch(
    checked = notifications,
    onCheckedChange = { notifications = it },
    label = "Получать уведомления",
    size = LabControlSize.Medium,
    icon = true,
)
```

`intent` по умолчанию Accent: выключенный трек neutral, включённый accent.
Neutral сохраняет нейтральный трек, Danger — красный при обоих значениях.
Figma содержит 108 вариантов: enabled neutral/off, accent/on, danger/off
и все disabled пары. Остальные enabled значения — расширение поведения SDK,
а не дополнительные авторские варианты. `labelStart` добавляет левую логическую
подпись; `label` располагается после трека. При нехватке ширины для целых слов
подписи занимают полную строку, трек переходит под них. Это сохраняет текст
при системном масштабе 200%; RTL меняет логическое направление и ход ползунка.

Подписи и трек образуют один native `Role.Switch`. `checked` управляет приложение,
Space выполняет одно переключение, disabled исключает ввод. При перестройке
компоновки узел и фокус сохраняются. `interactionSource` можно передать для
наблюдения за состояниями. Изменения размеров/позиции анимирует общий Lab Motion.

В списке настроек каждый Switch получает отдельную строку не ниже 48 dp через
`Modifier.fillMaxWidth().heightIn(min = 48.dp)`: авторский трек сохраняет размер,
а области нажатия соседних настроек не пересекаются. `SettingsLayoutTest`
проверяет настоящий экран при 640 dp/100% и 320 dp/200%, включая нажатие у края
строки и сохранение соседних значений. Заголовок Sheet при нехватке ширины
занимает полную строку, действие закрытия переходит ниже без пересоздания узла.
Его собственная роль из Figma `7719:54845` — Geist 20/20/600 с tracking −0,33 px,
а не общая ступень заголовка. Метрики приходят из `components.json#sheet.typography`.
Заголовок и форма используют одну ограниченную по высоте область прокрутки:
даже при 320×320 dp и масштабе 200% поля и «Сохранить» остаются достижимы.
Ручка остаётся сверху; внутренний запас для рамки фокуса берётся из существующих
отступов, поэтому обычная геометрия не меняется. Тест доходит до каждого поля,
изменяет черновик и нажимает видимую кнопку сохранения с записью в DataStore.

`SwitchRenderTest` проверяет 108 вариантов в двух темах при 100/125/200%,
длинные подписи на 320 dp, фактические границы строк и отсутствие дробления слов,
ход ползунка в RTL, семантику, фокус при переносе, Space и disabled pointer.
Тест использует CPU `ImageComposeScene`, без окон и звука. Атласы и сравнение
с исходной Figma находятся в [evidence/switch-20261118](evidence/switch-20261118/README.md).

## Snackbar

`LabSnackbar` использует общий `packages/tokens/src/components.json`: Elevated,
капсула, отступы 12/8/8, Geist 16/24/500, штатная small/accent/ghost-кнопка.
Таймер 32 dp / stroke 3 dp имеет пять авторских поз против часовой стрелки;
последние две секунды выделяются danger. При системном масштабе текста круг
растёт вместе с цифрой. Если строка с действием не помещается по её реальной
длине, действие переходит ниже. Радиус сохраняет размер однострочной капсулы,
чтобы многострочный текст не обрезался углами.
Сообщение объявляется в polite live region; таймер исключён из accessibility tree.

```kotlin
LabSnackbar(
    "Изменения сохранены", open = saved, onDismiss = { saved = false },
    notificationKey = saveNumber, actionLabel = "Отменить", onAction = ::undo,
    restoreFocus = editButton,
)
```

`durationMillis` по умолчанию 5000 из `LabSnackbarDefaults.durationMillis`,
`0` оставляет сообщение до закрытия приложением.
Отсчёт начинается после первого рендера и входа: холодный кадр не отнимает время
у действия. Новый `notificationKey` также получает полный срок после рендера.
Таймер учитывает системный accessibility timeout и останавливается при наведении,
фокусе внутри, `actionPending` или неактивном lifecycle. Один monotonic deadline
планирует только смены секунды/позы, без кадрового цикла. `notificationKey`
перезапускает тот же текст. Вход использует общий Motion entrance из DTCG.

Действие вызывается до `onDismiss`. Для асинхронного действия установите
`dismissOnAction=false`, передайте `actionPending` и закройте сообщение после
результата операции. Пример настроек действительно отменяет последнюю запись;
сравнение версии и восстановление выполняются одной транзакцией, последующая
запись в том же WorkspaceStore сохраняется. При ошибке Undo доступен повтор.
Desktop-пример использует SingleProcessDataStore; параллельное редактирование
одного файла разными процессами не поддерживается.

`SnackbarRenderTest` создаёт только CPU `ImageComposeScene`, без окон: обе темы
на ширине 640/360 dp при 100/125/200% и все пять поз таймера. Узкая версия
проверяет число строк сообщения, последний сектор — реальные пиксели слева/справа.
PNG сохраняются в `build/snackbar-render`. Платформенные
сценарии проходят save → Undo → save → restart через системную доступность.
Источники: [Figma](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[Compose Lifecycle](https://kotlinlang.org/docs/multiplatform/compose-lifecycle.html).

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
`motionSource` unset. `--verify` требует отдельный `LABUI_DATA_DIR` и проходит
сценарий через Java Accessibility. `verify-desktop-package.py` создаёт временное
хранилище и перезапускает launcher с `--verify-restart` для проверки записи;
события сохраняются в `build/accessibility-events*.txt`.
UI и screen-reader проверки выполняются в изолированной среде/CI: не запускайте
звуковую озвучку или видимые тестовые окна на рабочем столе пользователя.
Linux CI снимает main/Sheet обеих тем только после стабилизации настоящих пикселей
и сохраняет `build/screenshots`; обновлённый consumer ещё требует их оценки.
Отдельный Linux-сценарий проверяет packaged JVM с системным GNOME
`java-atk-wrapper` через AT-SPI и журнал произнесённых фраз Orca. Ввод,
отмена, валидация, сохранение и перезапуск проходят из другого процесса.
Он исполняется только в приватной D-Bus/Xvfb-сессии GitHub CI; результат
и журнал сохраняются в `build/linux-accessibility`. Сценарий прошёл в CI
`44145747285` с test-side подключением моста. Обновлённая проверка запускает
установленный DEB и исключает подмену launcher через переменные среды;
В [CI 44164544956](https://github.com/Labpics-Team/labui/actions/runs/44164544956)
эта проверка прошла: `/opt/labui/bin/LabUI` из установленного DEB, объявленная
зависимость `libatk-wrapper-java-jni (>= 0.37.1)`, `jvm_environment_injection=false`.
Orca произнесла действие и поле; внешний AT-SPI выполнил edit/cancel/validation/save/restart.
Android UI Automator действует через настоящий EditText или Switch:
Compose может экспортировать подпись отдельным описательным дочерним узлом.
Hierarchy и пиксели сохраняются до закрытия Activity, включая неудачные проверки.
XCTest ищет live announcements по label: UIKit экспортирует их как `Other`.
Текущие XCTest разделяют сохранение/перезапуск и Undo. Только отдельный Undo-тест
передаёт через DEBUG-параметр `LABUI_UI_TEST_SNACKBAR_DURATION_MS=60000` увеличенный
интервал штатному Snackbar: медленный XCTest snapshot не должен исчерпать время
действия. Основной сценарий и Release сохраняют авторские 5000 ms; работу таймера,
пауз и начала отсчёта проверяет отдельный компонентный набор. Новый iOS-прогон
и его результат отслеживаются в PR #240.
Полный iOS-сценарий edit → validation → save → Undo → save → restart прошёл
в [CI 44158011723](https://github.com/Labpics-Team/labui/actions/runs/44158011723):
143.6 секунды на iPhone 16 Pro Simulator, включая восстановленное значение
«Нативная лаборатория 東京». Это проверка поведения, а не скорости устройства.
Пример использует опубликованный `pics.lab:icons-compose` через `iconsVersion`;
до выпуска `iconsSource` явно подключает принятый native-каталог исходников.
Публичный выпуск Colors закреплён в [`colors-release.json`](colors-release.json):
одна версия содержит точный source commit для Android, desktop и Apple.
Оба Gradle-проекта используют общий каталог зависимостей и публичный Maven;
токен GitHub и временные CI-архивы не нужны. `:ui-colors:desktopTest` запускает
сам native solver. При обновлении выпуска в descriptor закрепляются версия,
точный commit Maven-хранилища и SHA256 Swift-архива. Maven URL использует commit
вместо изменяемой ветки; Apple release tag следует из версии.
Проверка публичных SDK-архивов, manifest и Maven-байтов зафиксирована
в [квитанции выпуска Colors](https://github.com/Labpics-Team/lab-colors/pull/878#issuecomment-6980707104).
Android-приложение включает core library desugaring и `desugar_jdk_libs:2.1.5`,
как требует поставка Colors AAR; готовая конфигурация находится в `consumer/androidApp`.

Для iOS установите XcodeGen, затем выполните
`python3 native/compose/consumer/iosApp/prepare.py`
и откройте созданный проект. Команда скачивает публичный SwiftPM-архив и проверяет
его SHA256 до распаковки. `--colors-archive` позволяет использовать уже скачанный
архив того же выпуска; проверка SHA256 остаётся обязательной.
Xcode вызывает `embedAndSignAppleFrameworkForXcode`;
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
Runtime установщика содержит `jdk.accessibility`, необходимый для Windows Java
Access Bridge. В системе пользователя мост включается штатным `jabswitch /enable`;
проверка через NVDA выполняется отдельно от Java Accessibility сценария.
`createDistributable packageDistributionForCurrentOS` собирает application image
и MSI, DMG или DEB текущей платформы;
`python native/compose/scripts/verify-desktop-package.py` проверяет сам application
image с его JVM, библиотеками и ресурсами. CI выполняет этот путь перед сохранением
установщика как проверяемого артефакта.
macOS-пример имеет app version 1.0.0: jpackage из JDK 21 требует положительный
major. Версия SDK остаётся независимой от версии приложения-примера.

### Linux и системная доступность

На Ubuntu перед desktop-сборкой установите `libatk-wrapper-java-jni`.
DEB объявляет эту зависимость; устанавливайте пример через
`sudo apt install ./labui_*.deb`, чтобы пакетный менеджер установил её вместе
с приложением. Система должна предоставлять desktop D-Bus и AT-SPI.

Gradle читает реальные пути JAR/JNI через `dpkg-query` и добавляет их в параметры
обычного `run` и launcher установщика. Ubuntu 20.04 и новые версии используют
свой согласованный GNOME bridge; Lab UI не встраивает библиотеку из более новой
glibc и не требует переменных среды пользователя. Расположение JNI определяется
пакетом для архитектуры сборки. Компонентный SDK не меняет настройки JVM;
свой desktop host должен перенести блок `linuxAccessibilityJvmArgs`, настройки
`AbstractJPackageTask`/`JavaExec` и зависимость DEB из `consumer/build.gradle.kts`.

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

Композиция Sheet берётся из `packages/materials/src/profile.json#compositions.sheet`:
поверхность elevated, тень modal и наружная линия border-base. Ghost занимает
ширину viewport, включая desktop, где Body ограничен 640 dp. Он идёт от верха
сцены до верхнего края панели плюс 32 dp перекрытия;
blur усиливается сверху вниз. Высота Ghost вычисляется после измерения Body
в том же проходе layout. Оба слоя перемещаются одной геометрией; Ghost захватывает только
фон, а Body может захватить перекрытие Ghost. Нажатие внутри панели не закрывает её;
прозрачная область снаружи запрашивает закрытие.

`LabSheetHost` исключает фон из дерева доступности во время модальности,
удерживает Tab/Shift+Tab, обрабатывает Escape, учитывает IME и возвращает
фокус после удаления Sheet. Приложение владеет открытостью и содержимым.
`LabInput` использует Tab/Shift+Tab для перехода между полями, включая многострочный
ввод; Enter в многострочном поле добавляет перевод строки.
Длинная подпись переносится целиком; каждая дополнительная строка увеличивает
высоту поля и верхний отступ ввода. Однострочные Input сохраняют авторские
36/48/56 dp. `singleLine = false` использует отдельный общий профиль Textarea:
минимальная рамка 112 dp, подпись 14/12, helper 12/12, три строки ввода сверху.
Системный размер шрифта увеличивает необходимую высоту; S/L сохраняют плотность
типографики API без отдельной авторской геометрии Textarea.
[Нативные рендеры и проверка 100/125/200%](evidence/input-20261118/README.md).
В используемом Medium без иконки боковая область Input сохраняет ширину 16 dp, центр добавляет 4 dp:
текст и caption начинаются на 20 dp, разрыв рамки — на 16 dp. Это геометрия
Figma `Show Left-icon=false`, а не исчезновение всей боковой области;
узлы сохранены в `evidence/input-empty-adornments-source.json`.
Card в сценарии настроек использует Elevated из master `6225:42443`.

## Источники

- [Lab UI — исходная Figma](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1)
- [Haze 2.1](https://chrisbanes.me/posts/haze-2.1.0/)
- [Haze Glass и radius/sigma](https://github.com/chrisbanes/haze/blob/2.1.0/haze-glass/src/commonMain/kotlin/dev/chrisbanes/haze/glass/SemanticBlurKernel.kt)
- [Skiko 0.150.2: выбор backend и fallback](https://github.com/JetBrains/skiko/blob/v0.150.2/skiko/src/jvmMain/kotlin/org/jetbrains/skiko/SkikoProperties.kt)
- [Compose — доступность](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-accessibility.html)
- [KMP DataStore — атомарное платформенное хранение](https://developer.android.com/kotlin/multiplatform/datastore)
- [Linear Preferences — опора композиции рабочей области](https://linear.app/docs/account-preferences)
- [Android — system bar icons и edge-to-edge](https://developer.android.com/develop/ui/compose/system/setup-e2e)
- [GNOME Java / AT-SPI](https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/toolkits.html#java-swing-via-java-atk-wrapper)
- [JDK 21 — AccessibilityProvider](https://docs.oracle.com/en/java/javase/21/docs/api/java.desktop/javax/accessibility/AccessibilityProvider.html)
- [Orca — журнал фактических speech outputs](https://github.com/GNOME/orca/blob/c917f9279a2036671741ad1f7d5daa64d851915f/src/orca/speech.py)

Шрифты Geist распространяются по SIL Open Font License; лицензия находится
рядом с файлами шрифтов. Код Lab UI — MIT.
