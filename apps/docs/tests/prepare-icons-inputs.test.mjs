import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  assertStateAnatomy,
  stateCapabilitiesReference,
  staticStatePathsReference,
  subjectStateReferences,
  validateStateReference,
  validateSubject,
} from './icons-packed.mjs';
import {
  assertPublicProvenance,
  projectPlatformMeasurement,
  projectPublicProvenance,
  publicApiRefusal,
  publicFailure,
} from './icons-public-provenance.mjs';
import {
  authorReference,
  consumerReceiptLog,
  consumerVisualLog,
  platformMeasurementLog,
  readAuthorMaster,
  readCycleMaster,
  stateReference,
  validatePlatformMeasurement,
  validateSourcePin,
} from './prepare-icons-inputs.mjs';

// Заморожены raw SVG и строки reload из Git a31c881e335d9e5b4d0d4c690931a6cf444e52ce.
// Это witness потребителя; producer helpers и generated glyph не формируют expected.
const RAW_FILE_KEY = 'SyntheticFigmaAuthorKey01';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const PIN = {
  schemaVersion: 2,
  repository: 'Labpics-Team/lab-icons',
  sourceCommit: 'a31c881e335d9e5b4d0d4c690931a6cf444e52ce',
  figma: {
    fileKeyLength: RAW_FILE_KEY.length,
    fileKeySha256: hash(RAW_FILE_KEY),
    version: '2416636003859748575',
  },
};

const MANIFEST = {
  schemaVersion: 1,
  source: {
    kind: 'figma',
    name: '🧪Lab UI (v2.1)',
    fileKey: RAW_FILE_KEY,
    version: '2416636003859748575',
    lastModified: '2026-11-01T01:18:02Z',
    pageId: '4045:632',
    frames: {
      outline: '8513:1000',
      filled: '6397:2241',
    },
    capturedAt: '2026-11-01T02:22:39.173Z',
    geometrySnapshotSha256: '622f0ccb116c0dad940b6d11b590ca78952ee460c42cad69f8c3d0cc8353c967',
  },
  icons: {
    reload: {
      filled: {
        nodeId: '6413:79',
        nodeSha256: '73a64f7a2fb9ec448c00f8b627e2bb8dc744a0e5c0ec3cac504223792cb17601',
        master: 'masters/figma/2416636003859748575/Filled/reload.svg',
        sha256: '3c7a57edcdac59581175696289e383f78ec43381bcbb72ed49c5034ae8ae871a',
        bytes: 1136,
        normalizedSource: {
          status: 'supported',
          sha256: 'a52aa08e898c62cdf5cb57a73f67ad2385cd0b3b6ff3fd2a144741d04e83a322',
          pathFingerprintSha256: '3441f62d5640362954f6229439a867913aee6aae98c463ee11a326419b958c62',
          priorGeometryFingerprint: 'changed',
        },
      },
      outline: {
        nodeId: '6431:3898',
        nodeSha256: 'feaaeb86b97b3013999ca9054bc166caf9b8e38bc62af0d5926b153d92f6c140',
        master: 'masters/figma/2416636003859748575/Outline/reload.svg',
        sha256: '9a6784d21805bb7374a37a62fab427be8a49b985bdb5ffc04876bfb3ed93bd80',
        bytes: 1325,
        normalizedSource: {
          status: 'supported',
          sha256: '66ae7016611a7c639ac4b666959308e485fd4a90f9d029f5607eaccf5a121513',
          pathFingerprintSha256: '0539b295f7e1087d3f3fb12524d578c5cdfb0a19655ea99786cee975b52b8f7c',
          priorGeometryFingerprint: 'changed',
        },
      },
    },
  },
};

const ANNOTATIONS = {
  schemaVersion: 1,
  source: {
    fileKey: RAW_FILE_KEY,
    version: '2416636003859748575',
  },
  icons: {
    reload: {
      outline: {
        masterSha256: '9a6784d21805bb7374a37a62fab427be8a49b985bdb5ffc04876bfb3ed93bd80',
        pathFingerprintSha256: '0539b295f7e1087d3f3fb12524d578c5cdfb0a19655ea99786cee975b52b8f7c',
        parts: [
          {
            pathIndex: 0,
            id: 'cycle-body',
            role: 'control',
            anchor: [0.5, 0.5],
            anchorMeaning: 'canvas-center',
          },
        ],
        gesture: {
          law: 'cycle.clockwise',
          partId: 'cycle-body',
        },
      },
      filled: {
        masterSha256: '3c7a57edcdac59581175696289e383f78ec43381bcbb72ed49c5034ae8ae871a',
        pathFingerprintSha256: '3441f62d5640362954f6229439a867913aee6aae98c463ee11a326419b958c62',
        parts: [
          {
            pathIndex: 0,
            id: 'cycle-body',
            role: 'control',
            anchor: [0.5, 0.5],
            anchorMeaning: 'canvas-center',
          },
        ],
        gesture: {
          law: 'cycle.clockwise',
          partId: 'cycle-body',
        },
      },
    },
  },
};

const MASTERS = {
  filled:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g id="reload" data-node-id="6413:79">\n<path id="Vector" data-node-id="6418:581" d="M11.8759 1.63672C13.2773 1.63529 14.6647 1.9184 15.9531 2.46973C16.9398 2.89201 17.8534 3.46421 18.6611 4.16504L19.0009 4.47364L19.2959 4.76856L20.7871 3.28028C21.4235 2.64442 22.5116 3.09538 22.5117 3.99512V8.68164C22.5114 9.23917 22.0584 9.69119 21.5009 9.69141H16.8115C15.9115 9.69141 15.4603 8.60307 16.0966 7.9668L17.5986 6.46485C16.8632 5.70208 15.9831 5.09278 15.0088 4.67579C14.0192 4.2524 12.9533 4.03486 11.8769 4.03614C7.48114 4.0362 3.91343 7.60328 3.91309 11.999C3.9133 16.3947 7.47939 19.9605 11.875 19.9609C13.5217 19.9607 15.1289 19.4514 16.4736 18.501C17.8183 17.5502 18.8362 16.2048 19.3857 14.6523C19.6071 14.0283 20.2927 13.7013 20.917 13.9219C21.5412 14.143 21.8689 14.8287 21.6484 15.4531C20.9334 17.4734 19.6092 19.2238 17.8593 20.4609C16.2189 21.6204 14.2789 22.2767 12.2773 22.3545L11.8769 22.3623C6.15562 22.3622 1.51194 17.7203 1.51172 11.999C1.51206 6.27833 6.15348 1.63765 11.874 1.63672H11.8759Z" fill="#101012"/>\n</g>\n</svg>\n',
  outline:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n<g id="reload" data-node-id="6431:3898">\n<path id="Vector" data-node-id="6432:408" d="M12.2158 1.85449C13.4135 1.91402 14.5922 2.18639 15.6973 2.65918C16.8026 3.13218 17.8143 3.79742 18.6846 4.62305L19.0498 4.9873L19.0644 5.00293L19.0664 5.00488L19.0752 5.0166L20.8447 3.25097C21.4719 2.62466 22.5439 3.06856 22.5439 3.95508V8.66504C22.5437 9.21444 22.0972 9.65994 21.5478 9.66015H16.8349C15.9481 9.66015 15.5039 8.58795 16.1308 7.96094L17.7998 6.29199L17.7324 6.21387C16.9557 5.40173 16.0225 4.75562 14.9892 4.31347C14.0803 3.92458 13.1103 3.70111 12.125 3.65234L11.7021 3.64258C7.08849 3.64261 3.34482 7.38538 3.34473 11.999C3.34473 16.6124 7.08696 20.3549 11.7002 20.3555L12.0244 20.3506L12.3271 20.333C13.8342 20.2197 15.2868 19.6991 16.5273 18.8223C17.9385 17.8246 19.0063 16.4143 19.583 14.7851L19.584 14.7832L19.6172 14.7012L19.6182 14.6992C19.8131 14.2872 20.2924 14.0812 20.7314 14.2363C21.2001 14.4022 21.4451 14.9172 21.2793 15.3857L21.1416 15.7529C20.4153 17.5773 19.1743 19.1552 17.5664 20.292C16.0586 21.3578 14.2929 21.9904 12.4609 22.1279L12.0937 22.1494L11.7021 22.1562C6.09435 22.1562 1.54395 17.6068 1.54395 11.999C1.54404 6.39127 6.09343 1.84283 11.7012 1.84277L12.2158 1.85449Z" fill="#101012"/>\n</g>\n</svg>\n',
};

const RECEIPTS = {
  outline: 'ab0a24b5a6f67c8ce5b264aa102bae704e463c0962b222b5713fcab19fe11f74',
  filled: '157c4e6842639651634bcf36424acb1553a5e69def0afaee4a18ee313842d05f',
};
const wholePath = (variant) => MASTERS[variant].match(/\bd="([^"]+)"/)[1];
const expectedGesture = {
  id: 'reload.cycle',
  kind: 'cycle',
  meaning:
    'Один оборот команды обновления по часовой стрелке; промежуточную позу можно развернуть или продолжить.',
  partIds: ['cycle-body'],
  progress: 'normalized-0-to-1',
  tracks: [
    {
      partId: 'cycle-body',
      kind: 'rotate',
      anchor: [0.5, 0.5],
      from: 0,
      to: 360,
      unit: 'degrees',
      interpolation: 'linear',
    },
  ],
};

async function writeJSON(root, path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), `${JSON.stringify(value)}\n`);
}

async function rawFixture(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-icons-oracle-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.match(basename(resolved), /^labui-icons-oracle-/);
    await rm(resolved, { recursive: true });
  });
  await writeJSON(root, 'semantics/figma-baseline.json', MANIFEST);
  await writeJSON(root, 'semantics/author-anatomy.json', ANNOTATIONS);
  for (const variant of ['outline', 'filled']) {
    const file = MANIFEST.icons.reload[variant].master;
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), MASTERS[variant]);
  }
  return root;
}

function assertReference(reference) {
  assert.equal(reference.fileName, '🧪Lab UI (v2.1)');
  assert.equal(reference.fileKeySha256, PIN.figma.fileKeySha256);
  assert.equal(reference.version, PIN.figma.version);
  assert.deepEqual(Object.keys(reference.icons), ['reload']);
  assert.deepEqual(Object.keys(reference.icons.reload).sort(), ['filled', 'outline']);
  for (const variant of ['outline', 'filled']) {
    const item = reference.icons.reload[variant];
    const record = MANIFEST.icons.reload[variant];
    assert.deepEqual(item.viewBox, [0, 0, 24, 24]);
    assert.deepEqual(item.paths, [{ d: wholePath(variant), fillRule: 'nonzero' }]);
    assert.deepEqual(item.parts, [
      {
        id: 'cycle-body',
        role: 'control',
        zIndex: 0,
        d: wholePath(variant),
        fillRule: 'nonzero',
      },
    ]);
    assert.deepEqual(item.gesture, expectedGesture);
    assert.deepEqual(item.anatomy, {
      version: 1,
      annotationSha256: RECEIPTS[variant],
      masterSha256: record.sha256,
      pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
    });
    assert.equal(item.sourceFile, record.master);
    assert.deepEqual(item.author, {
      kind: 'figma',
      fileKeySha256: PIN.figma.fileKeySha256,
      version: PIN.figma.version,
      nodeIdSha256: hash(record.nodeId),
      nodeSha256: record.nodeSha256,
      masterSha256: record.sha256,
      normalizedSha256: record.normalizedSource.sha256,
      pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
    });
  }
}

