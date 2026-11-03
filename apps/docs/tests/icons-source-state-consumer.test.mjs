import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import {
  assertIconsImport,
  assertStateAnatomy,
  consumerFixture,
  consumerPublicEntries,
  stateCapabilitiesReference,
  staticStatePathsReference,
  subjectStateReferences,
  validateStateReference,
} from './icons-packed.mjs';
import {
  SOURCE_STATE_ENTRIES,
  SOURCE_STATE_GROUPS,
  sourceStateEntries,
  sourceStateFixture,
  sourceStateGroups,
  sourceStateReferenceContract,
  sourceStateTypeFixture,
} from './icons-source-state-consumer.mjs';
import { readAuthorMaster, stateReference } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-source-state-masters.json', import.meta.url)),
);
const pin = {
  figma: { fileKey: snapshot.manifest.source.fileKey, version: snapshot.manifest.source.version },
};
async function fixture(t, schemaVersion = 13) {
  const root = await mkdtemp(join(tmpdir(), 'labui-source-state-oracle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'semantics'), { recursive: true });
  await writeFile(join(root, 'semantics/figma-baseline.json'), JSON.stringify(snapshot.manifest));
  await writeFile(
    join(root, 'semantics/author-state-groups.json'),
    JSON.stringify(snapshot.semantic),
  );
  for (const [file, bytes] of Object.entries(snapshot.masters)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  const references = Object.fromEntries(
    await Promise.all(
      Object.keys(sourceStateGroups(schemaVersion)).map(async (group) => [
        group,
        await stateReference(root, pin, group),
      ]),
    ),
  );
  return { root, references };
}

// Исполняет точный browser observer; DOM/CSSOM double задаёт только входные значения.
function collectedState(
  reference,
  {
    injected = null,
    mutate = () => {},
    color = 'rgb(22, 24, 28)',
    opacity,
    origin = [137.25, 98.5],
  } = {},
) {
  const source = consumerFixture(10);
  const start = source.indexOf('function statePaths(');
  const end = source.indexOf('\nfunction sharedAncestorsUnchanged(', start);
  const readStart = source.indexOf('function readState()');
  const readEnd = source.indexOf('\nasync function settleState(', readStart);
  assert.ok(start >= 0 && end > start && readStart >= 0 && readEnd > readStart);
  const declaration = (values) => ({
    get length() {
      return Object.keys(values).length;
    },
    item: (index) => Object.keys(values)[index],
    [Symbol.iterator]: function* () {
      yield* Object.keys(values);
    },
    getPropertyValue: (name) => values[name] ?? '',
    getPropertyPriority: () => '',
    setProperty: (name, value) => {
      values[name] = value;
    },
  });
  const style = {
    color,
    fill: color,
    'fill-opacity': '1',
    'fill-rule': 'nonzero',
    stroke: 'none',
    opacity: '1',
    transform: 'none',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    zoom: '1',
    filter: 'none',
    'clip-path': 'none',
    'mask-image': 'none',
    'offset-path': 'none',
    clip: 'auto',
    'marker-start': 'none',
    'marker-mid': 'none',
    'marker-end': 'none',
    visibility: 'visible',
    display: 'inline',
    'mix-blend-mode': 'normal',
    'background-color': 'rgba(0, 0, 0, 0)',
    'background-image': 'none',
    'box-shadow': 'none',
    'outline-style': 'none',
    'border-top-style': 'none',
    'border-right-style': 'none',
    'border-bottom-style': 'none',
    'border-left-style': 'none',
  };
  function node(tag, parent, attributes, computed = {}) {
    const item = {
      localName: tag,
      parentElement: parent,
      attributes,
      computed: { ...style, ...computed },
    };
    item.screenCtm = [1, 0, 0, 1, ...origin];
    item.getScreenCTM = () =>
      item.screenCtm === null
        ? null
        : Object.fromEntries(
            ['a', 'b', 'c', 'd', 'e', 'f'].map((name, index) => [name, item.screenCtm[index]]),
          );
    item.dataset = Object.fromEntries(
      Object.entries(attributes)
        .filter(([name]) => name.startsWith('data-'))
        .map(([name, value]) => [name.slice(5), value]),
    );
    item.getAttribute = (name) => item.attributes[name] ?? null;
    item.getAttributeNames = () => Object.keys(item.attributes);
    Object.defineProperty(item, 'style', {
      get: () =>
        declaration(
          Object.fromEntries(
            (item.attributes.style ?? '')
              .split(';')
              .filter((value) => value.trim())
              .map((value) => {
                const [name, ...rest] = value.split(':');
                return [name.trim(), rest.join(':').trim()];
              }),
          ),
        ),
    });
    return item;
  }
  const svg = node(
    'svg',
    null,
    {
      viewBox: '0 0 24 24',
      width: '24',
      height: '24',
      xmlns: 'http://www.w3.org/2000/svg',
      fill: 'currentColor',
      slot: 'icon',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    { display: 'block', width: '24px', height: '24px' },
  );
  svg.viewport = { left: origin[0], top: origin[1], width: 24, height: 24 };
  svg.getBoundingClientRect = () => ({ ...svg.viewport });
  const nodes = [];
  for (const state of reference.states) {
    const group = node(
      'g',
      svg,
      {
        'data-part': state.partId,
        'data-role': 'state',
        'data-state': state.id,
        opacity: state.id === reference.defaultState ? '1' : '0',
      },
      { opacity: String(opacity?.[state.id] ?? (state.id === reference.defaultState ? 1 : 0)) },
    );
    nodes.push(group);
    for (const path of staticStatePathsReference(reference, state))
      nodes.push(
        node(
          'path',
          group,
          {
            'data-part': path.partId,
            'data-role': path.role,
            d: path.d,
            fill: path.fill,
            'fill-rule': path.fillRule,
          },
          { 'fill-rule': path.fillRule, d: `path("${path.d}")` },
        ),
      );
    group.querySelectorAll = (selector) => {
      assert.equal(selector, 'path');
      return nodes.filter((item) => item.parentElement === group && item.localName === 'path');
    };
  }
  if (injected)
    nodes.push(
      node(injected.tag, svg, {
        'data-part': 'invented-overlay',
        'data-role': 'content',
        ...(injected.path
          ? { d: injected.path.d, fill: injected.path.fill, 'fill-rule': injected.path.fillRule }
          : {}),
      }),
    );
  mutate({
    svg,
    groups: nodes.filter((item) => item.localName === 'g'),
    paths: nodes.filter((item) => item.localName === 'path'),
  });
  svg.querySelectorAll = (selector) => {
    if (selector === '*' || selector === '[data-part]') return nodes;
    if (selector === 'g[data-state][data-part]')
      return nodes.filter((item) => item.localName === 'g');
    assert.equal(selector, '[data-part="null"]');
    return [];
  };
  svg.querySelector = (selector) => {
    assert.equal(selector, '[data-part="null"]');
    return null;
  };
  const native = {
    getBoundingClientRect: () => ({ width: 48, height: 48 }),
    type: 'button',
    getAttribute: () => 'action',
    querySelector: () => ({ getAttribute: () => 'true' }),
  };
  const scope = {
    stateSvg: svg,
    stateButton: {
      shadowRoot: { querySelector: () => native },
      isConnected: true,
      computed: style,
    },
    stateCapabilitiesValue: stateCapabilitiesReference(reference),
    stateOpacity: () => [],
    stateEnclosure: null,
    originalStateNodes: [...nodes],
    sharedNodes: new Map(),
    stateTarget: reference.defaultState,
    stateControl: null,
    stateEvents: [],
    stateNativeClicks: 0,
    stateStatus: { textContent: '' },
    stateSelect: { value: reference.defaultState },
    enclosurePresentation: null,
    configuration: sourceStateReferenceContract(reference.group),
    getComputedStyle: (item) => ({ ...item.computed, ...declaration(item.computed) }),
    document: { createElementNS: () => ({ style: declaration({}) }) },
  };
  return new Function(
    ...Object.keys(scope),
    `${source.slice(start, end)}\n${source.slice(readStart, readEnd)}\nreturn readState();`,
  )(...Object.values(scope));
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
      {
        tag: 'path',
        path: {
          d: 'M0 0H24V24H0Z',
          fillRule: 'nonzero',
          fill: 'currentColor',
          partId: 'invented-overlay',
          role: 'content',
        },
      },
      { tag: 'rect' },
      { tag: 'circle' },
      { tag: 'use' },
      { tag: 'text' },
    ]) {
      const extra = collectedState(reference, { injected });
      assert.throws(() => assertStateAnatomy(extra, reference), /необъявленную геометрию/);
    }
  }
  assert.equal(
    references['visibility-filled'].states.find((state) => state.id === 'visible').paths.length,
    1,
  );
  assert.equal(references.microphone.states.find((state) => state.id === 'muted').paths.length, 5);
  assert.notDeepEqual(
    references.microphone.states[0].paths,
    references['microphone-filled'].states[0].paths,
  );
});

