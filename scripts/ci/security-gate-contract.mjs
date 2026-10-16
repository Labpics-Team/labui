#!/usr/bin/env node
// Защиту бывшего общего допуска держит job security: каноничный шаг trivy без правок, без подавления
// отказа и с местом в обязательном итоге CI. Снятая настройка секретов (без неё trivy не смотрит
// тесты, примеры и *.md), мягкий код выхода или выпавший из итога job краснят CI.
import { readFileSync } from 'node:fs';

const canonical = [
  'set -euo pipefail',
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
  'scan() { "$dir/trivy" fs --cache-dir "$dir/cache" --exit-code 1 --no-progress "$@" .; }',
  'scan --scanners vuln,misconfig --severity UNKNOWN,HIGH,CRITICAL --include-dev-deps "${accepted[@]}"',
  '# Исправление вышло — принятая раньше уязвимость снова блокирует.',
  'scan --scanners vuln --severity UNKNOWN,HIGH,CRITICAL --include-dev-deps --ignore-unfixed --ignorefile /dev/null',
  '# Секрет в тестах, примерах и документации — такая же утечка: встроенные исключения trivy для них сняты.',
  String.raw`printf 'disable-allow-rules:\n  - tests\n  - examples\n  - markdown\n' > "$dir/secret.yaml"`,
  'scan --scanners secret --secret-config "$dir/secret.yaml" "${accepted[@]}"',
].join('\n');

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const stepName = '      - name: Scan dependencies, configuration and secrets';

// Строки job от заголовка «  <id>:» до следующего job.
function job(lines, id) {
  const start = lines.indexOf(`  ${id}:`);
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^ {2}[A-Za-z][\w-]*:$/.test(line));
  return lines.slice(start, end < 0 ? lines.length : end);
}

function violations(source) {
  const out = [];
  const lines = source.split('\n');
  if (lines.filter((line) => line === stepName).length !== 1)
    out.push('ci.yml must hold exactly one scan step');
  const security = job(lines, 'security');
  const step = security.indexOf(stepName);
  if (step < 0 || security[step + 1] !== '        run: |')
    out.push('job security must run the scan');
  else {
    const body = [];
    for (const line of security.slice(step + 2)) {
      if (line !== '' && !line.startsWith(' '.repeat(10))) break;
      body.push(line.slice(10));
    }
    if (body.join('\n').trimEnd() !== canonical) out.push('the scan step must stay canonical');
  }
  if (security.some((line) => /^\s+continue-on-error:/.test(line)))
    out.push('job security must not suppress failure');
  const aggregate = job(lines, 'ci');
  const needs = aggregate.indexOf('    needs:');
  const required = [];
  for (const line of needs < 0 ? [] : aggregate.slice(needs + 1)) {
    const item = line.match(/^ {6}- (\S+)$/);
    if (!item) break;
    required.push(item[1]);
  }
  if (!required.includes('security')) out.push('the CI aggregate must need job security');
  return out;
}

const actual = violations(workflow);
if (actual.length) throw new Error(actual.join('\n'));

const mutants = [
  workflow.replace(' --secret-config "$dir/secret.yaml"', ''),
  workflow.replace(/^ +printf 'disable-allow-rules:.*\n/m, ''),
  workflow.replace('--exit-code 1', '--exit-code 0'),
  workflow.replace(
    '          set -euo pipefail\n          version=0.74.0',
    '          version=0.74.0',
  ),
  workflow.replace('--ignore-unfixed --ignorefile /dev/null', '--ignore-unfixed "${accepted[@]}"'),
  workflow.replace(`${stepName}\n`, `${stepName}\n        continue-on-error: true\n`),
  workflow.replace('    needs:\n      - security\n', '    needs:\n'),
];
for (const [index, mutant] of mutants.entries()) {
  if (mutant === workflow || violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped security gate contract`);
}

process.stdout.write(`security gate contract: PASS (live + ${mutants.length} sabotage controls)\n`);
