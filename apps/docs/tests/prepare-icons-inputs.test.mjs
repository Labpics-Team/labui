import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { authorReference, readCycleMaster, validateSourcePin } from './prepare-icons-inputs.mjs';

// Заморожены raw SVG и строки reload из Git a31c881e335d9e5b4d0d4c690931a6cf444e52ce.
// Это witness потребителя; producer helpers и generated glyph не формируют expected.
const PIN = {
  schemaVersion: 1,
  repository: 'Labpics-Team/lab-icons',
  sourceCommit: 'a31c881e335d9e5b4d0d4c690931a6cf444e52ce',
  figma: {
    fileKey: 'LuaiBd4anRi4DMZayKAnY2',
    version: '2416636003859748575',
  },
};

const MANIFEST = {
  schemaVersion: 1,
  source: {
    kind: 'figma',
    name: '🧪Lab UI (v2.1)',
    fileKey: 'LuaiBd4anRi4DMZayKAnY2',
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
    fileKey: 'LuaiBd4anRi4DMZayKAnY2',
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
  outline: '1a1fb97986966df057cf0a50e67872e82ac3e4f9ed562e830bb9b61bfc022d5c',
  filled: '0be0aa7b6b29ca6ee7763e212664f219fdc7d02bcc75206f977b329ba652865c',
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

test('frozen fixture matches the declared raw source and both masters remain whole', async () => {
  const actualPin = JSON.parse(
    await readFile(new URL('./icons-consumer-source.json', import.meta.url)),
  );
  assert.deepEqual(validateSourcePin(actualPin), PIN);
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