test('current pin retains the frozen author identity and both masters remain whole', async () => {
  const actualPin = validateSourcePin(
    JSON.parse(await readFile(new URL('./icons-consumer-source.json', import.meta.url))),
  );
  assert.equal(actualPin.schemaVersion, PIN.schemaVersion);
  assert.equal(actualPin.repository, PIN.repository);
  assert.deepEqual(actualPin.figma, {
    fileKeyLength: 22,
    fileKeySha256: '0462b63eb5318980a5797205910d6e29fec02227f7eef140a8d1e97b6670016b',
    version: PIN.figma.version,
  });
  assert.equal(actualPin.sourceCommit, 'dc04d50903c658c29782f900da33a83c9a3fcb93');
  for (const variant of ['outline', 'filled']) {
    const bytes = Buffer.from(MASTERS[variant]);
    assert.equal(bytes.length, MANIFEST.icons.reload[variant].bytes);
    assert.equal(hash(bytes), MANIFEST.icons.reload[variant].sha256);
    assert.deepEqual(readCycleMaster(bytes), {
      viewBox: [0, 0, 24, 24],
      paths: [{ d: wholePath(variant), fillRule: 'nonzero' }],
    });
  }
});

test('unsupported rendering and malformed structure refuse instead of approximating', () => {
  const mutations = [
    ['group transform', (svg) => svg.replace('<g ', '<g transform="translate(1 0)" ')],
    ['path opacity', (svg) => svg.replace('<path ', '<path opacity="0.5" ')],
    ['different paint', (svg) => svg.replace('fill="#101012"', 'fill="#fff"')],
    ['broken nesting', (svg) => svg.replace('</g>', '</path>')],
    ['root transform', (svg) => svg.replace('<svg ', '<svg transform="scale(2)" ')],
    ['clipped path', (svg) => svg.replace('<path ', '<path clip-path="url(#clip)" ')],
    ['extra path', (svg) => svg.replace('</g>', '<path d="M0 0L1 0L1 1Z" fill="#101012"/></g>')],
    ['entity', (svg) => svg.replace('id="reload"', 'id="rel&#111;ad"')],
  ];
  for (const variant of ['outline', 'filled']) {
    const source = MASTERS[variant];
    for (const [label, mutate] of mutations) {
      const mutant = mutate(source);
      assert.notEqual(mutant, source, label);
      assert.throws(() => readCycleMaster(Buffer.from(mutant)), undefined, `${variant}: ${label}`);
    }
  }
});

test('inert metadata and neutral wrappers preserve the whole author contour', () => {
  for (const variant of ['outline', 'filled']) {
    const neutral = MASTERS[variant]
      .replace('<path ', '<g id="neutral" data-node-id="1:1"><path ')
      .replace('/>\n</g>', '/></g>\n</g>');
    assert.notEqual(neutral, MASTERS[variant]);
    assert.deepEqual(
      readCycleMaster(Buffer.from(neutral)),
      readCycleMaster(Buffer.from(MASTERS[variant])),
    );
  }
});

test('reference succeeds from data alone with frozen binding and clockwise gesture', async (t) => {
  const root = await rawFixture(t);
  assertReference(await authorReference(root, PIN));
});

test('private producer imports cannot become an oracle dependency', async (t) => {
  const root = await rawFixture(t);
  const expected = await authorReference(root, PIN);
  await writeJSON(root, 'package.json', { type: 'module' });
  for (const path of [
    'scripts/lib/author-baseline.js',
    'scripts/lib/author-anatomy.js',
    'src/core/icon-geometry.js',
  ]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), 'throw new Error("POISONED_PRIVATE_PRODUCER_IMPORT");\n');
  }
  assert.deepEqual(await authorReference(root, PIN), expected);
  assertReference(expected);
});

test('a producer role mutant cannot redefine the expected control part', async (t) => {
  const root = await rawFixture(t);
  const baseline = { icons: { reload: {} } };
  const contracts = {};
  for (const variant of ['outline', 'filled']) {
    const record = MANIFEST.icons.reload[variant];
    baseline.icons.reload[variant] = {
      master: record.master,
      author: {
        kind: 'figma',
        fileKey: RAW_FILE_KEY,
        version: PIN.figma.version,
        nodeId: record.nodeId,
        nodeSha256: record.nodeSha256,
        masterSha256: record.sha256,
        normalizedSha256: record.normalizedSource.sha256,
        pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
      },
      normalizedSvg: MASTERS[variant],
    };
    contracts[`reload/${variant}`] = {
      anatomy: {
        version: 1,
        annotationSha256: RECEIPTS[variant],
        masterSha256: record.sha256,
        pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
      },
      parts: [{ id: 'cycle-body', role: 'container', zIndex: 0 }],
      gestures: [expectedGesture],
    };
  }
  await writeJSON(root, 'package.json', { type: 'module' });
  await mkdir(join(root, 'scripts/lib'), { recursive: true });
  await mkdir(join(root, 'src/core'), { recursive: true });
  await writeFile(
    join(root, 'scripts/lib/author-baseline.js'),
    `export function loadAuthorBaseline() { return ${JSON.stringify(baseline)}; }\n`,
  );
  const helper = join(root, 'scripts/lib/author-anatomy.js');
  await writeFile(
    helper,
    `export function compileAuthorAnatomy() { return ${JSON.stringify(contracts)}; }\n`,
  );
  await writeFile(
    join(root, 'src/core/icon-geometry.js'),
    'export function authorPathEntries(svg) { return [{ d: svg.match(/\\bd="([^"]+)"/)[1], fillRule: "nonzero" }]; }\n',
  );
  const producer = await import(pathToFileURL(helper));
  const mutant = producer.compileAuthorAnatomy();
  assert.equal(mutant['reload/outline'].parts[0].role, 'container');
  assert.equal(mutant['reload/filled'].parts[0].role, 'container');
  const independent = await authorReference(root, PIN);
  assertReference(independent);
  assert.notEqual(
    mutant['reload/outline'].parts[0].role,
    independent.icons.reload.outline.parts[0].role,
  );
});

test('wrong raw annotation roles refuse, rather than changing the expected consumer', async (t) => {
  const root = await rawFixture(t);
  const annotation = structuredClone(ANNOTATIONS);
  annotation.icons.reload.outline.parts[0].role = 'container';
  await writeJSON(root, 'semantics/author-anatomy.json', annotation);
  await assert.rejects(authorReference(root, PIN), /control/);
});

// Малый synthetic witness проверяет reader и binding; actual Figma masters
// читаются отдельно штатным prepareInputs из закреплённого checkout.
const STATE_ICONS = {
  attention: 'alert-circle',
  confirmation: 'checkmark-circle',
  decrease: 'minus-circle',
  dismissal: 'close-circle',
  increase: 'plus-circle',
  question: 'question-circle',
};
const SHELL = 'M2 2L22 2L22 22L2 22ZM4 4L4 20L20 20L20 4Z';
const CONTENT = 'M9 9L15 9L12 15Z';
const DOT = 'M11 17L13 17L13 19L11 19Z';
const pathFingerprint = (paths) =>
  hash(JSON.stringify(paths.map((path, index) => ({ d: path.d, fillRule: path.fillRule, index }))));
async function stateFixture(t, schemaVersion = 1) {
  const root = await rawFixture(t);
  const manifest = structuredClone(MANIFEST);
  const document = {
    schemaVersion,
    source: { fileKey: RAW_FILE_KEY, version: PIN.figma.version },
    groups: {
      'status-circle': {
        law: 'enclosure.replace',
        defaultState: 'question',
        enclosurePartId: 'status-enclosure',
        ...(schemaVersion === 2
          ? { sharedParts: [{ id: 'status-enclosure', role: 'container' }] }
          : {}),
        states: {},
      },
    },
  };
  const texts = {};
  for (const [index, [id, icon]] of Object.entries(STATE_ICONS).entries()) {
    const paths = ['attention', 'question'].includes(id)
      ? [
          { d: DOT, fillRule: 'nonzero' },
          { d: CONTENT, fillRule: 'nonzero' },
        ]
      : [{ d: CONTENT, fillRule: 'nonzero' }];
    paths.push({ d: SHELL, fillRule: 'evenodd' });
    const content = paths
      .map((path) => `<path d="${path.d}" fill-rule="${path.fillRule}" fill="#101012"/>`)
      .join('');
    const text = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="neutral">${content}</g></svg>`;
    const file = `masters/figma/${PIN.figma.version}/Outline/${icon}.svg`;
    const bytes = Buffer.from(text);
    const fingerprint = pathFingerprint(paths);
    manifest.icons[icon] = {
      outline: {
        master: file,
        sha256: hash(bytes),
        bytes: bytes.length,
        nodeId: `1:${index + 1}`,
        nodeSha256: hash(`node-${id}`),
        normalizedSource: { sha256: hash(`normalized-${id}`), pathFingerprintSha256: fingerprint },
      },
    };
    document.groups['status-circle'].states[id] = {
      icon,
      variant: 'outline',
      masterSha256: hash(bytes),
      pathFingerprintSha256: fingerprint,
      ...(schemaVersion === 1 ? { enclosurePathIndex: paths.length - 1 } : {}),
      contentPartIds: paths.slice(0, -1).map((_, part) => `${id}-content-${part}`),
    };
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), text);
    texts[id] = { text, paths, file };
  }
  await writeJSON(root, 'semantics/figma-baseline.json', manifest);
  await writeJSON(root, 'semantics/author-state-groups.json', document);
  return { root, manifest, document, texts };
}

const FACE_SHARED = [
  { id: 'face-left-eye', role: 'content', d: 'M6 8L8 8L8 10L6 10Z', fillRule: 'nonzero' },
  { id: 'face-right-eye', role: 'content', d: 'M15 8L18 8L18 10L15 10Z', fillRule: 'nonzero' },
  { id: 'face-enclosure', role: 'container', d: SHELL, fillRule: 'evenodd' },
];
async function expressionFixture(t) {
  const fixture = await stateFixture(t, 2);
  const { root, manifest, document } = fixture;
  const group = {
    law: 'enclosure.replace',
    defaultState: 'aloof',
    enclosurePartId: 'face-enclosure',
    sharedParts: FACE_SHARED.map(({ id, role }) => ({ id, role })),
    states: {},
  };
  document.groups['expression-face'] = group;
  const texts = {};
  for (const [index, id] of ['aloof', 'sad', 'smile'].entries()) {
    const paths = [
      { d: `M8 ${14 + index}L16 ${14 + index}L12 18Z`, fillRule: 'nonzero' },
      ...FACE_SHARED.map(({ d, fillRule }) => ({ d, fillRule })),
    ];
    const text = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g>${paths
      .map((path) => `<path d="${path.d}" fill-rule="${path.fillRule}" fill="#101012"/>`)
      .join('')}</g></svg>`;
    const file = `masters/figma/${PIN.figma.version}/Outline/${id}.svg`;
    const fingerprint = pathFingerprint(paths);
    const record = {
      master: file,
      sha256: hash(text),
      bytes: Buffer.byteLength(text),
      nodeId: `2:${index + 1}`,
      nodeSha256: hash(`face-${id}`),
      normalizedSource: {
        sha256: hash(`face-normalized-${id}`),
        pathFingerprintSha256: fingerprint,
      },
    };
    manifest.icons[id] = { outline: record };
    group.states[id] = {
      icon: id,
      variant: 'outline',
      masterSha256: record.sha256,
      pathFingerprintSha256: fingerprint,
      contentPartIds: [`${id}-mouth`],
    };
    await writeFile(join(root, file), text);
    texts[id] = { text, file, paths };
  }
  await writeJSON(root, 'semantics/figma-baseline.json', manifest);
  await writeJSON(root, 'semantics/author-state-groups.json', document);
  return { ...fixture, texts };
}

