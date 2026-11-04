# Native evidence из GitHub runner

`smoke.ps1` получает начальную геометрию семи кнопок примера до ввода. Полный
снимок хранится в `result.json.initialLayout`: PID и время процесса, фактические
`UISettings.TextScaleFactor`, `XamlRoot.RasterizationScale`, тема, границы страницы,
кнопок и видимых текстовых частей. Пример записывает его один раз после загрузки
и layout только при `LABUI_LAYOUT_OBSERVATION`; harness восстанавливает env.
Границы и исходные `FontSize`/`LineHeight` выражены в DIP; `LineHeight=0` означает
автоматическую высоту строки WinUI. Масштаб системного текста
нелинеен; читаемость и обрезка глифов проверяются отдельно по нативным снимкам.
Параметр `-ExpectedTextScale` при передаче требует точного значения OS API от 1 до
2.25; без него читается действующая настройка. Текущий smoke масштаб не меняет.
`layout.test.ps1` проверяет admission и полный readback без GUI; существующий
log-кодек сохраняет снимок внутри `result.json`.

После исходного `page-<Theme>.png` smoke снимает нижнюю группу отдельно в
`page-lower-Light.png` и `page-lower-Dark.png`, пока подпись доступности остаётся
«Включить кнопку». `LabButtonViewport` адресует существующий ScrollViewer.
Harness читает строковый `ScrollVerticalPercent`: UIA `NoScroll` (`-1`) означает
съёмку без прокрутки, исходный `0` — переход в bottom с ожиданием `100`, снимок,
возврат в top с ожиданием `0`. Остальные исходные значения и отсутствующие
данные завершают проверку ошибкой. Контракт `NoScroll` описан в
[требованиях UIA Scroll](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-implementingscroll).
Перед снимком проверяются три исходные подписи, видимость и границы кнопок внутри
viewport. Краткие состояния до съёмки, при съёмке и после возврата находятся в
`result.json.lowerControls`. Возврат завершается до прежних сценариев ввода и
записей. При отказе smoke прекращается и закрывает своё приложение. Целостность
глифов проверяется по PNG; эти снимки не квалифицируют движение.
Оба нижних PNG обязательны в общем наборе: теперь в idle передаются 16 файлов.
Для повторного декодирования исторического журнала нужен codec его source commit;
прежние журналы и manifests сохраняются без добавления новых снимков.

`text-scale.ps1 -Qualify` выполняет сценарий системного масштаба 225% через
штатную страницу Settings → Text size на `windows-2025`. Третий job матрицы
запускает один normal-motion smoke с `ExpectedTextScale=2.25`, без lifetime probe.
Без `-Qualify` harness только читает доступность страницы. До открытия Settings
общий `winapp.ps1` подготавливает CLI 0.7.1 в новом job-owned каталоге, проверяет
закреплённый архив и байты executable. Готовый receipt передаётся smoke без
повторной загрузки. До любых эффектов проверяется GitHub-hosted Windows.
URI `ms-settings:easeofaccess-display` не выдаёт
подтверждение создания нового PID, поэтому существующий SystemSettings в текущей
сессии означает `unavailable` без запуска и закрытия. После одного URI launch
нужны единственный новый процесс, его время старта, штатный путь и собственный
HWND. Это корреляция на одноразовом runner; параллельный запуск Settings извне
не покрывается. Неоднозначность не разрешает закрыть прежнее окно.

До запуска Settings отдельный короткий Windows PowerShell 5 child читает
`new UISettings().TextScaleFactor` через штатную WinRT metadata projection.
`systemTextScaleBefore` сохраняет значение OS API, PID/start time/session и время
чтения; ошибка getter останавливает сценарий до URI launch. Тот же API независимо
подтверждает 2.25 перед запуском Buttons и исходный масштаб после восстановления.

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

Содержимое может находиться в другом HWND, связанном с исходным popup. Reader
заново читает его `GW_OWNER`, native PID/thread, class, parent/root и геометрию.
Owner свежего Settings сам становится кандидатом; для внешнего owner выполняется
`EnumChildWindows` только этого ненулевого HWND, с пределом 128 обработанных окон.
Сохраняются число совпадений PID и до восьми их metadata; неоднозначность или
обрезанный обход не дают допуска. При отсутствии owner читается исходный HWND.
Имена классов, foreground и размер не используются для выбора. `contentRoot`
отделён от первоначального `window`, который остаётся единственной целью cleanup.
Перед UIA-чтением и после него
[`IsChild(owner, content)`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-ischild)
проверяет текущее членство дочернего HWND в subtree выбранного owner, включая
вложенных потомков. Старого результата enumeration или неизменных parent/root
самого кандидата недостаточно. Если content — сам owner, отдельного child нет.