test('source anatomy refuses root, state and path presentation changes while preserving inherited color and state opacity', async (t) => {
  const { references } = await fixture(t);
  for (const reference of Object.values(references)) {
    assertStateAnatomy(
      collectedState(reference, {
        color: 'rgb(71, 110, 145)',
        opacity: Object.fromEntries(reference.states.map((state) => [state.id, 0.5])),
        mutate: ({ groups }) => {
          for (const group of groups) group.attributes.style = 'opacity: 0.5';
        },
      }),
      reference,
    );
    for (const target of ['svg', 'groups', 'paths']) {
      const mutations = [
        (item) => {
          item.attributes.stroke = 'currentColor';
          item.attributes['stroke-width'] = '6';
        },
        (item) => {
          item.attributes.transform = 'translate(8 0)';
        },
        (item) => {
          item.attributes.style = 'fill: transparent';
        },
        (item) => {
          item.computed.stroke = 'rgb(71, 110, 145)';
        },
        (item) => {
          item.computed.transform = 'matrix(1, 0, 0, 1, 8, 0)';
        },
        (item) => {
          item.computed.fill = 'rgba(0, 0, 0, 0)';
        },
      ];
      for (const mutate of mutations) {
        const changed = collectedState(reference, {
          mutate: (tree) => mutate(target === 'svg' ? tree.svg : tree[target][0]),
        });
        assert.equal(changed.identity, true);
        assert.throws(
          () => assertStateAnatomy(changed, reference),
          /presentation|paint|геометри|атрибут|style|заливк/,
        );
      }
    }
    for (const mutate of [
      ({ paths }) => {
        paths[0].computed.d = 'path("M0 0H24V24H0Z")';
      },
      ({ paths }) => {
        paths[0].computed['fill-rule'] =
          paths[0].computed['fill-rule'] === 'nonzero' ? 'evenodd' : 'nonzero';
      },
      ({ svg }) => {
        svg.computed.opacity = '0.5';
      },
      ({ paths }) => {
        paths[0].computed.opacity = '0.5';
      },
      ({ groups }) => {
        groups[0].computed.opacity = '';
      },
      ({ svg }) => {
        svg.computed['background-color'] = 'rgb(71, 110, 145)';
      },
      ({ paths }) => {
        paths[0].computed['clip-path'] = 'inset(50%)';
      },
      ({ paths }) => {
        paths[0].computed['offset-path'] = 'path("M0 0L8 0")';
      },
    ])
      assert.throws(
        () => assertStateAnatomy(collectedState(reference, { mutate }), reference),
        /source presentation/,
      );
  }
});

