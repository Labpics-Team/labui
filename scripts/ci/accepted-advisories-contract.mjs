#!/usr/bin/env node
// Уязвимость без исправления принята в .trivyignore.yaml только как разобранная пара «id + purl» и
// только для графа зависимостей, разобранного в её statement. Новый id на том же пакете, запись без
// purl или любое новое ребро графа к пакету — непринятый риск, поэтому он краснит CI.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Разобранная пара → все рёбра графа `pnpm why` от пакета до импортёров workspace, без версий:
// «A -> B» — пакет A зависит от B, «X devDependencies <- C» — импортёр workspace X и его зависимость C.
const reviewed = {
  'CVE-2026-93687 pkg:npm/braces@3.0.3': [
    '@changesets/apply-release-plan -> @changesets/config',
    '@changesets/apply-release-plan -> @changesets/git',
    '@changesets/apply-release-plan -> @changesets/should-skip-package',
    '@changesets/apply-release-plan -> @manypkg/get-packages',
    '@changesets/assemble-release-plan -> @changesets/get-dependents-graph',
    '@changesets/assemble-release-plan -> @changesets/should-skip-package',
    '@changesets/assemble-release-plan -> @manypkg/get-packages',
    '@changesets/cli -> @changesets/apply-release-plan',
    '@changesets/cli -> @changesets/assemble-release-plan',
    '@changesets/cli -> @changesets/config',
    '@changesets/cli -> @changesets/get-dependents-graph',
    '@changesets/cli -> @changesets/get-release-plan',
    '@changesets/cli -> @changesets/git',
    '@changesets/cli -> @changesets/pre',
    '@changesets/cli -> @changesets/read',
    '@changesets/cli -> @changesets/should-skip-package',
    '@changesets/cli -> @manypkg/get-packages',
    '@changesets/config -> @changesets/get-dependents-graph',
    '@changesets/config -> @changesets/should-skip-package',
    '@changesets/config -> @manypkg/get-packages',
    '@changesets/config -> micromatch',
    '@changesets/get-dependents-graph -> @manypkg/get-packages',
    '@changesets/get-release-plan -> @changesets/assemble-release-plan',
    '@changesets/get-release-plan -> @changesets/config',
    '@changesets/get-release-plan -> @changesets/pre',
    '@changesets/get-release-plan -> @changesets/read',
    '@changesets/get-release-plan -> @manypkg/get-packages',
    '@changesets/git -> @manypkg/get-packages',
    '@changesets/git -> micromatch',
    '@changesets/pre -> @manypkg/get-packages',
    '@changesets/read -> @changesets/git',
    '@changesets/should-skip-package -> @manypkg/get-packages',
    '@manypkg/get-packages -> globby',
    'fast-glob -> micromatch',
    'globby -> fast-glob',
    'labui devDependencies <- @changesets/cli',
    'micromatch -> braces',
  ],
  'CVE-2026-93748 pkg:npm/http-cache-semantics@4.2.0': [
    '@labpics/ui-astro devDependencies <- astro',
    'astro -> http-cache-semantics',
  ],
};

// Строгий разбор формы, в которой записи ведутся здесь: любая другая запись (уязвимость без purls,
// с paths или в другой форме YAML, раздел кроме vulnerabilities) не проходит молча, а требует
// разбора и правки этого контракта.
function records(source) {
  const pairs = [];
  const problems = [];
  let section = null;
  let entry = null;
  let field = null;
  const close = () => {
    if (entry?.purls.length === 0) problems.push(`${entry.id}: accepted without purls`);
    // Объяснение, почему риск здесь допустим, — часть записи: без него запись не принята.
    if (entry && entry.statement === 0) problems.push(`${entry.id}: accepted without a statement`);
    for (const purl of entry?.purls ?? []) pairs.push(`${entry.id} ${purl}`);
    entry = null;
    field = null;
  };
  for (const [index, line] of source.split('\n').entries()) {
    if (line.trim() === '') continue;
    const top = line.match(/^([a-z]+):$/);
    if (top) {
      close();
      section = top[1];
      // Другие разделы здесь не разобраны: misconfigurations и licenses требуют сначала расширить этот
      // контракт, а секреты не принимаются вовсе — шаг скана не читает для них .trivyignore.yaml.
      if (section !== 'vulnerabilities')
        problems.push(`line ${index + 1}: unreviewed section ${section}`);
      continue;
    }
    if (section !== 'vulnerabilities') {
      if (!line.startsWith(' ')) problems.push(`line ${index + 1}: unsupported syntax`);
      continue;
    }
    const id = line.match(/^ {2}- id: ([A-Za-z][A-Za-z0-9-]+)$/);
    const purl = line.match(/^ {6}- (pkg:npm\/\S+)$/);
    if (id) {
      close();
      entry = { id: id[1], purls: [], statement: 0 };
    } else if (entry && line === '    purls:') field = 'purls';
    else if (entry && line === '    statement: >-') field = 'statement';
    else if (entry && field === 'purls' && purl) entry.purls.push(purl[1]);
    else if (entry && field === 'statement' && /^ {6}\S/.test(line)) entry.statement += 1;
    else problems.push(`line ${index + 1}: unsupported vulnerability syntax`);
  }
  close();
  return { pairs, problems };
}