async function replaceExpressionPaths(fixture, id, paths) {
  const { root, manifest, document, texts } = fixture;
  const text = texts[id].text
    .replace(/<path[^>]*\/>/g, '')
    .replace(
      '</g>',
      `${paths.map((path) => `<path d="${path.d}" fill-rule="${path.fillRule}" fill="#101012"/>`).join('')}</g>`,
    );
  const record = manifest.icons[id].outline;
  record.sha256 = hash(text);
  record.bytes = Buffer.byteLength(text);
  record.normalizedSource.pathFingerprintSha256 = pathFingerprint(paths);
  Object.assign(document.groups['expression-face'].states[id], {
    masterSha256: record.sha256,
    pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
  });
  await writeFile(join(root, texts[id].file), text);
  await writeJSON(root, 'semantics/figma-baseline.json', manifest);
  await writeJSON(root, 'semantics/author-state-groups.json', document);
}

test('expression raw oracle preserves two ordered eyes and enclosure without producer code', async (t) => {
  const { root, texts } = await expressionFixture(t);
  await mkdir(join(root, 'scripts/lib'), { recursive: true });
  await writeFile(
    join(root, 'scripts/lib/author-state-groups.js'),
    'throw new Error("POISONED_COMPILER");',
  );
  const reference = await stateReference(root, PIN, 'expression-face');
  assert.deepEqual(reference.sharedParts, FACE_SHARED);
  assert.deepEqual(
    reference.sharedPartIds,
    FACE_SHARED.map((part) => part.id),
  );
  assert.equal(validateStateReference(reference, PIN.figma, 'expression-face'), reference);
  for (const state of reference.states) {
    assert.deepEqual(state.paths, texts[state.id].paths);
    assert.deepEqual(state.contentPartIds, [`${state.id}-mouth`]);
    assert.deepEqual(staticStatePathsReference(reference, state), [
      {
        ...texts[state.id].paths[0],
        fill: 'currentColor',
        partId: `${state.id}-mouth`,
        role: 'content',
      },
      ...FACE_SHARED.map(({ id, ...part }) => ({ ...part, fill: 'currentColor', partId: id })),
    ]);
  }
  for (const mutate of [
    (value) => {
      Reflect.deleteProperty(value, 'sharedPartIds');
    },
    (value) => {
      Reflect.deleteProperty(value, 'sharedParts');
    },
    (value) => {
      Reflect.deleteProperty(value.proof, 'sharedPartsSha256');
    },
    (value) => {
      value.sharedPartIds.reverse();
    },
    (value) => {
      value.sharedParts[0].role = 'container';
    },
    (value) => {
      value.sharedParts[1].d = value.sharedParts[0].d;
    },
  ]) {
    const changed = structuredClone(reference);
    mutate(changed);
    assert.throws(() => validateStateReference(changed, PIN.figma, 'expression-face'));
  }
});

test('rehashed expression eye edits, reordering and missing parts refuse while mouth changes remain valid', async (t) => {
  for (const mutate of [
    (paths) => {
      paths[1].d = paths[1].d.replace('6 8', '5 8');
    },
    (paths) => {
      [paths[1], paths[2]] = [paths[2], paths[1]];
    },
    (paths) => {
      paths.splice(1, 1);
    },
  ]) {
    const fixture = await expressionFixture(t);
    const paths = structuredClone(fixture.texts.sad.paths);
    mutate(paths);
    await replaceExpressionPaths(fixture, 'sad', paths);
    await assert.rejects(stateReference(fixture.root, PIN, 'expression-face'));
  }
  const healthy = await expressionFixture(t);
  const paths = structuredClone(healthy.texts.sad.paths);
  paths[0].d = 'M8 14L16 14L12 17Z';
  await replaceExpressionPaths(healthy, 'sad', paths);
  const reference = await stateReference(healthy.root, PIN, 'expression-face');
  assert.equal(reference.states.find((state) => state.id === 'sad').paths[0].d, paths[0].d);
  assert.deepEqual(reference.sharedParts, FACE_SHARED);
});

test('expression semantic declaration refuses changed shared order, roles and incomplete coverage', async (t) => {
  const { root, document } = await expressionFixture(t);
  for (const mutate of [
    (group) => {
      group.sharedParts.reverse();
    },
    (group) => {
      group.sharedParts[0].role = 'container';
    },
    (group) => {
      group.sharedParts.pop();
    },
    (group) => {
      Reflect.deleteProperty(group.states, 'smile');
    },
    (group) => {
      group.states.aloof.contentPartIds.push('another-mouth');
    },
    (group) => {
      group.states.aloof.contentPartIds[0] = 'face-left-eye';
    },
  ]) {
    const changed = structuredClone(document);
    mutate(changed.groups['expression-face']);
    await writeJSON(root, 'semantics/author-state-groups.json', changed);
    await assert.rejects(stateReference(root, PIN, 'expression-face'));
  }
});

test('browser anatomy oracle rejects animated, duplicated, reordered or replaced shared face nodes', async (t) => {
  const { root, texts } = await expressionFixture(t);
  const reference = await stateReference(root, PIN, 'expression-face');
  const observation = {
    viewBox: [0, 0, 24, 24],
    dimensions: [24, 24],
    identity: true,
    groups: reference.states.map((state) => ({
      id: state.id,
      partId: `state-${state.id}`,
      role: 'state',
      paths: [
        {
          ...texts[state.id].paths[0],
          fill: 'currentColor',
          partId: `${state.id}-mouth`,
          role: 'content',
        },
      ],
    })),
    enclosure: {
      d: SHELL,
      fillRule: 'evenodd',
      fill: 'currentColor',
      partId: 'face-enclosure',
      role: 'container',
    },
    enclosureCount: 1,
    enclosureOpacity: 1,
    sharedParts: FACE_SHARED.map(({ id, ...part }) => ({
      ...part,
      partId: id,
      fill: 'currentColor',
      count: 1,
      opacity: 1,
      transform: 'none',
      inStateGroup: false,
      ancestorsUnchanged: true,
      identity: true,
    })),
  };
  assert.doesNotThrow(() => assertStateAnatomy(observation, reference));
  for (const mutate of [
    (value) => {
      value.sharedParts[0].opacity = 0.9;
    },
    (value) => {
      value.sharedParts[0].transform = 'matrix(1, 0, 0, 1, 1, 0)';
    },
    (value) => {
      value.sharedParts[0].inStateGroup = true;
    },
    (value) => {
      value.sharedParts[0].ancestorsUnchanged = false;
    },
    (value) => {
      value.sharedParts[0].count = 2;
    },
    (value) => {
      value.sharedParts[0].identity = false;
    },
    (value) => {
      value.sharedParts.reverse();
    },
    (value) => {
      value.groups[0].paths.push(value.sharedParts[0]);
    },
  ]) {
    const changed = structuredClone(observation);
    mutate(changed);
    assert.throws(() => assertStateAnatomy(changed, reference));
  }
});

test('multi-path author reader preserves countershapes while cycle remains one whole path', () => {
  const source = MASTERS.outline.replace(
    '</g>',
    `<path d="${SHELL}" fill="#101012" fill-rule="evenodd"/></g>`,
  );
  const actual = readAuthorMaster(Buffer.from(source));
  assert.deepEqual(actual.dimensions, [24, 24]);
  assert.deepEqual(actual.paths, [
    { d: wholePath('outline'), fillRule: 'nonzero' },
    { d: SHELL, fillRule: 'evenodd' },
  ]);
  assert.throws(() => readCycleMaster(Buffer.from(source)), /cycle/);
  for (const [name, mutate] of [
    ['transform', (value) => value.replace('<g ', '<g transform="translate(1 0)" ')],
    ['opacity', (value) => value.replace('<path ', '<path opacity="0.5" ')],
    ['paint', (value) => value.replace('#101012', '#ffffff')],
    ['dimension', (value) => value.replace('width="24"', 'width="24px"')],
    ['open inner countershape', (value) => value.replace(SHELL, SHELL.slice(0, -1))],
    ['nonfinite geometry', (value) => value.replace(SHELL, SHELL.replace('22', '1e309'))],
    ['injection', (value) => value.replace('</g>', '<script>alert(1)</script></g>')],
  ])
    assert.throws(() => readAuthorMaster(Buffer.from(mutate(source))), undefined, name);
});

test('state reference derives six whole authored signs and one enclosure before producer imports', async (t) => {
  const { root, texts } = await stateFixture(t);
  await mkdir(join(root, 'scripts/lib'), { recursive: true });
  await writeFile(
    join(root, 'scripts/lib/author-state-groups.js'),
    'throw new Error("POISONED_COMPILER");',
  );
  const reference = await stateReference(root, PIN);
  assert.deepEqual(
    reference.states.map((state) => state.id),
    Object.keys(STATE_ICONS),
  );
  for (const state of reference.states) {
    assert.deepEqual(state.paths, texts[state.id].paths);
    assert.equal(state.author.masterSha256, hash(texts[state.id].text));
    assert.equal(state.partId, `state-${state.id}`);
  }
  assert.deepEqual(reference.enclosure, { d: SHELL, fillRule: 'evenodd' });
  assert.equal(validateStateReference(reference, PIN.figma), reference);
});