test('source anatomy observes the physical viewport and every source CTM independently of unscaled CSS dimensions', async (t) => {
  const { references } = await fixture(t);
  for (const reference of Object.values(references)) {
    assertStateAnatomy(
      collectedState(reference, {
        origin: [233.375, 456.0625],
        color: 'rgb(71, 110, 145)',
        opacity: Object.fromEntries(reference.states.map((state) => [state.id, 0.5])),
      }),
      reference,
    );
    for (const mutate of [
      ({ svg }) => {
        svg.computed.zoom = '.5';
        svg.viewport.width = 12;
        svg.viewport.height = 12;
      },
      ({ svg }) => {
        svg.viewport.width = 12;
        svg.viewport.height = 12;
      },
      ({ svg }) => {
        svg.screenCtm[0] = 0.5;
        svg.screenCtm[3] = 0.5;
      },
      ({ groups }) => {
        groups[0].computed.zoom = '.5';
      },
      ({ groups }) => {
        groups[0].screenCtm[0] = 0.5;
        groups[0].screenCtm[3] = 0.5;
      },
      ({ paths }) => {
        paths[0].computed.zoom = '.5';
      },
      ({ paths }) => {
        paths[0].screenCtm[4] += 8;
      },
      ({ paths }) => {
        paths[0].screenCtm = null;
      },
    ]) {
      const changed = collectedState(reference, { mutate });
      assert.equal(changed.presentation.nodes[0].computed.width, '24px');
      assert.equal(changed.presentation.nodes[0].computed.height, '24px');
      assert.equal(changed.identity, true);
      assert.throws(() => assertStateAnatomy(changed, reference), /source presentation/);
    }
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
    '@labpics/icons/states/microphone',
    '@labpics/icons/states/microphone-filled',
    '@labpics/icons/states/visibility',
    '@labpics/icons/states/visibility-filled',
  ]);
  const old = consumerPublicEntries(9);
  assert.deepEqual(
    consumerPublicEntries(10).filter((entry) => !old.includes(entry)),
    SOURCE_STATE_ENTRIES,
  );
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
  assert.deepEqual(
    subjectStateReferences({
      schemaVersion: 10,
      stateReferences: { a: 1 },
      sourceStateReferences: { b: 2 },
    }),
    { a: 1, b: 2 },
  );
});

