import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { decodeJsonEvidenceLog } from '../../../scripts/ci/evidence-log.mjs';
import {
  PUBLIC_ICONS_DESIGN_REFERENCE,
  assertPublicEvidence,
  collectPrivateLocations,
  sourceIdentitySha256,
} from '../../../scripts/ci/icons-public-provenance.mjs';
import {
  assertStateAnatomy,
  stateCapabilitiesReference,
  staticStatePathsReference,
  subjectStateReferences,
  validateStateReference,
  validateSubject,
} from './icons-packed.mjs';
import {
  authorReference,
  consumerReceiptLog,
  consumerResultLog,
  consumerVisualLog,
  exportPublicEvidence,
  platformMeasurementLog,
  projectJsonBytes,
  readAuthorMaster,
  readCycleMaster,
  resolveSourcePin,
  stateReference,
  validatePlatformMeasurement,
  validateSourcePin,
  verifyPublicExport,
} from './prepare-icons-inputs.mjs';

// Заморожены raw SVG и строки reload из Git a31c881e335d9e5b4d0d4c690931a6cf444e52ce.
// Это witness потребителя; producer helpers и generated glyph не формируют expected.
// File key и version вымышлены; геометрия raw SVG сохранена побайтово.
const PIN = {
  schemaVersion: 1,
  repository: 'Labpics-Team/lab-icons',
  sourceCommit: 'a31c881e335d9e5b4d0d4c690931a6cf444e52ce',
  figma: {
    fileKey: 'labuiTestFileKey0000000001',
    version: '1234567890123456789',
  },
};

function readConsumerResult(stdout) {
  return decodeJsonEvidenceLog(stdout, 'LABUI_ICONS_CONSUMER_RESULT', {
    digestField: 'resultSha256',
    maxBytes: 4 * 1024 * 1024,
  });
}

function publicPin(pin = PIN) {
  return {
    schemaVersion: 2,
    repository: pin.repository,
    sourceCommit: pin.sourceCommit,
    sourceIdentitySha256: sourceIdentitySha256(pin.figma),
  };
}