Один Windows PowerShell 5 child получает `FromHandle(contentRoot)`, проверяет
UIA PID/HWND и читает marker страницы, Slider/RangeValue и Apply из одного
ControlView. Пределы: глубина 12, 512 узлов, 32 записи разрешённого inventory.
Обход sibling выполняется по одному; предел ограничивает чтение, а не только
готовый output. `tree` сохраняет count/depth/type counts и `hasMoreChildren`;
неполный обход не доказывает единственность controls и не даёт `available`.
Topology и UIA повторно наблюдаются в остатке общего 20-секундного бюджета после
URI launch; `samples` сохраняет время и результат каждой попытки. Нет отдельного
полного бюджета для каждой попытки. Неожиданный отказ provider останавливает опыт.

В отдельный
`RUNNER_TEMP/labui-native/text-scale-capability.json` и строку
`LABUI_TEXT_SCALE_CAPABILITY_JSON` попадают только Text size/Make text bigger,
Slider и Apply: разрешённые labels, UIA RuntimeIds, AutomationIds, PID/HWND и типы.
Имя и AutomationId нерелевантного Slider скрываются, его RangeValue не читается; сам Slider учитывается
для проверки единственности. Остальные тексты Settings не публикуются.
Schema version 3 хранит RangeValue внутри наблюдения того же Slider; внешнего
массива range или выдуманного CLI selector нет. `available` требует
видимую страницу, единственный доступный Slider с label Text size/Make text bigger, соответствующий ему настоящий
RangeValue с конечными minimum/maximum/value, `isReadOnly=false` и единственную
видимую кнопку Apply с InvokePattern. Кнопка может быть disabled до изменения
Slider; её фактическое состояние сохраняется.
В read-only режиме `available` подтверждает только доступность controls.
Другой язык Settings
или неподходящий SKU могут дать `unavailable` с конкретной причиной. Неожиданная
ошибка и отказ cleanup завершают шаг ошибкой, сохраняя диагностический JSON.

В qualification до dispatch сохраняются фактический Slider.Value, независимый
OS factor, content HWND/thread, owner HWND/PID/thread и AutomationIds. Возможный
эффект отмечается до вызова child, поэтому потеря ответа не отменяет восстановление.
Один PS5 child получает controls из bounded traversal того же подтверждённого
content HWND. Он вызывает только `RangeValuePattern.SetValue(225)`, требует точный
readback Slider.Value, ожидает enabled Apply и вызывает его `InvokePattern`.
Сохранённые references повторно проверяются перед действием; другой control,
pattern, HWND или координатный ввод не выбираются. SetValue, ожидание Apply,
Invoke и независимый OS readback делят общий бюджет 30 секунд. Округлённое значение,
timeout или отказ provider завершают сценарий ошибкой.

Smoke вызывается через `&` в отдельном script scope того же PowerShell и сохраняет
свой animation finally. Внешний finally восстанавливает наблюдённый исходный
Slider.Value с отдельным общим бюджетом 60 секунд. Независимый getter выполняется
также после ошибки restore. Если slider уже равен цели и Apply отключён, запись
пропускается, но OS readback остаётся обязательным. `restore.confirmed` означает
совпадение с исходным OS factor; ошибка action всё равно не даёт PASS. `error`,
`restoreError`, `restoreGetterError` и `cleanupError` сохраняются отдельно.

Apply и restore читают сохранённые content/owner HWND напрямую и проверяют
поколение Settings и текущий `IsChild`. Они не требуют, чтобы первоначальный
popup оставался жив, и не ищут замену исчезнувшему content HWND. Перевыборка
controls допустима внутри этого же root: RuntimeId не переносится между
операциями как постоянный идентификатор. Закрытие исходного popup выполняется
последним; исчезнувший HWND с Win32 `ERROR_INVALID_WINDOW_HANDLE` считается закрытым.

