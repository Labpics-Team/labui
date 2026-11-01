# Lab Icons внутри установленного Lab UI

`icons-packed.mjs` собирает отдельное приложение с двумя настоящими `lab-button`:
Outline и Filled авторского `reload`. Публичный Lab Motion исполняет данные жеста
`reload.cycle`; приложение использует только публичные package entrypoints.
Harness принимает три готовых архива и независимый авторский reference. Он не
клонирует producer-репозитории и не собирает их вместо владельцев пакетов.

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

## Входной reference

JSON имеет `schemaVersion: 1`, `packages` и `authorReference`.

| Поле | Содержимое |
|---|---|
| `packages.icons` | Архив `@labpics/icons` |
| `packages.uiCore` | Архив `@labpics/ui-core` |
| `packages.uiShadow` | Архив `@labpics/ui-shadow` |
| Каждый пакет | `name`, `version`, `archiveSha256`, `archiveBytes`, `sourceCommit` |
| `authorReference` | `fileName`, `fileKey`, `version`, `icons.reload` |
| `icons.reload` | Ровно `outline` и `filled` |
| Каждый variant | `sourceFile`, `author`, `anatomy`, `viewBox`, `paths`, `parts`, `gesture` |

`fileName` указывает текущий Lab UI v2.1. `sourceFile` имеет вид
`masters/figma/<version>/Outline/reload.svg` или `Filled/reload.svg`.
`author` — точный receipt Figma: `kind: "figma"`, `fileKey`, `version`, `nodeId`,
`nodeSha256`, `masterSha256`, `normalizedSha256`, `pathFingerprintSha256`.
`anatomy` — точный version-1 receipt принятой авторской аннотации, включая
`annotationSha256`, `masterSha256`, `pathFingerprintSha256`.

`viewBox` — четыре конечных числа. `paths` — упорядоченные `{d, fillRule}` из
проверенного author master после штатного lowering. `parts` — упорядоченные
`{id, role, zIndex, fillRule, d}` из авторской аннотации этого master. Harness
самостоятельно проверяет fingerprint упорядоченных `{index, d, fillRule}` через
SHA256 JSON с отсортированными ключами и затем сравнивает эти значения с
установленным пакетом и реальным DOM.

`gesture` — точная принятая декларация `reload.cycle` с `partIds`,
`progress: "normalized-0-to-1"` и rotation tracks. Track содержит `partId`,
`kind: "rotate"`, `anchor`, `from`, `to`, `unit: "degrees"`,
`interpolation: "linear"`. Поле берётся из проверенной source annotation,
без чтения результата `compileSymbolEffect`. Harness сравнивает anchor,
transformOrigin и endpoints с этой независимой декларацией.

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
Motion. Whole IR/compiler/catalog и другие symbol-модули отвергаются.

Браузер проверяет оба начертания: точные контуры, fill-rule, порядок и part IDs,
receipt Figma/anatomy, доступное имя «Обновить», native target 48×48, декоративный
icon slot, pointer/Enter/Space, trusted composed click и отсутствие submit.
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

## Результаты и ограничения

Результат сохраняет `receipt.json` с фазой отказа, observations и browser errors;
при ошибке — также `failure.json` и screenshot соответствующего режима. Рядом остаются npm log,
dependency tree, lockfile, module graph, raw/gzip/brotli размеры и SHA каждого
bundle file, сами browser bundles и screenshots двух режимов. Запись содержит
SHA harness, checkout SHA, dirty state, Node, browser и идентичность runner.
Browser/server закрываются; удаляется только собственный временный consumer.

Размер относится к полному двухкнопочному приложению с Lab UI и Motion. Этот
маршрут не измеряет baseline speedup, стоимость одиночного статического импорта,
публикацию npm или оптическую приёмку всего корпуса. Для этих утверждений нужны
соответствующие producer/benchmark/visual evidence. Наличие harness без успешного
remote receipt не означает пройденную интеграцию.

Основание runner guard: [GitHub default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables).
Принятый packed-consumer маршрут: Lab UI PR #191, SHA
`846b2bac2b46b0628679e18d39e4d024e01778e0`.