const MANIFEST = {
  schemaVersion: 1,
  source: {
    kind: 'figma',
    name: '🧪Lab UI (v2.1)',
    fileKey: 'labuiTestFileKey0000000001',
    version: '1234567890123456789',
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
        master: 'masters/figma/1234567890123456789/Filled/reload.svg',
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
        master: 'masters/figma/1234567890123456789/Outline/reload.svg',
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
    fileKey: 'labuiTestFileKey0000000001',
    version: '1234567890123456789',
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
  outline: '7366c27275e774d30de047a35a4dd34d831d6b69ada6217b259c36efe7ec20b0',
  filled: 'b21135638f67d4a50f52bfe8c4efefd2e51a54c0900bc78515eb37d2fbdb924a',
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
  assert.equal(reference.fileKey, PIN.figma.fileKey);
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
      fileKey: PIN.figma.fileKey,
      version: PIN.figma.version,
      nodeId: record.nodeId,
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
  assert.equal(actualPin.schemaVersion, 2);
  assert.equal(actualPin.repository, PIN.repository);
  assert.equal(actualPin.figma, undefined);
  assert.equal(actualPin.sourceCommit, 'dc04d50903c658c29782f900da33a83c9a3fcb93');
  assert.equal(
    actualPin.sourceIdentitySha256,
    '48178c778759f56c919332a8c26553c50ac876920a69c8ed0f838889fb0eb09e',
  );
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
        fileKey: PIN.figma.fileKey,
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
    source: structuredClone(PIN.figma),
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
        nodeId: `120001:${index + 1}`,
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
      nodeId: `120002:${index + 1}`,
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
  const complete = structuredClone(subject);
  complete.schemaVersion = 4;
  for (const [key, name] of [
    ['uiMaterials', '@labpics/ui-materials'],
    ['uiTokens', '@labpics/ui-tokens'],
  ])
    complete.packages[key] = { ...complete.packages.uiCore, name };
  for (const item of Object.values(complete.packages))
    item.runtimeDependencies = { dependencies: {}, optionalDependencies: {}, peerDependencies: {} };
  assert.equal(validateSubject(complete), complete);
  assert.deepEqual(subjectStateReferences(complete), subjectStateReferences(subject));
  for (const mutate of [
    (value) => {
      Reflect.deleteProperty(value.packages, 'uiMaterials');
    },
    (value) => {
      Reflect.deleteProperty(value.packages, 'uiTokens');
    },
    (value) => {
      Reflect.deleteProperty(value.packages.uiCore, 'runtimeDependencies');
    },
    (value) => {
      value.packages.uiTokens.sourceCommit = 'f'.repeat(40);
    },
    (value) => {
      value.packages.uiCore.runtimeDependencies.dependencies['@labpics/ui-tokens'] = 'workspace:*';
    },
  ]) {
    const changed = structuredClone(complete);
    mutate(changed);
    assert.throws(() => validateSubject(changed));
  }
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

function measurementFixture() {
  return {
    sourceSha: PIN.sourceCommit,
    lockfileSha256: 'c'.repeat(64),
    capturedAt: '2026-11-01T15:00:00Z',
    environment: { node: 'v24.10.0' },
    packageMeasurement: 'frozen-package-method',
    consumerMeasurement: 'frozen-consumer-method',
    artifacts: {
      'dist/example.js': { bytes: 100, gzipBytes: 75, brotliBytes: 65, sha256: 'd'.repeat(64) },
    },
    consumers: { 'state-control': { bytes: 120, gzipBytes: 80, brotliBytes: 70 } },
    candidatePolicies: {
      package: { measurement: 'frozen-package-method', artifacts: { 'dist/example.js': {} } },
      consumer: { measurement: 'frozen-consumer-method', scenarios: { 'state-control': {} } },
    },
    policyViolations: ['dist/example.js: diagnostic budget refusal'],
  };
}

test('native measurement invocation keeps its file result and projects it without child streams', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'labui-icons-measurement-streams-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const marker = 'SyntheticPrivateMeasurementStream903';
  const report = { ...measurementFixture(), source: { fileKey: marker, version: '1' } };
  const reportBytes = Buffer.from(JSON.stringify(report));
  const file = join(directory, 'platform-measurement.json');
  const producer = join(directory, 'producer.mjs');
  await writeFile(
    producer,
    `import { writeFileSync } from 'node:fs';
    process.stdout.write(${JSON.stringify(marker)});
    process.stderr.write(${JSON.stringify(marker)});
    if (process.argv.includes('--fail')) process.exit(23);
    writeFileSync(process.argv[3], ${JSON.stringify(reportBytes.toString())});`,
  );
  const owner = await readFile(new URL('./prepare-icons-inputs.mjs', import.meta.url), 'utf8');
  // Исполняется ровно native effect block с синтетическим producer. Runner guard
  // и полный workload не вызываются; файл и последующая проекция проверяются реально.
  const invocation =
    / {2}execFileSync\(process\.execPath, \[join\(iconsRoot, program\.file\), '--output', join\(out, file\)\], \{[\s\S]*?\n {2}\}\);/.exec(
      owner,
    )?.[0];
  assert.ok(invocation, 'native measurement effect block must remain identifiable');
  for (const fail of [false, true]) {
    await rm(file, { force: true });
    const block = fail ? invocation.replace("'--output',", "'--output', '--fail',") : invocation;
    const script = `import { execFileSync } from 'node:child_process';
      import { join } from 'node:path'; import { readFileSync } from 'node:fs';
      import { platformMeasurementLog } from ${JSON.stringify(new URL('./prepare-icons-inputs.mjs', import.meta.url).href)};
      import { publicError } from ${JSON.stringify(new URL('../../../scripts/ci/icons-public-provenance.mjs', import.meta.url).href)};
      const iconsRoot=${JSON.stringify(directory)}, out=iconsRoot, program={file:'producer.mjs'}, file='platform-measurement.json';
      try { ${block}
        process.stdout.write(platformMeasurementLog(readFileSync(join(out,file)), ${JSON.stringify(PIN.sourceCommit)}));
      } catch(error) { process.stderr.write(JSON.stringify(publicError(error))); process.exitCode=1; }`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, fail ? 1 : 0);
    assert.equal(
      (result.stdout + result.stderr).includes(marker),
      false,
      'child streams are private',
    );
    if (fail) {
      assert.equal(result.stdout, '');
      assert.equal(existsSync(file), false);
      assert.match(JSON.parse(result.stderr).diagnosticSha256, /^[a-f0-9]{64}$/);
    } else {
      assert.equal(result.stderr, '');
      assert.deepEqual(await readFile(file), reportBytes);
      const packet = decodeConsumerEvidence(
        result.stdout,
        'LABUI_ICONS_PLATFORM_MEASUREMENT',
        'reportSha256',
      );
      const projected = assertProjectedBytes(packet.bytes, reportBytes);
      assert.deepEqual(projected.artifacts, report.artifacts);
      assert.deepEqual(projected.consumers, report.consumers);
      assert.equal(packet.metadata.sourceSha, PIN.sourceCommit);
    }
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
  const bytes = Buffer.from(
    JSON.stringify({
      witness: Array.from({ length: 256 }, (_, index) =>
        createHash('sha256').update(`independent-packet-${index}`).digest('hex'),
      ),
    }),
  );
  const lines = platformMeasurementLog(bytes, PIN.sourceCommit).trim().split('\n');
  const metadata = JSON.parse(lines[0].slice('LABUI_ICONS_PLATFORM_MEASUREMENT_BEGIN '.length));
  assert.equal(metadata.sourceSha, PIN.sourceCommit);
  assert.equal(metadata.originalBytesSha256, hash(bytes));
  assert.ok(metadata.chunks > 1);
  assert.equal(lines.at(-1), `LABUI_ICONS_PLATFORM_MEASUREMENT_END ${metadata.reportSha256}`);
  const chunks = lines.slice(1, -1).map((line, index) => {
    const match = /^LABUI_ICONS_PLATFORM_MEASUREMENT_CHUNK (\d+) ([A-Za-z0-9+/=]+)$/.exec(line);
    assert.equal(Number(match[1]), index);
    assert.ok(match[2].length <= 4096);
    return match[2];
  });
  assert.equal(chunks.length, metadata.chunks);
  const compressed = Buffer.from(chunks.join(''), 'base64');
  assert.equal(compressed.length, metadata.compressedBytes);
  const projected = gunzipSync(compressed);
  assert.equal(metadata.reportSha256, hash(projected));
  assert.deepEqual(assertProjectedBytes(projected, bytes), JSON.parse(bytes));
  assert.throws(() => gunzipSync(Buffer.from(chunks.slice(0, -1).join(''), 'base64')));
});

// Независимый однопиксельный PNG; это transport witness, не render продукта.
const PNG_WITNESS = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

function assertProjectedBytes(bytes, original) {
  const projection = JSON.parse(bytes);
  assert.equal(projection.projectionVersion, 1);
  assert.equal(projection.publicDesignReference, PUBLIC_ICONS_DESIGN_REFERENCE);
  assert.equal(projection.originalBytesSha256, hash(original));
  assert.equal(projection.originalBytes, Buffer.byteLength(original));
  assertPublicEvidence(projection, {
    privateLocations: collectPrivateLocations(JSON.parse(original)),
  });
  return projection.evidence;
}

test('public projection preserves numeric geometry and exact raw-byte commitments', () => {
  const input = {
    author: {
      fileKey: 'PrivateWitness903',
      version: '1',
      nodeId: '907001:902',
      master: 'masters/figma/1/Outline/witness.svg',
      masterSha256: 'a'.repeat(64),
    },
    geometry: { width: 1, controls: [0.8, 1, 0.5], version: 1 },
    failure: {
      phase: 'newer-request',
      stateContinuity: { from: 0.9, to: 0.8 },
      message: 'private source PrivateWitness903',
    },
  };
  const compact = Buffer.from(JSON.stringify(input));
  const formatted = Buffer.from(JSON.stringify(input, null, 2));
  assert.throws(() => projectJsonBytes(JSON.stringify(input)), /точные JSON bytes/);
  const first = JSON.parse(projectJsonBytes(compact));
  const second = JSON.parse(projectJsonBytes(formatted));
  assert.equal(first.originalSha256, second.originalSha256, 'canonical value identity сохраняется');
  assert.notEqual(
    first.originalBytesSha256,
    second.originalBytesSha256,
    'разные raw bytes различаются',
  );
  assert.equal(first.originalBytesSha256, hash(compact));
  assert.equal(second.originalBytesSha256, hash(formatted));
  assert.deepEqual(first.evidence.geometry, input.geometry);
  assert.deepEqual(first.evidence.failure.stateContinuity, input.failure.stateContinuity);
  assert.equal(first.evidence.failure.phase, input.failure.phase);
  assert.equal(first.evidence.author.masterSha256, input.author.masterSha256);
  assert.equal(first.evidence.author.sourceIdentitySha256, sourceIdentitySha256(input.author));
  assertPublicEvidence(first, { privateLocations: collectPrivateLocations(input) });
  assert.notEqual(first.evidence.failure.message, input.failure.message);
});

test('pin binds the clean committed source without publishing its Figma locator', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labui-icons-public-pin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = { fileKey: 'PrivateWitness903', version: '9037421903217548171' };
  await mkdir(join(root, 'semantics'));
  const file = join(root, 'semantics/figma-baseline.json');
  await writeFile(file, JSON.stringify({ source }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init');
  git('add', 'semantics/figma-baseline.json');
  git(
    '-c',
    'user.name=public-pin-witness',
    '-c',
    'user.email=witness@example.invalid',
    'commit',
    '-m',
    'test: freeze synthetic source identity',
  );
  const pin = {
    schemaVersion: 2,
    repository: PIN.repository,
    sourceCommit: git('rev-parse', 'HEAD').trim(),
    sourceIdentitySha256: sourceIdentitySha256(source),
  };
  assert.equal(validateSourcePin(pin), pin);
  assertPublicEvidence(pin, { privateLocations: collectPrivateLocations(source) });
  assert.deepEqual((await resolveSourcePin(root, pin)).figma, source);
  await assert.rejects(resolveSourcePin(root, { ...pin, sourceIdentitySha256: '0'.repeat(64) }), {
    code: 'SOURCE_IDENTITY_REFUSED',
  });
  assert.throws(() => validateSourcePin({ ...pin, figma: source }));
  await writeFile(file, JSON.stringify({ source: { ...source, version: '2' } }));
  await assert.rejects(resolveSourcePin(root, pin), /изменён источник/);
});

test('public export allowlist excludes raw inputs, producer archives and extra files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labui-icons-public-export-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ bodyWidth: 0.9 }],
    author: {
      fileKey: 'PrivateWitness903',
      version: '9037421903217548171',
      master: 'masters/figma/9037421903217548171/Outline/witness.svg',
    },
  };
  const raw = Buffer.from(JSON.stringify(receipt));
  await writeFile(join(root, 'producer.tgz'), raw);
  await mkdir(join(root, 'inputs'));
  await writeFile(join(root, 'inputs/subject.json'), raw);
  const options = {
    jsonFiles: new Map([['receipt.json', raw]]),
    visuals: [{ path: 'result/reduce.png', bytes: PNG_WITNESS }],
    privateLocations: collectPrivateLocations(receipt),
  };
  const manifest = await exportPublicEvidence(root, options);
  assert.deepEqual(await verifyPublicExport(join(root, 'public')), manifest);
  assert.deepEqual((await readdir(join(root, 'public'))).sort(), [
    'manifest.json',
    'receipt.json',
    'reduce.png',
  ]);
  for (const file of manifest.files) {
    const bytes = await readFile(join(root, 'public', file.file));
    assert.equal(file.sha256, hash(bytes));
    assert.equal(file.bytes, bytes.length);
    assertPublicEvidence(bytes, { privateLocations: options.privateLocations });
  }
  assert.deepEqual(
    assertProjectedBytes(await readFile(join(root, 'public/receipt.json')), raw).records,
    receipt.records,
  );
  assert.ok((await readFile(join(root, 'public/reduce.png'))).equals(PNG_WITNESS));
  await assert.rejects(
    exportPublicEvidence(root, { ...options, jsonFiles: new Map([['producer.tgz', raw]]) }),
    /неизвестный документ/,
  );
  await writeFile(join(root, 'public/subject-raw.json'), raw);
  await assert.rejects(exportPublicEvidence(root, options), /неизвестный или связанный файл/);
});