// Независимый снимок UTF-8 outputs Git63b6013, до добавления presentation-групп.
const LEGACY_SCHEMA_ORACLE = [
  [
    1,
    'a3da98e09017e6320f3801ed62e92df61eeae9950b25f55cbea8665ce05a6b9f',
    '7b582e5d14bc4ce7cee18cbd4c7fa5ac9c207c2dce1ae4cc1006bee48509f8d1',
  ],
  [
    2,
    '732183f518eb363e24d41e0d1b4875bc662c07bc62c84d23b9b8120ac4c9476c',
    'db4d6a688b9713ee3c0ffc4a4b7e548da089dde8361a019ca2f5cc6bbc4203cb',
  ],
  [
    3,
    '37c9312c21e921d6c0ae31b5727e3a35314a80e6ea5c742a14c154b83b2a140f',
    '1ee14a25f18470e1172afca229a1a385d3a497725eb92e4a23175db54111176d',
  ],
  [
    4,
    '3a50523174be4cdee63002b68731ed0d6c1a85e8374a6bf29ac07102100e8483',
    '45c8ba43916e981cd7e412bf90af0e77bf9aeaffc730c462627006f6e579f3e6',
  ],
  [
    5,
    '47fda332d4f216490aa59223200a1ba0128f896313917f7555ae32933bbf4f1f',
    '75daf0e72e747658b2f392790cf4646e6942156b675ef3c9b220c96de7719d33',
  ],
  [
    6,
    '96c0fcd23f73139de8cc25ef6b2130b1be564d42dd9fdd8a5da66c9c392b574a',
    '178700dbb1491b0ae8358f8f1800fc927661d3381e696e3bbed4d1afa4b1ced8',
  ],
  [
    7,
    '13a3b6cace8d02b3b1e814dbb895fb21cd8f63cd20ae2796c8277670810a82c4',
    '7191660ffe9d6cbaf1fbef42adcae93056bf6d027bbdd700152ec62dcc86edd8',
  ],
  [
    8,
    '44d374a1d53336a78037e2c93711acb33f37926f781552f5bf07c3aa96d703b5',
    '70346b41a6a68b6b4fbb8d8bb8641fc0f7e084d1a1bf05fd4e2f10f9d29d0b86',
  ],
  [
    9,
    'db4286d4a84ccfab8677c5d4650809412fc9352378d8bd66c7853438e3909911',
    'bbdb8c0dff35f1d417a49be2c8201f1012c3926d92365ab4ea6f5cb08d7f62ed',
  ],
  [
    10,
    '691911c1e512a303d77aeb982237621fdb28972c44f6153cd369d57b8bb0e4dd',
    '052376adf218f09d72f374fcdc4670e870b882523ceeb4e161cc79be991a3425',
  ],
  [
    11,
    '1260959f3c54ce12b2582e99ed8928ea2a0aa8e529538397e72eba68cd426ce9',
    '4ebe4e10bd9f4fa5e8c66a768da1291d9dd9bc82ea220cab997ea3d2a0edc887',
  ],
  [
    12,
    '4a16985a4bab641d513b73c5d8973d25c9d065b3f9577223f56b124a24722360',
    '5fb3cc307c73001ff6aca360a9a7cb169ba0f0a772b30439bc190772fb518483',
  ],
  [
    13,
    '4a16985a4bab641d513b73c5d8973d25c9d065b3f9577223f56b124a24722360',
    '5fb3cc307c73001ff6aca360a9a7cb169ba0f0a772b30439bc190772fb518483',
  ],
];
const hash = (value) => createHash('sha256').update(value).digest('hex');

