# Native Snackbar — 17 ноября 2026

`SnackbarRenderTest` создаёт CPU `ImageComposeScene` без окна. Перед сохранением
ожидаются Geist и четыре одинаковых кадра. PNG показывают первую позу 5 секунд
и постоянное сообщение без таймера; обе темы, системный масштаб текста
100/125/200%. 100% сохраняет размер таймера 32 dp; при увеличении текста круг
растёт вместе с цифрой, чтобы она не пересекала обводку.

Профиль: `packages/tokens/src/components.json.snackbar`, Figma master 6109:6735,
dark 7101:54738, timer 6109:6708. `figma-source.json` — неизменённая read-only
выгрузка PR #242. Native использует тот же профиль, общий Elevated и штатный
small/accent/ghost Button. Figma master показывает позу 4 и Acrylic поверх
изображения; этот набор показывает Solid на ровном фоне, поэтому совпадение
оптики с тем исходным фоном здесь не утверждается.

```powershell
native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.LabSnackbarTimerTest --tests pics.lab.ui.SnackbarRenderTest
```

Пауза и срок проверяются отдельно, а системные взаимодействия и сохранение →
Undo → сохранение → перезапуск — в Native Compose CI. Эти изображения сами
по себе не доказывают прохождение Android/iOS/Orca и не закрывают полный каталог.

Источники: [Figma](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6109-6735),
[Compose Lifecycle](https://kotlinlang.org/docs/multiplatform/compose-lifecycle.html).