test('a rehashed legal shell change cannot redefine common-enclosure identity', async (t) => {
  const { root, manifest, document, texts } = await stateFixture(t);
  const id = 'confirmation';
  const fixture = texts[id];
  const paths = structuredClone(fixture.paths);
  paths.at(-1).d = SHELL.replace('22', '21');
  const changed = fixture.text.replace(SHELL, paths.at(-1).d);
  const record = manifest.icons[STATE_ICONS[id]].outline;
  record.sha256 = hash(changed);
  record.bytes = Buffer.byteLength(changed);
  record.normalizedSource.pathFingerprintSha256 = pathFingerprint(paths);
  Object.assign(document.groups['status-circle'].states[id], {
    masterSha256: record.sha256,
    pathFingerprintSha256: record.normalizedSource.pathFingerprintSha256,
  });
  await writeFile(join(root, fixture.file), changed);
  await writeJSON(root, 'semantics/figma-baseline.json', manifest);
  await writeJSON(root, 'semantics/author-state-groups.json', document);
  await assert.rejects(stateReference(root, PIN), /enclosures/);
});

test('author-state schema2 derives the same raw status geometry without a second path index', async (t) => {
  const old = await stateFixture(t, 1);
  const current = await stateFixture(t, 2);
  const previous = await stateReference(old.root, PIN);
  const actual = await stateReference(current.root, PIN);
  assert.deepEqual(actual.states, previous.states);
  assert.deepEqual(actual.enclosure, previous.enclosure);
  assert.equal(actual.proof.enclosureSha256, previous.proof.enclosureSha256);
  assert.notEqual(actual.proof.specSha256, previous.proof.specSha256);
  assert.deepEqual(actual.sharedPartIds, ['status-enclosure']);
  assert.deepEqual(stateCapabilitiesReference(actual), {
    ...stateCapabilitiesReference(previous),
    sharedPartIds: ['status-enclosure'],
    proof: actual.proof,
  });
  assert.equal(validateStateReference(actual, PIN.figma), actual);
  for (const mutate of [
    (value) => {
      value.sharedPartIds = [];
    },
    (value) => {
      value.proof.sharedPartsSha256 = '0'.repeat(64);
    },
    (value) => {
      Reflect.deleteProperty(value, 'sharedPartIds');
    },
    (value) => {
      Reflect.deleteProperty(value.proof, 'sharedPartsSha256');
    },
  ]) {
    const changed = structuredClone(actual);
    mutate(changed);
    assert.throws(() => validateStateReference(changed, PIN.figma));
  }
});

test('author-state schema2 refuses incompatible shared anatomy and legacy index fields', async (t) => {
  const { root, document } = await stateFixture(t, 2);
  for (const mutate of [
    (value) => {
      value.schemaVersion = 3;
    },
    (value) => {
      value.groups['status-circle'].sharedParts = [];
    },
    (value) => {
      value.groups['status-circle'].sharedParts[0].role = 'content';
    },
    (value) => {
      value.groups['status-circle'].sharedParts[0].id = 'another-enclosure';
    },
    (value) => {
      value.groups['status-circle'].sharedParts.push({ id: 'extra', role: 'content' });
    },
    (value) => {
      value.groups['status-circle'].states.question.enclosurePathIndex = 2;
    },
  ]) {
    const changed = structuredClone(document);
    mutate(changed);
    await writeJSON(root, 'semantics/author-state-groups.json', changed);
    await assert.rejects(stateReference(root, PIN));
  }
});

test('state coverage, ordering, source and part ID mutations refuse precisely', async (t) => {
  const { root, document } = await stateFixture(t);
  for (const mutate of [
    (value) => {
      Reflect.deleteProperty(value.groups['status-circle'].states, 'question');
    },
    (value) => {
      value.source.version = '1';
    },
    (value) => {
      value.groups['status-circle'].states.question.enclosurePathIndex = 0;
    },
    (value) => {
      value.groups['status-circle'].states.question.contentPartIds[0] = 'state-question';
    },
    (value) => {
      value.groups['status-circle'].states.question.variant = 'filled';
    },
    (value) => {
      value.groups['status-circle'].states.question.masterSha256 = '0'.repeat(64);
    },
  ]) {
    const changed = structuredClone(document);
    mutate(changed);
    await writeJSON(root, 'semantics/author-state-groups.json', changed);
    await assert.rejects(stateReference(root, PIN));
  }
});

test('schema2 requires the state reference while historical schema1 cycle inputs stay valid', async (t) => {
  const { root } = await stateFixture(t);
  const author = await authorReference(root, PIN);
  const states = await stateReference(root, PIN);
  const packages = Object.fromEntries(
    [
      ['icons', '@labpics/icons'],
      ['uiCore', '@labpics/ui-core'],
      ['uiShadow', '@labpics/ui-shadow'],
    ].map(([key, name]) => [
      key,
      {
        name,
        version: '0.1.0',
        archiveSha256: 'a'.repeat(64),
        archiveBytes: 1,
        sourceCommit: PIN.sourceCommit,
      },
    ]),
  );
  const old = { schemaVersion: 1, packages, authorReference: author };
  assert.equal(validateSubject(old), old);
  const current = { ...old, schemaVersion: 2, stateReference: states };
  assert.equal(validateSubject(current), current);
  assert.throws(() => validateSubject({ ...old, schemaVersion: 2 }));
  assert.throws(() => validateSubject({ ...old, stateReference: states }));
  for (const mutate of [
    (value) => {
      value.states.pop();
    },
    (value) => {
      value.states.reverse();
    },
    (value) => {
      value.states[0].dimensions = [48, 48];
    },
    (value) => {
      value.states[0].paths[0].fillRule = 'evenodd';
    },
    (value) => {
      value.states[0].contentPartIds[0] = 'status-enclosure';
    },
    (value) => {
      value.proof.source.version = '1';
    },
  ]) {
    const changed = structuredClone(states);
    mutate(changed);
    assert.throws(() => validateSubject({ ...current, stateReference: changed }));
  }
});

test('schema3 requires both independent state references and dispatches every group', async (t) => {
  const { root } = await expressionFixture(t);
  const authorReferenceValue = await authorReference(root, PIN);
  const status = await stateReference(root, PIN);
  const expression = await stateReference(root, PIN, 'expression-face');
  const packages = Object.fromEntries(
    [
      ['icons', '@labpics/icons'],
      ['uiCore', '@labpics/ui-core'],
      ['uiShadow', '@labpics/ui-shadow'],
    ].map(([key, name]) => [
      key,
      {
        name,
        version: '0.1.0',
        archiveSha256: 'a'.repeat(64),
        archiveBytes: 1,
        sourceCommit: PIN.sourceCommit,
      },
    ]),
  );
  const subject = {
    schemaVersion: 3,
    packages,
    authorReference: authorReferenceValue,
    stateReferences: { 'status-circle': status, 'expression-face': expression },
  };
  assert.equal(validateSubject(subject), subject);
  assert.equal(subjectStateReferences(subject), subject.stateReferences);
  assert.deepEqual(subjectStateReferences({ schemaVersion: 2, stateReference: status }), {
    'status-circle': status,
  });
  assert.deepEqual(subjectStateReferences({ schemaVersion: 1 }), {});
  for (const mutate of [
    (value) => {
      Reflect.deleteProperty(value.stateReferences, 'expression-face');
    },
    (value) => {
      Reflect.deleteProperty(value.stateReferences, 'status-circle');
    },
    (value) => {
      value.stateReference = status;
    },
    (value) => {
      value.stateReferences.extra = status;
    },
    (value) => {
      value.stateReferences['expression-face'] = status;
    },
    (value) => {
      value.schemaVersion = 2;
      value.stateReference = status;
    },
  ]) {
    const changed = structuredClone(subject);
    mutate(changed);
    assert.throws(() => validateSubject(changed));
  }
});

test('public publication preserves schema3 and schema4 package headers exactly', async (t) => {
  const fixture = await summaryFixture(t, 3);
  const v3 = JSON.parse(await readFile(join(fixture.output, 'inputs/subject.json'), 'utf8'));
  const v4 = structuredClone(v3);
  v4.schemaVersion = 4;
  for (const [key, name] of [
    ['uiMaterials', '@labpics/ui-materials'],
    ['uiTokens', '@labpics/ui-tokens'],
  ])
    v4.packages[key] = { ...v4.packages.uiCore, name };
  for (const item of Object.values(v4.packages))
    item.runtimeDependencies = { dependencies: {}, optionalDependencies: {}, peerDependencies: {} };
  v4.packages.uiCore.runtimeDependencies.dependencies = {
    '@labpics/ui-materials': '0.1.0',
    '@labpics/ui-tokens': '^0.1.0',
    '@labpics/ui-shadow': '~0.1.0',
    '@labpics/motion': '0.5.0',
  };
  v4.packages.uiCore.runtimeDependencies.peerDependencies = { typescript: '>=5' };

  for (const input of [v3, v4]) {
    assert.deepEqual(projectPublicProvenance(input, 'subject'), input);
    const header = {
      schemaVersion: 1,
      outcome: 'passed',
      records: [],
      subject: input,
      subjectSha256: hash(JSON.stringify(input)),
      archives: Object.entries(input.packages).map(([key, item]) => ({
        key,
        inputNameSha256: hash(`${key}.tgz`),
        archiveSha256: item.archiveSha256,
        archiveBytes: item.archiveBytes,
        integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
        snapshot: `archives/${key}.tgz`,
      })),
      installed: [
        ...Object.values(input.packages),
        { name: '@labpics/motion', version: '0.5.0' },
      ].map((item) => ({
        name: item.name,
        version: item.version,
        manifestSha256: 'a'.repeat(64),
        lockIntegrity: null,
        lockResolvedSha256: null,
      })),
    };
    const published = projectPublicProvenance(header, 'receipt');
    assert.deepEqual(published, header);
    const bytes = Buffer.from(JSON.stringify(published));
    const block = consumerReceiptLog(bytes, PIN.sourceCommit, PIN.sourceCommit);
    const decoded = decodeConsumerEvidence(block, 'LABUI_ICONS_CONSUMER_RECEIPT', 'receiptSha256');
    assert.deepEqual(decoded.bytes, bytes);
    assert.deepEqual(JSON.parse(decoded.bytes).subject, input);
    assert.equal(decoded.metadata.sourceSha, PIN.sourceCommit);
    assert.equal(decoded.metadata.uiCommit, PIN.sourceCommit);
  }
  const source = structuredClone(fixture.source);
  source.files.push(
    ...['materials', 'tokens'].map((name) => ({
      repository: 'Labpics-Team/labui',
      file: `packages/${name}/package.json`,
      sha256: 'a'.repeat(64),
      bytes: 10,
    })),
  );
  assert.deepEqual(projectPublicProvenance(source, 'source-receipt'), source);
  for (const mutate of [
    (value) => {
      value.schemaVersion = 3;
    },
    (value) => {
      Reflect.deleteProperty(value.packages, 'uiMaterials');
    },
    (value) => {
      Reflect.deleteProperty(value.packages.uiTokens, 'runtimeDependencies');
    },
    (value) => {
      value.packages.uiTokens.sourceCommit = 'b'.repeat(40);
    },
    (value) => {
      value.packages.uiCore.runtimeDependencies.notes = RAW_FILE_KEY;
    },
    (value) => {
      value.packages.uiCore.runtimeDependencies.dependencies['@labpics/ui-tokens'] = 'workspace:*';
    },
    (value) => {
      value.packages.uiCore.runtimeDependencies.dependencies['@labpics/ui-tokens'] =
        Buffer.from(RAW_FILE_KEY).toString('base64');
    },
  ]) {
    const changed = structuredClone(v4);
    mutate(changed);
    assert.throws(() => projectPublicProvenance(changed, 'subject'));
  }
  const oldWithNewFields = structuredClone(v3);
  oldWithNewFields.packages.uiCore.runtimeDependencies = v4.packages.uiCore.runtimeDependencies;
  assert.throws(() => projectPublicProvenance(oldWithNewFields, 'subject'));
});

