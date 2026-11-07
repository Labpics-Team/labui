#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const canonical = [
  'set -euo pipefail',
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
  'scan() { "$dir/trivy" fs --config /dev/null --cache-dir "$dir/cache" --exit-code 1 --no-progress "$@" .; }',
  'scan --scanners vuln,misconfig --severity UNKNOWN,HIGH,CRITICAL --include-dev-deps "${accepted[@]}"',
  'scan --scanners vuln --severity UNKNOWN,HIGH,CRITICAL --include-dev-deps --ignore-unfixed --ignorefile /dev/null',
  String.raw`printf 'disable-allow-rules:\n  - tests\n  - examples\n  - markdown\n' > "$dir/secret.yaml"`,
  'secret_scan() { scan --scanners secret --secret-config "$dir/secret.yaml" --ignorefile /dev/null "$@"; }',
  'secret_scan',
  'source .github/scripts/secret-scan-contract.sh',
];
const securityJob = [
  '  security:',
  '    runs-on: ubuntu-latest',
  '    timeout-minutes: <n>',
  '    steps:',
  '      - name: Checkout',
  '        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2',
  '        with:',
  '          persist-credentials: false',
  '',
  '      - name: Scan dependencies, configuration and secrets',
  '        run: |',
  ...canonical.map((line) => `          ${line}`),
];

const aggregateJob = [
  '  ci:',
  '    name: CI',
  '    needs:',
  '      - <jobs>',
  '    if: ${{ always() }}',
  '    runs-on: ubuntu-latest',
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
const requiredNeeds = ['security', 'quality', 'e2e'];
const e2eHeader = [
  '  e2e:',
  '    name: playwright smoke (critical path)',
  '    runs-on: ubuntu-latest',
  '    container:',
  '      image: mcr.microsoft.com/playwright:v1.55.1-noble@sha256:2f29369043d81d6d69a815ceb80760f55e85f5020371ad06a4d996f18503ad1c',
  '      options: --init',
  '    defaults:',
  '      run:',
  '        shell: bash',
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
const topLevel = ['name: CI', 'on:', 'permissions:', 'concurrency:', 'env:', 'jobs:'];
const triggers = ['  push:', '    branches: [main]', '  pull_request:', '  merge_group:'];
const env = ['  CI: "true"'];
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
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
      if (line.trimStart().startsWith('#')) continue;
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
const content = (lines, header) =>
  block(lines, header)
    .slice(1)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'));
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
  if (jobFields.filter((line) => !explicitNoSuppression(line, 4)).length !== 6)
    out.push('job e2e must not add or repeat job-level fields');

  const steps = e2e.join('\n').split(/^ {6}- /m);
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
  const fieldsByStep = steps.map((step, index) =>
    step
      .split('\n')
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
  if (/actions\/upload-artifact@/i.test(source))
    out.push('ephemeral CI reports must not be uploaded to Actions artifacts');
  return out;
}

const actual = violations(workflow);
if (actual.length) throw new Error(actual.join('\n'));
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
  inSecurity('          source .github/scripts/secret-scan-contract.sh\n', ''),
  inSecurity('          secret_scan\n', ''),
  inSecurity(' --secret-config "$dir/secret.yaml"', ''),
  inSecurity('fs --config /dev/null --cache-dir', 'fs --cache-dir'),
  inSecurity(/^ +printf 'disable-allow-rules:.*\n/m, ''),
  inSecurity('--exit-code 1', '--exit-code 0'),
  inSecurity('          set -euo pipefail\n', ''),
  inSecurity(/^ +unset "\$\{!TRIVY_@\}"\n/m, ''),
  inSecurity('--ignore-unfixed --ignorefile /dev/null', '--ignore-unfixed "${accepted[@]}"'),
  inSecurity(
    '--secret-config "$dir/secret.yaml" --ignorefile /dev/null',
    '--secret-config "$dir/secret.yaml" "${accepted[@]}"',
  ),
  inSecurity(/^( {10}sum=)[0-9a-f]{64}$/m, (_, key) => key),
  inSecurity(scanStep, `${scanStep}        continue-on-error: true\n`),
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
  workflow.replace('  pull_request:\n', ''),
  workflow.replace('  merge_group:\n', ''),
  `${workflow.trimEnd()}\n  "security":\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n`,
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
  inAggregate('\n    if: ${{ always() }}\n', '\n'),
  inAggregate('            exit 1\n', '            exit 0\n'),
  ...[
    '      - name: Upload FX\n        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n        with:\n          name: fx\n          path: packages/colors/artifacts/fx-render/',
    '      - uses: "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"',
    '      - "uses": actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    '      - {uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02}',
    '      - name: Upload report\n        uses: >-\n          actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  ].map((step) =>
    workflow.replace(
      '      - name: Verify browser rendering and smoke tests in pinned Playwright runtime',
      `${step}\n      - name: Verify browser rendering and smoke tests in pinned Playwright runtime`,
    ),
  ),
  workflow.replace(
    '      - name: Verify full E2E ownership',
    '      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n      - name: Verify full E2E ownership',
  ),
];
for (const [index, mutant] of mutants.entries()) {
  if (mutant === workflow || violations(mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped security gate contract`);
}
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
  workflow.replace(
    '      - name: Verify browser rendering and smoke tests in pinned Playwright runtime',
    '      - run: echo ready\n      - name: Verify browser rendering and smoke tests in pinned Playwright runtime',
  ),
];
for (const [index, variant] of allowed.entries()) {
  if (variant === workflow || violations(variant).length > 0)
    throw new Error(`allowed change ${index + 1} rejected by security gate contract`);
}

process.stdout.write(
  `security gate contract: PASS (source + ${mutants.length} sabotage + ${allowed.length} allowed controls)\n`,
);