const target = (pair) => decodeURIComponent(pair.slice(pair.indexOf(' pkg:npm/') + 9));
const at = (pkg) => pkg.lastIndexOf('@');

function graph(trees, pkg) {
  const edges = new Set();
  const walk = (node) => {
    for (const dependent of node.dependents ?? []) {
      edges.add(
        dependent.depField
          ? `${dependent.name} ${dependent.depField} <- ${node.name}`
          : `${dependent.name} -> ${node.name}`,
      );
      walk(dependent);
    }
  };
  for (const tree of trees) if (tree.version === pkg.slice(at(pkg) + 1)) walk(tree);
  return [...edges].sort();
}

function violations({ pairs, problems }, trees) {
  const out = [...problems];
  for (const pair of new Set([...pairs, ...Object.keys(reviewed)])) {
    if (!pairs.includes(pair)) out.push(`${pair}: reviewed without a .trivyignore.yaml record`);
    else if (!reviewed[pair]) out.push(`${pair}: accepted without review`);
    else {
      const actual = graph(trees[target(pair)] ?? [], target(pair)).join('\n');
      if (actual !== [...reviewed[pair]].sort().join('\n'))
        out.push(`${pair}: dependency graph is not the reviewed one:\n${actual || 'nothing'}`);
    }
  }
  return out;
}

const source = readFileSync('.trivyignore.yaml', 'utf8');
const accepted = records(source);
const why = (pkg) =>
  JSON.parse(
    execFileSync('pnpm', ['why', '--recursive', '--json', pkg.slice(0, at(pkg))], {
      encoding: 'utf8',
    }),
  );
const trees = Object.fromEntries(
  Object.keys(reviewed).map((pair) => [target(pair), why(target(pair))]),
);
const actual = violations(accepted, trees);
if (actual.length) throw new Error(actual.join('\n'));

const extend = (pkg, dependent) => ({
  ...trees,
  [pkg]: trees[pkg].map((tree) => ({ ...tree, dependents: [...tree.dependents, dependent] })),
});
const record = (text) => records(`${source.trimEnd()}\n${text}\n`);
const mutants = [
  // Новый CVE на уже принятом пакете.
  [
    record(
      '  - id: CVE-2099-0001\n    purls:\n      - pkg:npm/braces@3.0.3\n    statement: >-\n      Проба.',
    ),
    trees,
  ],
  // Принятая запись без объяснения или с пустым объяснением.
  [records(source.replace(/ {4}statement: >-\n(?: {6}.*\n)+/, '')), trees],
  [records(source.replace(/( {4}statement: >-\n)(?: {6}.*\n)+/, '$1')), trees],
  // Запись без purls.
  [record('  - id: CVE-2099-0002\n    statement: >-\n      Без пути.'), trees],
  // Принятие в неразобранном разделе.
  [
    records(
      `${source.trimEnd()}\nsecrets:\n  - id: aws-access-key-id\n    paths:\n      - packages/x.test.ts\n`,
    ),
    trees,
  ],
  // Та же запись в другой форме YAML.
  [records(source.replace(/purls:\n {6}- (\S+)/, 'purls: [$1]')), trees],
  // Новый непосредственный потребитель.
  [
    accepted,
    extend('braces@3.0.3', {
      name: '@labpics/ui-core',
      version: '0.0.0',
      depField: 'dependencies',
    }),
  ],
  // Новая внутренняя ветвь при прежнем импортёре.
  [
    accepted,
    extend('braces@3.0.3', {
      name: '@changesets/cli',
      version: '2.27.12',
      dependents: [{ name: 'labui', version: '0.0.0', depField: 'devDependencies' }],
    }),
  ],
];
for (const [index, [parsed, mutant]] of mutants.entries()) {
  if (violations(parsed, mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped accepted advisories contract`);
}

process.stdout.write(
  `accepted advisories contract: PASS (${accepted.pairs.length} records + ${mutants.length} sabotage controls)\n`,
);
