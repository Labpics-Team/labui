# Lab Icons внутри установленного Lab UI

`icons-packed.mjs` собирает отдельное приложение с двумя настоящими `lab-button`:
Outline и Filled авторского `reload`. Публичный Lab Motion исполняет данные жеста
`reload.cycle`; приложение использует только публичные package entrypoints.
Schema2 добавляет один button со `status-circle`: шесть авторских Outline знаков
внутри одной сохраняемой оболочки, select состояния и доступный текст приложения.
Schema3 добавляет `expression-face`: спокойствие, грусть и улыбку с двумя
сохраняемыми глазами и оболочкой. Все три выражения показаны в 16, 24 и 48 px.
Обе группы используют один consumer executor и публичный state effect contract.
Публичный `sequence` Lab Motion исполняет opacity stages с явным первым кадром
из видимой позы; новый control создаётся до остановки прежнего. Reload остаётся
в том же приложении.
Schema4 сохраняет те же визуальные сценарии и замыкает runtime-зависимости Lab UI.
Harness принимает пять готовых архивов и независимые авторские references. Он не
клонирует producer-репозитории и не собирает их вместо владельцев пакетов.

## Запуск

Штатный запуск — [icons-consumer.yml](../../../.github/workflows/icons-consumer.yml)
на стандартном GitHub-hosted `ubuntu-latest` в закреплённом контейнере Playwright.
Для harness нужны Node ≥22.19, зависимости `apps/docs` и Chromium;
workflow готовит их в контейнере. Harness проверяет `GITHUB_ACTIONS`, `CI`,
`GITHUB_RUN_ID` и `RUNNER_ENVIRONMENT` до установки пакетов и запуска браузера.
Локальные проверки работают с исходниками без имитации Actions runner.

```sh
node apps/docs/tests/icons-packed.mjs \
  --icons-tarball /artifacts/labpics-icons.tgz \
  --ui-core-tarball /artifacts/labpics-ui-core.tgz \
  --ui-materials-tarball /artifacts/labpics-ui-materials.tgz \
  --ui-tokens-tarball /artifacts/labpics-ui-tokens.tgz \
  --ui-shadow-tarball /artifacts/labpics-ui-shadow.tgz \
  --subject /artifacts/icons-subject.json \
  --out /artifacts/icons-consumer-result
```

`--out` должен быть новым каталогом вне checkout; его родитель уже существует.
Необязательный `--browser-channel chrome` выбирает установленный browser channel.
По умолчанию используется Chromium Playwright. Проверка установленных пакетов
Lab UI исполняется в CI Lab UI.

Workflow получает точный head Lab UI и Icons commit из
`icons-consumer-source.json`, затем вызывает
`browser-check.sh --icons-consumer <icons-checkout>` в своём контейнере. Helper
работает с этими checkout напрямую. Corepack выбирает их `packageManager`;
зависимости устанавливаются с `--frozen-lockfile`. Icons проходит обычный `pack`
с `prepack`; Lab UI собирает runtime-зависимости core и упаковывает
core/materials/tokens/shadow.

Inputs и результат сохраняются в `$RUNNER_TEMP/labui-icons.XXXXXX`, вне checkout.
`prepare-icons-inputs.mjs --summarize` получает исходный exit status consumer
и выводит measurement, PNG и receipt в job log. Helper завершается с этим статусом;
workflow не загружает диагностику в Actions artifact storage.

## Входной reference

Текущий JSON имеет `schemaVersion: 4`, `packages`, `authorReference` и
`stateReferences` с двумя обязательными ключами: `status-circle` и `expression-face`.
Schema3 сохраняет прежний набор из трёх архивов. Schema2 сохраняет прежний `stateReference` только для status-circle. Schema1
сохраняет cycle reference и исполняемый путь reload без state reference.
Одновременное присутствие старого и нового state полей получает отказ.

