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
Schema4 добавляет `notifications` и `notifications-unread` в обоих начертаниях:
настоящие кнопки Lab UI и авторские SVG в 16, 24 и 48 px. Закон
`notification.ring` сдвигает только язычок; корпус и badge сохраняют свои контуры
и DOM nodes. Общий адаптер переводит публичный translation effect v3 в `sequence`.
Harness принимает точный набор runtime-архивов и независимые авторские references. Он не
клонирует producer-репозитории и не собирает их вместо владельцев пакетов.
Schema6 добавляет восемь circle-семейств: параметр толщины меняет только
внутренний просвет Outline. Авторский наружный контур и знак сохраняются; Filled
остаётся независимым исходным мастером. Обе формы показаны в 16, 24 и 48 px.
Schema7 добавляет `status-circle` и `playback-circle` с изменяемым общим
обрамлением. Geometry patch меняет только `d` неподвижной общей части во время
приостановленного перехода; исходные nodes, видимая смесь и исполнение сохраняются.
Проверяются новое состояние, обратный ход, reset, reduced motion, точный отказ
Filled и экспорт видимой позы. Прежний state consumer остаётся контролем.
Schema9 добавляет `mic` и `mic-circle` в независимых Outline/Filled: настоящие
кнопки в 16, 24 и 48 px и одну настройку ширины корпуса. Публичный
`variations/<имя>` меняет готовую модель; consumer сохраняет высоту, стойку,
обрамление и paint composition. Filled `mic-circle` остаётся одним `evenodd`
path с двумя отрицательными контурами. Native выбор определяет скачиваемый SVG;
reset возвращает тот же source-объект. Отказы вне диапазона, invalid input,
source-only variation и необъявленное движение сохраняют принятую форму.
Точные saved Figma masters служат oracle до импорта producer. Основания для
доступных кнопок и compound SVG: [WAI Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
и [SVG 2 fill-rule](https://www.w3.org/TR/SVG2/painting.html#FillRuleProperty),
прочитаны 2026-11-02. Новый renderer или отдельный interaction framework не нужны.
Schema14 добавляет выбор `plain` ↔ `circle` для микрофона и плюса в Outline/Filled.
Статические образцы в 16, 24 и 48 px и настоящие кнопки используют самостоятельные
авторские masters. Общий state consumer исполняет `source.replace` через Lab Motion:
новый переход начинается с видимой смеси, поддерживает прерывание, обратный ход,
reduced motion и экспорт текущего SVG. Filled circle сохраняет compound path
и отрицательные контуры. Геометрический morph этих endpoints не доказан;
`bodyWidth` в presentation-переходе и неподдержанные форматы получают точный отказ.
Отдельная ранее принятая настройка ширины mic/mic-circle сохраняется в своём API.

## Запуск

Запускайте в self-hosted GitHub Actions job Lab UI с Node ≥22.19, установленными
зависимостями `apps/docs` и Chromium для Playwright. Harness проверяет официальные
`GITHUB_ACTIONS`, `CI`, `GITHUB_RUN_ID` и `RUNNER_ENVIRONMENT=self-hosted` **до**
установки пакетов, импорта Vite и запуска браузера. Не подменяйте эти переменные для
локального запуска. Синтаксическая проверка и импорт функций допускаются локально.

```sh
node apps/docs/tests/icons-packed.mjs \
  --icons-tarball /artifacts/labpics-icons.tgz \
  --ui-core-tarball /artifacts/labpics-ui-core.tgz \
  --ui-shadow-tarball /artifacts/labpics-ui-shadow.tgz \
  --subject /artifacts/icons-subject.json \
  --out /artifacts/icons-consumer-result
```

`--out` должен быть новым каталогом вне checkout; его родитель уже существует.
Необязательный `--browser-channel chrome` выбирает установленный browser channel.
По умолчанию используется Chromium Playwright. Тяжёлый запуск не добавлен в CI
Icons: доступ к приватному Lab UI и проверка его пакетов принадлежат Lab UI.

Общий `downloadedSvg` регистрирует ожидание native download до клика и читает
реальный файл. Запросы одной страницы выполняются последовательно. После десяти
запросов помощник выдерживает интервал больше секунды от первого подтверждённого
download: [Chromium140 ограничивает короткие серии](https://github.com/chromium/chromium/blob/140.0.7339.186/third_party/blink/renderer/core/frame/local_frame.cc#L3864-L3879).
Этот темп относится к Node-оркестрации экспорта; длительности жестов и reduced motion
задаёт production compiler. Проверки байтов, ошибок загрузки и всех начертаний сохраняются.

Штатный workflow Lab UI `icons-consumer.yml` получает точный head Lab UI и
публичный Icons commit из `icons-consumer-source.json`. Затем вызывает
`browser-check.sh --icons-consumer <icons-checkout>`. Этот же helper владеет
Playwright image, host UID/GID, отдельным контейнером, CID и очисткой обычного E2E.
Фиксированный Icons workload копирует оба checkout с Git metadata в изолированную
директорию; Corepack читает их собственные `packageManager`, а pnpm stores разделены.
Icons проходит обычный `pack` с `prepack`; Lab UI собирает runtime-зависимости core
и упаковывает выбранные по их manifests пакеты.
Исходные mounts доступны только для чтения.

Inputs и результат находятся вне копий исходников. После удаления контейнера
helper переносит только обычные файлы без ссылок в
`apps/docs/test-results/icons-consumer`, затем удаляет собственную временную
директорию. Ошибка удаления контейнера запрещает перенос нестабильной диагностики.
Workflow не загружает архивы в Actions storage. Локальные тесты oracle и lifecycle
проверяют вызовы Docker через recorder и не запускают контейнерный workload.

## Входной reference

Текущий JSON имеет `schemaVersion: 14`, `packages`, `authorReference` и
`stateReferences` с двумя обязательными ключами: `status-circle` и `expression-face`.
Обязательный `notificationReference` содержит обе пары начертаний уведомления и
два статических `notifications-off` controls. `authoredDotsReference` связывает
четыре мастера многоточия, их анатомию, state declarations и grid.
`annulusReference` связывает шестнадцать мастеров circle-семейств и принятые Outline
декларации обрамления. `stateAnnulusReference` связывает обе группы состояний,
их настоящие masters и принятую анатомию общего обрамления.
`microphoneReference` обязателен с schema9: он связывает четыре мастера микрофона,
их независимые декларации и source fingerprints. С schema10 обязательны
`sourceStateReferences`: четыре группы microphone/visibility с самостоятельными
Outline/Filled on/off masters. С schema11 `motionProjectionReference` связывает
допущенные rotation targets Reload/Refresh и статические Timer Outline/Filled
с точным отказом движения. С schema12 `widthMotionReference` связывает
подготовленную ширину микрофона с теми же raw masters, позами и fingerprints.
Schema14 добавляет в `sourceStateReferences` четыре группы
`microphone-presentation`, `microphone-presentation-filled`, `plus-presentation`
и `plus-presentation-filled`. Каждая связывает самостоятельные авторские формы
`plain` и `circle`; обрамление и контрпространство входят в точный master состояния.
Прежние схемы 1–13 сохраняют прежние imports, fixture и type-consumer байты.
Schema8 сохраняет предыдущий content-scale consumer
без microphone reference. Schema6 сохраняет
круговые семейства без state variation reference. Schema5 сохраняет многоточия
без annulus reference. Schema4
сохраняет уведомления без dot reference. Schema3 сохраняет обе state группы.
Schema2 сохраняет прежний `stateReference` только для status-circle. Schema1
сохраняет cycle reference и исполняемый путь reload без state reference.
Одновременное присутствие старого и нового state полей получает отказ.

| Поле | Содержимое |
|---|---|
| `packages.icons` | Архив `@labpics/icons` |
| `packages.uiCore` | Архив `@labpics/ui-core` |
| `packages.uiShadow` | Архив `@labpics/ui-shadow` |
| `packages.uiMaterials`, `packages.uiTokens` | Архивы соответствующих runtime-зависимостей, когда их требует core |
| Каждый пакет | `name`, `version`, `archiveSha256`, `archiveBytes`, `sourceCommit` |
| Каждый пакет с schema13 | Также `runtimeDependencies`: материализованные `dependencies`, `optionalDependencies`, `peerDependencies` |
| `authorReference` | `fileName`, `fileKey`, `version`, `icons.reload` |
| `icons.reload` | Ровно `outline` и `filled` |
| Каждый variant | `sourceFile`, `author`, `anatomy`, `viewBox`, `paths`, `parts`, `gesture` |
| Каждый state reference | `group`, `variant`, `defaultState`, `enclosurePartId`, `enclosure`, `states`, `proof` |
| `expression-face` | Также `sharedPartIds` и упорядоченные `sharedParts` с `id`, `role`, `d`, `fillRule` |
| Каждый state | `id`, `partId`, `icon`, `contentPartIds`, `sourceFile`, `author`, `viewBox`, `dimensions`, `paths` |
| `proof` | Закон, Figma source, hashes полной enclosure identity и semantic spec; для shared anatomy также `sharedPartsSha256` |
| `notificationReference` | Figma file/version и шесть raw masters: paths, viewBox, author; у четырёх подвижных variants также declaration, parts, amplitude и unchangedPartIds |
| `microphoneReference` | Четыре raw masters mic/mic-circle, независимые Outline/Filled декларации и fingerprints; обязателен с schema9 |
| `sourceStateReferences` | Четыре группы microphone/visibility с schema10; с schema14 также четыре presentation-группы microphone/plus Outline/Filled. Независимые masters и доказательство `source.replace` |
| `motionProjectionReference` | Raw masters Reload/Refresh/Timer, допуски rotation и точный отказ Timer; обязателен с schema11 |
| `widthMotionReference` | Привязка подготовленного `capsule.width` к `microphoneReference` и проверяемые позы; обязателен с schema12 |
| `authoredDotsReference` | Figma file/version, semantic/grid hashes, четыре raw masters с declaration/parts и две группы orientation |
| `annulusReference` | Figma file/version, semantic hash, шестнадцать raw masters с paths/receipts; у Outline также declaration `annulus.counter-scale` и IDs частей |

`fileName` указывает текущий Lab UI v2.1. `sourceFile` имеет вид
`masters/figma/<version>/Outline/reload.svg` или `Filled/reload.svg`.
`author` — точный receipt Figma: `kind: "figma"`, `fileKey`, `version`, `nodeId`,
`nodeSha256`, `masterSha256`, `normalizedSha256`, `pathFingerprintSha256`.
`anatomy` — точный version-1 receipt принятой авторской аннотации, включая
`annotationSha256`, `masterSha256`, `pathFingerprintSha256`.

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

Notification reference читает шесть raw masters и аннотации до импорта producer.
Ширина язычка вычисляется независимо через экстремумы шести cubic рёбер;
амплитуда равна четверти этой ширины. Oracle проверяет шесть линейных stops
`0, A, −A, A/2, −A/2, 0`. Ни producer parser, ни его bbox или sampler не формируют
expected. Source receipt также связывает bytes основного harness и общего
notification helper с точным Lab UI commit.

Schema5 продолжает тот же consumer четырьмя авторскими многоточиями:
horizontal/vertical в Outline/Filled. Размер точки и расстояние меняются через
доступные клавиатуре range controls; SVG показывает настоящую изменённую форму
в 16, 24 и 48 px. Кнопка возвращает точный авторский размер, другая скачивает SVG.
Состояния `ellipsis-orientation-outline` и `ellipsis-orientation-filled`
меняют только крайние контуры; средняя точка и все DOM nodes сохраняются.
Публичный `value` Lab Motion владеет прогрессом и interruption. Icons передаёт
переносимый JSON effect; `prepareContourStateEffect` проверяет его один раз.
Потребитель не разбирает paths в кадре и не запускает собственного scheduler.
Harness проверяет strict NodeNext TypeScript в том же установленном consumer: обе authored
variation группы и оба contour entrypoints, с тремя отрицательными controls для
неизвестного состояния, неверной шкалы и скрытых координат.
Горизонтальная форма также выполняет `activity` на изменённой геометрии через
публичный `sequence`: новый цикл сохраняет видимую непрозрачность. Вертикальная
форма не получает жест загрузки только из-за сходства трёх точек.

`authoredDotsReference` в schema5 содержит ровно четыре raw masters, Figma
receipts, объявления `dots.affine`/`dots.orient`, hash исходных state semantics
и grid. Reference готовится до чтения установленного пакета. Endpoint oracle
сравнивает исходный `d` буквально; внутреннюю позу проверяет независимо по
raw operands. Отдельные controls обнаруживают замену DOM nodes, запись в среднюю
точку, неправильную промежуточную форму и silent default при variation.

Два contour модуля поддерживают exact default 1/1 и web-effect. Изменённая
variation пока не допускается в orientation transition: её безопасные конечные
формы не доказывают весь путь. Lottie, dotLottie и SF Symbols для этого перехода
получают `FORMAT_UNSUPPORTED`. Variation не объявлена optical sizing или
StyleProfile. Эти границы сохраняются в receipt, вместе с reverse/newer target,
reduced motion, экспортом текущей видимой формы и освобождением MotionValue.

В schema6 потребитель импортирует отдельные `symbols` и `variations` entrypoints
для alert, checkmark, close, minus, pause, play, plus и question circle. Числовой control передаёт только
`enclosureEmphasis`; координаты обрамления остаются в Icons. Параметр 1 и
`source-only` сохраняют общий frozen default. Oracle выводит центр, внешний и
внутренний радиусы из raw master и проверяет изменение только внутреннего
контура. Для значений 0.8 и 1.2 сравниваются реальные SVG; подмена наружного
контура, знака или возврат исходной формы вместо деформации получают отказ.

Недопустимый ввод сохраняет последнюю принятую форму и её SVG export, а control
показывает ошибку с `aria-invalid`. Filled отказывает даже запросу variation с
параметром 1 или пустым объектом. `checkmark-circle.presence` меняет видимость
отметки через публичный opacity effect и Lab Motion `sequence`. Реверс и новая
цель начинают с видимой позы; изменение толщины сохраняет SVG-узлы и активный
control. Reduced motion сразу даёт конечную позу. SVG export сохраняет текущую
видимость отметки; cleanup останавливает незавершённый переход.
Отдельный жест `annulus.pulse` получает точный публичный отказ владельца.
Групповые переходы сохраняют авторские default формы. TypeScript consumer проверяет annulus entrypoints и
четыре отрицательных случая, включая Filled variation и скрытые координаты.
Этот срез требует отдельного self-hosted browser receipt; синтаксическая и
oracle проверки сами по себе его не подтверждают.

После фиксации raw references и `subject.json` та же prepare-inputs граница
запускает producer `scripts/measure-platform-artifacts.mjs --output ...` после
штатного pack. Запуск разрешён только self-hosted runner. `--update` не передаётся:
candidate policies и `policyViolations` остаются диагностикой, принятие лимитов
принадлежит Icons. Отчёт `inputs/platform-measurement.json` содержит полный
release contract census, raw/gzip/brotli и hashes artifacts, consumer metrics,
среду, методы и candidate policies. Source receipt связывает его bytes/hash с
точным Icons SHA, lockfile и программой/её исходными материалами. Отсутствующий,
изменённый или относящийся к другому SHA report получает отказ.

Diagnostic reader сохраняет report с нарушениями. Итоговый `--summarize`
отказывает в delivery PASS при непустом `policyViolations` и независимо сверяет
измеренные raw/gzip bytes с `maxBytes`/`maxGzipBytes` проекции того же producer.
Отсутствующий потолок также получает отказ. Consumer не хранит своих порогов
и не принимает новый ratchet. Report, PNG и успешный browser receipt передаются
до ненулевого exit; RESULT сохраняет `browserOutcome`, `policyFailure` и
`outcome: "failed"`, даже если сам браузер прошёл.

Готовьте reference из закреплённого Figma manifest/master и проверенной аннотации,
**до чтения установленного glyph**. Генерация ожидаемого результата из того же
пакета уничтожает независимость проверки. Авторская геометрия не хранится второй
редактируемой таблицей в Lab UI.

После проверки SHA256 и размера архивные bytes записываются через `wx` в новый
собственный snapshot consumer. Snapshot повторно проверяется; npm получает
только эти пути. Последующее изменение исходного архива не меняет вход установки.
Receipt сохраняет SHA256, размер и SHA512 integrity snapshot. Для каждого архива
installed npm lock обязан содержать тот же SHA512; отсутствие или несовпадение
получает отказ.
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
Schema4 дополнительно требует три sliced symbol entries уведомлений, включая off.
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

Notification consumer подтверждает native pointer/Enter/Space, доступное имя и
реальное движение. Публичные `pause()` и `seek()` проверяют все шесть поз,
обратный и частичный интервалы. Фаза сохраняется отдельно: одинаковый сдвиг в
фазах 0.1 и 0.25 требует разных обратных маршрутов. Новое входящее событие
начинает новую occurrence и подхватывает видимую позу до admission; координата
не используется как часы. Reduced motion сразу достигает запрошенной фазы.
Корпус и badge сохраняют единичный transform и исходные nodes на каждой
проверяемой позе. `notifications-off.ring` получает `SEMANTIC_MOTION_UNAVAILABLE`,
необъявленный morph — `GESTURE_UNSUPPORTED`; off SVG совпадает с raw master.
Disposal останавливает ещё действующий прогон и проверяет его `stopped` receipt.

Schema11 добавляет установленные `@labpics/icons/gestures/reload`, `refresh` и
статический `@labpics/icons/symbols/timer`. SVG, parts и rotation operands команд
Reload/Refresh уже подготовлены Lab Icons; публичный Lab Motion исполняет числовой rotate.
Outline и Filled показываются
на native Lab UI кнопках при 16, 24 и 48 px. Контуры, part IDs, author/anatomy
receipt и неподвижные части сверяются с raw Figma masters независимо от producer.
Полный оборот, частичный интервал, reversal и новое намерение проверяют конечные
матрицы и C0 continuity при передаче в одном browser task. Reduced motion сохраняет
целевую позу с duration 0. Движение Timer получает `SEMANTIC_MOTION_UNAVAILABLE`;
неизвестный жест и недопустимая фаза получают точные отказы.
Disposal проверяет stopped активного playback, снятие
listeners и удаление mounted nodes.

Два PNG, `no-preference-timer-static-refusal.png` и `reduce-timer-static-refusal.png`,
сохраняют статический Timer в обоих начертаниях и трёх размерах — по одному снимку
на motion preference. Receipt связывает размеры, имя файла и SHA PNG.
Успех capture проверяет происхождение снимка; оптическая оценка требует просмотра
этих изображений. SVG download содержит исходный master таймера.
Размеры тонких SVG/effect/combined imports измеряет отдельный producer benchmark;
для движения Reload/Refresh прежний default runtime не выполнял ту же полезную работу,
поэтому speedup относительно отказа не заявляется.

Schema12 добавляет подготовленную анимацию ширины `mic` и `mic-circle` во всех
четырёх авторских начертаниях. Подготовленная функция из `@labpics/icons/gestures/...` возвращает
полный физический `d`, включая отрицательный compound path Filled. Публичный
`@labpics/motion@0.5.0 value()` исполняет числовую ширину с явными duration и
линейным easing. Consumer сохраняет успешную запись как исходную точку следующего
намерения; в кадре не создаются glyph, IR и provenance hashes. Цель и DOM binding
проверяются до остановки предыдущего playback. Отписка и поколение защищают от
устаревшего callback; история завершений ограничена двумя promises.

Native кнопки показывают 16/24/48 px, рядом с `mic-circle` стоят авторские
`question-circle` и `play-circle`. Проверяются участок 35%, reversal, новое
намерение, pause/seek/stop/finish и rapid latest-wins, C0 continuity и точные
refusals. Reduced admission записывает цель синхронно; live MediaQueryList.change
завершает текущую цель. Teardown останавливает playback, снимает подписки и listener,
сохраняет доступный readback и не допускает поздних DOM writes. SVG download
содержит реальную текущую форму. Шесть PNG привязаны к width 1, 0.92 и 0.8 в обоих
режимах, всем четырём начертаниям и трём размерам; capture не назначает оптический
вердикт. Raw oracle проверяет постоянную высоту, контрпространство и неизменные
стойку и обрамление, независимо от совпадения двух producer implementations.

Четыре самостоятельных измерительных consumer сравнивают prepared width и полный
`glyph()` для двух семейств на одинаковом числовом executor и mounted path. Vite
собирает полную closure с реально используемым публичным Motion, после чего браузер
импортирует каждый bundle и исполняет те же endpoints обоих начертаний. Receipt
содержит raw/gzip/brotli, code и fixture hashes, module graph и точные Icons/UI SHA,
Motion version. Первый такой report является измерением; допустимые бюджеты и
speedup принимаются после его чтения. Старые ceilings не увеличиваются. Browser,
визуальная оценка и скорость никогда не выводятся из одних source tests.

## Runtime-пакеты с schema13–14

Семантика и публичные symbol imports schema13 совпадают со schema12. Меняется
состав архивов: `icons-runtime-packages.mjs` начинает с Icons и UI Core и проходит
их `dependencies`, `optionalDependencies` и `peerDependencies`. Dev-зависимости
не добавляют архивов. Core с зависимостью только от Shadow требует три
архива; Core → Materials → Tokens → Shadow требует пять. Неиспользуемые пакеты
не требуют исходников или архивов. Schema1–12 сохраняют свой набор из трёх архивов.

Перед `npm install` harness сопоставляет source manifests с manifests
архивных snapshots. После единственной установки consumer проверяет manifests
и lock integrity каждого выбранного пакета. Отсутствующая workspace-зависимость,
лишний архив, несовпавший runtime manifest или неподдержанный локальный диапазон
версий получают отказ до установки. Поддержанные workspace shorthand `*`, `^`,
`~` материализуются по версиям выбранных исходников; aliases и relative paths
требуют отдельного подтверждённого binding. Основание преобразования —
[pnpm workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace).

Штатный shell получает рецепт через `--pack-plan <icons-source> <ui-source>`
того же owner. Для ручного запуска с пятиархивным subject добавьте к команде выше
`--ui-materials-tarball <архив>` и `--ui-tokens-tarball <архив>`; набор флагов
должен совпасть с `packages`. Бюджеты, optical/state/width references и проверенная
публичная проекция предыдущих схем сохраняются.

## Результаты и ограничения

Результат сохраняет `receipt.json` с фазой отказа, observations и browser errors;
при ошибке — также `failure.json` и screenshot соответствующего режима. Рядом остаются npm log,
dependency tree, lockfile, module graph, raw/gzip/brotli размеры и SHA каждого
bundle file, сами browser bundles и screenshots двух режимов. Запись содержит
SHA полного набора исходников harness, checkout SHA, dirty state, Node, browser и идентичность runner.
`icons-harness.mjs` задаёт единый набор исполняемых исходников для preparation,
receipt и финальной проверки неизменности, включая сам owner и state-annulus
модуль. Неполный или изменённый набор и изменение любого файла дают отказ.
Перед успешной сводкой `summarize` сопоставляет preparation и native receipt:
Lab UI commit, SHA и содержимое исполненного subject, sourceCommit UI packages
и SHA всего набора harness, включая entrypoint. Изменение исходников или HEAD
между preparation и запуском получает `CONSUMER_SOURCE_IDENTITY_REFUSED`.
RESULT сохраняет `sourceIdentityFailure`, исходный browser outcome и hashes
диагностических файлов; consumer packets с неверной привязкой не передаются.
Schema1–12 сохраняют свои subject contracts. Receipt без обязательной идентичности
остаётся диагностикой и не получает успешную привязку к текущим исходникам.
Browser/server закрываются; удаляется только собственный временный consumer.

После начала browser proof отказ сохраняет `failure.browserFrontier`: режим,
этап, текущий символ, длительности и число завершённых наблюдений. Каждый режим
сохраняет снимок до failure capture и закрытия context. Общий снимок выбирается
при первом отказе, переданном в `Promise.all`, вместе с его исходной ошибкой;
поздние callbacks его не меняют. Если ошибка уже содержит снимок deadline,
сохраняется именно он. Публичный RESULT и JSON-артефакты используют одну проекцию
проверенных полей frontier и сведений по обоим
режимам, когда они присутствуют. Свободное имя последней записи становится
`lastCompletedRecordSha256`. Неизвестные поля, неподдержанные labels и некорректные
счётчики дают `EVIDENCE_REFUSED`; raw message, stack и source locators остаются
в runner. Наличие frontier показывает место отказа, а причину устанавливают
по связанным observations и отдельной проверке.

Размер относится к полному приложению с Lab UI и Motion: schema1 содержит две
reload кнопки; schema2 также содержит status-circle и select состояния; schema3
добавляет expression-face с select и девятью static samples; schema4 также
содержит четыре кнопки уведомлений и двенадцать static samples. Этот
маршрут не измеряет baseline speedup, стоимость одиночного статического импорта,
публикацию npm или оптическую приёмку всего корпуса. Для этих утверждений нужны
соответствующие producer/benchmark/visual evidence. Наличие harness без успешного
remote receipt не означает пройденную интеграцию.

`--summarize` также выводит полный report стандартным
[gzip](https://nodejs.org/api/zlib.html#zlibgzipsyncbuffer-options) и base64 блоком
в stdout, без нового Actions artifact storage. `LABUI_ICONS_PLATFORM_MEASUREMENT_BEGIN`
содержит encoding, source SHA, исходный digest/размер, compressed size и число
частей. Строки `LABUI_ICONS_PLATFORM_MEASUREMENT_CHUNK <index> <base64>` имеют
последовательные индексы и не более 4096 base64 символов. `..._END` повторяет digest.
Для восстановления из полного job log проверьте наличие всех индексов и END,
соедините base64, декодируйте и gunzip, затем проверьте исходный размер и SHA256.
Неполный блок не является report. Schema1 не требует measurement packet.

Тот же код передачи выводит PNG двумя режимами и публичную проекцию успешного
`receipt.json` с реальными observations. PNG сохраняет исходные байты; пересэмплирования нет.
Блоки `LABUI_ICONS_CONSUMER_VISUAL` и `LABUI_ICONS_CONSUMER_RECEIPT` используют
тот же порядок BEGIN/CHUNK/END и gzip-base64. Metadata добавляет `file`,
`sourceSha` Icons и `uiCommit`; digest называется `pngSha256` или `receiptSha256`.
У PNG также есть исходные `width`/`height`. Допускаются только `result/receipt.json`
и screenshots `no-preference`/`reduce`, включая их `-failure` варианты.
Каждый передаваемый файл ограничен 4 MiB, PNG — 16 Mi pixels. Эти пределы
относятся к readback, а не к размеру glyph или optical domain.

JSON имеет отдельный `projectionVersion: 1`. `originalSha256` связывает
каноническое исходное значение, `originalBytesSha256` и `originalBytes` — точные
проверенные bytes. `publicDesignReference` указывает на опубликованный Community
reference; происхождение частного master остаётся commitment и не подменяется.
Геометрия, хеши, outcome, phase и stateContinuity сохраняются; приватные locator
поля и сырые диагностические строки заменяются commitments.

После восстановления проверьте оба source SHA по evidence в RESULT, затем digest и размер
публичного packet. Gunzip должен иметь `maxOutputLength`
4 MiB; отсутствие части, чужой SHA или несовпадение bytes запрещает использовать
packet как evidence. Native PNG-профиль принимает только IHDR (8 bit), IDAT и
IEND с корректными длинами, порядком и CRC. Произвольные, в том числе сжатые,
metadata получают `PUBLIC_EVIDENCE_REFUSED`; изображение не переписывается.
IDAT обязан содержать ровно один полностью использованный zlib stream с ожидаемым
числом строк canvas. Распаковка ограничена его объявленными размерами; скрытый хвост
после image stream запрещён. Реальный
просмотр decoder остаётся отдельной проверкой изображения. Проекция receipt передаётся
только для `passed`; неуспешный RESULT сохраняет прежний ограниченный failure
и continuity witness. Отказ отдельному packet сохраняет RESULT с
`readbackFailure: { code: 'EVIDENCE_REFUSED', file }` и завершает шаг ошибкой.
Наличие PNG не объявляет live Figma parity.

Pin schema2 хранит repository, sourceCommit и `sourceIdentitySha256` пары
fileKey/version. Перед чтением masters подготовка проверяет этот digest по
зафиксированному source manifest. Полные source references проверяются внутри
runner до публичной проекции. CLI-отказы сохраняют allowlisted code и
diagnosticSha256, без raw stack и argv.

В host artifacts переносится только `output/public` с завершённым manifest:
проверенные проекции JSON и разрешённые screenshots. Raw inputs, result,
producer tarballs и Trace2 не экспортируются. Отсутствие manifest, ссылки и
незавершённая проекция запрещают readiness; проверка браузера сохраняет отказ.
Manifest записывается во временный файл того же каталога и публикуется rename
после завершения записи. До копирования host вызывает `--verify-public`: schema,
полный набор файлов, bytes/SHA256, публичные JSON и PNG проверяются повторно.
Частичный manifest и изменённый файл не получают readiness; первичный ненулевой
статус workload сохраняется.

Основание PNG-профиля: [PNG Third Edition, W3C Recommendation 2025-06-24](https://www.w3.org/TR/png-3/).

`summarize` дожидается завершения записи полного блока и RESULT перед отказом
по неуспешному receipt. При ошибке stdout возвращается исходная причина согласно
[контракту Node Writable](https://nodejs.org/api/stream.html#writablewritechunk-encoding-callback).

Полный RESULT передаётся существующим gzip/base64 codec с ограниченными chunks
и `resultSha256`. Для чтения используйте `decodeJsonEvidenceLog` из
`scripts/ci/evidence-log.mjs`: он сохраняет прежний JSON-формат и отвергает
неполный, повреждённый, дублированный или смешанный результат. Отказ передаётся
до PNG; успешный RESULT завершает передачу остальных evidence packets.

Основание runner guard: [GitHub default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables).
Принятый packed-consumer маршрут: Lab UI PR #191, SHA
`846b2bac2b46b0628679e18d39e4d024e01778e0`.