test('public verification rejects incomplete markers and every artifact drift', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labui-icons-export-verifier-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const publicRoot = join(root, 'public');
  const raw = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'failed',
      records: [],
      failure: { phase: 'interrupt', stateContinuity: { before: 0.9, after: 0.9 } },
    }),
  );
  const options = {
    jsonFiles: new Map([['receipt.json', raw]]),
    visuals: [{ path: 'result/reduce.png', bytes: PNG_WITNESS }],
    privateLocations: [],
  };
  const rejected = { name: 'PublicEvidenceRefusal', code: 'PUBLIC_EVIDENCE_REFUSED' };
  const invoke = () =>
    spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--verify-public',
        publicRoot,
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
  for (const [name, mutate] of [
    ['empty marker', () => writeFile(join(publicRoot, 'manifest.json'), '')],
    [
      'truncated marker',
      () => writeFile(join(publicRoot, 'manifest.json'), '{"projectionVersion":1,'),
    ],
    ['missing artifact', () => rm(join(publicRoot, 'receipt.json'))],
    ['changed artifact', () => writeFile(join(publicRoot, 'receipt.json'), '{}')],
    ['unexpected artifact', () => writeFile(join(publicRoot, 'producer.tgz'), raw)],
    [
      'interrupted pending marker',
      () => writeFile(join(publicRoot, '.manifest-interrupted.pending'), '{'),
    ],
    [
      'artifact symlink',
      async () => {
        await rm(join(publicRoot, 'receipt.json'));
        await import('node:fs/promises').then(({ symlink }) =>
          symlink(join(publicRoot, 'reduce.png'), join(publicRoot, 'receipt.json')),
        );
      },
    ],
    [
      'wrong public reference',
      async () => {
        const manifest = JSON.parse(await readFile(join(publicRoot, 'manifest.json')));
        manifest.publicDesignReference = 'https://www.figma.com/file/PrivateWitness903';
        await writeFile(join(publicRoot, 'manifest.json'), JSON.stringify(manifest));
      },
    ],
    [
      'empty file set',
      async () => {
        const manifest = JSON.parse(await readFile(join(publicRoot, 'manifest.json')));
        manifest.files = [];
        await writeFile(join(publicRoot, 'manifest.json'), JSON.stringify(manifest));
      },
    ],
  ]) {
    await t.test(name, async () => {
      await rm(publicRoot, { recursive: true, force: true });
      const manifest = await exportPublicEvidence(root, options);
      assert.deepEqual(await verifyPublicExport(publicRoot), manifest);
      assert.equal(invoke().status, 0);
      await mutate();
      await assert.rejects(verifyPublicExport(publicRoot), rejected);
      const result = invoke();
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      const error = JSON.parse(result.stderr.slice('LABUI_ICONS_CONSUMER_ERROR '.length));
      assert.equal(error.code, 'PUBLIC_EVIDENCE_REFUSED');
      assert.match(error.diagnosticSha256, /^[a-f0-9]{64}$/);
      assert.doesNotMatch(result.stderr, /PrivateWitness903|Error:|at file:/);
    });
  }
});