function measurementFixture() {
  const packageMethod = 'fflate@0.8.2 gzipSync level=9 mtime=0 after pnpm build';
  const consumerMethod =
    'esbuild@0.25.12 bundle+minify+treeshake es2022 browser; fflate@0.8.2 gzipSync level=9 mtime=0';
  return {
    sourceSha: PIN.sourceCommit,
    lockfileSha256: 'c'.repeat(64),
    capturedAt: '2026-11-01T15:00:00Z',
    environment: { node: 'v24.10.0' },
    packageMeasurement: packageMethod,
    consumerMeasurement: consumerMethod,
    artifacts: {
      'dist/example.js': { bytes: 100, gzipBytes: 75, brotliBytes: 65, sha256: 'd'.repeat(64) },
    },
    consumers: { 'state-control': { bytes: 120, gzipBytes: 80, brotliBytes: 70 } },
    candidatePolicies: {
      package: {
        measurement: packageMethod,
        artifacts: {
          'dist/example.js': {
            baselineBytes: 90,
            baselineGzipBytes: 60,
            maxBytes: 90,
            maxGzipBytes: 60,
            allowedModules: [],
            forbiddenNeedles: [],
          },
        },
      },
      consumer: {
        measurement: consumerMethod,
        scenarios: {
          'state-control': {
            entry: 'src/state-control.ts',
            baselineBytes: 120,
            baselineGzipBytes: 80,
            maxBytes: 120,
            maxGzipBytes: 80,
          },
        },
      },
    },
    policyViolations: ['dist/example.js: budget 90 B / 60 B gzip; measured 100 B / 75 B gzip'],
  };
}

test('typed measurement preserves producer numbers and projects every opaque identity and refusal', () => {
  const raw = measurementFixture();
  const artifact = 'dist/example.js';
  const metric = raw.artifacts[artifact];
  const policy = raw.candidatePolicies.package.artifacts[artifact];
  raw.environment = {
    node: process.version,
    versions: { ...process.versions, libffi: '3.5.0', lief: '0.17.0' },
    platform: process.platform,
    arch: process.arch,
    cpu: RAW_FILE_KEY,
    cpuCount: 2,
    totalMemory: 1024,
  };
  raw.brotliMeasurement = 'node:zlib brotliCompressSync quality=11; environment.versions.brotli';
  raw.candidatePolicies.package.version = 1;
  raw.candidatePolicies.consumer.version = 1;
  metric.modules = [RAW_FILE_KEY];
  policy.allowedModules = ['src/checked.ts'];
  policy.forbiddenNeedles = [RAW_FILE_KEY];
  policy.identicalTo = 'dist/counterpart.js';
  raw.candidatePolicies.consumer.scenarios['state-control'].entry =
    `import '${RAW_FILE_KEY}';\nconsole.log('consumer');\n`;
  raw.candidatePolicies.consumer.scenarios['state-control'].maxBytes = 100;
  raw.candidatePolicies.consumer.scenarios['state-control'].maxGzipBytes = 70;
  raw.policyViolations.push(
    'state-control: consumer budget 100 B / 70 B gzip; measured 120 B / 80 B gzip',
    `${artifact}: module inclusion drift; expected [src/checked.ts], actual [${RAW_FILE_KEY}]`,
    `${artifact}: forbidden marker ${RAW_FILE_KEY}`,
    'dist/removed.js: previous artifact отсутствует в release contract',
    'removed-state: previous consumer scenario отсутствует в measurement',
    `${artifact}: identicalTo dist/counterpart.js обязан быть byte-identical`,
  );
  const before = structuredClone(raw);
  const published = projectPlatformMeasurement(raw);
  assert.deepEqual(raw, before, 'projection must retain the raw diagnostic source');
  assert.equal(assertPublicProvenance(published, 'measurement'), published);
  assert.equal(published.representation, 'public-identities/1');
  assert.equal(published.environment.cpuSha256, hash(RAW_FILE_KEY));
  assert.deepEqual(published.environment.versions, raw.environment.versions);
  assert.deepEqual(published.artifacts[hash(artifact)], {
    ...metric,
    modules: [hash(RAW_FILE_KEY)],
  });
  assert.deepEqual(published.consumers[hash('state-control')], raw.consumers['state-control']);
  assert.equal(
    published.candidatePolicies.consumer.scenarios[hash('state-control')].entrySha256,
    hash(raw.candidatePolicies.consumer.scenarios['state-control'].entry),
  );
  assert.deepEqual(
    published.policyViolations.map((item) => item.code),
    [
      'ARTIFACT_BUDGET',
      'CONSUMER_BUDGET',
      'MODULE_DRIFT',
      'FORBIDDEN_MARKER',
      'ARTIFACT_MISSING',
      'SCENARIO_MISSING',
      'IDENTICAL_BYTES_REQUIRED',
    ],
  );
  assert.deepEqual(published.policyViolations[0], {
    code: 'ARTIFACT_BUDGET',
    subjectSha256: hash(artifact),
    sourceMessageSha256: hash(raw.policyViolations[0]),
    maxBytes: 90,
    maxGzipBytes: 60,
    measuredBytes: 100,
    measuredGzipBytes: 75,
  });
  assert.ok(!JSON.stringify(published).includes(RAW_FILE_KEY));
  assert.throws(() => platformMeasurementLog(Buffer.from(JSON.stringify(raw)), PIN.sourceCommit));
  for (const mutate of [
    (value) => {
      value.environment.notes = Buffer.from(RAW_FILE_KEY).toString('base64');
    },
    (value) => {
      value.candidatePolicies.package.artifacts[artifact].notes = { copied: RAW_FILE_KEY };
    },
    (value) => {
      value.policyViolations.push(RAW_FILE_KEY);
    },
    (value) => {
      value.policyViolations[0] = `${artifact}: budget 91 B / 60 B gzip; measured 100 B / 75 B gzip`;
    },
    (value) => {
      value.artifacts[artifact].modules = [{ fileKey: RAW_FILE_KEY }];
    },
  ]) {
    const changed = structuredClone(raw);
    mutate(changed);
    assert.throws(() => projectPlatformMeasurement(changed));
  }
  const changed = structuredClone(published);
  changed.environment.versions.notes = Buffer.from(RAW_FILE_KEY).toString('base64');
  assert.throws(() =>
    platformMeasurementLog(Buffer.from(JSON.stringify(changed)), PIN.sourceCommit),
  );
});

test('typed measurement preserves Node 26 dependency versions and refuses opaque replacements', () => {
  const raw = measurementFixture();
  raw.environment = {
    node: 'v26.13.0',
    versions: { nghttp3: '', ngtcp2: '', zlib: '1.3.2.1-motley-123abcd' },
  };
  const published = projectPlatformMeasurement(raw);
  assert.deepEqual(published.environment.versions, raw.environment.versions);
  assert.equal(assertPublicProvenance(published, 'measurement'), published);
  for (const [name, value] of [
    ['node', ''],
    ['ares', ''],
    ['nghttp3', Buffer.from(RAW_FILE_KEY).toString('base64')],
    ['ngtcp2', RAW_FILE_KEY],
    ['zlib', `1.3.2.1-${RAW_FILE_KEY}-123abcd`],
  ]) {
    const changed = structuredClone(raw);
    changed.environment.versions[name] = value;
    assert.throws(() => projectPlatformMeasurement(changed));
  }
});