| Поле | Содержимое |
|---|---|
| `packages.icons` | Архив `@labpics/icons` |
| `packages.uiCore` | Архив `@labpics/ui-core` |
| `packages.uiMaterials` | Архив `@labpics/ui-materials` |
| `packages.uiTokens` | Архив `@labpics/ui-tokens` |
| `packages.uiShadow` | Архив `@labpics/ui-shadow` |
| Каждый пакет | `name`, `version`, `archiveSha256`, `archiveBytes`, `sourceCommit`; в schema4 также `runtimeDependencies` |
| `authorReference` | `fileName`, `fileKeySha256`, `version`, `icons.reload` |
| `icons.reload` | Ровно `outline` и `filled` |
| Каждый variant | `sourceFile`, `author`, `anatomy`, `viewBox`, `paths`, `parts`, `gesture` |
| Каждый state reference | `group`, `variant`, `defaultState`, `enclosurePartId`, `enclosure`, `states`, `proof` |
| `expression-face` | Также `sharedPartIds` и упорядоченные `sharedParts` с `id`, `role`, `d`, `fillRule` |
| Каждый state | `id`, `partId`, `icon`, `contentPartIds`, `sourceFile`, `author`, `viewBox`, `dimensions`, `paths` |
| `proof` | Закон, Figma source, hashes полной enclosure identity и semantic spec; для shared anatomy также `sharedPartsSha256` |