test('schema1–13 preserve exact imports, fixture bytes and source-state type consumers', () => {
  for (const [schema, fixtureHash, entriesHash] of LEGACY_SCHEMA_ORACLE) {
    assert.equal(hash(consumerFixture(schema)), fixtureHash, `fixture schema${schema}`);
    assert.equal(
      hash(JSON.stringify(consumerPublicEntries(schema))),
      entriesHash,
      `imports schema${schema}`,
    );
    assert.equal(
      hash(sourceStateFixture(schema)),
      '2f9357517035651c7facf13f94c58c44e9fc8f4f42348b5d7494607c4eb43bdf',
    );
    assert.equal(
      hash(sourceStateTypeFixture(schema)),
      '4e822f10c671509eefe86a55156e4942b9f5c5460e2016130cc10257a7bcefc5',
    );
    assert.deepEqual(sourceStateGroups(schema), SOURCE_STATE_GROUPS);
    assert.deepEqual(sourceStateEntries(schema), SOURCE_STATE_ENTRIES);
  }
});

const PRESENTATION_ENTRIES = [
  '@labpics/icons/states/microphone-presentation',
  '@labpics/icons/states/microphone-presentation-filled',
  '@labpics/icons/states/plus-presentation',
  '@labpics/icons/states/plus-presentation-filled',
];