test('every producer record kind preserves cycle, state and native witnesses through the receipt sink', async (t) => {
  const { root } = await expressionFixture(t);
  const author = await authorReference(root, PIN);
  const references = await Promise.all([
    stateReference(root, PIN),
    stateReference(root, PIN, 'expression-face'),
  ]);
  const records = [];
  const matrix = [[1, 0, 0, 1, 0.125, -0.25]];
  const apiRefusal = (code) =>
    publicApiRefusal({ ok: false, reason: { code, message: RAW_FILE_KEY } });
  for (const mode of ['no-preference', 'reduce']) {
    const duration = mode === 'reduce' ? 0 : 600;
    for (const variant of ['outline', 'filled']) {
      const reference = author.icons.reload[variant];
      const effect = {
        version: 1,
        icon: 'reload',
        variant,
        gesture: 'reload.cycle',
        from: 0,
        to: 1,
        options: { duration, easing: 'linear', fill: 'both' },
        viewport: { overflow: 'visible' },
        unchangedPartIds: [],
        targets: reference.gesture.tracks.map((track) => ({
          partId: track.partId,
          rotation: { from: track.from, to: track.to, unit: 'degrees' },
          style: {
            transformBox: 'view-box',
            transformOrigin: `${track.anchor[0] * 100}% ${track.anchor[1] * 100}%`,
          },
          keyframes: [
            { offset: 0, transform: `rotate(${track.from}deg)` },
            { offset: 1, transform: `rotate(${track.to}deg)` },
          ],
        })),
      };
      if (mode === 'no-preference') {
        records.push({
          name: `${variant}:forward-complete`,
          terminal: matrix,
          completionStatuses: ['finished'],
        });
        records.push({
          name: `${variant}:interrupt-reverse`,
          effect,
          before: matrix,
          after: matrix,
          terminal: matrix,
        });
      } else records.push({ name: `${variant}:reduced-motion`, effect });
      const point = { x: 10.5, y: 12.25 };
      records.push({
        name: `${variant}:${mode}:real-button`,
        target: {
          width: 48,
          height: 48,
          name: 'Обновить',
          type: 'button',
          iconHidden: 'true',
          slotHidden: 'true',
        },
        pointerControl: {
          point,
          coverage: {
            width: 1280,
            height: 900,
            left: 0,
            top: 0,
            right: 1280.5,
            bottom: 900.5,
            point,
            pointHit: true,
          },
          events: ['pointerdown', 'pointerup', 'click'].map((type) => ({
            type,
            trusted: true,
            target: true,
            button: 0,
            x: point.x,
            y: point.y,
          })),
        },
        events: [
          {
            trusted: true,
            composed: true,
            native: true,
            initialize: false,
            before: matrix,
            after: matrix,
            effect,
          },
        ],
        provenance: {
          kind: 'source',
          file: reference.sourceFile,
          author: reference.author,
          anatomy: reference.anatomy,
        },
        refusal: { axis: 'AUTHOR_PARITY_REQUIRED', motion: apiRefusal('GESTURE_UNSUPPORTED') },
      });
    }
    for (const reference of references) {
      const pose = reference.states.map((state, index) => ({
        partId: state.partId,
        value: index === 0 ? 0.375 : 0,
      }));
      const witness = {
        sampledAt: 123.5,
        timelineTime: 123.25,
        playback: 'running',
        readStartedAt: 123.125,
        readCompletedAt: 123.75,
        opacity: pose,
        partTimes: pose.map(({ partId }) => ({
          partId,
          readStartedAt: 123.125,
          readCompletedAt: 123.75,
        })),
        inlineOpacity: pose.map(({ partId, value }) => ({ partId, value: String(value) })),
        animations: [
          {
            partId: reference.states[0].partId,
            sampledAt: 123.5,
            currentTime: 75.25,
            startTime: 48.25,
            playState: 'running',
            pending: false,
            firstKeyframe: {
              opacity: '0',
              offset: 0,
              computedOffset: 0,
              easing: 'linear',
              composite: 'auto',
            },
            lastKeyframe: {
              opacity: '1',
              offset: 1,
              computedOffset: 1,
              easing: 'linear',
              composite: 'auto',
            },
          },
        ],
      };
      const continuity = {
        before: witness,
        admitted: { ...witness, previousPlayback: 'paused' },
        after: witness,
      };
      const effect = (targetState) => ({
        contract: 'labpics.symbol-state-effect/1',
        version: 1,
        kind: 'enclosure-replacement',
        group: reference.group,
        variant: 'outline',
        targetState,
        stages: reference.states.map((state) => ({
          partId: state.partId,
          property: 'opacity',
          to: Number(state.id === targetState),
          at: 0,
          duration,
        })),
        unchangedPartIds: reference.sharedPartIds ?? [reference.enclosurePartId],
        options: { duration, easing: 'linear', fill: 'both' },
      });
      const change = {
        effect: effect(reference.defaultState),
        before: pose,
        after: pose,
        generation: 3,
        continuity,
      };
      records.push({
        name: `${reference.group}:${mode}:trusted-activation`,
        events: [
          {
            trusted: true,
            composed: true,
            native: true,
            before: pose,
            after: pose,
            effect: change.effect,
            continuity,
          },
        ],
      });
      for (const state of reference.states)
        records.push({
          name: `${reference.group}:${state.id}:${mode}`,
          source: state.author,
          effect: effect(state.id),
          terminal: pose,
          identity: true,
          sharedParts: (
            reference.sharedParts ?? [
              { ...reference.enclosure, id: reference.enclosurePartId, role: 'container' },
            ]
          ).map(({ id, role, d, fillRule }) => ({
            d,
            fillRule,
            fill: 'currentColor',
            partId: id,
            role,
            count: 1,
            opacity: 1,
            transform: 'matrix(1, 0, 0, 1, 0, 0)',
            inStateGroup: false,
            ancestorsUnchanged: true,
            identity: true,
          })),
        });
      if (mode === 'no-preference')
        records.push({
          name: `${reference.group}:paused-reverse-newer-state`,
          paused: pose,
          reverse: change,
          newer: change,
          mixture: pose,
          latest: change,
        });
      if (reference.group === 'expression-face')
        records.push({
          name: `${reference.group}:${mode}:author-size-samples`,
          samples: reference.states.flatMap((state) =>
            [16, 24, 48].map((size) => ({
              state: state.id,
              size,
              width: size,
              height: size,
              viewBox: state.viewBox,
              paths: staticStatePathsReference(reference, state),
            })),
          ),
        });
      records.push({
        name: `${reference.group}:${mode}:public-refusals`,
        refusal: {
          filled: apiRefusal('VARIANT_UNSUPPORTED'),
          nullRequest: apiRefusal('INVALID_REQUEST'),
          unknown: apiRefusal('STATE_UNSUPPORTED'),
          exports: [apiRefusal('FORMAT_UNSUPPORTED')],
          web: { ok: true, effect: change.effect },
        },
      });
      records.push({
        name: `${reference.group}:${mode}:dispose`,
        connected: false,
        completionStatus: mode === 'reduce' ? 'finished' : 'stopped',
        playback: 'stopped',
      });
    }
  }
  assert.equal(records.length, 44);
  const receipt = { schemaVersion: 1, outcome: 'passed', records };
  const published = projectPublicProvenance(receipt, 'receipt');
  assert.deepEqual(published, receipt, 'every approved observation must stay exact');
  const bytes = Buffer.from(JSON.stringify(published));
  assert.deepEqual(
    decodeConsumerEvidence(
      consumerReceiptLog(bytes, PIN.sourceCommit, PIN.sourceCommit),
      'LABUI_ICONS_CONSUMER_RECEIPT',
      'receiptSha256',
    ).bytes,
    bytes,
  );
  for (const record of records) {
    assert.deepEqual(projectPublicProvenance(record, 'record'), record);
    const changed = structuredClone(record);
    changed.notes = { nested: Buffer.from(RAW_FILE_KEY).toString('base64') };
    assert.throws(() => projectPublicProvenance(changed, 'record'));
  }
});

test('complete measurement remains diagnostic and refuses stale or incomplete source evidence', () => {
  const report = measurementFixture();
  const validate = (value) =>
    validatePlatformMeasurement(value, PIN.sourceCommit, ['dist/example.js'], 'c'.repeat(64));
  assert.equal(validate(report), report);
  assert.equal(report.policyViolations.length, 1, 'a violation cannot disappear from the report');
  for (const mutate of [
    (value) => {
      value.sourceSha = 'b'.repeat(40);
    },
    (value) => {
      value.lockfileSha256 = 'b'.repeat(64);
    },
    (value) => {
      Reflect.deleteProperty(value.artifacts, 'dist/example.js');
    },
    (value) => {
      Reflect.deleteProperty(value.candidatePolicies.package.artifacts, 'dist/example.js');
    },
    (value) => {
      Reflect.deleteProperty(value.artifacts['dist/example.js'], 'brotliBytes');
    },
    (value) => {
      value.artifacts['dist/example.js'].sha256 = 'missing';
    },
    (value) => {
      value.consumerMeasurement = 'different-method';
    },
    (value) => {
      value.candidatePolicies.consumer.scenarios = {};
    },
    (value) => {
      Reflect.deleteProperty(value, 'policyViolations');
    },
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.throws(() => validate(changed));
  }
});

test('log block reconstructs exact report bytes with bounded indexed lines and a digest', () => {
  const report = measurementFixture();
  report.artifacts['dist/example.js'].modules = Array.from({ length: 256 }, (_, index) =>
    hash(`independent-packet-${index}`),
  );
  const bytes = Buffer.from(JSON.stringify(projectPlatformMeasurement(report)));
  const lines = platformMeasurementLog(bytes, PIN.sourceCommit).trim().split('\n');
  const metadata = JSON.parse(lines[0].slice('LABUI_ICONS_PLATFORM_MEASUREMENT_BEGIN '.length));
  assert.equal(metadata.sourceSha, PIN.sourceCommit);
  assert.equal(metadata.reportSha256, hash(bytes));
  assert.ok(metadata.chunks > 1);
  assert.equal(lines.at(-1), `LABUI_ICONS_PLATFORM_MEASUREMENT_END ${hash(bytes)}`);
  const chunks = lines.slice(1, -1).map((line, index) => {
    const match = /^LABUI_ICONS_PLATFORM_MEASUREMENT_CHUNK (\d+) ([A-Za-z0-9+/=]+)$/.exec(line);
    assert.equal(Number(match[1]), index);
    assert.ok(match[2].length <= 4096);
    return match[2];
  });
  assert.equal(chunks.length, metadata.chunks);
  const compressed = Buffer.from(chunks.join(''), 'base64');
  assert.equal(compressed.length, metadata.compressedBytes);
  assert.deepEqual(gunzipSync(compressed), bytes);
  assert.throws(() => gunzipSync(Buffer.from(chunks.slice(0, -1).join(''), 'base64')));
});

// Независимый однопиксельный PNG; это transport witness, не render продукта.
const PNG_WITNESS = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+xuo4AAAAASUVORK5CYII=',
  'base64',
);

function decodeConsumerEvidence(stdout, prefix, digestField, file) {
  const all = stdout.split('\n').filter((line) => line.startsWith(`${prefix}_`));
  const starts = all.flatMap((line, index) =>
    line.startsWith(`${prefix}_BEGIN `) &&
    (file === undefined || JSON.parse(line.slice(`${prefix}_BEGIN `.length)).file === file)
      ? [index]
      : [],
  );
  assert.equal(starts.length, 1, 'нужен один однозначный evidence block');
  const end = all.findIndex(
    (line, index) => index > starts[0] && line.startsWith(`${prefix}_END `),
  );
  assert.ok(end > starts[0]);
  const lines = all.slice(starts[0], end + 1);
  const metadata = JSON.parse(lines[0].slice(`${prefix}_BEGIN `.length));
  assert.equal(metadata.encoding, 'gzip-base64');
  assert.equal(lines.at(-1), `${prefix}_END ${metadata[digestField]}`);
  const chunks = lines.slice(1, -1).map((line, index) => {
    const fields = line.split(' ');
    assert.equal(fields[0], `${prefix}_CHUNK`);
    assert.equal(Number(fields[1]), index);
    assert.match(fields[2], /^[A-Za-z0-9+/=]{1,4096}$/);
    return fields[2];
  });
  assert.equal(chunks.length, metadata.chunks);
  const compressed = Buffer.from(chunks.join(''), 'base64');
  assert.equal(compressed.length, metadata.compressedBytes);
  const bytes = gunzipSync(compressed, { maxOutputLength: 4 * 1024 * 1024 });
  assert.equal(bytes.length, metadata.bytes);
  assert.equal(hash(bytes), metadata[digestField]);
  return { metadata, bytes };
}

