#!/usr/bin/env node
// Защиту бывшего общего допуска держит job security: каноничный шаг trivy без правок и с местом в
// обязательном итоге CI. Job сверяется целиком, потому что обойти скан можно и рядом с шагом: условием
// или рабочим каталогом шага, лишним шагом, другим ref у checkout, defaults или BASH_ENV workflow.
// Снятая настройка секретов (без неё trivy не смотрит тесты, примеры и *.md), переменные TRIVY_* или
// trivy.yaml из проверяемого дерева, мягкий код выхода или выпавший из итога job краснят CI.
import { readFileSync } from 'node:fs';

const canonical = [
  'set -euo pipefail',
  '# trivy читает переменные TRIVY_* как флаги: охват проверки задаёт только этот шаг.',
  'unset "${!TRIVY_@}"',
  'version=0.74.0',
  'sum=2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a',
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

// Весь job security: защита от fork-PR, чистый воркспейс, checkout кандидата и каноничный шаг.
const securityJob = [
  '  security:',
  '    runs-on: self-hosted',
  '    # Защита от fork-PR: НЕ гоняем недоверенный код форков на своей инфре.',
  '    # Форк-PR пропускается (job skipped, раннер не выделяется); push в main',
  '    # и same-repo PR (коллаборатор) — гоняются как прежде.',
  '    if: >-',
  "      github.event_name != 'pull_request' ||",
  '      github.event.pull_request.head.repo.full_name == github.repository',
  '    timeout-minutes: 10',
  '    steps:',
  "      # Тот же clean-шаг, что у каждого job'а (см. «ИНВАРИАНТ root-docker» выше).",
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

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

// Строки блока от заголовка до следующего ключа того же уровня.
function block(lines, header) {
  const start = lines.indexOf(header);
  if (start < 0) return [];
  const indent = header.length - header.trimStart().length;
  const sibling = new RegExp(`^ {${indent}}[A-Za-z][\\w-]*:`);
  const end = lines.findIndex((line, index) => index > start && sibling.test(line));
  return lines.slice(start, end < 0 ? lines.length : end);
}

function violations(source) {
  const out = [];
  const lines = source.split('\n');
  const security = block(lines, '  security:').join('\n').trimEnd().split('\n');
  const differs = securityJob.findIndex((line, index) => security[index] !== line);
  if (differs >= 0 || security.length !== securityJob.length)
    out.push(
      `job security must stay canonical (line ${(differs < 0 ? securityJob.length : differs) + 1} of the job)`,
    );
  if (lines.some((line) => /^defaults:/.test(line)))
    out.push('workflow defaults would change how the scan runs');
  const env = block(lines, 'env:').flatMap(
    (line) => line.match(/^ {2}([A-Za-z_][\w]*):/)?.[1] ?? [],
  );
  if (env.join(' ') !== 'CI BUSYBOX_IMAGE DOCKER_CONFIG')
    out.push(
      `workflow env must stay CI, BUSYBOX_IMAGE and DOCKER_CONFIG, found: ${env.join(', ')}`,
    );
  const required = block(lines, '  ci:')
    .join('\n')
    .match(/^ {4}needs:\n((?: {6}- \S+\n)+)/m)?.[1]
    ?.match(/\S+$/gm);
  if (!required?.includes('security')) out.push('the CI aggregate must need job security');
  return out;
}

const actual = violations(workflow);
if (actual.length) throw new Error(actual.join('\n'));

const scanStep = '      - name: Scan dependencies, configuration and secrets\n';
const lastLine = `          ${canonical.at(-1)}\n`;
const mutants = [
  workflow.replace(' --secret-config "$dir/secret.yaml"', ''),
  workflow.replace('fs --config /dev/null --cache-dir', 'fs --cache-dir'),
  workflow.replace(/^ +printf 'disable-allow-rules:.*\n/m, ''),
  workflow.replace('--exit-code 1', '--exit-code 0'),
  workflow.replace(
    '          set -euo pipefail\n          # trivy читает',
    '          # trivy читает',
  ),
  workflow.replace(/^ +unset "\$\{!TRIVY_@\}"\n/m, ''),
  workflow.replace('--ignore-unfixed --ignorefile /dev/null', '--ignore-unfixed "${accepted[@]}"'),
  workflow.replace(scanStep, `${scanStep}        continue-on-error: true\n`),
  // Шаг пропущен условием после тела: тело при этом совпадает с каноничным.
  workflow.replace(lastLine, `${lastLine}        if: \${{ false }}\n`),
  workflow.replace(scanStep, `${scanStep}        working-directory: .github\n`),
  workflow.replace(scanStep, `      - run: rm -rf packages\n${scanStep}`),
  workflow.replace(
    '          persist-credentials: false\n\n',
    '          persist-credentials: false\n          ref: main\n\n',
  ),
  workflow.replace('\njobs:\n', '\ndefaults:\n  run:\n    working-directory: .github\n\njobs:\n'),
  workflow.replace('\nenv:\n', '\nenv:\n  BASH_ENV: .github/skip-scan.sh\n'),
  workflow.replace('    needs:\n      - security\n', '    needs:\n'),
];
for (const [index, mutant] of mutants.entries()) {
  if (mutant === workflow || violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped security gate contract`);
}

process.stdout.write(`security gate contract: PASS (live + ${mutants.length} sabotage controls)\n`);