test('interrupted manifest write cannot expose a final publication marker', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'labui-icons-manifest-interruption-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const owner = new URL('./prepare-icons-inputs.mjs', import.meta.url);
  const original = await readFile(owner, 'utf8');
  const nativeImport = /import\s*\{[^}]*\}\s*from\s*'node:fs\/promises';/;
  assert.ok(nativeImport.test(original), 'fault injection должен перехватить настоящий writeFile');
  const transformed = original
    .replace(nativeImport, (declaration) =>
      declaration.replace(/\bwriteFile\b/, 'writeFile as nativeWriteFile'),
    )
    .replace(/from '([^']+)'/g, (match, specifier) =>
      specifier.startsWith('.') ? `from ${JSON.stringify(new URL(specifier, owner).href)}` : match,
    );
  const source = `${transformed}\nasync function writeFile(path, bytes, options) {
      if (String(path).includes('manifest')) {
        await nativeWriteFile(path, '{"projectionVersion":1,', options);
        throw Object.assign(new Error('injected pending manifest write failure'), {code:'EIO'});
      }
      return nativeWriteFile(path, bytes, options);
    }\n`;
  const artifact = join(root, 'interrupted-publisher.mjs');
  await writeFile(artifact, source);
  const publisher = await import(pathToFileURL(artifact).href);
  await assert.rejects(
    publisher.exportPublicEvidence(root, {
      jsonFiles: new Map([
        ['receipt.json', Buffer.from('{"schemaVersion":1,"outcome":"failed","records":[]}')],
      ]),
      visuals: [],
      privateLocations: [],
    }),
    /injected pending manifest write failure/,
  );
  assert.equal(
    existsSync(join(root, 'public/manifest.json')),
    false,
    'неполная запись никогда не становится final marker',
  );
  await assert.rejects(verifyPublicExport(join(root, 'public')), {
    code: 'PUBLIC_EVIDENCE_REFUSED',
  });
});

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
  const { root } = schemaVersion >= 3 ? await expressionFixture(t) : await stateFixture(t);
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
  if (schemaVersion >= 4) {
    for (const [key, name] of [
      ['uiMaterials', '@labpics/ui-materials'],
      ['uiTokens', '@labpics/ui-tokens'],
    ])
      packages[key] = { ...packages.uiCore, name };
    for (const item of Object.values(packages))
      item.runtimeDependencies = {
        dependencies: {},
        optionalDependencies: {},
        peerDependencies: {},
      };
  }
  const subject = {
    schemaVersion,
    packages,
    authorReference: author,
    ...(schemaVersion === 2 ? { stateReference: states } : {}),
    ...(schemaVersion >= 3
      ? {
          stateReferences: {
            'status-circle': states,
            'expression-face': await stateReference(root, PIN, 'expression-face'),
          },
        }
      : {}),
  };
  const subjectBytes = JSON.stringify(subject);
  const report = measurementFixture();
  const reportBytes = JSON.stringify(report);
  const program = {
    file: 'scripts/measure-platform-artifacts.mjs',
    sha256: 'e'.repeat(64),
    bytes: 10,
  };
  const source = {
    schemaVersion: 1,
    uiCommit: PIN.sourceCommit,
    pin: publicPin(),
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
            artifactFiles: ['dist/example.js'],
          },
        }
      : {}),
  };
  const output = join(root, 'output');
  await mkdir(join(output, 'inputs'), { recursive: true });
  await mkdir(join(output, 'result'));
  await writeFile(join(output, 'inputs/subject.json'), subjectBytes);
  await writeFile(join(output, 'inputs/source-receipt.json'), JSON.stringify(source));
  const receipt = { schemaVersion: 1, outcome: 'passed', records: [] };
  await writeFile(join(output, 'result/receipt.json'), JSON.stringify(receipt));
  if (schemaVersion >= 2)
    await writeFile(join(output, 'inputs/platform-measurement.json'), reportBytes);
  const invoke = () =>
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--summarize',
        output,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
    );
  return { output, source, report, receipt, invoke };
}

