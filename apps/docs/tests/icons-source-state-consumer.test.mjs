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

// Исполняет точный browser observer; DOM/CSSOM double задаёт только входные значения.
function collectedState(reference, { injected = null, mutate = () => {}, color = 'rgb(22, 24, 28)', opacity } = {}) {
  const source = consumerFixture(10);
  const start = source.indexOf('function statePaths(');
  const end = source.indexOf('\nfunction sharedAncestorsUnchanged(', start);
  const readStart = source.indexOf('function readState()');
  const readEnd = source.indexOf('\nasync function settleState(', readStart);
  assert.ok(start >= 0 && end > start && readStart >= 0 && readEnd > readStart);
  const declaration = values => ({
    get length() { return Object.keys(values).length; },
    item: index => Object.keys(values)[index],
    [Symbol.iterator]: function* () { yield* Object.keys(values); },
    getPropertyValue: name => values[name] ?? '',
    getPropertyPriority: () => '',
    setProperty: (name, value) => { values[name] = value; },
  });
  const style = {
    color, fill: color, 'fill-opacity': '1', 'fill-rule': 'nonzero', stroke: 'none',
    opacity: '1', transform: 'none', translate: 'none', rotate: 'none', scale: 'none',
    filter: 'none', 'clip-path': 'none', 'mask-image': 'none', 'offset-path': 'none', clip: 'auto',
    'marker-start': 'none', 'marker-mid': 'none', 'marker-end': 'none',
    visibility: 'visible', display: 'inline', 'mix-blend-mode': 'normal',
    'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none',
    'box-shadow': 'none', 'outline-style': 'none', 'border-top-style': 'none',
    'border-right-style': 'none', 'border-bottom-style': 'none', 'border-left-style': 'none',
  };
  function node(tag, parent, attributes, computed = {}) {
    const item = { localName: tag, parentElement: parent, attributes, computed: { ...style, ...computed } };
    item.dataset = Object.fromEntries(Object.entries(attributes).filter(([name]) => name.startsWith('data-'))
      .map(([name, value]) => [name.slice(5), value]));
    item.getAttribute = name => item.attributes[name] ?? null;
    item.getAttributeNames = () => Object.keys(item.attributes);
    Object.defineProperty(item, 'style', { get: () => declaration(Object.fromEntries(
      (item.attributes.style ?? '').split(';').filter(value => value.trim()).map(value => {
        const [name, ...rest] = value.split(':'); return [name.trim(), rest.join(':').trim()];
      }))) });
    return item;
  }
  const svg = node('svg', null, { viewBox: '0 0 24 24', width: '24', height: '24',
    xmlns: 'http://www.w3.org/2000/svg', fill: 'currentColor', slot: 'icon',
    'aria-hidden': 'true', focusable: 'false' }, { display: 'block', width: '24px', height: '24px' });
  const nodes = [];
  for (const state of reference.states) {
    const group = node('g', svg, { 'data-part': state.partId, 'data-role': 'state', 'data-state': state.id,
      opacity: state.id === reference.defaultState ? '1' : '0' },
    { opacity: String(opacity?.[state.id] ?? (state.id === reference.defaultState ? 1 : 0)) });
    nodes.push(group);
    for (const path of staticStatePathsReference(reference, state))
      nodes.push(node('path', group, { 'data-part': path.partId, 'data-role': path.role,
        d: path.d, fill: path.fill, 'fill-rule': path.fillRule },
      { 'fill-rule': path.fillRule, d: `path("${path.d}")` }));
    group.querySelectorAll = selector => {
      assert.equal(selector, 'path'); return nodes.filter(item => item.parentElement === group && item.localName === 'path');
    };
  }
  if (injected) nodes.push(node(injected.tag, svg, { 'data-part': 'invented-overlay', 'data-role': 'content',
    ...(injected.path ? { d: injected.path.d, fill: injected.path.fill, 'fill-rule': injected.path.fillRule } : {}) }));
  mutate({ svg, groups: nodes.filter(item => item.localName === 'g'), paths: nodes.filter(item => item.localName === 'path') });
  svg.querySelectorAll = selector => {
    if (selector === '*' || selector === '[data-part]') return nodes;
    if (selector === 'g[data-state][data-part]') return nodes.filter(item => item.localName === 'g');
    assert.equal(selector, '[data-part="null"]'); return [];
  };
  svg.querySelector = selector => { assert.equal(selector, '[data-part="null"]'); return null; };
  const native = { getBoundingClientRect: () => ({ width: 48, height: 48 }), type: 'button',
    getAttribute: () => 'action', querySelector: () => ({ getAttribute: () => 'true' }) };
  const scope = {
    stateSvg: svg, stateButton: { shadowRoot: { querySelector: () => native }, isConnected: true, computed: style },
    stateCapabilitiesValue: stateCapabilitiesReference(reference), stateOpacity: () => [], stateEnclosure: null,
    originalStateNodes: [...nodes], sharedNodes: new Map(), stateTarget: reference.defaultState,
    stateControl: null, stateEvents: [], stateNativeClicks: 0, stateStatus: { textContent: '' },
    stateSelect: { value: reference.defaultState }, enclosurePresentation: null,
    configuration: SOURCE_STATE_GROUPS[reference.group],
    getComputedStyle: item => ({ ...item.computed, ...declaration(item.computed) }),
    document: { createElementNS: () => ({ style: declaration({}) }) },
  };
  return new Function(...Object.keys(scope), `${source.slice(start, end)}\n${source.slice(readStart, readEnd)}\nreturn readState();`)(...Object.values(scope));
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
    const observation = collectedState(reference);
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
      const extra = collectedState(reference, { injected });
      assert.throws(() => assertStateAnatomy(extra, reference), /необъявленную геометрию/);
    }
  }
  assert.equal(references['visibility-filled'].states.find(state => state.id === 'visible').paths.length, 1);
  assert.equal(references.microphone.states.find(state => state.id === 'muted').paths.length, 5);
  assert.notDeepEqual(references.microphone.states[0].paths, references['microphone-filled'].states[0].paths);
});