`qualification.smoke` связывает source/tree, app hash, PID/start time и SHA-256
точных байтов `identity.json`/`result.json`. Проверяются normal animation и
`initialLayout.textScaleFactor=2.25` из того же запуска. Эти файлы не переписываются.
`fontQualification=runtime-capture-awaiting-visual-review` оставляет проверку
читаемости, обрезки и анатомии S/M/L в обеих темах открытой до просмотра кадров.
`status=passed` относится к capture и восстановлению, а не к визуальной приёмке.

В [точном исходнике CLI 0.7.1](https://github.com/microsoft/winappCli/blob/e3cd0b94f3e7b776ac51ba0564f4908094e979b5/src/winapp-CLI/WinApp.UIAutomation/Services/UiAutomationService.cs)
`GetPropertiesAsync` читает ValuePattern, но не RangeValue. Кроме того, `inspect`
группирует дочерний HWND под GA_ROOT и допускает fallback при отказе
ElementFromHandle. Поэтому допуск страницы целиком читает PS5 child со штатной
UIAutomationClient.dll: [FromHandle](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement.fromhandle?view=netframework-4.8.1)
и [RangeValuePattern.Current](https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.rangevaluepattern.current?view=netframework-4.8.1).
Он удерживает process handle, проверяет start time/path/session и UIA root PID/HWND
до и после чтения, повторно сверяет native identity и связь окон. Эти проверки
не являются атомарной гарантией отсутствия HWND reuse. Команда передаётся через
`ProcessStartInfo.ArgumentList` и `-Command`, ответ — UTF-8. UTF-16 base64 полного
reader превысил бы лимит командной строки Windows. Новых пакетов и другого UI
driver нет. Reader можно удалить, когда квалифицированный CLI даст тот же
полный контракт чтения и identity без fallback.

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
`text-scale.test.ps1` проверяет guard, identity, bounded traversal, Apply с
первоначально disabled кнопкой, частичный эффект, ошибки smoke/restore/getter
и порядок cleanup без открытия Settings. Action body исполняется также в PS5
с inert references; настоящий OS getter только читает настройку. Фактическое
поведение provider и render/input при 225% проверяет завершённый hosted job.

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

CI запускает три сценария в отдельных одноразовых runner: **Windows Button** — normal,
**Windows Button · reduced motion** — начальный false, третий — normal при 225%.
Все выполняют те же сборку,
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
финального `pointer-out`. Длинное нажатие и два Space дают три
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

После двух записей и проверки 9 активаций lifetime-сценарий подготавливает
`LabButtonMedium`, начинает настоящее удержание и удаляет его при промежуточном
native pressed readback. Только после завершения команды указателя и
подтверждённого `Unloaded` harness возвращает тот же экземпляр, проверяет
`Loaded`, выполняет ещё одно удержание на 1000 ms с отпусканием внутри кнопки
и завершает probe. Счётчик
остаётся 9 при удалении и становится ровно 10 после возврата.

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
pwsh -NoProfile -File native/windows/test/viewport.test.ps1
pwsh -NoProfile -File native/windows/test/retarget.test.ps1
pwsh -NoProfile -File native/windows/test/lifetime.test.ps1
node native/windows/test/lifetime-probe.test.mjs
```

### Прерываемый Space

В каждой записи `rapid-space` отправляет четыре раздельных события системного
`SendInput`: down → up → down → up. Паузы 80/50/80 ms относятся только к тестовому
вводу. Они не вводят минимальное время показа pressed-слоя и сами по себе не
доказывают прерывание. Helper проверяет HWND/PID, foreground, исходное удержание
Space и модификаторов, число принятых событий; при отказе отпускает только своё
удержание. Настоящий ввод разрешён только в одноразовом GitHub hosted окружении.

`LABUI_SPACE_OBSERVATION=1` включает пассивный observer примера. Harness передаёт
фиксированные `arm Light`, `arm Dark` и `complete`
через stdin собственного дочернего WinExe; stdout/stderr читаются параллельно и
ограничены по объёму. Команды идут до и после жеста. Во время него приложение
сохраняет только bounded memory: native key/IsPressed/focus/Click и исходные
observations закреплённого pressed-канала LabMotion. EOF и выгрузка снимают
подписки; на завершение дочернего процесса действует прежний ограниченный cleanup.

Родительская Page наблюдает tunneling `PreviewKeyDown/PreviewKeyUp` до обработки
клавиши кнопкой. Обработчик только записывает память: прежние IsPressed, канал,
Position, последнюю наблюдённую пару Operation/NativeRequestId и границы чтения.
ObservationCount у каждого app event фиксирует префикс Motion observations,
известный при чтении, и связывает PRE с последующим requested/IsPressed/bubbling
даже при равных timestamps. Обработчик не меняет Handled, focus или анимацию и
не выполняет await/I/O.

`result.captures[theme].space` хранит весь trace, receipt SendInput и временные
границы команды. Общая шкала QPC связывает события приложения с вводом;
измеренные границы начала часов harness сохраняют неопределённость привязки к WGC.
Асинхронное чтение Position не объявляется атомарным снимком нажатия.
`space-observation.mjs` одинаково проверяет smoke и exporter: четыре клавиши,
два Click, актуальный канал и конечное состояние у нуля с допуском 0.001. Normal требует
перед первым up и повторным down движения прежнего запроса, отсутствия уже
наблюдённого idle и PRE Position вне существующих endpoint-допусков: 0.001 < q < 0.999,
а после последнего up — idle актуального запроса.
Это наблюдаемое старое состояние до обработки клавиши; асинхронный readback не
доказывает одновременное состояние compositor. Reduced сохраняет ту же PRE/native
цепочку и подтверждает Snap последней цели с Operation=0 через value или idle:
TryUpdatePosition из уже неподвижного состояния меняет координату без нового
перехода в idle. Незавершённое движение от него не требуется. Переполнение, потеря фокуса, пропуск фазы или старый
завершающий request отвергаются. Полные кадры остаются обязательными для визуальной
приёмки; trace не измеряет FPS. Старые журналы читаются своей версией source codec.

Локальные проверки не вызывают Win32 input: `space-input.test.mjs` исполняет
настоящий helper с подменённой OS-границей; `space-protocol.test.mjs` проверяет
реальный WinExe через pipes без создания UI и отсутствие test helpers в Compile-наборе SDK.
`space-probe.test.mjs` исполняет producer и его сериализацию на инертных границах;
порядок Windows tunneling он моделирует, а настоящий UI проверяет hosted-запуск.

### Отключение анимации во время движения

`-DynamicMotion` включает отдельную пробу только при начальном
`-AnimationsEnabled $true`. Normal job выполняет её после обычных взаимодействий
и lifetime: отключение до lifetime нарушило бы его требование наблюдать Animation.
Reduced и text-scale jobs эту пробу не запускают.

На той же кнопке в Dark начинается Space down. Проба требует промежуточный
native readback текущей Animation без уже наблюдённого idle, затем вызывает
закреплённый `ClientAreaAnimation.Write(false)` вне UI dispatcher. Нужны
процессное `UISettings.AnimationsEnabledChanged`, false readback и подтверждение
Snap к прежней цели 1 через native value/idle. Последующие up → down → up
должны дать Snap к 0 → 1 → 0, два Click и конечный released readback.
Запись `requested` сама по себе подтверждением не считается.

Prepare, setter и четыре события ввода расходуют общий бюджет 5 s. Промах
внутри перехода, timeout, старый request или неполный trace означают отказ
квалификации. Системный setter работает в собственном consumer; его завершение
подтверждается до восстановления исходной настройки, чтобы поздняя запись не
перезаписала restore. Cleanup сохраняет первичную ошибку и проверяет readback.
Настоящий системный ввод и setter допускаются только на disposable GitHub runner.

Полный trace находится в `result.json.dynamicMotion`; отдельная WGC-запись
`interaction-Dynamic` сохраняет MP4, каждый индексированный JPEG и временные
границы. `identity.json.dynamicMotionExpected` делает весь набор обязательным
для export/decode. Старые static trace проверяются прежним validator;
`dynamic-observation.mjs` проверяет новую историю и exporter связывает все три
записи общим clock origin. Локальные `dynamic-harness.test.ps1`,
`dynamic-observation.test.mjs`, producer и codec fixtures проверяют границы без
изменения пользовательской ОС. Hosted-результат этого сценария ещё не получен;
эти проверки не удостоверяют плавность, FPS или мгновенность Snap.