test('summary transmits successful raw observations and PNG authenticated against RESULT files', async (t) => {
  const fixture = await summaryFixture(t, 3);
  const receipt = {
    ...fixture.receipt,
    records: [{ name: 'expression-face:synthetic-witness', opacity: 0.375 }],
  };
  const receiptBytes = Buffer.from(JSON.stringify(receipt));
  await writeFile(join(fixture.output, 'result/receipt.json'), receiptBytes);
  await writeFile(join(fixture.output, 'result/reduce.png'), PNG_WITNESS);
  await writeFile(join(fixture.output, 'result/no-preference.png'), PNG_WITNESS);
  const stdout = fixture.invoke();
  const summary = readConsumerResult(stdout).evidence;
  assert.equal(summary.outcome, 'passed');
  assert.ok(
    stdout.indexOf('LABUI_ICONS_CONSUMER_RESULT_BEGIN ') >
      stdout.indexOf('LABUI_ICONS_CONSUMER_RECEIPT_END '),
    'Успешный RESULT требует уже переданный raw receipt',
  );
  assert.equal(summary.browserOutcome, undefined);
  assert.equal(summary.readbackFailure, undefined);
  for (const [prefix, digestField, file, expected] of [
    ['LABUI_ICONS_CONSUMER_VISUAL', 'pngSha256', 'result/reduce.png', PNG_WITNESS],
    ['LABUI_ICONS_CONSUMER_VISUAL', 'pngSha256', 'result/no-preference.png', PNG_WITNESS],
    ['LABUI_ICONS_CONSUMER_RECEIPT', 'receiptSha256', 'result/receipt.json', receiptBytes],
  ]) {
    const { metadata, bytes } = decodeConsumerEvidence(stdout, prefix, digestField, file);
    const material = summary.files.find((item) => item.path === file);
    if (prefix === 'LABUI_ICONS_CONSUMER_RECEIPT') {
      assert.deepEqual(assertProjectedBytes(bytes, expected).records, receipt.records);
      assert.equal(metadata.originalBytesSha256, material.sha256);
      assert.equal(metadata.originalBytes, material.bytes);
    } else {
      assert.ok(bytes.equals(expected), 'PNG bytes изменились');
      assert.equal(metadata[digestField], material.sha256);
      assert.equal(metadata.bytes, material.bytes);
    }
    assert.equal(metadata.sourceSha, summary.source.pin.sourceCommit);
    assert.equal(metadata.uiCommit, summary.source.uiCommit);
  }
});

