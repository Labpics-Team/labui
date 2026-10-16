#!/usr/bin/env node
// Уязвимость без исправления принята в .trivyignore.yaml только для пути, разобранного в её
// statement. Любой другой путь к пакету — новый, непринятый риск, поэтому он краснит CI.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Принятый пакет → единственная связь «импортёр workspace ← его прямая зависимость».
const scopes = {
  'braces@3.0.3': 'labui devDependencies <- @changesets/cli',
  'http-cache-semantics@4.2.0': '@labpics/ui-astro devDependencies <- astro',
};

const accepted = [...readFileSync('.trivyignore.yaml', 'utf8').matchAll(/pkg:npm\/(\S+)/g)].map(
  ([, purl]) => decodeURIComponent(purl),
);
const at = (pkg) => pkg.lastIndexOf('@');

function importerEdges(node, edges) {
  for (const dependent of node.dependents ?? []) {
    if (dependent.depField) edges.add(`${dependent.name} ${dependent.depField} <- ${node.name}`);
    else importerEdges(dependent, edges);
  }
  return edges;
}

function violations(records, trees) {
  const out = [];
  for (const pkg of new Set([...records, ...Object.keys(scopes)])) {
    if (!records.includes(pkg)) out.push(`${pkg}: scope without a .trivyignore.yaml record`);
    else if (!scopes[pkg]) out.push(`${pkg}: accepted without a reviewed dependency scope`);
    else {
      const edges = new Set();
      for (const tree of trees[pkg] ?? []) {
        if (tree.version === pkg.slice(at(pkg) + 1)) importerEdges(tree, edges);
      }
      const actual = [...edges].join('; ');
      if (actual !== scopes[pkg]) out.push(`${pkg}: reached via ${actual || 'nothing'}`);
    }
  }
  return out;
}

const trees = Object.fromEntries(
  accepted.map((pkg) => [
    pkg,
    JSON.parse(
      execFileSync('pnpm', ['why', '--recursive', '--json', pkg.slice(0, at(pkg))], {
        encoding: 'utf8',
      }),
    ),
  ]),
);
const actual = violations(accepted, trees);
if (actual.length) throw new Error(actual.join('\n'));

const runtime = { name: '@labpics/ui-core', version: '0.0.0', depField: 'dependencies' };
const mutants = [
  [[...accepted, 'left-pad@1.3.0'], trees],
  [
    accepted,
    Object.fromEntries(
      Object.entries(trees).map(([pkg, list]) => [
        pkg,
        list.map((tree) => ({ ...tree, dependents: [...tree.dependents, runtime] })),
      ]),
    ),
  ],
];
for (const [index, [records, mutant]] of mutants.entries()) {
  if (violations(records, mutant).length === 0)
    throw new Error(`mutation ${index + 1} escaped accepted advisories contract`);
}

process.stdout.write(
  `accepted advisories contract: PASS (${accepted.length} records + ${mutants.length} sabotage controls)\n`,
);
