# Native input extensions — 2026-11-20

Combobox и Tags Input используют один `LabInput` и один настоящий `TextFieldState`.
Рамка, вырез под подпись, helper/error и S/M/L читают существующий Input profile.
Список Combobox использует Dropdown profile; метки — авторский Chip S Sharp selected.
Отдельных Figma masters у расширений нет. Number Input доставлен в той же ветке;
его числовая модель и отдельный oracle описаны в [соседнем evidence](../number-input-20261120/README.md).

## Проверки

SOFTWARE, `java.awt.headless=true`, без окон и звука:

- `InputRenderTest`: 3 проверки обычного Input/Textarea после расширения общего API.
- `InputExtensionsRenderTest`: 11 проверок editor/keyboard/semantics/IME/paste/render.
- `NumberInputRenderTest`: 8 проверок числового поля и IME.
- `NumberInputValueTest`: 6 проверок, включая независимый JVM BigDecimal oracle.
- `ChipRenderTest`: 4 проверки авторского Chip после добавления статичного readOnly.

Все 32 проверки прошли. После уточнения assertion для слитой semantics readOnly
повторно выполнены только 11 InputExtensions; остальные 21 уже прошли на том же production source.

Combobox проверен с отклонённым и принятым запросом, disabled-вариантами, single/multiple,
фильтром, удалением меток, неизменным фокусом editor и прокруткой последнего варианта
в окно высотой 300 px. Tags проверен с max/duplicates, отклонённым запросом,
редактированием, внешней заменой редактируемого элемента, RTL и экранным Done.
Настоящие IME edit commands сохраняют composition при смене размера и не превращают
Enter завершения composition в выбор/добавление.

`fields-{Light,Dark}-{1.0,2.0}.png` — узкое окно 390 px, обе темы и текст 100/200%.
`combobox-open-scrolled.png` — открытый список, активный последний вариант и disabled-сосед.
PNG осмотрены: метки и текст переносятся, helper читается, рамка растёт с содержимым;
readOnly сохраняет читаемую selected-палитру, не показывает действие удаления
и не добавляет пустую строку для ввода. XML сохранены рядом с PNG.

Команда из `native/compose`:

```powershell
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true -Dskiko.renderApi=SOFTWARE'
.\gradlew.bat :desktopTest --tests pics.lab.ui.InputRenderTest --tests pics.lab.ui.InputExtensionsRenderTest --tests pics.lab.ui.ChipRenderTest --tests pics.lab.ui.NumberInputValueTest --tests pics.lab.ui.NumberInputRenderTest --no-daemon --max-workers=1 '-Pkotlin.compiler.execution.strategy=in-process' '-Dorg.gradle.jvmargs=-Xmx768m'
```

## Вставка и поддержка платформ

Случайный признак «буфер был прочитан» не используется. Одна операция читает текст,
проверяет непрерывность фокуса/компонента/запроса, текущие text/selection/composition
и возможность записи, затем заменяет выделение через `state.edit`. Только завершённая
вставка запускает `addOnPaste`. Отмена и ошибка чтения ничего не оставляют для следующего ввода.

На Android применяется публичный `contentReceiver` с `Source.Clipboard` и потреблением
обработанного содержимого. На Desktop/iOS Compose 1.12.2 этот API не реализован;
узкий локальный Clipboard adapter использует проверенное свойство state-based
BasicTextField этой версии: `getClipEntry` вызывается для Paste, доступность меню
проверяется через native metadata. Adapter сохраняет native clipboard и copy,
завершает вставку сам и возвращает null штатному Paste, чтобы исключить повторную запись.
Это зависимость от версии Foundation, а не универсальный публичный callback Paste.
При обновлении Compose нужно сохранить интеграционные проверки доступности меню и вставки.

Desktop integration подтверждает context-menu-open без чтения/вставки, меню Paste,
Ctrl+V, accessibility Paste, ровно одно чтение, same-text replacement, selection,
undo/redo, отмену/ошибку/пустой и нетекстовый clipboard, смену draft/выделения,
потерю и возврат фокуса, disable/re-enable, disposal и два перекрывающихся запроса.
Undo подтверждён для editor; история принятых controlled-меток принадлежит приложению.

Android instrumentation regression `tagsPasteWithAncestorReceiverInsertsExactlyOnce`
добавлен в существующий consumer и `verify-android-app.py`. Он проверяет обычную
вставку и addOnPaste при внешнем contentReceiver. Локальный Android SDK не настроен;
этот сценарий должен пройти в existing CI на API 33/35. iOS runtime здесь не запускался.

Независимый [поиск точной границы Paste](paste-research.md) и
[эксперимент undo/redo](paste-undo-experiment.kt) сохранены рядом. Эксперимент выполнен
исследовательницей с настоящим Foundation 1.12.2; продуктовые тесты повторяют его
существенные свойства через реальный editor.

Первоисточники: [TextFieldState](https://developer.android.com/reference/kotlin/androidx/compose/foundation/text/input/TextFieldState),
[state-based input](https://developer.android.com/develop/ui/compose/text/user-input),
[Clipboard](https://developer.android.com/reference/kotlin/androidx/compose/ui/platform/Clipboard),
[точный Foundation 1.12.2 source artifact](https://repo.maven.apache.org/maven2/org/jetbrains/compose/foundation/foundation-desktop/1.12.2/foundation-desktop-1.12.2-sources.jar),
[Combobox APG](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
