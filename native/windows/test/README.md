# Native evidence из GitHub runner

`smoke.ps1` запускает собственное приложение и ввод только на одноразовом hosted
runner. После успешной проверки `evidence.mjs export` передаёт исходные снимки,
две полные MP4-записи, временные метки и все уникальные JPEG из индекса через полный
журнал job. Общий wire-кодек находится в
`scripts/ci/evidence-log.mjs`; allowlist и проверка native-файлов принадлежат этому
harness. Actions artifact storage не используется.

Получите полный журнал завершённого **Windows Button** job и SHA checkout из run:

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

```powershell
node --test scripts/ci/evidence-log.test.mjs native/windows/test/evidence.test.mjs
```