test('oversized raw failure and refused PNG keep the limited continuity RESULT', async (t) => {
  const fixture = await summaryFixture(t, 1);
  const stateContinuity = { differences: [{ partId: 'mouth', before: 0.375, after: 0.25 }] };
  await writeFile(
    join(fixture.output, 'result/receipt.json'),
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'failed',
      records: [],
      failure: { phase: 'browser', stateContinuity, message: 'x'.repeat(4 * 1024 * 1024) },
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
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /LABUI_ICONS_CONSUMER_RECEIPT_BEGIN/);
    const summary = readConsumerResult(result.stdout).evidence;
    assert.deepEqual(summary.failure, { phase: 'browser', stateContinuity });
    assert.equal(summary.outcome, 'failed');
    assert.ok(result.stdout.length < 5000, 'failure.message не передаётся');
    assert.deepEqual(
      summary.readbackFailure,
      invalidVisual ? { code: 'EVIDENCE_REFUSED', file: 'result/reduce.png' } : undefined,
    );
  }
});

for (const schema of [2, 3, 4])
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
    assert.throws(fixture.invoke, (error) => {
      assert.equal(error.status, 1);
      const refusal = JSON.parse(error.stderr.slice('LABUI_ICONS_CONSUMER_ERROR '.length));
      assert.equal(refusal.code, 'ERR_ASSERTION');
      assert.match(refusal.diagnosticSha256, /^[a-f0-9]{64}$/);
      assert.doesNotMatch(error.stderr, /measurement относится к другому source SHA/);
      return true;
    });
    await rm(join(fixture.output, 'inputs/platform-measurement.json'));
    assert.throws(fixture.invoke, /ENOENT/);
  });

test('historical schema1 summary does not need a measurement report', async (t) => {
  const fixture = await summaryFixture(t, 1);
  const stdout = fixture.invoke();
  assert.doesNotMatch(stdout, /LABUI_ICONS_PLATFORM_MEASUREMENT_/);
  assert.match(stdout, /LABUI_ICONS_CONSUMER_RESULT/);
});

test('RESULT framing authenticates the same private-safe projection and refuses oversized bytes', () => {
  const raw = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'failed',
      source: { figma: PIN.figma },
      failure: { phase: 'browser', message: `private stack ${PIN.figma.fileKey}` },
    }),
  );
  const log = consumerResultLog(raw);
  const projection = readConsumerResult(log);
  assert.deepEqual(projection, JSON.parse(projectJsonBytes(raw)));
  assert.equal(projection.originalBytesSha256, hash(raw));
  assert.equal(projection.originalBytes, raw.length);
  const metadata = JSON.parse(
    log.split('\n')[0].slice('LABUI_ICONS_CONSUMER_RESULT_BEGIN '.length),
  );
  assert.equal(metadata.originalBytesSha256, projection.originalBytesSha256);
  assert.equal(metadata.originalBytes, raw.length);
  assert.equal(
    metadata.resultSha256,
    hash(Buffer.from(`${JSON.stringify(projection, null, 2)}\n`)),
  );
  assert.equal(log.includes(PIN.figma.fileKey), false);
  assert.equal(log.includes('private stack'), false);
  assert.throws(() => consumerResultLog(Buffer.alloc(4 * 1024 * 1024 + 1, 'x')));
});