test('consumer PNG readback keeps exact bytes, dimensions and both source identities', () => {
  for (const mode of ['no-preference', 'reduce', 'no-preference-failure', 'reduce-failure']) {
    const file = `result/${mode}.png`;
    const uiCommit = 'b'.repeat(40);
    const block = consumerVisualLog(PNG_WITNESS, file, PIN.sourceCommit, uiCommit);
    const { metadata, bytes } = decodeConsumerEvidence(
      block,
      'LABUI_ICONS_CONSUMER_VISUAL',
      'pngSha256',
    );
    assert.deepEqual(bytes, PNG_WITNESS);
    assert.deepEqual(
      [metadata.file, metadata.sourceSha, metadata.uiCommit, metadata.width, metadata.height],
      [file, PIN.sourceCommit, uiCommit, 1, 1],
    );
    assert.throws(() =>
      decodeConsumerEvidence(
        block.replace(/_END [a-f0-9]+/, `_END ${'0'.repeat(64)}`),
        'LABUI_ICONS_CONSUMER_VISUAL',
        'pngSha256',
      ),
    );
  }
});

test('consumer readback refuses unrelated files, unbounded PNG and incomplete receipt', () => {
  const visual = (
    bytes = PNG_WITNESS,
    file = 'result/reduce.png',
    sha = PIN.sourceCommit,
    ui = PIN.sourceCommit,
  ) => consumerVisualLog(bytes, file, sha, ui);
  assert.throws(() => visual(PNG_WITNESS, 'result/secret.png'));
  assert.throws(() => visual(PNG_WITNESS, '../reduce.png'));
  assert.throws(() => visual(PNG_WITNESS, 'result/reduce.png', 'main'));
  assert.throws(() => visual(PNG_WITNESS, 'result/reduce.png', PIN.sourceCommit, 'main'));
  assert.throws(() => visual(Buffer.alloc(4 * 1024 * 1024 + 1)));
  assert.throws(() => visual(PNG_WITNESS.subarray(0, -1)));
  for (const [offset, value] of [
    [0, 0],
    [8, 0],
    [12, 0],
    [16, 0xffffffff],
    [20, 0],
  ]) {
    const changed = Buffer.from(PNG_WITNESS);
    changed.writeUInt32BE(value, offset);
    assert.throws(() => visual(changed));
  }
  for (const receipt of [
    { schemaVersion: 1, outcome: 'running', records: [] },
    { schemaVersion: 1, outcome: 'failed', records: [] },
    { schemaVersion: 1, outcome: 'passed' },
  ])
    assert.throws(() =>
      consumerReceiptLog(Buffer.from(JSON.stringify(receipt)), PIN.sourceCommit, PIN.sourceCommit),
    );
});

async function summaryFixture(t, schemaVersion) {
  const { root } = schemaVersion === 3 ? await expressionFixture(t) : await stateFixture(t);
  const author = await authorReference(root, PIN);
  const states = await stateReference(root, PIN);
  const packages = Object.fromEntries(
    [
      ['icons', '@labpics/icons'],
      ['uiCore', '@labpics/ui-core'],
      ['uiShadow', '@labpics/ui-shadow'],
    ].map(([key, name]) => [
      key,
      {
        name,
        version: '0.1.0',
        archiveSha256: 'a'.repeat(64),
        archiveBytes: 1,
        sourceCommit: PIN.sourceCommit,
      },
    ]),
  );
  const subject = {
    schemaVersion,
    packages,
    authorReference: author,
    ...(schemaVersion === 2 ? { stateReference: states } : {}),
    ...(schemaVersion === 3
      ? {
          stateReferences: {
            'status-circle': states,
            'expression-face': await stateReference(root, PIN, 'expression-face'),
          },
        }
      : {}),
  };
  const subjectBytes = JSON.stringify(subject);
  const report = projectPlatformMeasurement(measurementFixture());
  const reportBytes = JSON.stringify(report);
  const program = {
    file: 'scripts/measure-platform-artifacts.mjs',
    sha256: 'e'.repeat(64),
    bytes: 10,
  };
  const source = {
    schemaVersion: 1,
    uiCommit: PIN.sourceCommit,
    pin: PIN,
    subjectSha256: hash(subjectBytes),
    files: [
      { repository: PIN.repository, ...program },
      {
        repository: PIN.repository,
        file: 'pnpm-lock.yaml',
        sha256: report.lockfileSha256,
        bytes: 10,
      },
    ],
    ...(schemaVersion >= 2
      ? {
          measurement: {
            file: 'platform-measurement.json',
            sourceSha: PIN.sourceCommit,
            sha256: hash(reportBytes),
            bytes: Buffer.byteLength(reportBytes),
            program,
            lockfileSha256: report.lockfileSha256,
            artifactFiles: [hash('dist/example.js')],
          },
        }
      : {}),
  };
  const output = join(root, 'output');
  await mkdir(join(output, 'inputs'), { recursive: true });
  await mkdir(join(output, 'result'));
  await writeFile(join(output, 'inputs/subject.json'), subjectBytes);
  await writeFile(join(output, 'inputs/source-receipt.json'), JSON.stringify(source));
  await writeFile(
    join(output, 'result/receipt.json'),
    JSON.stringify({ schemaVersion: 1, outcome: 'passed', records: [] }),
  );
  if (schemaVersion >= 2)
    await writeFile(join(output, 'inputs/platform-measurement.json'), reportBytes);
  const invoke = () =>
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--summarize',
        output,
        '--consumer-exit-code',
        '0',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
    );
  return { output, source, report, invoke };
}

test('summary transmits successful raw observations and PNG authenticated against RESULT files', async (t) => {
  const fixture = await summaryFixture(t, 3);
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ name: 'author-observation', opacity: 0.375 }],
  };
  const receiptBytes = Buffer.from(JSON.stringify(receipt));
  await writeFile(join(fixture.output, 'result/receipt.json'), receiptBytes);
  await writeFile(join(fixture.output, 'result/reduce.png'), PNG_WITNESS);
  await writeFile(join(fixture.output, 'result/no-preference.png'), PNG_WITNESS);
  const stdout = fixture.invoke();
  const summary = JSON.parse(stdout.split('LABUI_ICONS_CONSUMER_RESULT ')[1]);
  for (const [prefix, digestField, file, expected] of [
    ['LABUI_ICONS_CONSUMER_VISUAL', 'pngSha256', 'result/reduce.png', PNG_WITNESS],
    ['LABUI_ICONS_CONSUMER_VISUAL', 'pngSha256', 'result/no-preference.png', PNG_WITNESS],
    ['LABUI_ICONS_CONSUMER_RECEIPT', 'receiptSha256', 'result/receipt.json', receiptBytes],
  ]) {
    const { metadata, bytes } = decodeConsumerEvidence(stdout, prefix, digestField, file);
    const material = summary.files.find((item) => item.path === file);
    assert.deepEqual(bytes, expected);
    assert.equal(metadata[digestField], material.sha256);
    assert.equal(metadata.bytes, material.bytes);
    assert.equal(metadata.sourceSha, summary.source.pin.sourceCommit);
    assert.equal(metadata.uiCommit, summary.source.uiCommit);
  }
});

for (const refusal of ['refused PNG', 'oversized PASSED receipt'])
  test(`a passed consumer with ${refusal} cannot publish successful evidence qualification`, async (t) => {
    const fixture = await summaryFixture(t, 1);
    const record = {
      name: 'author-observation',
      opacity: 0.375,
      ...(refusal === 'oversized PASSED receipt'
        ? { paths: [{ d: 'M0 0L1 0L1 1Z '.repeat(1024), fillRule: 'nonzero' }] }
        : {}),
    };
    const receipt = {
      schemaVersion: 1,
      outcome: 'passed',
      records: refusal === 'refused PNG' ? [record] : Array(320).fill(record),
    };
    assert.equal(assertPublicProvenance(receipt, 'receipt'), receipt);
    const receiptBytes = Buffer.from(JSON.stringify(receipt));
    await writeFile(join(fixture.output, 'result/receipt.json'), receiptBytes);
    await writeFile(join(fixture.output, 'result/no-preference.png'), PNG_WITNESS);
    if (refusal === 'refused PNG') {
      assert.doesNotThrow(() =>
        consumerReceiptLog(receiptBytes, PIN.sourceCommit, PIN.sourceCommit),
      );
      await writeFile(join(fixture.output, 'result/reduce.png'), 'not a PNG');
    } else {
      assert.ok(receiptBytes.length > 4 * 1024 * 1024);
      assert.throws(() => consumerReceiptLog(receiptBytes, PIN.sourceCommit, PIN.sourceCommit));
    }
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--summarize',
        fixture.output,
        '--consumer-exit-code',
        '0',
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    const summary = JSON.parse(result.stdout.split('LABUI_ICONS_CONSUMER_RESULT ')[1]);
    assert.equal(
      summary.outcome,
      'failed',
      `evidence refusal must fail qualification; PASSED packet: ${/LABUI_ICONS_CONSUMER_RECEIPT_BEGIN/.test(result.stdout)}`,
    );
    assert.doesNotMatch(result.stdout, /LABUI_ICONS_CONSUMER_RECEIPT_BEGIN/);
    assert.deepEqual(summary.readbackFailure, {
      code: 'EVIDENCE_REFUSED',
      file: refusal === 'refused PNG' ? 'result/reduce.png' : 'result/receipt.json',
    });
    const { metadata, bytes } = decodeConsumerEvidence(
      result.stdout,
      'LABUI_ICONS_CONSUMER_VISUAL',
      'pngSha256',
      'result/no-preference.png',
    );
    assert.deepEqual(bytes, PNG_WITNESS);
    assert.equal(metadata.pngSha256, hash(PNG_WITNESS));
    assert.equal(metadata.sourceSha, fixture.source.pin.sourceCommit);
    assert.equal(metadata.uiCommit, fixture.source.uiCommit);
    assert.deepEqual(await readFile(join(fixture.output, 'result/receipt.json')), receiptBytes);
  });

test('oversized API failure and refused PNG keep the limited continuity RESULT', async (t) => {
  const fixture = await summaryFixture(t, 1);
  const stateContinuity = { differences: [{ partId: 'smile-mouth', before: 0.375, after: 0.25 }] };
  const error = Object.assign(new Error('x'.repeat(4 * 1024 * 1024)), { stateContinuity });
  await writeFile(
    join(fixture.output, 'result/receipt.json'),
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'failed',
      records: [],
      failure: { phase: 'browser', ...publicFailure(error) },
    }),
  );
  for (const invalidVisual of [false, true]) {
    if (invalidVisual) await writeFile(join(fixture.output, 'result/reduce.png'), 'not a PNG');
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--summarize',
        fixture.output,
        '--consumer-exit-code',
        '1',
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /LABUI_ICONS_CONSUMER_RECEIPT_BEGIN/);
    const summary = JSON.parse(result.stdout.split('LABUI_ICONS_CONSUMER_RESULT ')[1]);
    assert.deepEqual(summary.failure, { phase: 'browser', stateContinuity });
    assert.equal(summary.outcome, 'failed');
    assert.ok(result.stdout.length < 5000, 'failure.message не передаётся');
    assert.deepEqual(
      summary.readbackFailure,
      invalidVisual ? { code: 'EVIDENCE_REFUSED', file: 'result/reduce.png' } : undefined,
    );
  }
});

