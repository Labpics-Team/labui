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
  '# Секрет в тестах, примерах и документации — такая же утечка: встроенные исключения trivy для них сняты.',
  String.raw`printf 'disable-allow-rules:\n  - tests\n  - examples\n  - markdown\n' > "$dir/secret.yaml"`,
  'scan --scanners secret --secret-config "$dir/secret.yaml" "${accepted[@]}"',
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
  '          docker run --rm -e OWNER="$(id -u):$(id -g)" -v "${GITHUB_WORKSPACE}:/workspace" "${BUSYBOX_IMAGE}" \\',
  `            sh -c 'rm -rf /workspace/* /workspace/.[!.]* /workspace/..?* 2>/dev/null || true; chown "$OWNER" /workspace 2>/dev/null || true'`,
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

// Итог обязан ждать security и quality: в quality работают контракты принятых записей и этого job.
const requiredNeeds = ['security', 'quality'];
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
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    if (body >= 0 && (line.trim() === '' || indent > body)) {
      out.push(
        line
          .replace(/^( {10}version=)\d+\.\d+\.\d+$/, '$1<version>')
          .replace(/^( {10}sum=)[0-9a-f]{64}$/, '$1<sha256>'),
      );
      continue;
    }
    body = -1;
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

function violations(source) {
  const lines = source.split('\n');
  const out = [];
  const roots = lines.filter((line) => /^[^\s#]/.test(line));
  if (roots.join('\n') !== topLevel.join('\n'))
    out.push(`workflow top level must be exactly: ${topLevel.join(', ')}`);
  out.push(...differs(content(lines, 'on:'), triggers, 'workflow triggers'));
  out.push(...differs(content(lines, 'env:'), env, 'workflow env'));
  for (const id of ['security', 'ci']) {
    if (lines.filter((line) => new RegExp(`^ {2}["']?${id}["']?\\s*:`).test(line)).length !== 1)
      out.push(`workflow must define job ${id} exactly once`);
  }
  out.push(...differs(normalized(block(lines, '  security:')).lines, securityJob, 'job security'));
  const aggregate = normalized(block(lines, '  ci:'));
  out.push(...differs(aggregate.lines, aggregateJob, 'job ci'));
  for (const id of requiredNeeds) {
    if (!aggregate.needs.includes(id)) out.push(`the CI aggregate must need job ${id}`);
  }
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
const mutants = [
  inSecurity(' --secret-config "$dir/secret.yaml"', ''),
  inSecurity('fs --config /dev/null --cache-dir', 'fs --cache-dir'),
  inSecurity(/^ +printf 'disable-allow-rules:.*\n/m, ''),
  inSecurity('--exit-code 1', '--exit-code 0'),
  inSecurity('          set -euo pipefail\n          # trivy читает', '          # trivy читает'),
  inSecurity(/^ +unset "\$\{!TRIVY_@\}"\n/m, ''),
  inSecurity('--ignore-unfixed --ignorefile /dev/null', '--ignore-unfixed "${accepted[@]}"'),
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
  // Итог пропущен после отказа security или превращает отказ в успех.
  inAggregate('\n    if: ${{ always() }}\n', '\n'),
  inAggregate('            exit 1\n', '            exit 0\n'),
];
for (const [index, mutant] of mutants.entries()) {
  if (mutant === workflow || violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped security gate contract`);
}

// Допустимые правки: таймаут, комментарии YAML (и внутри with), новая версия trivy, ещё один job в итоге.
const allowed = [
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
];
for (const [index, variant] of allowed.entries()) {
  if (variant === workflow || violations(variant).length > 0)
    throw new Error(`allowed change ${index + 1} rejected by security gate contract`);
}

process.stdout.write(
  `security gate contract: PASS (live + ${mutants.length} sabotage + ${allowed.length} allowed controls)\n`,
);