test('complete RESULT stays bounded when source artifacts grow and retains native failure', async (t) => {
  const fixture = await summaryFixture(t, 1);
  await writeFile(join(fixture.output, 'result/no-preference-failure.png'), PNG_WITNESS);
  await writeFile(
    join(fixture.output, 'result/receipt.json'),
    JSON.stringify({ outcome: 'failed', records: [], failure: { phase: 'browser' } }),
  );
  for (const count of [1455, 10_000]) {
    const source = {
      ...fixture.source,
      files: [
        ...fixture.source.files,
        ...Array.from({ length: count }, (_, index) => ({
          repository: PIN.repository,
          file: `dist/fixture-${index}.js`,
          sha256: hash(`artifact-${index}`),
          bytes: index + 1,
        })),
      ],
    };
    await writeFile(join(fixture.output, 'inputs/source-receipt.json'), JSON.stringify(source));
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--summarize',
        fixture.output,
      ],
      { encoding: 'utf8', timeout: 10_000, maxBuffer: 8 * 1024 * 1024 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    const longestLine = Math.max(
      ...result.stdout.split(/\r?\n/).map((line) => Buffer.byteLength(line)),
    );
    assert.ok(longestLine <= 4300, `${count} artifacts emitted a ${longestLine}-byte line`);
    const projection = readConsumerResult(result.stdout);
    assert.equal(projection.evidence.outcome, 'failed');
    assert.deepEqual(projection.evidence.failure, { phase: 'browser' });
    assert.deepEqual(projection.evidence.source.files, source.files);
    assert.ok(
      result.stdout.indexOf('LABUI_ICONS_CONSUMER_RESULT_END ') <
        result.stdout.indexOf('LABUI_ICONS_CONSUMER_VISUAL_BEGIN '),
      'Отказ сохраняет RESULT до необязательного PNG',
    );
  }
});