`runtimeDependencies` фиксирует `dependencies`, `optionalDependencies` и `peerDependencies`
исходного manifest после преобразования `workspace:*`, `workspace:^` и `workspace:~`
в публикуемый диапазон по правилам [pnpm pack](https://pnpm.io/workspaces).
Каждая runtime workspace-зависимость должна иметь архив среди входов; build-only
зависимости туда не входят. Неизвестный workspace-диапазон получает явный отказ.
Manifest каждого snapshot-архива сверяется до npm install, установленный manifest
и обязательный lock integrity — после установки. Недостающий архив не заменяется
случайным пакетом из registry.

`fileName` указывает текущий Lab UI v2.1. `sourceFile` имеет вид
`masters/figma/<version>/Outline/reload.svg` или `Filled/reload.svg`.
`author` — публичная проекция проверенного receipt Figma: `kind: "figma"`,
`fileKeySha256`, `version`, `nodeIdSha256`,
`nodeSha256`, `masterSha256`, `normalizedSha256`, `pathFingerprintSha256`.
`anatomy` — точный version-1 receipt принятой авторской аннотации, включая
`annotationSha256`, `masterSha256`, `pathFingerprintSha256`.

Подготовка читает raw manifest и masters в памяти, сверяет их происхождение
с закреплённым источником и проверяет геометрию. В публичных JSON и сообщениях
идентификаторы файла и узла заменены SHA256; хеши исходных файлов и значения
oracle сохраняются. Повторные decoded JSON keys получают отказ до `JSON.parse`.
Публичная ссылка на эталон ведёт в Figma Community.

`viewBox` — четыре конечных числа. `paths` — упорядоченные `{d, fillRule}` из
raw author master. Независимый reader принимает нейтральные группы и явно
замкнутые paths, включая контрформы; cycle witness дополнительно требует один
целый path с одним контуром. Transform, opacity, clip, неизвестные paint
и неподдержанный XML получают отказ. Авторский `d` не переписывается. `parts` — упорядоченные
`{id, role, zIndex, fillRule, d}` из авторской аннотации этого master. Harness
самостоятельно проверяет fingerprint упорядоченных `{index, d, fillRule}` через
SHA256 JSON с отсортированными ключами и затем сравнивает эти значения с
установленным пакетом и реальным DOM.

`gesture` — точная принятая декларация `reload.cycle` с `partIds`,
`progress: "normalized-0-to-1"` и rotation tracks. Track содержит `partId`,
`kind: "rotate"`, `anchor`, `from`, `to`, `unit: "degrees"`,
`interpolation: "linear"`. Oracle независимо выражает `cycle.clockwise` из raw
аннотации: один `control` part, canvas-center `[0.5, 0.5]`, оборот `0 → 360`.
Private producer helpers, generated glyph и `compileSymbolEffect` не участвуют
в построении expected. Harness сравнивает anchor,
transformOrigin и endpoints с этой независимой декларацией.

`stateReference` независимо читает `semantics/author-state-groups.json` и шесть
точных raw masters из того же Figma manifest. Все states имеют viewBox 24 и
размеры 24; enclosure занимает последнее место в каждом master и совпадает по
точному `d`, fill-rule, paint и рамке. Interior paths сохраняют исходный порядок;
IDs берутся из versioned spec. Reference не импортирует compiler или helpers
производителя. В Lab UI нет отдельной редактируемой таблицы геометрии. Source
receipt добавляет hash semantic spec и каждого прочитанного master.

После фиксации raw references и `subject.json` та же prepare-inputs граница
запускает producer `scripts/measure-platform-artifacts.mjs --output ...` после
штатного pack. Запуск разрешён только в GitHub Actions с официальной runner identity.
`--update` не передаётся:
candidate policies и `policyViolations` остаются диагностикой, принятие лимитов
принадлежит Icons. Отчёт `inputs/platform-measurement.json` содержит полный
release contract census, raw/gzip/brotli и hashes artifacts, consumer metrics,
среду, методы и candidate policies. Source receipt связывает его bytes/hash с
точным Icons SHA, lockfile и программой/её исходными материалами. Отсутствующий,
изменённый или относящийся к другому SHA report получает отказ.

Готовьте reference из закреплённого Figma manifest/master и проверенной аннотации,
**до чтения установленного glyph**. Генерация ожидаемого результата из того же
пакета уничтожает независимость проверки. Авторская геометрия не хранится второй
редактируемой таблицей в Lab UI.

После проверки SHA256 и размера архивные bytes записываются через `wx` в новый
собственный snapshot consumer. Snapshot повторно проверяется; npm получает
только эти пути. Последующее изменение исходного архива не меняет вход установки.
Receipt сохраняет SHA256, размер и SHA512 integrity snapshot; присутствующий
installed npm lock integrity обязан совпасть. Отсутствие lock integrity явно
сохраняется как `null`, а не считается независимым подтверждением npm.
`sourceCommit` сохраняется как утверждение producer; доказательство того, что архив собран из этого SHA,
должно поступить из build/release evidence producer. Версия в `package.json`
сама этого не доказывает. Motion устанавливается как точный публичный
`@labpics/motion@0.5.0`, а его dependency integrity сохраняется в npm lockfile.

## Что проверяется

Временный npm-consumer находится вне workspace. Установка выполняется с
`--ignore-scripts`, без aliases и ссылок на producer source. Rollup module graph
обязан разрешаться внутрь этого consumer и содержать реальные button, reload и
Motion. Импорты чужих публичных symbols и whole IR entrypoints отвергаются.
Schema2 также требует вклад публичного `@labpics/icons/states/status-circle`.
Schema3 требует вклад обоих state entries, включая
`@labpics/icons/states/expression-face`; отсутствие одного не сокращает проверку.
Проверка не фиксирует частное размещение его implementation; полный retained
module graph сохраняется для проверки отсутствия catalog/authoring owners.
Button, reload и Motion разрешаются bundler-ом по публичным entrypoints
установленных пакетов. В bundle требуется вклад их import-closure: перенос файлов
при сохранённых exports и удаление пустого reexport facade не ломают проверку.
Фактические resolved entries сохраняются в receipt; чужие публичные symbols и
whole IR entrypoints получают отказ независимо от расположения файлов.
Частные имена файлов не определяют символ или catalog. Размеры полного приложения
записываются в receipt; ограничения стоимости отдельных Icons imports проверяет
сам producer в своём consumer-size gate.

Браузер проверяет оба начертания: точные контуры, fill-rule, порядок и part IDs,
receipt Figma/anatomy, доступное имя «Обновить», native target 48×48, декоративный
icon slot, pointer по иконке и свободной части target, Enter/Space, trusted composed
click через native button и отсутствие submit. Посторонний overlay должен блокировать
pointer action без единого native click.

В закреплённом Playwright 1.55.1 hit-testing не следует `assignedSlot` и ошибочно
считает декоративный SVG преградой для внутренней кнопки. Обычный pointer-click
на host сохраняет actionability; доступное имя и клавиатура проверяются на native
button, а каждый click обязан пройти его обработчик и composed path.
Исправление observer находится в [Playwright #37777](https://github.com/microsoft/playwright/pull/37777).
Повторный ввод передаёт движение новому scalar target. Отдельный reversal
принимается из наблюдаемой промежуточной позы; transform до/после передачи
сравнивается в одном browser task. Конечная поза проверяется после публичного
`Playback.finished` с `status: "finished"` и двух кадров; зависание получает
точный timeout, cancellation не засчитывается завершением. Это не обещание C1
continuity или compositor-only execution.

Прямой полный оборот отдельно обязан закончиться в авторской позе **до**
инициализации нового оборота. `status: "finished"` без правильной конечной позы
не проходит проверку; сброс следующего жеста не может скрыть ошибку исполнителя.

При reduced motion compiler выдаёт нулевую длительность, и конечная поза остаётся
верной. Движение одного экземпляра не меняет SVG соседа и authored path data.
Непринятая weight axis получает `AUTHOR_PARITY_REQUIRED`, чужой morph —
`GESTURE_UNSUPPORTED`. Cleanup останавливает controls, удаляет mounted кнопки и
проверяет отсутствие running native animations.

State consumer сравнивает все static SVG endpoints каждой группы с независимым reference,
точные content paths и countershapes всех mounted групп, один enclosure, размеры
и stable IDs. `stateCapabilities()` и экспорт `web-effect` сверяются с семантикой
группы. Отдельный сценарий ставит публичный playback на паузу в видимой смеси,
проверяет отсутствие движения на двух кадрах, продолжение, обратный ход и новое
намерение. Consumer передаёт Motion публичные пары `[видимая opacity, цель]`,
сохраняя исходный снимок до admission. Передача сравнивает opacity до/после
в одном browser task; третье намерение сохраняет три одновременно видимых знака.
После завершения проверяется
one-hot конечная поза. Select и native Lab UI button управляют состоянием; текст
status и доступное имя принадлежат приложению. Reduced motion завершает целевую
позу с duration 0. Cleanup прерывает ещё активный переход и удаляет DOM; `stopped`
при disposal не выдаётся за `finished`. Filled, неизвестное состояние, null request
и неподдержанные transition formats получают точные отказы.

В expression-face меняется только рот. Оба глаза и оболочка должны присутствовать
ровно один раз вне state groups, сохранять authored contours, opacity 1,
transform `none` и исходные DOM nodes во время паузы, reversal и нового намерения.
Raw oracle отвергает изменённый или переставленный глаз даже после пересчёта
hashes master и manifest. Все девять static samples сверяются с raw geometry;
screenshots сохраняются для визуального просмотра. Масштабирование здесь не
объявляет optical axis или live Figma parity.

## Результаты и ограничения

Результат сохраняет `receipt.json` с фазой отказа, observations и browser errors;
при ошибке — также `failure.json` и screenshot соответствующего режима. Рядом остаются npm log,
dependency tree, lockfile, module graph, raw/gzip/brotli размеры и SHA каждого
bundle file, сами browser bundles и screenshots двух режимов. Запись содержит
SHA harness, checkout SHA, dirty state, Node, browser и идентичность runner.
Browser/server закрываются; удаляется только собственный временный consumer.

Размер относится к полному приложению с Lab UI и Motion: schema1 содержит две
reload кнопки; schema2 также содержит status-circle и select состояния; schema3
добавляет expression-face с select и девятью static samples. Этот
маршрут не измеряет baseline speedup, стоимость одиночного статического импорта,
публикацию npm или оптическую приёмку всего корпуса. Для этих утверждений нужны
соответствующие producer/benchmark/visual evidence. Наличие harness без успешного
remote receipt не означает пройденную интеграцию.

Вызывающий скрипт передаёт наблюдаемый exit status `icons-packed` через
`--summarize <directory> --consumer-exit-code <0..255>`; функция `summarize`
принимает тот же код вторым аргументом. Пропущенный или некорректный код вызывает
отказ до публикации. PASSED требует кода `0` и успешного receipt без FAILED маркера.
Ненулевой код задаёт FAILED для диагностического readback даже при ранее записанном
PASSED receipt или отсутствии маркера. Ошибка summarize не заменяет исходный
ненулевой статус.

`--summarize` также выводит полный report стандартным
[gzip](https://nodejs.org/api/zlib.html#zlibgzipsyncbuffer-options) и base64 блоком
в stdout, без нового Actions artifact storage. `LABUI_ICONS_PLATFORM_MEASUREMENT_BEGIN`
содержит encoding, source SHA, исходный digest/размер, compressed size и число
частей. Строки `LABUI_ICONS_PLATFORM_MEASUREMENT_CHUNK <index> <base64>` имеют
последовательные индексы и не более 4096 base64 символов. `..._END` повторяет digest.
Для восстановления из полного job log проверьте наличие всех индексов и END,
соедините base64, декодируйте и gunzip, затем проверьте исходный размер и SHA256.
Неполный блок не является report. Schema1 не требует measurement packet.

Тот же код передачи выводит PNG двумя режимами и полный успешный `receipt.json`
с реальными observations. PNG сохраняет исходные байты; пересэмплирования нет.
Блоки `LABUI_ICONS_CONSUMER_VISUAL` и `LABUI_ICONS_CONSUMER_RECEIPT` используют
тот же порядок BEGIN/CHUNK/END и gzip-base64. Metadata добавляет `file`,
`sourceSha` Icons и `uiCommit`; digest называется `pngSha256` или `receiptSha256`.
У PNG также есть исходные `width`/`height`. Допускаются только `result/receipt.json`
и screenshots `no-preference`/`reduce`, включая их `-failure` варианты.
Каждый передаваемый файл ограничен 4 MiB, PNG — 16 Mi pixels. Эти пределы
относятся к readback, а не к размеру glyph или optical domain.

После восстановления проверьте оба source SHA по RESULT, затем digest и размер
по соответствующему элементу `files`. Gunzip должен иметь `maxOutputLength`
4 MiB; отсутствие части, чужой SHA или несовпадение bytes запрещает использовать
packet как evidence. PNG signature/IHDR/IEND guards ограничивают вход; реальный
просмотр decoder остаётся отдельной проверкой изображения. Raw receipt передаётся
только для `passed`; неуспешный RESULT сохраняет прежний ограниченный failure
и continuity witness. Отказ отдельному packet сохраняет RESULT с
`readbackFailure: { code: 'EVIDENCE_REFUSED', file }` и завершает шаг ошибкой.
Наличие PNG не объявляет live Figma parity.

`summarize` дожидается завершения записи полного блока и RESULT перед отказом
по неуспешному receipt. При ошибке stdout возвращается исходная причина согласно
[контракту Node Writable](https://nodejs.org/api/stream.html#writablewritechunk-encoding-callback).

Основание runner guard: [GitHub default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables).
Принятый packed-consumer маршрут: Lab UI PR #191, SHA
`846b2bac2b46b0628679e18d39e4d024e01778e0`.
