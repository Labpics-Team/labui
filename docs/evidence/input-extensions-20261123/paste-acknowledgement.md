# Подтверждение принятой вставки в Tags

Native Compose run [45061748503](https://github.com/Labpics-Team/labui/actions/runs/45061748503),
source `295e688203d4a3f2256f0126aee13f60d1ca706c`, выявил две разные причины отказа.

На macOS тест посылал Ctrl+V. Штатный Foundation 1.12.2 выбирает
`commonKeyMapping(KeyModifiers.Meta)` для macOS; реальное сочетание — Command+V.
Прямая accessibility PasteText в том же тесте работала. Fixture теперь выбирает
модификатор платформы и по-прежнему проверяет одну clipboard read, принятие
значений, очистку draft, undo/redo и замену выделения.

На Android API 33 и 35 вставка выполнялась ровно один раз и приложение принимало
`[three, four]`, но редактор сохранял `three,four`. Послетестовый PNG и XML
из `native-android-example-33` показывали одновременно chips и draft;
последнее слово было снова выделено как IME composition. Поэтому это не
раннее чтение тестом: ожидание окончания композиции в acknowledgement
оставляло уже принятый текст в редакторе.

`commit()` допускается только вне активной IME. Подтверждение уже созданного
запроса проверяет равенство принятого списка и неизменность его draft.
Повторная IME-пометка этого же текста не отменяет факт принятия. Условие
`state.composition == null` удалено только из acknowledgement. Если пользователь
изменил текст, прямое сравнение с `pending.draft` защищает новый ввод ещё до
запуска наблюдателя изменений. Отклонённый список по-прежнему не очищает draft.

Детерминированный тест через настоящий `PlatformTextInputMethodRequest`
посылает `SetComposingRegionCommand` между paste и принятым controlled value.
До исправления он воспроизводит `expected empty, actual first,second`.
Соседний сценарий вводит новое `first,third` через IME и требует сохранить
этот текст и composing range при запоздавшем принятии прежней вставки.
Исходные Android assertions не ослаблялись и ожидания не добавлялись.

Источники: [Foundation 1.12.2 sources](https://repo.maven.apache.org/maven2/org/jetbrains/compose/foundation/foundation/1.12.2/foundation-1.12.2-sources.jar),
`text/KeyMapping.skiko.kt` и `text/input/internal/selection/TextFieldSelectionState.kt`;
[Apple: copy and paste](https://support.apple.com/en-us/102553).
