# Native evidence из GitHub runner

`smoke.ps1` получает начальную геометрию семи кнопок примера до ввода. Полный
снимок хранится в `result.json.initialLayout`: PID и время процесса, фактические
`UISettings.TextScaleFactor`, `XamlRoot.RasterizationScale`, тема, границы страницы,
кнопок и видимых текстовых частей. Пример записывает его один раз после загрузки
и layout только при `LABUI_LAYOUT_OBSERVATION`; harness восстанавливает env.
Границы и исходные `FontSize`/`LineHeight` выражены в DIP. Масштаб системного текста
нелинеен; читаемость и обрезка глифов проверяются отдельно по нативным снимкам.
Параметр `-ExpectedTextScale` при передаче требует точного значения OS API от 1 до
2.25; без него читается действующая настройка. Текущий smoke масштаб не меняет.
`layout.test.ps1` проверяет admission и полный readback без GUI; существующий
log-кодек сохраняет снимок внутри `result.json`.

`text-scale.ps1` — конечный read-only эксперимент доступности штатной страницы
Settings → Text size на `windows-2025`. Он запускается после успешного native smoke
только в normal job и использует уже скачанный WinApp CLI 0.7.1. До любых эффектов
проверяется GitHub-hosted Windows. URI `ms-settings:easeofaccess-display` не выдаёт
подтверждение создания нового PID, поэтому существующий SystemSettings в текущей
сессии означает `unavailable` без запуска и закрытия. После одного URI launch
нужны единственный новый процесс, его время старта, штатный путь и собственный
HWND. Это корреляция на одноразовом runner; параллельный запуск Settings извне
не покрывается. Неоднозначность не разрешает закрыть прежнее окно.

До запуска Settings отдельный короткий Windows PowerShell 5 child читает
`new UISettings().TextScaleFactor` через штатную WinRT metadata projection.
`systemTextScaleBefore` сохраняет значение OS API, PID/start time/session и время
чтения; ошибка getter останавливает эксперимент до URI launch. Это будущий
независимый readback восстановления, не запуск Buttons или чтение реестра.

Перед прежним HWND admission `windowCandidate` сохраняет выбранные CLI HWND/PID,
owner HWND и className, а `windowDiagnostic` — результат
`GetWindowThreadProcessId` и обновлённый `Process.MainWindowHandle`. CLI включает
видимые top-level окна с owner; .NET main-window heuristic их исключает.
MainWindow остаётся диагностикой. Допуск проверяет живой creator PID выбранного
HWND и закрепляет creator thread; owned окно допустимо и при MainWindowHandle=0.
Native handle свежего Settings удерживается до завершения cleanup; поколение,
path/session и HWND→PID/thread повторно проверяются перед чтением и закрытием.
Отсутствие UIA inventory
после такого отказа ещё не устанавливает отсутствие страницы Text size.
Первичный отказ остаётся в `error`, ошибка закрытия отдельно в `cleanupError`.

Inspect ограничен этим HWND. В отдельный
`RUNNER_TEMP/labui-native/text-scale-capability.json` и строку
`LABUI_TEXT_SCALE_CAPABILITY_JSON` попадают только Text size/Make text bigger,
Slider и Apply: наблюдённые labels, selectors, AutomationIds и типы. Остальные
окна рабочего стола и тексты навигации не публикуются. `available` требует
видимую страницу, единственный доступный Slider с label Text size/Make text bigger, соответствующий ему настоящий
RangeValue с конечными minimum/maximum/value, `isReadOnly=false` и кнопку Apply.
Ничего не устанавливается и не применяется; `available` не подтверждает 225%,
политику системного текста или читаемость шрифта Button. Другой язык Settings
или неподходящий SKU могут дать `unavailable` с конкретной причиной. Неожиданная
ошибка и отказ cleanup завершают шаг ошибкой, сохраняя диагностический JSON.

