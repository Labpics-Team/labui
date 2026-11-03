# Native evidence из GitHub runner

`smoke.ps1` запускает собственное приложение и ввод только на одноразовом hosted
runner. После успешной проверки `evidence.mjs export` передаёт девять PNG и пять
JSON через полный журнал job. Общий wire-кодек находится в
`scripts/ci/evidence-log.mjs`; allowlist и проверка native-файлов принадлежат этому
harness. Actions artifact storage не используется.

Получите полный журнал завершённого **Windows Button** job и SHA checkout из run:

```powershell
gh api repos/Labpics-Team/labui/actions/jobs/JOB_ID/logs | Set-Content -Encoding utf8 native-job.log
node native/windows/test/evidence.mjs decode native-job.log CHECKOUT_SHA native-readback
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

Лимиты: 4 MiB на PNG, 16 Mi pixels, 256 KiB на JSON, 16 MiB всего payload и
64 MiB на полный читаемый журнал. Диагностические файлы, исполняемые файлы и
скачанный инструмент в allowlist не входят. Скрипт не архивирует весь каталог.
Локальный failed smoke остаётся failed; отсутствие полного успешного набора
не превращается в транспортный PASS.

Эта передача подтверждает сохранность байтов. Визуальное соответствие проверяется
по восстановленным снимкам. Плавность движения, real GPU loss, lifetime и
reduced-motion требуют отдельных проверок; неподвижные PNG их не доказывают.

```powershell
node --test scripts/ci/evidence-log.test.mjs native/windows/test/evidence.test.mjs
```
