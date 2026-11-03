# Native evidence из GitHub runner

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

Для начального false проверяйте `identity.json.animation.expected: false`, SPI readback
и `process.animationsEnabled: false`, затем native кадры и функциональные результаты
того же запуска. Это не сценарий системного `true→false` во время движения:
наблюдение при запуске записывается один раз. `result.json.reducedMotion` остаётся
`not-qualified` до независимой приёмки с явно указанной областью вывода.

```powershell
node --test scripts/ci/evidence-log.test.mjs native/windows/test/evidence.test.mjs
pwsh -NoProfile -File native/windows/test/animation.test.ps1
pwsh -NoProfile -File native/windows/test/retarget.test.ps1
```
