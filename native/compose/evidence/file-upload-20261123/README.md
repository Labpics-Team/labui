# File Upload — Compose, 23 ноября 2026

Снимки получены `FileUploadRenderTest` через `ImageComposeScene`, software Skia,
`java.awt.headless=true`. Geist, LabText, LabButton, LabComponents и реальные Compose
resources используются без подмены. Окна и системные диалоги не открывались.

Первоначальный набор из десяти тестов прошёл: четыре проверки выбора/метаданных,
две проверки асинхронного приёма и четыре проверки семантики/рендера. После правки
композиции повторно прошли все пять проверок `FileUploadRenderTest`, включая новую
проверку списка: каждое имя показано один раз, имена выровнены, удаление принадлежит
той же группе и находится внутри её границ, оба файла действительно удаляются.
Снимки `input-multiple-dark` и `area-multiple-dark` показывают этот результат.
`secondDropWhileMetadataIsSuspendedRetainsBothBatchesAndPendingReferences` сохраняет
обе пачки и ссылки разрешений при повторном drop; `changingConstraintsWhileMetadataIsSuspendedCannotPublishTheOldPolicyResult`
не допускает публикацию результата по старому лимиту. Оба теста приостанавливают
metadata через `CompletableDeferred`, затем читают метаданные настоящих FileKit handles.
Различимость проверена: временное отключение накопления pending и сверки текущего
лимита дало ровно два падения этих тестов; после восстановления обеих защит целевой
набор снова прошёл.
`area-{default,hover,selected,disabled,drag}` сняты в обеих темах;
hover получен событием указателя. `input-{small,medium,large}` проверяют высоты
40/48/56 dp. `area-narrow-dark-200` проверяет 280 dp, 200% шрифт и длинное имя.

Авторский источник: Figma `LuaiBd4anRi4DMZayKAnY2`, область `6178:10578`, hover
`6178:10696`, выбранный файл `7676:739`, drag `6178:10579`; compact M `6202:7221`,
выбранный M `6202:7252`. Figma использовалась только для чтения. Artwork экспортирован
с `contentsOnly: true`, чтобы вне бумажной иллюстрации сохранялась прозрачность.
Рамка иллюстрации и bitmap имеют разные размеры: тени не ужимаются в 128 dp.
Фон drag — точная авторская диагональная штриховка из Vector, сохранённая в
`assets/file-upload/drag-background.png`; градиент или свечение не добавлялись.

Изображения проверяют вид, а семантические действия — контролируемое удаление,
Enter, disabled и сообщения ошибок. Системный picker и реальный внешний OS drop
в этом прогоне не выполнялись. Их реализация использует FileKit 0.17.1 и официальный
Compose drag/drop API. Android и iOS требуют отдельной проверки на целевых runners.
На iOS поддержан picker; интерфейс не обещает drag/drop. Подробные ограничения
срока жизни URI перечислены в [справке компонента](../../docs/file-upload.md).

```powershell
$env:SKIKO_RENDER_API = 'SOFTWARE'
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
./gradlew.bat :desktopTest --tests 'pics.lab.ui.FileUpload*'
```

Проверка генератора из корня: `node scripts/generate-file-upload-artwork.mjs --check`.
Она сравнивает Web/Compose artifacts с исходными assets и не пишет файлы.
