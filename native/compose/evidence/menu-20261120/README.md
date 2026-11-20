# Native Menu family — 20 ноября 2026

Реальный offscreen Compose Foundation Popup, Java 21, Skiko SOFTWARE,
`-Djava.awt.headless=true`. Окон и screen readers этот прогон не создаёт.

`menu/context/menubar-{light,dark}-{100,200}.png` — 12 композиций с состояниями,
типографикой и проверяемыми действиями. `source-{dropdown,context,menubar}-*.png`
воспроизводят шесть авторских композиций. Dropdown измерен как 256×386 dp:
heading 48, линия 1, восемь строк по 40, три разделителя по 3, padding 4.
`menubar-keyboard-focus.png` показывает видимый фокус закрытого управления.
Сами рендеры, включая светлый Dropdown и тёмный Context, осмотрены.

Общий источник — `packages/tokens/src/components.json#menu`, связанный через
registry с Dropdown Menu, Context Menu и Menubar. Source screenshots родительская
задача получила read-only через официальный Figma API. Этот каталог содержит
только собственные native-рендеры.

15 проверок `MenuModelTest`/`MenuRenderTest` прошли: уникальное дерево, radio
между уровнями, контролируемый отказ, локальные defaults, disabled и Icons в
Check/Radio, nested selection и возврат к родительскому действию, secondary click,
Menu key/accessible long press, Escape/Tab, RTL, динамический disabled,
переключение Menubar указателем и клавиатурой, закрытие вне меню и source geometry.

Установленный consumer использует Maven-версию `0.1.0-menu-family-20261120-r7`,
без `uiSource`/composite substitution. Проверка подтверждает загрузку JAR через
`protectionDomain.codeSource`, затем меняет общий check через Menu, запускает
nested действие через Context Menu и вновь меняет check через Menubar в обеих
темах при 100/200%. PNG consumer лежат в подкаталоге `consumer`.

```powershell
$env:JAVA_HOME='C:/Program Files/Zulu/zulu-21'
$env:JAVA_TOOL_OPTIONS='-Djava.awt.headless=true'
$env:SKIKO_RENDER_API='SOFTWARE'
# native/compose:
./gradlew.bat :desktopTest --tests 'pics.lab.ui.MenuRenderTest' --tests 'pics.lab.ui.MenuModelTest'
./gradlew.bat :publishDesktopPublicationToDistributionRepository :publishKotlinMultiplatformPublicationToDistributionRepository :ui-colors:publishDesktopPublicationToDistributionRepository :ui-colors:publishKotlinMultiplatformPublicationToDistributionRepository '-PpublicationVersion=0.1.0-menu-family-20261120-r7' '-PpublicationRepository=<absolute local Maven directory>'
# native/compose/consumer:
../gradlew.bat :desktopTest --tests 'pics.lab.ui.sample.MenuConsumerTest' '-PuiVersion=0.1.0-menu-family-20261120-r7' '-PuiRepository=<same directory>'
```

Native metadata/commonMain и Skiko metadata также скомпилированы при публикации.
Android/iOS execution и системные screen readers этим результатом не подтверждены.

Основание устройства: [Foundation Popup source](https://github.com/JetBrains/compose-multiplatform-core/blob/jb-main/compose/ui/ui/src/skikoMain/kotlin/androidx/compose/ui/window/Popup.skiko.kt)
показывает `consumePointerInputOutside = focusable`. Первый вариант с отдельными
Popup на уровень прошёл клавиатуру, но терял click обратно в родителя. Отдельный
pointer-тест выявил дефект; один popup на всю цепочку устранил саму причину.
