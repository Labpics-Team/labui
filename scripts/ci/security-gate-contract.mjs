#!/usr/bin/env node
// Защиту бывшего общего допуска держит job security: каноничный для всей организации шаг trivy и
// обязательный итог CI, который краснеет при любом его отказе. Оба job сверяются по тексту, потому что
// обойти скан можно и рядом с шагом: условием или рабочим каталогом шага, лишним шагом, другим ref у
// checkout, пропуском или мягким выходом итога, а на уровне workflow — триггерами, defaults, BASH_ENV
// или подменой образа очистки. Свободно то, что на защиту не влияет: комментарии YAML, таймауты,
// версия trivy с её контрольной суммой и дополнительные job в итоге.
import { readFileSync } from 'node:fs';

// Логика скана одинакова во всех репозиториях организации; версия и sha256 trivy живут в workflow.
const canonical = [
  'set -euo pipefail',
  '# trivy читает переменные TRIVY_* как флаги: охват проверки задаёт только этот шаг.',
  'unset "${!TRIVY_@}"',
  'version=<version>',
  'sum=<sha256>',
  'dir="$RUNNER_TEMP/trivy"',
  'mkdir -p "$dir"',
  'curl -fsSL --retry 3 --retry-all-errors -o "$dir/trivy.tgz" \\',
  '  "https://github.com/aquasecurity/trivy/releases/download/v$version/trivy_${version}_Linux-64bit.tar.gz"',
  'echo "$sum  $dir/trivy.tgz" | sha256sum -c -',
  'tar -xzf "$dir/trivy.tgz" -C "$dir" trivy',
  'accepted=(--ignorefile /dev/null)',
  '[ -f .trivyignore.yaml ] && accepted=(--ignorefile .trivyignore.yaml)',
  '# Настройки сканера задаёт шаг: trivy.yaml из проверяемого дерева их не меняет.',
  'scan() { "$dir/trivy" fs --config /dev/null --cache-dir "$dir/cache" --exit-code 1 --no-progress "$@" .; }',
  'scan --scanners vuln,misconfig --severity UNKNOWN,HIGH,CRITICAL --include-dev-deps "${accepted[@]}"',
  '# Исправление вышло — принятая раньше уязвимость снова блокирует.',
  'scan --scanners vuln --severity UNKNOWN,HIGH,CRITICAL --include-dev-deps --ignore-unfixed --ignorefile /dev/null',
  '# Секрет в тестах, примерах и документации — такая же утечка: встроенные исключения trivy для них сняты,',
  '# а записи .trivyignore.yaml к секретам не применяются.',
  String.raw`printf 'disable-allow-rules:\n  - tests\n  - examples\n  - markdown\n' > "$dir/secret.yaml"`,
  'secret_scan() { scan --scanners secret --secret-config "$dir/secret.yaml" --ignorefile /dev/null "$@"; }',
  'secret_scan',
  'source .github/scripts/secret-scan-contract.sh',
];

// Job security: защита от fork-PR, чистый воркспейс, checkout кандидата и каноничный шаг.
const securityJob = [
  '  security:',
  '    runs-on: self-hosted',
  '    if: >-',
  "      github.event_name != 'pull_request' ||",
  '      github.event.pull_request.head.repo.full_name == github.repository',
  '    timeout-minutes: <n>',
  '    steps:',
  '      - name: Чистый воркспейс (self-hosted)',
  '        shell: bash',
  '        run: |',
  '          mkdir -p "${GITHUB_WORKSPACE}" "${DOCKER_CONFIG}"',
  '          docker run --rm -v "${GITHUB_WORKSPACE}:/workspace" "${BUSYBOX_IMAGE}" \\',
  `            sh -c 'rm -rf /workspace/* /workspace/.[!.]* /workspace/..?* 2>/dev/null || true; chown "$1:$2" /workspace' sh "$(id -u)" "$(id -g)"`,
  '      - name: Checkout',
  '        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2',
  '        with:',
  '          persist-credentials: false',
  '',
  '      - name: Scan dependencies, configuration and secrets',
  '        run: |',
  ...canonical.map((line) => `          ${line}`),
];

