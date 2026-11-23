# File Upload в Compose

`LabFileUpload` выбирает файлы через системный диалог FileKit 0.17.1. Компонент возвращает
`PlatformFile`; отправку и чтение содержимого выполняет приложение. Дополнительной
инициализации для Compose launchers FileKit не требуется.

```kotlin
var files by remember { mutableStateOf(emptyList<PlatformFile>()) }

LabFileUpload(
    value = files,
    onValueChange = { files = it },
    label = "Документы",
    variant = LabFileUploadVariant.Area,
    multiple = true,
    accept = listOf(".pdf", ".docx"),
    maxFiles = 5,
    maxFileSize = 20L * 1024 * 1024,
)
```

`Input` — компактный вариант по умолчанию; `Area` — большая область. Размеры
`Small`, `Medium`, `Large` меняют компактный вариант: 40, 48, 56 dp при обычном
масштабе текста. Длинные имена переносятся, системный размер шрифта увеличивает
высоту. `labelHidden` скрывает видимую подпись, сохраняя доступное имя.

## Выбор и ограничения

- `value` полностью управляется приложением. `onValueChange` запрашивает изменение;
  если приложение его не приняло, прежние файлы остаются видимыми.
- Одиночный выбор заменяет список. `multiple = true` добавляет файлы. Повтор
  имени, размера и MIME-типа отклоняется, включая повтор внутри одной пачки.
- Отмена диалога, пустая и полностью отклонённая пачка сохраняют список.
  Превышение `maxFiles` отклоняет всю новую допустимую пачку без частичного добавления.
- `accept` принимает расширения с точкой, MIME-типы и группы, например
  `listOf(".pdf", "image/*")`. Проверки расширения и типа работают как альтернативы.
  MIME-тип приходит от платформы; компонент не определяет его чтением содержимого.
- `minFileSize` и `maxFileSize` заданы в байтах. Неизвестный размер не равен нулю:
  при заданной границе размера файл получает `UnknownSize`; без границы принимается.
- Папки и ошибки чтения метаданных отклоняются. Метаданные читаются на `Dispatchers.IO`
  с FileKit security-scoped access. Ни для проверки, ни для рисунка файлы целиком не читаются.
- `onReject` сообщает файл, имя и `LabFileUploadRejectReason`. Причины видны под
  компонентом и объявляются через live region. `error` приложения имеет приоритет.
- `enabled = false` и `readOnly = true` блокируют picker, drop и удаление. `helper`
  объясняет допустимые файлы. Все действия и причины локализуются через
  `LabFileUploadStrings`.

## Поддержка платформ

| Платформа | Системный выбор | Внешнее перетаскивание |
|---|---|---|
| JVM desktop: Windows, macOS, Linux | FileKit | Compose `dragAndDropTarget`, AWT file list |
| Android | FileKit Compose launcher | Compose `dragAndDropTarget`, URI и разрешение Activity |
| iOS | FileKit document picker | Не включено; интерфейс предлагает выбрать файлы |

Android-разрешения внешнего drop удерживаются, пока хотя бы один его URI присутствует
в выбранных или проверяемых файлах. Удаление последнего URI или уход компонента
освобождает разрешение. Для фоновой работы после удаления/ухода приложение заранее
переносит файл в своё хранилище; ссылки выбранного списка сами по себе не являются
постоянным разрешением. На Apple приложение использует FileKit scoped access при
собственном чтении вне sandbox.

iOS `NSItemProvider` может возвращать временную копию. Apple требует координировать
доступ и разрешает удалить копию после его окончания; одного сохранённого URL
недостаточно для безопасного `PlatformFile`. Поэтому drag/drop iOS не заявлен.

## Авторский вид и проверки

Геометрия и роли берутся из общего `packages/tokens/src/components.json` через
`LabComponents`. Иллюстрации хранятся в `assets/file-upload`, затем генерируются
в Compose resources. Рамки иллюстраций и размеры bitmap различаются: тени выходят
за рамку, их нельзя ужимать через `ContentScale.Fit`. Compact file glyph использует
точный контур авторского SVG, преобразованный генератором в Android Vector XML.
`drag-background.png` сохраняет авторскую диагональную штриховку Vector; это рисунок
из Figma, а не свечение или радиальный градиент.

`FileUploadTest` проверяет отмену, ограничения, дубликаты, неизвестный размер и
метаданные настоящего FileKit handle. `FileUploadAsyncTest` приостанавливает metadata
через `CompletableDeferred`: повторный drop сохраняет обе пачки, а смена ограничения
не позволяет опубликовать результат по старым правилам. `FileUploadRenderTest` проверяет управляемое
удаление, Enter, disabled, все пять состояний области, компактные S/M/L и узкий экран
при 200% в тёмной теме. Платформа без drop показывает инструкцию системного выбора.
Снимки сохраняются в `build/file-upload-evidence`. Тесты не открывают системный диалог.

```powershell
$env:SKIKO_RENDER_API = 'SOFTWARE'
$env:JAVA_TOOL_OPTIONS = '-Djava.awt.headless=true'
./gradlew.bat :desktopTest --tests 'pics.lab.ui.FileUpload*'
```

Первоисточники: [FileKit picker](https://filekit.mintlify.app/dialogs/file-picker),
[FileKit 0.17.1](https://github.com/vinceglb/FileKit/tree/0.17.1),
[Compose drag/drop](https://kotlinlang.org/docs/multiplatform/compose-drag-drop.html),
[Android permissions](https://developer.android.com/develop/ui/compose/touch-input/user-interactions/drag-and-drop),
[Apple in-place URL](https://developer.apple.com/documentation/foundation/nsitemprovider/loadinplacefilerepresentation(fortypeidentifier:completionhandler:)).
