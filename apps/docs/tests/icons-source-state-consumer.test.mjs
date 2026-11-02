import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import { SOURCE_STATE_ENTRIES, SOURCE_STATE_GROUPS, sourceStateFixture, sourceStateTypeFixture } from './icons-source-state-consumer.mjs';
import { assertIconsImport, assertStateAnatomy, consumerFixture, consumerPublicEntries, stateCapabilitiesReference, staticStatePathsReference, subjectStateReferences, validateStateReference } from './icons-packed.mjs';
import { stateReference } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(await readFile(new URL('./fixtures/icons-source-state-masters.json', import.meta.url)));
const pin = { figma: { fileKey: snapshot.manifest.source.fileKey, version: snapshot.manifest.source.version } };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'labui-source-state-oracle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'semantics'), { recursive: true });
  await writeFile(join(root, 'semantics/figma-baseline.json'), JSON.stringify(snapshot.manifest));
  await writeFile(join(root, 'semantics/author-state-groups.json'), JSON.stringify(snapshot.semantic));
  for (const [file, bytes] of Object.entries(snapshot.masters)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  const references = Object.fromEntries(await Promise.all(Object.keys(SOURCE_STATE_GROUPS).map(async group => [group, await stateReference(root, pin, group)])));
  return { root, references };
}

// Исполняет точный сборщик из browser fixture на DOM-узлах; expected берётся из raw masters.
function collectedStateTree(reference, injected = null) {
  const source = consumerFixture(10);
  const start = source.indexOf('function stateTree()');
  const end = source.indexOf('\nfunction sharedAncestorsUnchanged(', start);
  assert.ok(start >= 0 && end > start);
  const svg = {};
  const nodes = [];
  for (const state of reference.states) {
    const group = { localName: 'g', parentElement: svg, dataset: { part: state.partId, role: 'state', state: state.id } };
    nodes.push(group);
    for (const path of staticStatePathsReference(reference, state))
      nodes.push({ localName: 'path', parentElement: group, dataset: { part: path.partId, role: path.role }, path });
  }
  if (injected) nodes.push({ localName: injected.tag, parentElement: svg, dataset: { part: 'invented-overlay', role: 'content' }, path: injected.path ?? null });
  svg.querySelectorAll = selector => { assert.equal(selector, '*'); return nodes; };
  return new Function('stateSvg', 'statePath', `${source.slice(start, end)}\nreturn stateTree();`)(svg, node => node.path);
}

test('eight raw endpoint masters retain all ordered paths without an invented enclosure', async (t) => {
  const { references } = await fixture(t);
  for (const [group, reference] of Object.entries(references)) {
    validateStateReference(reference, pin.figma, group);
    assert.equal(reference.enclosurePartId, null);
    assert.deepEqual(reference.sharedParts, []);
    assert.equal(reference.proof.enclosureSha256, null);
    const capability = stateCapabilitiesReference(reference);
    assert.equal(capability.transition, 'source-replacement');
    assert.equal(capability.morph, 'unavailable');
    const observation = {
      viewBox: [0, 0, 24, 24], dimensions: [24, 24], identity: true,
      groups: reference.states.map(state => ({ id: state.id, partId: state.partId, role: 'state', paths: staticStatePathsReference(reference, state) })),
      enclosure: null, enclosureCount: 0, enclosureOpacity: null, sharedParts: [],
      tree: collectedStateTree(reference),
    };
    assertStateAnatomy(observation, reference);
    const missing = structuredClone(observation);
    missing.groups[0].paths.pop();
    assert.throws(() => assertStateAnatomy(missing, reference));
    const fake = structuredClone(observation);
    fake.enclosure = fake.groups[0].paths.at(-1);
    fake.enclosureCount = 1;
    assert.throws(() => assertStateAnatomy(fake, reference));
    for (const injected of [
      { tag: 'path', path: { d: 'M0 0H24V24H0Z', fillRule: 'nonzero', fill: 'currentColor', partId: 'invented-overlay', role: 'content' } },
      { tag: 'rect' }, { tag: 'circle' }, { tag: 'use' }, { tag: 'text' },
    ]) {
      const extra = { ...observation, tree: collectedStateTree(reference, injected) };
      assert.throws(() => assertStateAnatomy(extra, reference), /необъявленную геометрию/);
    }
  }
  assert.equal(references['visibility-filled'].states.find(state => state.id === 'visible').paths.length, 1);
  assert.equal(references.microphone.states.find(state => state.id === 'muted').paths.length, 5);
  assert.notDeepEqual(references.microphone.states[0].paths, references['microphone-filled'].states[0].paths);
});

test('raw master and semantic drift refuse before importing the producer', async (t) => {
  const { root, references } = await fixture(t);
  const reference = references.microphone;
  const modified = structuredClone(reference);
  modified.states[0].paths[0].d += 'M1 1L2 1L1 2Z';
  assert.throws(() => validateStateReference(modified, pin.figma, 'microphone'));
  const invented = structuredClone(reference);
  invented.enclosurePartId = 'fake-shell';
  assert.throws(() => validateStateReference(invented, pin.figma, 'microphone'));
  const file = reference.states[0].sourceFile;
  await writeFile(join(root, file), `${snapshot.masters[file]} `);
  await assert.rejects(() => stateReference(root, pin, 'microphone'));
});

test('schema10 adds four public source states through the existing mount and motion executor', () => {
  assert.deepEqual(SOURCE_STATE_ENTRIES, [
    '@labpics/icons/states/microphone', '@labpics/icons/states/microphone-filled',
    '@labpics/icons/states/visibility', '@labpics/icons/states/visibility-filled',
  ]);
  const old = consumerPublicEntries(9);
  assert.deepEqual(consumerPublicEntries(10).filter(entry => !old.includes(entry)), SOURCE_STATE_ENTRIES);
  for (const entry of SOURCE_STATE_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/states/microphone-circle'));
  assert.throws(() => assertIconsImport('@labpics/icons/ir/state-runtime'));
  assert.equal(consumerFixture(9).includes('sourceConsumer0'), false);
  assert.ok(consumerFixture(10).includes(sourceStateFixture()));
  assert.equal(sourceStateFixture().includes('function mountStateConsumer'), false);
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-source-state-consumer.mjs'));
  const types = sourceStateTypeFixture();
  assert.equal((types.match(/@ts-expect-error/g) ?? []).length, 12);
  assert.equal((types.match(/source-replacement/g) ?? []).length, 4);
  assert.deepEqual(subjectStateReferences({ schemaVersion: 10, stateReferences: { a: 1 }, sourceStateReferences: { b: 2 } }), { a: 1, b: 2 });
});