test('source anatomy refuses root, state and path presentation changes while preserving inherited color and state opacity', async (t) => {
  const { references } = await fixture(t);
  for (const reference of Object.values(references)) {
    assertStateAnatomy(collectedState(reference, { color: 'rgb(71, 110, 145)',
      opacity: Object.fromEntries(reference.states.map(state => [state.id, .5])),
      mutate: ({ groups }) => { for (const group of groups) group.attributes.style = 'opacity: 0.5'; },
    }), reference);
    for (const target of ['svg', 'groups', 'paths']) {
      const mutations = [
        item => { item.attributes.stroke = 'currentColor'; item.attributes['stroke-width'] = '6'; },
        item => { item.attributes.transform = 'translate(8 0)'; },
        item => { item.attributes.style = 'fill: transparent'; },
        item => { item.computed.stroke = 'rgb(71, 110, 145)'; },
        item => { item.computed.transform = 'matrix(1, 0, 0, 1, 8, 0)'; },
        item => { item.computed.fill = 'rgba(0, 0, 0, 0)'; },
      ];
      for (const mutate of mutations) {
        const changed = collectedState(reference, { mutate: tree => mutate(target === 'svg' ? tree.svg : tree[target][0]) });
        assert.equal(changed.identity, true);
        assert.throws(() => assertStateAnatomy(changed, reference), /presentation|paint|геометри|атрибут|style|заливк/);
      }
    }
    for (const mutate of [
      ({ paths }) => { paths[0].computed.d = 'path("M0 0H24V24H0Z")'; },
      ({ paths }) => { paths[0].computed['fill-rule'] = paths[0].computed['fill-rule'] === 'nonzero' ? 'evenodd' : 'nonzero'; },
      ({ svg }) => { svg.computed.opacity = '0.5'; },
      ({ paths }) => { paths[0].computed.opacity = '0.5'; },
      ({ groups }) => { groups[0].computed.opacity = ''; },
      ({ svg }) => { svg.computed['background-color'] = 'rgb(71, 110, 145)'; },
      ({ paths }) => { paths[0].computed['clip-path'] = 'inset(50%)'; },
      ({ paths }) => { paths[0].computed['offset-path'] = 'path("M0 0L8 0")'; },
    ]) assert.throws(() => assertStateAnatomy(collectedState(reference, { mutate }), reference), /source presentation/);
  }
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