test('failed receipt waits for a complete large report through asynchronous stdout backpressure', async (t) => {
  const fixture = await summaryFixture(t, 2);
  fixture.report.diagnosticPadding = Array.from({ length: 4096 }, (_, index) =>
    createHash('sha256').update(`transport-only-${index}`).digest('hex'),
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
    await summarize(${JSON.stringify(fixture.output)});
  `;
  for (const outcome of ['passed', 'failed']) {
    await writeFile(
      join(fixture.output, 'result/receipt.json'),
      JSON.stringify({
        ...fixture.receipt,
        schemaVersion: 1,
        outcome,
        records: [],
        ...(outcome === 'failed' ? { failure: { phase: 'mock-continuity' } } : {}),
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
      assertProjectedBytes(
        gunzipSync(Buffer.from(chunks.map((chunk) => chunk[2]).join(''), 'base64')),
        bytes,
      ),
      JSON.parse(bytes),
    );
    assert.ok(
      result.stdout.indexOf(`LABUI_ICONS_PLATFORM_MEASUREMENT_END ${header.reportSha256}\n`) <
        result.stdout.indexOf('LABUI_ICONS_CONSUMER_RESULT_BEGIN '),
    );
    const summary = readConsumerResult(result.stdout).evidence;
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
    try { await summarize(${JSON.stringify(fixture.output)}); }
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
      const failure = { phase: 'browser', message: 'private stack', stateContinuity: witness };
      await writeFile(
        join(fixture.output, 'result/receipt.json'),
        JSON.stringify({ outcome: 'failed', records: [], failure }),
      );
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
          '--summarize',
          fixture.output,
        ],
        { encoding: 'utf8', timeout: 5000 },
      );
      assert.equal(result.status, 1, result.stderr);
      assert.doesNotMatch(result.stdout, /LABUI_ICONS_CONSUMER_RECEIPT_BEGIN/);
      const line = result.stdout
        .split('\n')
        .find((item) => item.startsWith('LABUI_ICONS_CONSUMER_RESULT_BEGIN '));
      assert.ok(line, 'failed receipt потерял RESULT');
      const summary = readConsumerResult(result.stdout).evidence;
      assert.equal(summary.outcome, 'failed');
      assert.equal(summary.schemaVersion, 1);
      assert.deepEqual(
        summary.failure,
        witness === undefined ? { phase: 'browser' } : { phase: 'browser', stateContinuity },
      );
    }
  }
});

function timeoutFrontier() {
  const stage = {
    mode: 'no-preference',
    stage: 'state',
    member: 'expression-face',
    elapsedMs: 240,
    completedRecords: 1,
    stageElapsedMs: 120,
    stageCompletedRecords: 0,
    lastCompletedRecord: 'outline:no-preference:phase-0.35',
    lastCompletedAtMs: 200,
    sinceLastCompletedMs: 40,
    completedStages: [
      { mode: null, stage: 'start', member: null, elapsedMs: 10, completedRecords: 0 },
    ],
  };
  return {
    ...stage,
    mode: null,
    stage: 'parallel-modes',
    member: null,
    modes: {
      'no-preference': { ...stage },
      reduce: { ...stage, mode: 'reduce', lastCompletedRecord: 'reduce:state:phase-0.92' },
    },
  };
}

test('failed summary retains safe browser frontier through the real caller without raw diagnostics', async (t) => {
  const fixture = await summaryFixture(t, 1);
  const browserFrontier = structuredClone(timeoutFrontier());
  const marker = 'controlled-private-observation token=controlled-secret';
  browserFrontier.lastCompletedRecord = marker;
  browserFrontier.modes.reduce.lastCompletedRecord = marker;
  const expected = structuredClone(browserFrontier);
  for (const item of [expected, ...Object.values(expected.modes)]) {
    item.lastCompletedRecordSha256 = hash(item.lastCompletedRecord);
    Reflect.deleteProperty(item, 'lastCompletedRecord');
  }
  await writeFile(
    join(fixture.output, 'result/receipt.json'),
    JSON.stringify({
      ...fixture.receipt,
      outcome: 'failed',
      failure: { phase: 'browser', browserFrontier, message: `private stack ${PIN.figma.fileKey}` },
    }),
  );
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
      '--summarize',
      fixture.output,
    ],
    { encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const summary = readConsumerResult(result.stdout).evidence;
  assert.deepEqual(summary.failure, { phase: 'browser', browserFrontier: expected });
  assert.equal(summary.readbackFailure, undefined);
  assert.equal(result.stdout.includes('outline:no-preference:phase-0.35'), false);
  assert.equal(result.stdout.includes('reduce:mic/filled:width-motion-0.92'), false);
  assert.equal(result.stdout.includes('private stack'), false);
  assert.equal(result.stdout.includes(PIN.figma.fileKey), false);
  assert.equal(result.stdout.includes(marker), false);
  const manifest = await verifyPublicExport(join(fixture.output, 'public'));
  const raw = await readFile(join(fixture.output, 'result/receipt.json'));
  for (const file of ['failure.json', 'receipt.json']) {
    assert.ok(manifest.files.some((item) => item.file === file));
    const bytes = await readFile(join(fixture.output, 'public', file));
    assert.equal(bytes.includes(marker), false, `${file}: свободная запись приватна`);
    const document = JSON.parse(bytes);
    assert.deepEqual(document.evidence.failure.browserFrontier, expected);
    assert.equal(document.originalBytesSha256, hash(raw));
    assert.equal(document.originalBytes, raw.length);
    assert.equal(document.originalSha256, JSON.parse(projectJsonBytes(raw)).originalSha256);
    assert.equal(document.evidence.failure.message.kind, 'diagnostic-commitment');
  }
  const failureFile = join(fixture.output, 'public/failure.json');
  const changed = JSON.parse(await readFile(failureFile));
  changed.evidence.failure.browserFrontier.lastCompletedRecord = marker;
  const changedBytes = Buffer.from(JSON.stringify(changed));
  await writeFile(failureFile, changedBytes);
  const entry = manifest.files.find((item) => item.file === 'failure.json');
  entry.bytes = changedBytes.length;
  entry.sha256 = hash(changedBytes);
  await writeFile(join(fixture.output, 'public/manifest.json'), JSON.stringify(manifest));
  await assert.rejects(verifyPublicExport(join(fixture.output, 'public')), {
    code: 'PUBLIC_EVIDENCE_REFUSED',
  });
});

test('failed summary refuses sensitive and malformed frontier without losing its browser phase', async (t) => {
  const fixture = await summaryFixture(t, 1);
  for (const mutate of [
    (value) => {
      value.member = PIN.figma.fileKey;
    },
    (value) => {
      value.stack = 'private stack';
    },
    (value) => {
      value.stageElapsedMs = -1;
    },
    (value) => {
      value.stageCompletedRecords = Number.NaN;
    },
    (value) => {
      value.completedStages[0].sourceFile = 'private source';
    },
    (value) => {
      value.modes.reduce.modes = {};
    },
    (value) => {
      value.modes.reduce.mode = 'no-preference';
    },
    (value, receipt) => {
      value.member = 'privatekey';
      receipt.metadata = { fileKey: 'privatekey' };
    },
  ]) {
    const browserFrontier = structuredClone(timeoutFrontier());
    const receipt = {
      ...fixture.receipt,
      outcome: 'failed',
      failure: { phase: 'browser', browserFrontier },
    };
    mutate(browserFrontier, receipt);
    await writeFile(join(fixture.output, 'result/receipt.json'), JSON.stringify(receipt));
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
        '--summarize',
        fixture.output,
      ],
      { encoding: 'utf8', timeout: 10_000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    const summary = readConsumerResult(result.stdout).evidence;
    assert.deepEqual(summary.failure, { phase: 'browser' });
    assert.deepEqual(summary.readbackFailure, {
      code: 'EVIDENCE_REFUSED',
      file: 'result/browser-frontier-evidence',
    });
    assert.equal(result.stdout.includes(PIN.figma.fileKey), false);
    await rm(join(fixture.output, 'public'), { recursive: true, force: true });
  }
});