В [точном исходнике CLI 0.7.1](https://github.com/microsoft/winappCli/blob/e3cd0b94f3e7b776ac51ba0564f4908094e979b5/src/winapp-CLI/WinApp.UIAutomation/Services/UiAutomationService.cs)
`GetPropertiesAsync` читает ValuePattern, но не RangeValue. Поэтому только
range-read выполняет отдельный Windows PowerShell 5 child со штатной
UIAutomationClient.dll: [FromHandle](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement.fromhandle?view=netframework-4.8.1)
и [RangeValuePattern.Current](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.rangevaluepattern.current?view=netframework-4.8.1).
Он удерживает process handle, проверяет start time/path/session и UIA root PID/HWND
до и после чтения, читает Slider descendants и возвращает UTF-8;
его команда передаётся как UTF-16 EncodedCommand. Новых пакетов и другого UI
driver нет. Reader удаляется, когда квалифицированный CLI предоставит эти getter.

Процессы CLI/reader/launcher имеют общий deadline для exit и stdout/stderr.
По истечении срока чтения отменяются штатным CancellationToken; cleanup проверяет
завершение обеих задач и освобождает свои readers/process handles. После повторной
проверки PID/start time/path/session/HWND/thread Settings получает единственный
`PostMessageW(WM_CLOSE)` на выбранный HWND — тот же Windows primitive, который
использует `.NET CloseMainWindow`, с явным адресатом. Disabled окно не закрывается.
Успешная отправка не доказывает закрытие: до пяти секунд наблюдаются выход процесса
либо исчезновение HWND; отказ/таймаут записывается в cleanupError без retry/kill.
Проверка HWND и отправка не атомарны; reuse между ними остаётся пределом этого
одноразового эксперимента без конкурентного внешнего управления Settings.
`text-scale.test.ps1` проверяет guard, подменённую границу cleanup и ложный
`available`, не открывая Settings. После hosted результата этот discovery
заменяется установкой/readback/restore в том же harness. Существующий native
payload, SDK и продуктовый код эта проверка не меняет.

`smoke.ps1` запускает собственное приложение и ввод только на одноразовом hosted
runner. После успешной проверки `evidence.mjs export` передаёт исходные снимки,
две полные MP4-записи, временные метки и все уникальные JPEG из индекса через полный
журнал job. Общий wire-кодек находится в
`scripts/ci/evidence-log.mjs`; allowlist и проверка native-файлов принадлежат этому
harness. Actions artifact storage не используется.

Перед запуском приложения harness сохраняет client-area animation, временно
устанавливает ожидаемый режим и проверяет readback. `-AnimationsEnabled` принимает
boolean и по умолчанию равен `$true`; `$false` проверяет запуск с выключенными
системными анимациями.
Параметр `-AnimationSettingsPath` указывает на
`test/windows/animation-settings.cs` из закреплённого в workflow LabMotion checkout.
Этот helper использует `SystemParametersInfoW` с `SPIF_SENDCHANGE`, без записи
в профиль. Guard GitHub-hosted выполняется до загрузки helper и изменения настройки.
В `finally`, после попытки закрыть собственное приложение, harness восстанавливает
исходное значение даже при ошибке capture или записи evidence. Ошибка закрытия
приложения не превращается в PASS. Подтверждение восстановления находится
в `close.json.animation`.

Пример читает `UISettings.AnimationsEnabled` после создания окна только при заданном
`LABUI_ANIMATION_OBSERVATION`. Harness передаёт новый путь для этого запуска;
пример атомарно публикует JSON с PID, временем Unix в миллисекундах и boolean.
Наблюдение включается в `identity.json.animation.process`. До первого ввода harness
требует совпадение PID, время внутри текущего запуска и логическое значение
`animationsEnabled`, равный ожидаемому режиму. В identity также остаются
`animation.expected`, исходная настройка, readback и SHA-256 helper.

CI запускает оба режима в отдельных одноразовых runner: **Windows Button** — normal,
**Windows Button · reduced motion** — начальный false. Оба выполняют те же сборку,
проверки отрисовки, ввода и захвата. Матрица передаёт boolean через `[bool]::Parse`,
чтобы строка `"false"` не превратилась в `$true`. Полный журнал каждого job
декодируется отдельно: смешивание normal/reduced создаёт повторные имена файлов.

Это наблюдение отдельного `UISettings` в процессе примера при запуске. Оно не
доказывает значение private cache конкретного `LabButton`, выбор ветки Animate/Snap
или неизменность настройки на протяжении записи. Проверка анимаций здесь не меняет
политику reduced motion библиотеки. Официальные контракты:
[UISettings.AnimationsEnabled](https://learn.microsoft.com/en-us/uwp/api/windows.ui.viewmanagement.uisettings.animationsenabled?view=winrt-26100),
[client-area animation](https://learn.microsoft.com/en-us/windows/win32/winauto/client-area-animation),
[SystemParametersInfoW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow).

Получите полный журнал завершённого job нужного режима и SHA checkout из run:

```powershell
gh api repos/Labpics-Team/labui/actions/jobs/JOB_ID/logs | Set-Content -Encoding utf8 native-job.log
node native/windows/test/evidence.mjs decode native-job.log CHECKOUT_SHA native-readback interaction
```

Для `pull_request` checkout обычно является synthetic merge SHA. Сверьте его
с проверяемым head/tree отдельно; decoder намеренно не заменяет identity.
`native-readback` должен быть новым каталогом. Decode проверяет последовательность
BEGIN/CHUNK/END, размеры, SHA-256, source во всех пакетах и `identity.json`, полноту
набора, PNG chunks/CRC, JSON результатов и завершение приложения. Identity включает
отдельные хеши apphost `Buttons.exe`, исполняемого consumer `Buttons.dll`, LabUI и
LabMotion. Только после
всех проверок создаются файлы и `manifest.json` с их хешами. Повреждённый или
обрезанный журнал оставляет визуальную приёмку открытой.

Режим задаётся явно: `interaction` требует Light/Dark hover, MP4, recorder result,
окно ввода, manifest, полный индекс и каждый уникальный JPEG из него. `idle`
поддерживает прежний набор из девяти PNG и пяти JSON, но отвергает результат,
объявляющий interaction captures: незаметно отбросить запись нельзя. API также
проверяет режим каждого нового log packet; прежние packets читаются только в `idle`.

Новые записи объявляют `result.json.gesturePattern: "cancel-drag"` и содержат
ровно пять жестов в каждой теме: `hover`, `pressed`, `rapid-space`, `cancel-drag`,
`pointer-out`. Для прежних записей без этой метки decoder требует исходные четыре
жеста без `cancel-drag`. Неизвестная метка, пропуск или перестановка жеста,
неверные аргументы отмены и непокрытый записью ввод отвергаются.

`cancel-drag` выполняет штатную команду WinApp CLI 0.7.1:
`ui drag LabButtonMedium LabActionResult --hold-ms 50`. Она удерживает кнопку
мыши при движении от проверяемой кнопки к тексту результата и отпускает её снаружи.
Harness проверяет, что отмена не добавила активацию, и повторяет проверку после
финального `pointer-out`. Длинное нажатие и три Space сохраняют свои четыре
активации. Аргумент `50` не задаёт полную длительность нажатия: CLI добавляет
собственные паузы и шаги движения. Контракт команды закреплён в
[исходнике 0.7.1](https://github.com/microsoft/winappCli/blob/e3cd0b94f3e7b776ac51ba0564f4908094e979b5/src/winapp-CLI/WinApp.UIAutomation/Input/MouseInput.cs#L121).

Ранний разворот подтверждает просмотр области кнопки: различимые кадры движения
к pressed, затем возврата до достижения установившегося pressed-вида из длинного
нажатия в той же теме. Если таких кадров нет, результат по этому свойству остаётся
INCOMPLETE. Номинальные паузы CLI, `changed` всего окна и неизменный счётчик этого
не доказывают; `result.json.retarget` остаётся `not-qualified` до отдельной приёмки.

Перед выводом первого packet измеряются и читаются все файлы. Лимиты: 4 MiB на PNG
или MP4, 1 MiB на JPEG или индекс, 16 Mi pixels, 2048 samples на запись,
256 KiB на JSON, 16 MiB всего payload и 64 MiB на полный читаемый журнал.
Превышение завершает экспорт ошибкой без частичного вывода или отбора кадров.
Диагностические файлы, исполняемые файлы и
скачанный инструмент в allowlist не входят. Скрипт не архивирует весь каталог.
Локальный failed smoke остаётся failed; отсутствие полного успешного набора
не превращается в транспортный PASS.

Эта передача подтверждает сохранность байтов и полноту записанного набора. MP4/JPEG
проходят структурную проверку контейнера/размеров; декодирование изображений выполняет
capture, а воспроизведение и визуальную приёмку — reviewer. Временные метки окна
относятся к командам harness, а не к точному времени событий приложения. Полная
запись доступна для просмотра, но сама доставка не подтверждает плавность,
производительность, real GPU loss, lifetime или reduced motion.

Normal job также передаёт `-Lifetime`. Этот switch по умолчанию выключен и
отвергается вместе с `-AnimationsEnabled $false`: удаление внутри перехода
требует наблюдённого движения. Harness задаёт новый `LABUI_LIFETIME_OBSERVATION`
перед запуском; без switch очищает возможное унаследованное значение. Исходное
значение переменной восстанавливается в существующем `finally`.

После двух записей и проверки 11 активаций lifetime-сценарий подготавливает
`LabButtonMedium`, начинает настоящее удержание и удаляет его при промежуточном
native pressed readback. Только после завершения команды указателя и
подтверждённого `Unloaded` harness возвращает тот же экземпляр, проверяет
`Loaded`, выполняет ещё одно удержание на 1000 ms с отпусканием внутри кнопки
и завершает probe. Счётчик
остаётся 11 при удалении и становится ровно 12 после возврата.

Пример создаёт служебные команды только при заданной переменной окружения;
в обычном запуске их группа остаётся незагруженной через штатный `x:Load`.
Доступ к двум private полям закреплённого LabButton используется исключительно
этим qualification consumer; публичный SDK не получает нового API. После
удаления старые каналы должны бросать `ObjectDisposedException` при чтении
`Position`, а hand-in visual должен отсутствовать. После возврата сравниваются
managed references каналов и container; это не проверка native COM identity.

Полный JSON процесса с PID, временем, счётчиками, Loaded/Unloaded events и
старым/новым motion trace включается в `result.json.lifetime`. Harness проверяет
типизированные значения, привязку к этому запуску, последовательность событий,
движение до удаления и после возврата, покой нового канала и записанное окно без
старых observations. Только тогда `motionLifetime` получает
`bounded-disposal-reuse`. Ошибка, пропущенные данные, переполнение, чужой PID или
таймаут не дают PASS. Прежний codec передаёт этот JSON без нового имени файла.

Последний readback и вызов удаления выполняются без промежуточной публикации
evidence. В JSON остаются отдельные monotonic границы чтения и удаления;
асинхронный Composition readback не называется атомарным состоянием в момент
отключения. После повторного подключения pressed должен вернуться к нулю;
idle callback, актуальный Position и повторная проверка после окна наблюдения
используют допуск 0.001 из [квалификации normalized Progress закреплённого Motion](https://github.com/Labpics-Team/lab-motion/blob/7a8bfbba3ead9f57743c0cbc6c3d2fe52d370121/native/windows/README.md#точность-прогресса).
`lifetime-probe.test.mjs` исполняет настоящие тела этой границы с подменой
публикации и каналов: задержанная запись, idle(1), дрейф во время окна и законный
возврат к нулю. Это проверка oracle; она не подменяет hosted WinUI запуск.

Такой результат ограничен данной историей удаления и повторного подключения.
Он не доказывает отсутствие managed/native/GPU leaks, освобождение каждой
COM-ссылки, исход скрытых async-ожиданий или отсутствие любых будущих callbacks.
Существующие кадры относятся к предшествующим взаимодействиям: визуальная съёмка
самого удаления этой проверкой не объявляется выполненной.

Для начального false проверяйте `identity.json.animation.expected: false`, SPI readback
и `process.animationsEnabled: false`, затем native кадры и функциональные результаты
того же запуска. Это не сценарий системного `true→false` во время движения:
наблюдение при запуске записывается один раз. `result.json.reducedMotion` остаётся
`not-qualified` до независимой приёмки с явно указанной областью вывода.

```powershell
node --test scripts/ci/evidence-log.test.mjs native/windows/test/evidence.test.mjs
pwsh -NoProfile -File native/windows/test/animation.test.ps1
pwsh -NoProfile -File native/windows/test/retarget.test.ps1
pwsh -NoProfile -File native/windows/test/lifetime.test.ps1
node native/windows/test/lifetime-probe.test.mjs
```