// Итог CI запускается и после отказа зависимостей и пропускает только сплошной success.
const aggregateJob = [
  '  ci:',
  '    name: CI',
  '    needs:',
  '      - <jobs>',
  '    if: ${{ always() }}',
  '    runs-on: self-hosted',
  '    timeout-minutes: <n>',
  '    permissions: {}',
  '    steps:',
  '      - name: Require complete verification',
  '        shell: bash',
  '        env:',
  "          NEEDS_RESULTS: ${{ join(needs.*.result, ',') }}",
  '        run: |',
  '          set -euo pipefail',
  '          if [[ ! "$NEEDS_RESULTS" =~ ^success(,success)*$ ]]; then',
  `            printf 'Required verification did not succeed: %s\\n' "$NEEDS_RESULTS" >&2`,
  '            exit 1',
  '          fi',
];

// Итог обязан ждать security, quality и e2e: отказ готовой загрузки в e2e блокирует CI.
const requiredNeeds = ['security', 'quality', 'e2e'];
const e2eHeader = [
  '  e2e:',
  '    name: playwright smoke (critical path)',
  '    runs-on: self-hosted',
  '    if: >-',
  "      github.event_name != 'pull_request' ||",
  '      github.event.pull_request.head.repo.full_name == github.repository',
  '    timeout-minutes: <n>',
  '    steps:',
];
const browserStep = [
  'name: Verify browser rendering and smoke tests in pinned Playwright runtime',
  '        id: browser',
  '        shell: bash',
  '        env:',
  '          E2E_SMOKE: "1"',
  '        run: bash .github/scripts/browser-check.sh',
];
const uploadAction =
  '        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';
const uploadConditions = {
  'fx-render': "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}",
  'playwright-report':
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}",
};
const readyUploads = {
  'fx-render': [
    'name: Upload FX-render артефакт (PNG для обзора владельцем)',
    uploadConditions['fx-render'],
    uploadAction,
    '        with:',
    '          name: fx-render',
    '          path: packages/colors/artifacts/fx-render/',
    '          retention-days: 7',
    '          if-no-files-found: error',
  ],
  'playwright-report': [
    'name: Upload Playwright report',
    uploadConditions['playwright-report'],
    uploadAction,
    '        with:',
    '          name: playwright-report',
    '          path: apps/docs/playwright-report/',
    '          retention-days: 7',
    '          if-no-files-found: error',
  ],
};
const topLevel = ['name: CI', 'on:', 'permissions:', 'concurrency:', 'env:', 'jobs:'];
// Кандидат проверяется в каждом PR и в очереди слияния.
const triggers = ['  push:', '    branches: [main]', '  pull_request:', '  merge_group:'];
// Образ очистки работает от root с доступом к воркспейсу: его смена — явная правка этого контракта.
const env = [
  '  CI: "true"',
  '  BUSYBOX_IMAGE: "busybox:1.36@sha256:73aaf090f3d85aa34ee199857f03fa3a95c8ede2ffd4cc2cdb5b94e566b11662"',
  '  DOCKER_CONFIG: "/tmp/labui-ci-docker-anon"',
];
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

// Строки блока от заголовка до следующего ключа того же уровня.
function block(lines, header) {
  const start = lines.indexOf(header);
  if (start < 0) return [];
  const indent = header.length - header.trimStart().length;
  const sibling = new RegExp(`^ {${indent}}\\S`);
  const end = lines.findIndex(
    (line, index) => index > start && sibling.test(line) && !line.trimStart().startsWith('#'),
  );
  return lines.slice(start, end < 0 ? lines.length : end);
}