for (const schema of [2, 3])
  test(`schema${schema} summary publishes the authenticated report and rejects missing or wrong-source output`, async (t) => {
    const fixture = await summaryFixture(t, schema);
    const stdout = fixture.invoke();
    assert.match(stdout, /LABUI_ICONS_PLATFORM_MEASUREMENT_BEGIN/);
    assert.match(stdout, /LABUI_ICONS_CONSUMER_RESULT/);
    const changed = { ...fixture.report, sourceSha: 'b'.repeat(40) };
    const bytes = JSON.stringify(changed);
    fixture.source.measurement.sha256 = hash(bytes);
    fixture.source.measurement.bytes = Buffer.byteLength(bytes);
    await writeFile(join(fixture.output, 'inputs/platform-measurement.json'), bytes);
    await writeFile(
      join(fixture.output, 'inputs/source-receipt.json'),
      JSON.stringify(fixture.source),
    );
    assert.throws(fixture.invoke, /measurement относится к другому source SHA/);
    await rm(join(fixture.output, 'inputs/platform-measurement.json'));
    assert.throws(fixture.invoke, /ENOENT/);
  });

test('historical schema1 summary does not need a measurement report', async (t) => {
  const fixture = await summaryFixture(t, 1);
  const stdout = fixture.invoke();
  assert.doesNotMatch(stdout, /LABUI_ICONS_PLATFORM_MEASUREMENT_/);
  assert.match(stdout, /LABUI_ICONS_CONSUMER_RESULT/);
});

test('summary diagnostics distinguish missing measurement, changed bytes and wrong lockfile from wrong source', async (t) => {
  for (const [kind, expected] of [
    ['descriptor', /measurement отсутствует/],
    ['bytes', /measurement bytes изменились/],
    ['lockfile', /measurement lockfile не совпал/],
  ]) {
    const fixture = await summaryFixture(t, 3);
    assert.match(fixture.invoke(), /LABUI_ICONS_CONSUMER_RESULT/);
    if (kind === 'descriptor') {
      Reflect.deleteProperty(fixture.source, 'measurement');
    } else if (kind === 'bytes') {
      await writeFile(
        join(fixture.output, 'inputs/platform-measurement.json'),
        `${JSON.stringify(fixture.report)}\n`,
      );
    } else {
      const changed = JSON.stringify({ ...fixture.report, lockfileSha256: 'b'.repeat(64) });
      fixture.source.measurement.sha256 = hash(changed);
      fixture.source.measurement.bytes = Buffer.byteLength(changed);
      await writeFile(join(fixture.output, 'inputs/platform-measurement.json'), changed);
    }
    await writeFile(
      join(fixture.output, 'inputs/source-receipt.json'),
      JSON.stringify(fixture.source),
    );
    assert.throws(fixture.invoke, (error) => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /measurement относится к другому source SHA/);
      assert.doesNotMatch(error.message, /SyntheticFigmaAuthorKey01/);
      return true;
    });
  }
});

test('failed receipt waits for a complete large report through asynchronous stdout backpressure', async (t) => {
  const fixture = await summaryFixture(t, 2);
  fixture.report.artifacts[hash('dist/example.js')].modules = Array.from(
    { length: 4096 },
    (_, index) => createHash('sha256').update(`transport-only-${index}`).digest('hex'),
  );
  const bytes = Buffer.from(JSON.stringify(fixture.report));
  fixture.source.measurement.sha256 = hash(bytes);
  fixture.source.measurement.bytes = bytes.length;
  await writeFile(join(fixture.output, 'inputs/platform-measurement.json'), bytes);
  await writeFile(
    join(fixture.output, 'inputs/source-receipt.json'),
    JSON.stringify(fixture.source),
  );
  const source = `
    import { Writable } from 'node:stream';
    import { summarize } from ${JSON.stringify(new URL('./prepare-icons-inputs.mjs', import.meta.url).href)};
    const native = process.stdout;
    // POSIX stdout асинхронен; Windows stdout pipes синхронны.
    // Обычный Writable сохраняет частичный вывод до callback в обеих средах.
    const delayed = new Writable({ write(chunk, encoding, callback) {
      const boundary = Math.min(chunk.length, 65536);
      native.write(chunk.subarray(0, boundary));
      setTimeout(() => native.write(chunk.subarray(boundary), callback), 25);
    } });
    Object.defineProperty(process, 'stdout', { value: delayed });
    await summarize(${JSON.stringify(fixture.output)}, 0);
  `;
  for (const outcome of ['passed', 'failed']) {
    await writeFile(
      join(fixture.output, 'result/receipt.json'),
      JSON.stringify({
        schemaVersion: 1,
        outcome,
        records: [],
        ...(outcome === 'failed' ? { failure: { phase: 'browser' } } : {}),
      }),
    );
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', source], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout = [];
      const stderr = [];
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('mock stdout timeout'));
      }, 5000);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.stdout.on('data', (chunk) => {
        stdout.push(chunk);
        child.stdout.pause();
        setTimeout(() => child.stdout.resume(), 1);
      });
      child.stderr.on('data', (chunk) => stderr.push(chunk));
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          code,
          stdout: Buffer.concat(stdout).toString(),
          stderr: Buffer.concat(stderr).toString(),
        });
      });
    });
    assert.equal(result.code, outcome === 'passed' ? 0 : 1, result.stderr);
    const header = JSON.parse(
      result.stdout.split('\n')[0].slice('LABUI_ICONS_PLATFORM_MEASUREMENT_BEGIN '.length),
    );
    const chunks = [
      ...result.stdout.matchAll(
        /LABUI_ICONS_PLATFORM_MEASUREMENT_CHUNK (\d+) ([A-Za-z0-9+/=]+)\n/g,
      ),
    ];
    t.diagnostic(
      `${outcome}: ${Buffer.byteLength(result.stdout)} stdout bytes, ${chunks.length}/${header.chunks} complete chunks`,
    );
    assert.equal(chunks.length, header.chunks);
    assert.deepEqual(
      chunks.map((chunk) => Number(chunk[1])),
      Array.from({ length: header.chunks }, (_, index) => index),
    );
    assert.deepEqual(
      gunzipSync(Buffer.from(chunks.map((chunk) => chunk[2]).join(''), 'base64')),
      bytes,
    );
    assert.ok(
      result.stdout.indexOf(`LABUI_ICONS_PLATFORM_MEASUREMENT_END ${hash(bytes)}\n`) <
        result.stdout.indexOf('LABUI_ICONS_CONSUMER_RESULT '),
    );
    const summary = JSON.parse(result.stdout.split('LABUI_ICONS_CONSUMER_RESULT ')[1]);
    assert.equal(summary.outcome, outcome);
  }
});

test('stdout write failure keeps its original error and removes the one-shot listener', async (t) => {
  const fixture = await summaryFixture(t, 2);
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { Writable } from 'node:stream';
    import { summarize } from ${JSON.stringify(new URL('./prepare-icons-inputs.mjs', import.meta.url).href)};
    const native = process.stdout;
    const broken = new Writable({ write(chunk, encoding, callback) {
      callback(Object.assign(new Error('MOCK_STDOUT_WRITE_FAILURE'), { code: 'MOCK_STDOUT_ERROR' }));
    } });
    Object.defineProperty(process, 'stdout', { value: broken });
    try { await summarize(${JSON.stringify(fixture.output)}, 0); }
    catch (error) {
      await new Promise(setImmediate);
      native.write(JSON.stringify({ code: error.code, listeners: broken.listenerCount('error') }));
      process.exitCode = 1;
    }
  `,
    ],
    { encoding: 'utf8', timeout: 5000 },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { code: 'MOCK_STDOUT_ERROR', listeners: 0 });
  assert.doesNotMatch(result.stderr, /Unhandled 'error' event/);
});

test('failed schema1 and schema2 summaries preserve an optional native continuity witness exactly', async (t) => {
  // Синтетический transport witness; эти числа не являются измерением продукта.
  const stateContinuity = {
    differences: [{ partId: 'state-confirmation', before: 0.375, after: 0, delta: -0.375 }],
    witness: {
      before: {
        readStartedAt: 124.125,
        readCompletedAt: 124.25,
        timelineTime: 123.5,
        opacity: [{ partId: 'state-confirmation', value: 0.375 }],
        animations: [
          {
            partId: 'state-confirmation',
            currentTime: 75.25,
            startTime: 48.25,
            playState: 'running',
            pending: false,
            firstKeyframe: { opacity: '0', offset: 0, easing: 'linear' },
            lastKeyframe: { opacity: '1', offset: 1, easing: 'linear' },
          },
        ],
      },
      admitted: { timelineTime: 123.5, previousPlayback: 'running', playback: 'running' },
      after: { timelineTime: 123.5, opacity: [{ partId: 'state-confirmation', value: 0 }] },
    },
  };
  for (const schemaVersion of [1, 2]) {
    const fixture = await summaryFixture(t, schemaVersion);
    for (const witness of [undefined, stateContinuity]) {
      const failure = {
        phase: 'browser',
        ...publicFailure(Object.assign(new Error('private stack'), { stateContinuity: witness })),
      };
      await writeFile(
        join(fixture.output, 'result/receipt.json'),
        JSON.stringify({ schemaVersion: 1, outcome: 'failed', records: [], failure }),
      );
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
          '--summarize',
          fixture.output,
          '--consumer-exit-code',
          '1',
        ],
        { encoding: 'utf8', timeout: 5000 },
      );
      assert.equal(result.status, 1, result.stderr);
      assert.doesNotMatch(result.stdout, /LABUI_ICONS_CONSUMER_RECEIPT_BEGIN/);
      const line = result.stdout
        .split('\n')
        .find((item) => item.startsWith('LABUI_ICONS_CONSUMER_RESULT '));
      assert.ok(line, 'failed receipt потерял RESULT');
      const summary = JSON.parse(line.slice('LABUI_ICONS_CONSUMER_RESULT '.length));
      assert.equal(summary.outcome, 'failed');
      assert.equal(summary.schemaVersion, 1);
      assert.deepEqual(
        summary.failure,
        witness === undefined ? { phase: 'browser' } : { phase: 'browser', stateContinuity },
      );
    }
  }
});