test('schema14 adds four presentation imports to the same state consumer and executor', () => {
  const old = consumerPublicEntries(13);
  const entries = consumerPublicEntries(14);
  assert.deepEqual(
    entries.filter((entry) => old.includes(entry)),
    old,
  );
  assert.deepEqual(
    entries.filter((entry) => !old.includes(entry)),
    PRESENTATION_ENTRIES,
  );
  assert.deepEqual(sourceStateEntries(14), [...SOURCE_STATE_ENTRIES, ...PRESENTATION_ENTRIES]);
  for (const entry of PRESENTATION_ENTRIES) assertIconsImport(entry);
  const source = consumerFixture(14);
  assert.equal(hash(source), '5eb08f888edb01a3cf315e394d6e4de82e4f9d9a0b4a4835ce5ca3e1f1797c07');
  assert.equal(hash(JSON.stringify(entries)), '678ab542b583c2b2a14b3608ca267bf8c3507a87dca5bd6c84b50f6fc9229ea1');
  assert.ok(source.includes(sourceStateFixture(14)));
  assert.equal((source.match(/function mountStateConsumer\(/g) ?? []).length, 1);
  assert.equal((source.match(/const sourceConsumer\d = mountStateConsumer/g) ?? []).length, 8);
  const types = sourceStateTypeFixture(14);
  assert.equal((types.match(/@ts-expect-error/g) ?? []).length, 24);
  assert.equal((types.match(/source-replacement/g) ?? []).length, 8);
  for (const schema of [0, 16, 13.5, '14']) {
    assert.throws(() => sourceStateGroups(schema));
    assert.throws(() => consumerFixture(schema));
    assert.throws(() => consumerPublicEntries(schema));
  }
});

test('presentation endpoints preserve independent author paths and counters through the browser observer', async (t) => {
  const { references } = await fixture(t, 14);
  assert.equal(Object.keys(references).length, 8);
  assert.equal(Object.keys(snapshot.masters).length, 14);
  for (const entry of PRESENTATION_ENTRIES) {
    const group = entry.split('/').at(-1);
    const reference = references[group];
    validateStateReference(reference, pin.figma, group);
    assert.equal(reference.defaultState, 'plain');
    assert.deepEqual(
      reference.states.map((state) => state.id),
      ['circle', 'plain'],
    );
    assert.deepEqual(reference.sharedParts, []);
    assert.equal(reference.enclosurePartId, null);
    assert.equal(reference.proof.enclosureSha256, null);
    const capability = stateCapabilitiesReference(reference);
    assert.equal(capability.transition, 'source-replacement');
    assert.equal(capability.morph, 'unavailable');
    for (const state of reference.states) {
      assert.deepEqual(
        state.paths,
        readAuthorMaster(Buffer.from(snapshot.masters[state.sourceFile])).paths,
      );
      assert.equal(state.author.masterSha256, hash(snapshot.masters[state.sourceFile]));
      assert.deepEqual(
        state.contentPartIds,
        snapshot.semantic.groups[group].states[state.id].contentPartIds,
      );
    }
    assertStateAnatomy(collectedState(reference), reference);
    assertStateAnatomy(
      collectedState(reference, { opacity: { plain: 0.4, circle: 0.6 } }),
      reference,
    );
    const extra = collectedState(reference, { injected: { tag: 'circle' } });
    assert.throws(() => assertStateAnatomy(extra, reference), /необъявленную геометрию/);
    const missing = structuredClone(reference);
    missing.states.pop();
    assert.throws(() => validateStateReference(missing, pin.figma, group));
    const wrongVariant = structuredClone(reference);
    wrongVariant.variant = reference.variant === 'outline' ? 'filled' : 'outline';
    assert.throws(() => validateStateReference(wrongVariant, pin.figma, group));
  }
  const circle = (group) => references[group].states.find((state) => state.id === 'circle');
  assert.equal(circle('microphone-presentation').paths.length, 3);
  assert.equal(circle('microphone-presentation-filled').paths.length, 1);
  assert.equal(circle('microphone-presentation-filled').paths[0].fillRule, 'evenodd');
  assert.equal(circle('plus-presentation').paths.length, 2);
  assert.equal(circle('plus-presentation-filled').paths.length, 1);
  assert.equal(circle('plus-presentation-filled').paths[0].fillRule, 'evenodd');
});