// Сравнимый вид блока: без комментариев YAML (строки тел `run: |` остаются как есть), без пустых
// хвостов, с подстановками вместо таймаута, версии и sha256 trivy; список needs разбирается отдельно.
function normalized(lines) {
  const needs = [];
  const out = [];
  let body = -1;
  let contentIndent = -1;
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    if (body >= 0 && contentIndent < 0 && line.trim() !== '' && indent > body) {
      contentIndent = indent;
    }
    if (body >= 0 && (line.trim() === '' || (contentIndent >= 0 && indent >= contentIndent))) {
      out.push(
        line
          .replace(/^( {10}version=)\d+\.\d+\.\d+$/, '$1<version>')
          .replace(/^( {10}sum=)[0-9a-f]{64}$/, '$1<sha256>'),
      );
      continue;
    }
    body = -1;
    contentIndent = -1;
    if (line.trimStart().startsWith('#')) continue;
    const scalar = line.match(/^( *)(- )?[\w-]+: [|>][-+]?$/);
    if (scalar) body = scalar[1].length + (scalar[2] ? 2 : 0);
    const item = line.match(/^ {6}- (\S+)$/);
    if (item && (out.at(-1) === '    needs:' || out.at(-1) === '      - <jobs>')) {
      needs.push(item[1]);
      if (out.at(-1) === '    needs:') out.push('      - <jobs>');
      continue;
    }
    out.push(line.replace(/^ {4}timeout-minutes: [1-9]\d*$/, '    timeout-minutes: <n>'));
  }
  while (out.at(-1) === '') out.pop();
  return { lines: out, needs };
}

function differs(actual, expected, name) {
  const index = expected.findIndex((line, at) => actual[at] !== line);
  if (index < 0 && actual.length === expected.length) return [];
  return [`${name} must stay canonical (line ${(index < 0 ? expected.length : index) + 1})`];
}

// Содержимое блока верхнего уровня без заголовка, комментариев и пустых строк.
const content = (lines, header) =>
  block(lines, header)
    .slice(1)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));

// Только скаляры верхнего уровня шага/job: YAML допускает кавычки, Unicode-escape в имени
// и tab перед ':'. Неизвестное представление не считаем разрешённым false.
function scalar(value) {
  const match = value.match(/^ *("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^# \t]+)(?:[ \t]+#.*)?[ \t]*$/);
  if (!match) return null;
  const text = match[1];
  if (text.startsWith('"')) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return text.startsWith("'") ? text.slice(1, -1).replaceAll("''", "'") : text;
}

function field(line, indent) {
  const prefix = ' '.repeat(indent);
  if (!line.startsWith(prefix) || /^\s|^#/.test(line.slice(indent))) return null;
  const match = line
    .slice(indent)
    .match(/^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[\w-]+)[ \t]*:[ \t]*(.*)$/);
  return match ? { key: scalar(match[1]), value: match[2] } : null;
}

// Сравниваем весь защищённый шаг, а не только несколько ключей: YAML допускает
// экранированные имена и повторные поля. Явное false не подавляет отказ.
function explicitNoSuppression(line, indent) {
  const entry = field(line, indent);
  return entry?.key === 'continue-on-error' && /^false(?:[ \t]+#.*)?[ \t]*$/.test(entry.value);
}

function comparableStep(step) {
  return step
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
    .filter((line) => !explicitNoSuppression(line, 8))
    .map((line) => line.replace(/[ \t]+#.*$/, '').trimEnd());
}

function violations(source) {
  const lines = source.split('\n');
  const out = [];
  const roots = lines.filter((line) => /^[^\s#]/.test(line));
  if (roots.join('\n') !== topLevel.join('\n'))
    out.push(`workflow top level must be exactly: ${topLevel.join(', ')}`);
  out.push(...differs(content(lines, 'on:'), triggers, 'workflow triggers'));
  out.push(...differs(content(lines, 'env:'), env, 'workflow env'));
  for (const id of ['security', 'ci', 'e2e']) {
    if (lines.filter((line) => new RegExp(`^ {2}["']?${id}["']?\\s*:`).test(line)).length !== 1)
      out.push(`workflow must define job ${id} exactly once`);
  }
  out.push(...differs(normalized(block(lines, '  security:')).lines, securityJob, 'job security'));
  const aggregate = normalized(block(lines, '  ci:'));
  out.push(...differs(aggregate.lines, aggregateJob, 'job ci'));
  for (const id of requiredNeeds) {
    if (!aggregate.needs.includes(id)) out.push(`the CI aggregate must need job ${id}`);
  }
  // Каноничный e2e job и три защищённых шага фиксируют цепь browser → ready
  // upload → required CI; соседние шаги допустимы в простой YAML-форме.
  const e2e = block(lines, '  e2e:');
  const stepsAt = e2e.indexOf('    steps:');
  const header = e2e.slice(0, stepsAt < 0 ? e2e.length : stepsAt + 1);
  out.push(
    ...differs(
      normalized(header.filter((line) => !explicitNoSuppression(line, 4))).lines,
      e2eHeader,
      'job e2e header',
    ),
  );
  const jobFields = e2e.filter((line) => /^ {4}\S/.test(line) && !line.trimStart().startsWith('#'));
  if (jobFields.filter((line) => !explicitNoSuppression(line, 4)).length !== 5)
    out.push('job e2e must not add or repeat job-level fields');

  const steps = e2e.join('\n').split(/^ {6}- /m);
  // Разбиение осмысленно лишь когда каждый YAML-элемент списка имеет тот же
  // отступ, один пробел после '-' и первый ключ на этой строке. Actionlint
  // допускает и одиночный '-', и flow map: они иначе скрыли бы новый upload.
  const itemLines = e2e.slice(stepsAt + 1).filter((line) => /^ {6}-/.test(line));
  if (
    itemLines.length !== steps.length - 1 ||
    itemLines.some(
      (line) => !line.startsWith('      - ') || field(`        ${line.slice(8)}`, 8)?.key == null,
    )
  )
    out.push('e2e steps must use one canonical sequence-item layout');
  const browserAt = steps.findIndex((step) => /^ {8}id: browser$/m.test(step));
  if (browserAt < 0 || steps.filter((step) => /^ {8}id: browser$/m.test(step)).length !== 1)
    out.push('the browser step must appear exactly once');
  else out.push(...differs(comparableStep(steps[browserAt]), browserStep, 'browser step'));

  // Все e2e uses проверяем по значению скаляра, иначе quoted action или ключ с
  // escape создают дополнительную публикацию вне двух защищённых шагов.
  const fieldsByStep = steps.map((step, index) =>
    step
      .split('\n')
      // split убирает `      - `: первый ключ шага теперь начинается с нулевого отступа.
      .map((line, at) => (index > 0 && at === 0 ? `        ${line}` : line))
      .filter((line) => /^ {8}\S/.test(line) && !line.trimStart().startsWith('#'))
      .map((line) => field(line, 8)),
  );
  const stepFields = fieldsByStep.flat();
  if (stepFields.some((entry) => entry?.key == null))
    out.push('e2e step fields must use supported scalar keys');
  const actions = stepFields
    .filter((entry) => entry?.key === 'uses')
    .map((entry) => scalar(entry.value));
  if (actions.some((action) => action == null || /^[&*|>!]/.test(action)))
    out.push('e2e uses must use literal scalar action references');
  const uploads = steps.filter((_, index) =>
    fieldsByStep[index].some(
      (entry) =>
        entry?.key === 'uses' && /^actions\/upload-artifact@/i.test(scalar(entry.value) ?? ''),
    ),
  );
  if (uploads.length !== 2) out.push('the browser job must retain both ready artifact uploads');
  const uploadPositions = [];
  for (const [name, expected] of Object.entries(readyUploads)) {
    const matches = uploads.filter((step) => step.split('\n').includes(`          name: ${name}`));
    if (matches.length !== 1) {
      out.push(`${name} upload must appear exactly once`);
      continue;
    }
    out.push(...differs(comparableStep(matches[0]), expected, `${name} ready upload`));
    uploadPositions.push(steps.indexOf(matches[0]));
  }
  if (
    uploadPositions.length === 2 &&
    !(browserAt < uploadPositions[0] && uploadPositions[0] < uploadPositions[1])
  )
    out.push('ready uploads must follow the browser step in order');
  return out;
}

const actual = violations(workflow);
if (actual.length) throw new Error(actual.join('\n'));

// Мутации меняют только свой блок: перестановка job или правка needs их не обезвреживает.
const lines = workflow.split('\n');
const securityText = block(lines, '  security:').join('\n');
const aggregateText = block(lines, '  ci:').join('\n');
const inSecurity = (from, to) =>
  workflow.replace(securityText, () => securityText.replace(from, to));
const inAggregate = (from, to) =>
  workflow.replace(aggregateText, () => aggregateText.replace(from, to));
const scanStep = '      - name: Scan dependencies, configuration and secrets\n';
const lastLine = `          ${canonical.at(-1)}\n`;
const browserAt = workflow.indexOf('      - name: Verify browser rendering and smoke tests');
const fxAt = workflow.indexOf('      - name: Upload FX-render артефакт');
const reportAt = workflow.indexOf('      - name: Upload Playwright report');
const browserBlock = workflow.slice(browserAt, fxAt);
const fxBlock = workflow.slice(fxAt, reportAt);
const mutants = [
  inSecurity('          source .github/scripts/secret-scan-contract.sh\n', ''),
  inSecurity('          secret_scan\n', ''),
  inSecurity(' --secret-config "$dir/secret.yaml"', ''),
  inSecurity('fs --config /dev/null --cache-dir', 'fs --cache-dir'),
  inSecurity(/^ +printf 'disable-allow-rules:.*\n/m, ''),
  inSecurity('--exit-code 1', '--exit-code 0'),
  inSecurity('          set -euo pipefail\n          # trivy читает', '          # trivy читает'),
  inSecurity(/^ +unset "\$\{!TRIVY_@\}"\n/m, ''),
  inSecurity('--ignore-unfixed --ignorefile /dev/null', '--ignore-unfixed "${accepted[@]}"'),
  // Секреты снова принимаются записями из проверяемого дерева.
  inSecurity(
    '--secret-config "$dir/secret.yaml" --ignorefile /dev/null',
    '--secret-config "$dir/secret.yaml" "${accepted[@]}"',
  ),
  inSecurity(/^( {10}sum=)[0-9a-f]{64}$/m, (_, key) => key),
  inSecurity(scanStep, `${scanStep}        continue-on-error: true\n`),
  // Шаг пропущен условием после тела: тело при этом совпадает с каноничным.
  inSecurity(lastLine, `${lastLine}        if: \${{ false }}\n`),
  inSecurity(scanStep, `${scanStep}        working-directory: .github\n`),
  inSecurity(scanStep, `      - run: rm -rf packages\n${scanStep}`),
  inSecurity(
    '          persist-credentials: false\n',
    '          persist-credentials: false\n          ref: main\n',
  ),
  workflow.replace('\njobs:\n', '\ndefaults:\n  run:\n    working-directory: .github\n\njobs:\n'),
  workflow.replace('\njobs:\n', '\n"defaults":\n  run:\n    working-directory: .github\n\njobs:\n'),
  workflow.replace('\nenv:\n', '\nenv:\n  BASH_ENV: .github/skip-scan.sh\n'),
  workflow.replace('\nenv:\n', '\nenv:\n  "BASH_ENV": .github/skip-scan.sh\n'),
  workflow.replace(/^( {2}BUSYBOX_IMAGE: ).*$/m, (_, key) => `${key}"busybox:latest"`),
  workflow.replace(
    /^( {2}BUSYBOX_IMAGE: "busybox:1\.36@sha256:)[0-9a-f]{64}"$/m,
    (_, key) => `${key}${'0'.repeat(64)}"`,
  ),
  workflow.replace('  pull_request:\n', ''),
  workflow.replace('  merge_group:\n', ''),
  `${workflow.trimEnd()}\n  "security":\n    runs-on: self-hosted\n    steps:\n      - run: "true"\n`,
  inAggregate(/^ {6}- security\n/m, ''),
  inAggregate(/^ {6}- quality\n/m, ''),
  inAggregate(/^ {6}- e2e\n/m, ''),
  workflow.replace('  e2e:\n', '  e2e:\n    continue-on-error: true\n'),
  workflow.replace('  e2e:\n', '  e2e:\n    continue-on-error : true\n'),
  workflow.replace('  e2e:\n', () => `  e2e:\n${String.raw`    "\u0063ontinue-on-error": true`}\n`),
  workflow.replace(
    '  e2e:\n',
    () => `  e2e:\n${String.raw`    "\u0063ontinue-on-error"`}\t: true\n`,
  ),
  workflow.replace(
    '        id: browser\n',
    '        id: browser\n        continue-on-error: true\n',
  ),
  // Итог пропущен после отказа security или превращает отказ в успех.
  inAggregate('\n    if: ${{ always() }}\n', '\n'),
  inAggregate('            exit 1\n', '            exit 0\n'),
  ...[
    "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}\n",
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}\n",
  ].map((condition) =>
    workflow.replace(condition, `${condition}        continue-on-error: true\n`),
  ),
  ...[
    "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}\n",
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}\n",
  ].map((condition) =>
    workflow.replace(condition, `${condition}        continue-on-error : true\n`),
  ),
  workflow.replace(
    "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}\n",
    (condition) => `${condition}${String.raw`        "\u0063ontinue-on-error": true`}\n`,
  ),
  workflow.replace(
    '          path: packages/colors/artifacts/fx-render/',
    '          path: README.md',
  ),
  // Вторая загрузка с quoted uses не должна обойти счётчик защищённых uploads.
  workflow.replace(
    '      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)',
    `      - name: Publish successful smoke report without a failure condition
        uses: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
        with:
          name: playwright-report
          path: apps/docs/playwright-report/
      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)`,
  ),
  // Допустимый короткий YAML-вид первого ключа шага тоже не должен обходить счётчик.
  workflow.replace(
    '      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)',
    `      - uses: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
        with:
          name: playwright-report
          path: apps/docs/playwright-report/
      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)`,
  ),
  workflow.replace(
    '      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)',
    () => `      - ${String.raw`"u\u0073es"`}: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
        with:
          name: playwright-report
          path: apps/docs/playwright-report/
      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)`,
  ),
  // Actionlint принимает эти формы нового YAML-элемента после cleanup; ни один
  // не вправе публиковать отчёт успешного smoke вне защищённого шага.
  ...[
    `      -
          uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
          with:
            name: extra-report
            path: apps/docs/playwright-report/`,
    `      -  uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
         with:
           name: extra-report
           path: apps/docs/playwright-report/`,
    '      - {uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02, with: {name: extra-report, path: apps/docs/playwright-report/}}',
  ].map((step) => workflow.replace('\n  ci:\n', `\n${step}\n  ci:\n`)),
  // YAML block scalar для uses actionlint тоже принимает, но текстового ref
  // на одной строке у guard уже нет: такие формы должны закрываться явно.
  ...['>-', '|-'].map((style) =>
    workflow.replace(
      '\n  ci:\n',
      `\n      - name: Extra report upload
        uses: ${style}
          actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02
        with:
          name: extra-report
          path: apps/docs/playwright-report/
  ci:\n`,
    ),
  ),
  // Публикация до browser не увидит outputs и станет успешным пропуском.
  workflow.replace(`${browserBlock}${fxBlock}`, () => `${fxBlock}${browserBlock}`),
  // Отказ более ранней загрузки не превращает успешный smoke в повод хранить отчёт.
  workflow.replace(
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}",
    "        if: ${{ failure() && !cancelled() && steps.browser.outputs.report_ready == 'true' }}",
  ),
  // Прежний smoke-отчёт на успешном прогоне и отказ от готовности нарушают новый контракт.
  workflow.replace(
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}",
    "        if: ${{ !cancelled() && steps.browser.outputs.report_ready == 'true' }}",
  ),
  workflow.replace(
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}",
    '        if: ${{ failure() && !cancelled() }}',
  ),
  // Пропуск всех публикаций под видом допустимого пропуска без готового артефакта.
  ...[
    "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}",
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}",
  ].map((condition) => workflow.replace(condition, '        if: ${{ false }}')),
  // Пустая ready-директория не должна стать успешным upload.
  workflow.replaceAll('          if-no-files-found: error', '          if-no-files-found: ignore'),
  workflow.replaceAll('          if-no-files-found: error', '          if-no-files-found: warn'),
];
for (const [index, mutant] of mutants.entries()) {
  if (mutant === workflow || violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped security gate contract`);
}

// Допустимые правки: таймаут, комментарии YAML (и внутри with), новая версия trivy, ещё один job в итоге.
const allowed = [
  inSecurity(
    '      - name: Checkout\n',
    '         # пояснение после тела run\n      - name: Checkout\n',
  ),
  inSecurity(
    /^ {4}timeout-minutes: (\d+)$/m,
    (_, minutes) => `    timeout-minutes: ${Number(minutes) + 5}`,
  ),
  inSecurity(scanStep, `      # Скан кандидата.\n${scanStep}`),
  inSecurity(
    '          persist-credentials: false\n',
    '          # Checkout без сохранения credentials\n          persist-credentials: false\n',
  ),
  inSecurity(/^( {10}version=)\d+\.\d+\.\d+$/m, (_, key) => `${key}0.99.0`).replace(
    /^( {10}sum=)[0-9a-f]{64}$/m,
    (_, key) => `${key}${'a'.repeat(64)}`,
  ),
  workflow.replace('  pull_request:\n', '  # Каждый PR.\n  pull_request:\n'),
  inAggregate('\n    needs:\n', '\n    needs:\n      - docs\n'),
  workflow.replace('  e2e:\n', '  e2e:\n    continue-on-error: false\n'),
  workflow.replace(
    '  e2e:\n',
    '  e2e:\n    continue-on-error : false # явный отказ от подавления\n',
  ),
  workflow.replace(
    '  e2e:\n',
    () =>
      `  e2e:\n    ${String.raw`"\u0063ontinue-on-error"`}\t: false # явный отказ от подавления\n`,
  ),
  workflow.replace(
    '        id: browser\n',
    '        id: browser\n        continue-on-error: false # исходный отказ сохраняется\n',
  ),
  workflow.replace(
    '        id: browser\n',
    () => `        id: browser\n        ${String.raw`"\u0063ontinue-on-error"`}\t: false\n`,
  ),
  // Другой шаг после публикаций допустим: запрет относится к лишней загрузке.
  workflow.replace(
    '      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)',
    '      - run: echo ready\n      - name: Вернуть владение воркспейса раннеру (self-hosted cleanup)',
  ),
  workflow.replace(
    '          if-no-files-found: error',
    '          if-no-files-found: error # путь обязателен',
  ),
  // Комментарий рядом с публикацией не меняет её статус и готовность.
  ...['Upload FX-render артефакт (PNG для обзора владельцем)', 'Upload Playwright report'].map(
    (name) =>
      workflow.replace(
        `      - name: ${name}\n`,
        `      - name: ${name}\n        # Артефакт публикуется по своему условию.\n`,
      ),
  ),
  ...[
    "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}\n",
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}\n",
  ].map((condition) =>
    workflow.replace(condition, `${condition}        continue-on-error: false\n`),
  ),
  ...[
    "        if: ${{ !cancelled() && steps.browser.outputs.fx_ready == 'true' }}\n",
    "        if: ${{ !cancelled() && steps.browser.outcome == 'failure' && steps.browser.outputs.report_ready == 'true' }}\n",
  ].map((condition) =>
    workflow.replace(
      condition,
      `${condition}        continue-on-error: false # блокировать отказ\n`,
    ),
  ),
];
for (const [index, variant] of allowed.entries()) {
  if (variant === workflow || violations(variant).length > 0)
    throw new Error(`allowed change ${index + 1} rejected by security gate contract`);
}

process.stdout.write(
  `security gate contract: PASS (live + ${mutants.length} sabotage + ${allowed.length} allowed controls)\n`,
);
