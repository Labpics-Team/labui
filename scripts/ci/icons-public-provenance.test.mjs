import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  PUBLIC_ICONS_DESIGN_REFERENCE,
  assertPublicEvidence,
  assertSourceIdentity,
  collectPrivateLocations,
  projectPublicEvidence,
  publicBrowserFrontier,
  publicError,
  sourceIdentitySha256,
} from './icons-public-provenance.mjs';

// Fixtures намеренно синтетические: публичные тесты не раскрывают private Figma IDs.
const source = { fileKey: 'SyntheticPrivateFileKeyABCD', version: '1' };
const nodeId = '123456:987654';
const pageId = '112233:445566';
const frameId = '223344:556677';
const privateURL = `https://www.figma.com/design/${source.fileKey}/fixture?node-id=123456-987654`;
const assetURL = 'https://s3-alpha-sig.figma.com/img/synthetic-file?Expires=123&Signature=fixture';
const sourcePath = 'masters/figma/1/Outline/microphone.svg';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const stableJSON = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
const canonicalHash = (value) => hash(stableJSON(value));
const refused = (error) => {
  assert.equal(error.name, 'PublicEvidenceRefusal');
  assert.match(error.code, /^(?:PUBLIC_EVIDENCE|SOURCE_IDENTITY)_REFUSED$/);
  assert.doesNotMatch(error.message, /SyntheticPrivate|123456|987654|masters\/figma/);
  return true;
};

test('DNS root dot preserves private URL classification and the exact public reference', async (t) => {
  const { mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { exportPublicEvidence, verifyPublicExport } = await import(
    '../../apps/docs/tests/prepare-icons-inputs.mjs'
  );
  const directory = await mkdtemp(join(tmpdir(), 'labui-icons-dns-root-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const identity = { fileKey: 'SyntheticPrivateFileAuditZ7', version: '1' };
  const encodedKey = `%53${identity.fileKey.slice(1)}`;
  const geometry = { viewBox: [0, 0, 24, 24], d: 'M1 1L12 1L12 24Z' };
  for (const host of [
    'www.figma.com',
    'WWW.FIGMA.COM.',
    's3-alpha.figma.com.',
    'figmausercontent.com.',
  ]) {
    const url = `https://${host}/design/${encodedKey}/fixture`;
    const input = { source: identity, geometry, note: url };
    assert.throws(() => projectPublicEvidence(input), refused);
    assert.throws(() => assertPublicEvidence({ note: url }), refused);
    await assert.rejects(
      exportPublicEvidence(directory, {
        jsonFiles: new Map([['receipt.json', Buffer.from(JSON.stringify(input))]]),
        visuals: [],
      }),
      refused,
    );
  }
  const input = {
    source: identity,
    geometry,
    note: 'https://www.figma.com.example.invalid./guide',
    publicDesignReference: PUBLIC_ICONS_DESIGN_REFERENCE,
  };
  await exportPublicEvidence(directory, {
    jsonFiles: new Map([['receipt.json', Buffer.from(JSON.stringify(input))]]),
    visuals: [],
  });
  await verifyPublicExport(join(directory, 'public'));
  const output = JSON.parse(await readFile(join(directory, 'public/receipt.json'))).evidence;
  assert.deepEqual(output.geometry, geometry);
  assert.equal(output.note, input.note);
  assert.equal(output.publicDesignReference, PUBLIC_ICONS_DESIGN_REFERENCE);
  assert.equal(JSON.stringify(output).includes(identity.fileKey), false);
  const publicRoot = join(directory, 'public');
  const receipt = JSON.parse(await readFile(join(publicRoot, 'receipt.json')));
  receipt.evidence.note = `https://www.figma.com./design/${encodedKey}/fixture`;
  const bytes = Buffer.from(JSON.stringify(receipt));
  const manifest = JSON.parse(await readFile(join(publicRoot, 'manifest.json')));
  manifest.files[0].bytes = bytes.length;
  manifest.files[0].sha256 = hash(bytes);
  await writeFile(join(publicRoot, 'receipt.json'), bytes);
  await writeFile(join(publicRoot, 'manifest.json'), JSON.stringify(manifest));
  await assert.rejects(verifyPublicExport(publicRoot), refused);
});

test('URL preprocessing agrees with the native parser at export and verification boundaries', async (t) => {
  const { mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { exportPublicEvidence, verifyPublicExport } = await import(
    '../../apps/docs/tests/prepare-icons-inputs.mjs'
  );
  const directory = await mkdtemp(join(tmpdir(), 'labui-icons-url-preprocessing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const identity = { fileKey: 'SyntheticPrivateR2ReviewK9', version: '1' };
  const encodedKey = `%53${identity.fileKey.slice(1)}`;
  const canonical = `https://www.figma.com./design/${encodedKey}/fixture`;
  const publicBase = 'https://public.invalid/';
  const expected = new URL(canonical, publicBase);
  const geometry = { viewBox: [0, 0, 24, 24], d: 'M1 1L12 1L12 24Z', label: 'Контур — ✓' };
  const options = (note) => ({
    jsonFiles: new Map([
      ['receipt.json', Buffer.from(JSON.stringify({ source: identity, geometry, note }))],
    ]),
    visuals: [],
  });
  await exportPublicEvidence(directory, options(PUBLIC_ICONS_DESIGN_REFERENCE));
  const publicRoot = join(directory, 'public');
  const healthy = JSON.parse(await readFile(join(publicRoot, 'receipt.json')));
  const manifest = await verifyPublicExport(publicRoot);
  const variants = new Set([canonical]);
  for (const unit of ['\t', '\n', '\r']) {
    for (let position = 0; position <= canonical.length; position++)
      variants.add(canonical.slice(0, position) + unit + canonical.slice(position));
  }
  for (let code = 0; code <= 0x20; code++) {
    const unit = String.fromCharCode(code);
    variants.add(unit + canonical + unit);
  }
  variants.add(`//www.fig\tma.com./design/${encodedKey}/fixture`);
  for (const note of variants) {
    const parsed = new URL(note, publicBase);
    assert.equal(parsed.href, expected.href, 'the native parser qualifies the differential input');
    assert.equal(decodeURIComponent(parsed.pathname.split('/')[2]), identity.fileKey);
  }
  const multiple = [];
  for (const separator of ['\t', '\n', '\r', '\r\n']) {
    const privateNote = `https://www.fig${separator}ma.com./design/${encodedKey}/fixture`;
    multiple.push(
      `https://docs.example.invalid${separator}${privateNote}`,
      `${privateNote}${separator}${PUBLIC_ICONS_DESIGN_REFERENCE}`,
      `${PUBLIC_ICONS_DESIGN_REFERENCE}${separator}${privateNote}${separator}https://docs.example.invalid/guide`,
    );
  }
  for (const note of [...variants, ...multiple]) {
    assert.throws(() => projectPublicEvidence({ source: identity, geometry, note }), refused);
    await assert.rejects(exportPublicEvidence(directory, options(note)), refused);
    // Проверяем также уже сохранённый packet, пересчитав все контролируемые digests.
    const projected = structuredClone(healthy);
    projected.evidence.note = note;
    const bytes = Buffer.from(JSON.stringify(projected));
    manifest.files[0].bytes = bytes.length;
    manifest.files[0].sha256 = hash(bytes);
    await writeFile(join(publicRoot, 'receipt.json'), bytes);
    await writeFile(join(publicRoot, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyPublicExport(publicRoot), refused);
  }
  for (const note of [
    'Примечание\tдля автора\n✓ — обычный текст\rбез URL',
    'Unicode\u00a0пробел и\u2028перенос — 🧪',
    'https://www.figma.com.example.invalid./guide',
    'https://пример.example/путь',
    PUBLIC_ICONS_DESIGN_REFERENCE,
    PUBLIC_ICONS_DESIGN_REFERENCE.replace('figma', 'fig\tma'),
    ...['\t', '\n', '\r', '\r\n'].map(
      (separator) =>
        `${PUBLIC_ICONS_DESIGN_REFERENCE}${separator}https://docs.example.invalid/guide`,
    ),
  ]) {
    await exportPublicEvidence(directory, options(note));
    await verifyPublicExport(publicRoot);
    const output = JSON.parse(await readFile(join(publicRoot, 'receipt.json'))).evidence;
    assert.equal(output.note, note);
    assert.deepEqual(output.geometry, geometry);
    assert.equal(JSON.stringify(output).includes(identity.fileKey), false);
  }
  t.diagnostic(
    `${variants.size} parser-qualified representations, ${multiple.length} multiple-URL notes`,
  );
});

function fixture() {
  return {
    schemaVersion: 12,
    source: {
      kind: 'figma',
      ...source,
      name: 'Lab UI synthetic fixture',
      pageId,
      frames: { outline: frameId, filled: '334455:667788' },
      capturedAt: '2026-11-03T09:00:00Z',
      geometrySnapshotSha256: 'a'.repeat(64),
      url: privateURL,
      assetUrl: assetURL,
    },
    icons: {
      microphone: {
        outline: {
          sourceFile: sourcePath,
          author: {
            kind: 'figma',
            ...source,
            nodeId,
            nodeSha256: 'b'.repeat(64),
            masterSha256: 'c'.repeat(64),
            normalizedSha256: 'd'.repeat(64),
            pathFingerprintSha256: 'e'.repeat(64),
          },
          viewBox: [0, 0, 24, 24],
          paths: [{ d: 'M1 1L12 1L12 24Z', fillRule: 'nonzero' }],
          parts: [{ id: 'microphone-capsule', role: 'body', zIndex: 0, anchor: [0.5, 0.5] }],
          gesture: {
            id: 'microphone.listen',
            partIds: ['microphone-capsule'],
            tracks: [{ partId: 'microphone-capsule', from: 1, to: 1.1 }],
          },
          svg: '<svg viewBox="0 0 24 24"><path d="M1 1L12 1L12 24Z"/></svg>',
        },
      },
    },
  };
}

test('source identity commits exact original file/version independently of object order', () => {
  const expected = canonicalHash(source);
  assert.equal(sourceIdentitySha256(source), expected);
  assert.equal(sourceIdentitySha256({ version: '1', fileKey: source.fileKey }), expected);
  assert.equal(sourceIdentitySha256({ ...source, name: 'ignored metadata' }), expected);
  assert.equal(assertSourceIdentity(source, expected), source);
  for (const changed of [
    { ...source, version: '2' },
    { ...source, fileKey: 'SyntheticOtherFileKeyABCDE' },
    { version: '1', publicDesignReference: PUBLIC_ICONS_DESIGN_REFERENCE },
    { ...source, version: 1 },
  ])
    assert.throws(() => assertSourceIdentity(changed, expected), refused);
  assert.throws(() => assertSourceIdentity(source, 'not-a-sha'), refused);
});

test('public projection commits the whole original and preserves all geometry and author hashes', () => {
  const input = fixture();
  const before = structuredClone(input);
  const projection = projectPublicEvidence(input);
  assert.equal(projection.projectionVersion, 1);
  assert.equal(projection.publicDesignReference, PUBLIC_ICONS_DESIGN_REFERENCE);
  assert.equal(projection.originalSha256, canonicalHash(input));
  assert.notEqual(projection.originalSha256, canonicalHash(projection.evidence));
  assert.notEqual(projection.originalSha256, hash(JSON.stringify(input, null, 2)));
  assert.deepEqual(input, before);
  const original = input.icons.microphone.outline;
  const projected = projection.evidence.icons.microphone.outline;
  for (const key of ['viewBox', 'paths', 'parts', 'gesture', 'svg'])
    assert.deepEqual(projected[key], original[key]);
  for (const key of [
    'kind',
    'nodeSha256',
    'masterSha256',
    'normalizedSha256',
    'pathFingerprintSha256',
  ])
    assert.equal(projected.author[key], original.author[key]);
  assert.equal(projected.author.originalSha256, canonicalHash(original.author));
  assert.equal(projected.author.sourceIdentitySha256, sourceIdentitySha256(source));
  assert.equal(projection.evidence.source.originalSha256, canonicalHash(input.source));
  assert.equal(
    projection.evidence.source.geometrySnapshotSha256,
    input.source.geometrySnapshotSha256,
  );
  assert.equal(projection.evidence.source.name, undefined);
  assert.equal(projected.sourceFile, undefined);
  const locations = collectPrivateLocations(input);
  assert.equal(assertPublicEvidence(projection, { privateLocations: locations }), projection);
  for (const { kind, value } of locations)
    if (kind !== 'source-version') assert.ok(!JSON.stringify(projection).includes(value));
});

test('typed locations do not globally redact short source versions or legal SVG numbers', () => {
  const locations = collectPrivateLocations(fixture());
  assert.ok(locations.some((item) => item.kind === 'source-version' && item.value === '1'));
  assert.ok(locations.some((item) => item.kind === 'source-path' && item.value === sourcePath));
  assert.ok(Object.isFrozen(locations) && locations.every(Object.isFrozen));
  const publicGeometry = { version: '1', paths: [{ d: 'M1 1L11 11Z' }], weight: 1 };
  assert.deepEqual(
    projectPublicEvidence(publicGeometry, { privateLocations: locations }).evidence,
    publicGeometry,
  );
  assert.equal(
    assertPublicEvidence(publicGeometry, { privateLocations: locations }),
    publicGeometry,
  );
});

test('private frame/node/page maps retain membership under commitments and preserve unrelated keys', () => {
  const input = {
    source: {
      kind: 'figma',
      ...source,
      frames: { [frameId]: { name: 'outline', nodeId }, outline: '334455:667788' },
      nodes: { [nodeId]: { name: 'capsule', nodeSha256: 'b'.repeat(64) } },
      pages: { [pageId]: { name: 'icons', pageId } },
    },
    geometry: { 'left:body': [1, 2], partIds: ['frame', 'node', 'page'] },
  };
  const projected = projectPublicEvidence(input).evidence;
  assert.deepEqual(projected.geometry, input.geometry);
  assert.equal(projected.source.frames[`sha256:${canonicalHash(frameId)}`].name, 'outline');
  assert.equal(projected.source.frames.outline, `sha256:${canonicalHash('334455:667788')}`);
  assert.equal(
    projected.source.nodes[`sha256:${canonicalHash(nodeId)}`].nodeSha256,
    'b'.repeat(64),
  );
  assert.equal(projected.source.pages[`sha256:${canonicalHash(pageId)}`].name, 'icons');
});

test('file identity names are removed precisely while semantic and non-Figma source names remain', () => {
  const input = {
    authorReference: { fileName: 'Synthetic private file title', ...source },
    metadata: {
      fileName: 'Synthetic partial identity title',
      version: '1',
      capturedAt: '2026-11-03',
    },
    source: { name: 'public producer', repository: 'Labpics-Team/lab-icons' },
    geometry: { name: 'microphone capsule', parts: [{ id: 'capsule', name: 'body' }] },
    frames: [{ name: 'button row' }],
  };
  const projected = projectPublicEvidence(input).evidence;
  assert.equal(projected.authorReference.fileName, undefined);
  assert.equal(projected.authorReference.originalSha256, canonicalHash(input.authorReference));
  assert.equal(projected.metadata.fileName, undefined);
  assert.equal(projected.metadata.version, undefined);
  assert.equal(projected.metadata.capturedAt, input.metadata.capturedAt);
  for (const key of ['source', 'geometry', 'frames']) assert.deepEqual(projected[key], input[key]);
  assert.throws(() => assertPublicEvidence(input), refused);
});

test('known failure diagnostics become commitments while motion continuity and phase remain visible', () => {
  const input = {
    author: { kind: 'figma', ...source, nodeId },
    outcome: 'failed',
    failure: {
      phase: 'interrupt',
      stateContinuity: { before: 0.33, after: 0.33 },
      message: `Source ${privateURL} failed`,
      stack: `Error ${source.fileKey}\n at ${nodeId}`,
      browserErrors: [`Unknown node ${nodeId}`],
    },
    browserErrors: [`Asset ${assetURL}`],
    cleanupErrors: [`Cleanup ${sourcePath}`],
  };
  const result = projectPublicEvidence(input).evidence;
  assert.equal(result.outcome, 'failed');
  assert.equal(result.failure.phase, 'interrupt');
  assert.deepEqual(result.failure.stateContinuity, input.failure.stateContinuity);
  for (const key of ['message', 'stack'])
    assert.deepEqual(result.failure[key], {
      kind: 'diagnostic-commitment',
      originalSha256: canonicalHash(input.failure[key]),
    });
  assert.equal(result.browserErrors[0].originalSha256, canonicalHash(input.browserErrors[0]));
  assert.equal(result.cleanupErrors[0].originalSha256, canonicalHash(input.cleanupErrors[0]));
  assert.equal(
    result.failure.browserErrors[0].originalSha256,
    canonicalHash(input.failure.browserErrors[0]),
  );
});

test('object diagnostics are wholly committed while failure phase and continuity remain visible', () => {
  const input = {
    failure: {
      phase: 'interrupt',
      stateContinuity: { before: 0.4, after: 0.4 },
      browserErrors: [
        { message: 'SyntheticDiagnosticSecretABC', stack: 'SyntheticStackSecretDEF' },
      ],
    },
    cleanupErrors: [
      { message: 'SyntheticCleanupSecretGHI', details: { raw: 'SyntheticDetailSecretJKL' } },
    ],
  };
  const result = projectPublicEvidence(input).evidence;
  assert.doesNotMatch(JSON.stringify(result), /Synthetic(?:Diagnostic|Stack|Cleanup|Detail)Secret/);
  assert.deepEqual(result.failure.browserErrors[0], {
    kind: 'diagnostic-commitment',
    originalSha256: canonicalHash(input.failure.browserErrors[0]),
  });
  assert.deepEqual(result.cleanupErrors[0], {
    kind: 'diagnostic-commitment',
    originalSha256: canonicalHash(input.cleanupErrors[0]),
  });
  assert.equal(result.failure.phase, input.failure.phase);
  assert.deepEqual(result.failure.stateContinuity, input.failure.stateContinuity);
});

test('unknown locator-bearing fields and geometry fail explicitly instead of being silently rewritten', () => {
  const privateLocations = collectPrivateLocations(fixture());
  for (const input of [
    { note: `Private file ${source.fileKey}` },
    { geometry: { [nodeId]: [0, 0] } },
    { geometry: { svg: `<g data-node-id="${nodeId}"/>` } },
    { geometry: { partId: source.fileKey } },
    { arbitrary: privateURL },
    { arbitrary: sourcePath },
    { arbitrary: assetURL },
    { author: { kind: 'figma', ...source, unknown: privateURL } },
    { geometry: { sourceFile: sourcePath, d: privateURL } },
  ]) {
    const original = structuredClone(input);
    assert.throws(() => projectPublicEvidence(input, { privateLocations }), refused);
    assert.deepEqual(input, original);
    assert.throws(() => assertPublicEvidence(input, { privateLocations }), refused);
  }
  assert.deepEqual(projectPublicEvidence({ fileKey: source.fileKey }).evidence, {
    originalSha256: canonicalHash({ fileKey: source.fileKey }),
  });
});

test('public scanner catches JSON escaping and binary text locations without changing bytes', () => {
  const privateLocations = collectPrivateLocations(fixture());
  for (const text of [
    privateURL,
    assetURL,
    sourcePath,
    `prefix ${nodeId} suffix`,
    nodeId.replaceAll(':', '-'),
    encodeURIComponent(nodeId),
  ]) {
    assert.throws(() => assertPublicEvidence(text, { privateLocations }), refused);
    assert.throws(() => assertPublicEvidence(Buffer.from(text), { privateLocations }), refused);
    assert.throws(
      () => assertPublicEvidence(Buffer.from(text, 'utf16le'), { privateLocations }),
      refused,
    );
  }
  const escaped = JSON.stringify({ note: source.fileKey }).replace(/S/g, '\\u0053');
  assert.throws(() => assertPublicEvidence(escaped, { privateLocations }), refused);
  assert.throws(() => assertPublicEvidence(Buffer.from(escaped), { privateLocations }), refused);
  const safe = Buffer.from('plain public artifact bytes');
  assert.equal(assertPublicEvidence(safe, { privateLocations }), safe);
});

test('public JSON bytes retain every source string and refuse overwritten members', () => {
  const key = 'SyntheticDuplicateKeyAuditV4';
  const url = `https://www.figma.com./design/${key}/fixture`;
  const privateLocations = [{ kind: 'file-key', value: key }];
  const escapedKey = JSON.stringify(key).replace('S', '\\u0053');
  for (const text of [
    `{"note":${JSON.stringify(url)},"note":"safe"}`,
    `{"note":${JSON.stringify(key)},"note":"safe"}`,
    `{"note":${escapedKey},"n\\u006fte":"safe"}`,
    `{"author":{"fileKey":${JSON.stringify(key)}},"author":{}}`,
    '{"note":"first","note":"last"}',
    '{"note":"first","n\\u006fte":"last"}',
  ]) {
    assert.doesNotThrow(() => JSON.parse(text), 'fixture must exercise valid last-wins JSON');
    for (const value of [text, Buffer.from(text), Buffer.from(text, 'utf16le')])
      assert.throws(() => assertPublicEvidence(value, { privateLocations }), refused);
  }
  const notes = {
    note: `${PUBLIC_ICONS_DESIGN_REFERENCE}\nhttps://docs.example.invalid/guide`,
    escaped: 'Кавычка " и backslash \\ сохраняют {скобки} и [массивы]',
    records: [{ note: 'first' }, { note: 'second' }],
  };
  const text = JSON.stringify(notes, null, 2).replace('"note"', '"n\\u006fte"');
  for (const value of [text, Buffer.from(text), Buffer.from(text, 'utf16le')])
    assert.equal(assertPublicEvidence(value, { privateLocations }), value);
  assert.deepEqual(JSON.parse(text), notes);
});

test('host verification checks original receipt and manifest bytes before last-wins parsing', async (t) => {
  const { mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { exportPublicEvidence, verifyPublicExport } = await import(
    '../../apps/docs/tests/prepare-icons-inputs.mjs'
  );
  const directory = await mkdtemp(join(tmpdir(), 'labui-icons-duplicate-json-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const key = 'SyntheticDuplicateKeyAuditV4';
  const url = `https://www.figma.com./design/${key}/fixture`;
  const raw = Buffer.from('{"note":"safe"}');
  const options = { jsonFiles: new Map([['receipt.json', raw]]), visuals: [] };
  const publicRoot = join(directory, 'public');
  const cases = [
    ['receipt.json', '"note": "safe"', `"note":${JSON.stringify(url)},"note":"safe"`],
    [
      'receipt.json',
      '"evidence":',
      `"evidence":{"author":{"fileKey":${JSON.stringify(key)}}},"evidence":`,
    ],
    ['receipt.json', '"note": "safe"', `"note":${JSON.stringify(key)},"n\\u006fte":"safe"`],
    [
      'manifest.json',
      '"publicDesignReference":',
      `"publicDesignReference":${JSON.stringify(url)},"publicDesignReference":`,
    ],
    [
      'manifest.json',
      '"file":"receipt.json"',
      `"file":${JSON.stringify(key)},"file":"receipt.json"`,
    ],
    [
      'manifest.json',
      '"file":"receipt.json"',
      `"file":${JSON.stringify(key)},"f\\u0069le":"receipt.json"`,
    ],
  ];
  for (const [target, before, after] of cases) {
    await exportPublicEvidence(directory, options);
    await verifyPublicExport(publicRoot);
    const original = await readFile(join(publicRoot, 'receipt.json'));
    assert.equal(
      original.includes(key),
      false,
      'ordinary public projection preserves the safe note',
    );
    const manifest = JSON.parse(await readFile(join(publicRoot, 'manifest.json')));
    const text = target === 'receipt.json' ? original.toString() : JSON.stringify(manifest);
    assert.ok(text.includes(before));
    const changed = Buffer.from(text.replace(before, after));
    assert.ok(changed.includes(key));
    if (target === 'receipt.json') {
      manifest.files[0].bytes = changed.length;
      manifest.files[0].sha256 = hash(changed);
      await writeFile(join(publicRoot, 'receipt.json'), changed);
      await writeFile(join(publicRoot, 'manifest.json'), JSON.stringify(manifest));
    } else {
      await writeFile(join(publicRoot, 'manifest.json'), changed);
    }
    await assert.rejects(verifyPublicExport(publicRoot), refused);
  }
});

test('raw projection refuses duplicate metadata before collecting private locations', async () => {
  const { projectJsonBytes } = await import('../../apps/docs/tests/prepare-icons-inputs.mjs');
  const key = 'SyntheticRawMetadataKeyC83';
  const author = JSON.stringify({ fileKey: key, version: '101' });
  for (const text of [
    `{"author":${author},"author":{},"notes":"${key}"}`,
    `{"author":${author},"a\\u0075thor":{},"notes":"${key}"}`,
    `{"metadata":{"author":${author},"author":{}},"notes":"${key}"}`,
  ]) {
    const raw = Buffer.from(text);
    assert.doesNotThrow(() => JSON.parse(raw));
    for (const locations of [undefined, [], [{ kind: 'file-key', value: 'UnrelatedSourceD94' }]])
      assert.throws(() => projectJsonBytes(raw, locations), refused);
  }
});

test('explicit private context augments identities discovered in the current document', () => {
  const key = 'SyntheticRawUniqueMetadataB92';
  const value = { author: { fileKey: key, version: '101' }, notes: key };
  for (const privateLocations of [[], [{ kind: 'file-key', value: 'UnrelatedSourceD94' }]])
    assert.throws(() => projectPublicEvidence(value, { privateLocations }), refused);
});

test('raw export retains local private classification and accepts unique public neighbors', async (t) => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { exportPublicEvidence, verifyPublicExport } = await import(
    '../../apps/docs/tests/prepare-icons-inputs.mjs'
  );
  const directory = await mkdtemp(join(tmpdir(), 'labui-icons-raw-metadata-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const key = 'SyntheticRawMetadataKeyC83';
  const author = { fileKey: key, version: '101' };
  const options = { visuals: [], privateLocations: [] };
  for (const text of [
    `{"author":${JSON.stringify(author)},"author":{},"notes":"${key}"}`,
    `{"author":${JSON.stringify(author)},"a\\u0075thor":{},"notes":"${key}"}`,
    JSON.stringify({ author, notes: key }),
  ]) {
    await assert.rejects(
      exportPublicEvidence(directory, {
        ...options,
        jsonFiles: new Map([['receipt.json', Buffer.from(text)]]),
      }),
      refused,
    );
    await assert.rejects(verifyPublicExport(join(directory, 'public')), refused);
  }
  const publicNotes = `${PUBLIC_ICONS_DESIGN_REFERENCE}\nhttps://docs.example.invalid/guide`;
  const input = { author, notes: publicNotes, geometry: { width: 24, paths: 5 } };
  const raw = Buffer.from(JSON.stringify(input, null, 2).replace('"author"', '"a\\u0075thor"'));
  await exportPublicEvidence(directory, {
    ...options,
    jsonFiles: new Map([['receipt.json', raw]]),
  });
  await verifyPublicExport(join(directory, 'public'));
  const bytes = await readFile(join(directory, 'public', 'receipt.json'));
  assert.equal(bytes.includes(key), false);
  const projected = JSON.parse(bytes);
  assert.equal(projected.evidence.notes, publicNotes);
  assert.deepEqual(projected.evidence.geometry, input.geometry);
  assert.equal(projected.originalBytesSha256, hash(raw));
});

test('WHATWG private URL variants refuse without rewriting arbitrary notes', () => {
  const variants = [
    String.raw`https:\\www.figma.com\design\SyntheticUnknownKeyABCD\fixture?node-id=111222-333444`,
    String.raw`https:\www.figma.com\design\SyntheticUnknownKeyABCD\fixture`,
    'https:www.figma.com/design/SyntheticUnknownKeyABCD/fixture',
    '//www.figma.com/design/SyntheticUnknownKeyABCD/fixture',
    String.raw`\\www.figma.com\design\SyntheticUnknownKeyABCD\fixture`,
  ];
  for (const url of variants) {
    const native = /^https?:/i.test(url) ? new URL(url) : new URL(url, 'https://example.com/');
    assert.equal(native.hostname, 'www.figma.com');
    const input = { note: `Reference ${url}` };
    assert.throws(() => projectPublicEvidence(input), refused);
    assert.throws(() => assertPublicEvidence(input), refused);
    assert.equal(input.note, `Reference ${url}`);
  }
  const control = {
    note: String.raw`https:\\example.com\docs`,
    path: String.raw`C:\workspace\icons`,
  };
  assert.deepEqual(projectPublicEvidence(control).evidence, control);
});

test('public errors allowlist labels and commit diagnostics without custom error or getter leaks', () => {
  const privateLocations = collectPrivateLocations(fixture());
  const error = Object.assign(new Error(`Missing ${privateURL}`), {
    name: `Custom-${source.fileKey}`,
    code: `CODE-${nodeId}`,
    secret: privateURL,
  });
  const projected = publicError(error, { privateLocations });
  assert.deepEqual(Object.keys(projected).sort(), ['code', 'diagnosticSha256', 'name']);
  assert.equal(projected.name, 'Error');
  assert.equal(projected.code, 'ERROR');
  assert.equal(publicError(new TypeError('type')).name, 'TypeError');
  assert.match(projected.diagnosticSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(projected.diagnosticSha256, publicError(new Error('different')).diagnosticSha256);
  assert.doesNotThrow(() => assertPublicEvidence(projected, { privateLocations }));
  assert.equal(
    publicError(Object.assign(new Error('assertion'), { code: 'ERR_ASSERTION' })).code,
    'ERR_ASSERTION',
  );
  let getterCalls = 0;
  const hostile = Object.defineProperties(
    {},
    Object.fromEntries(
      ['name', 'code', 'message', 'stack'].map((key) => [
        key,
        {
          get() {
            getterCalls++;
            throw error;
          },
        },
      ]),
    ),
  );
  assert.deepEqual(publicError(hostile), publicError(null));
  assert.deepEqual(
    publicError(
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw error;
          },
        },
      ),
    ),
    publicError(null),
  );
  assert.equal(getterCalls, 0);
});

test('invalid JSON identities, cycles and accessors refuse before invoking user code', () => {
  const cyclic = {};
  cyclic.self = cyclic;
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, 'fileKey', {
    enumerable: true,
    get() {
      getterCalls++;
      return source.fileKey;
    },
  });
  const sparse = Array(2);
  sparse[1] = 1;
  for (const input of [
    cyclic,
    accessor,
    { weight: Number.NaN },
    { geometry: undefined },
    new Date(),
    sparse,
  ])
    assert.throws(() => projectPublicEvidence(input), refused);
  assert.equal(getterCalls, 0);
  assert.throws(() => projectPublicEvidence({}, { privateLocations: ['not-typed'] }), refused);
});

test('array traversal refuses own method accessors and inherited iterators before execution', () => {
  let methodCalls = 0;
  const geometry = [1, 2];
  Object.defineProperty(geometry, 'map', {
    get() {
      methodCalls++;
      geometry[0] = 9;
      return Array.prototype.map;
    },
  });
  assert.throws(() => projectPublicEvidence({ geometry }), refused);
  assert.equal(methodCalls, 0);
  assert.deepEqual(Array.from(geometry), [1, 2]);
  let iteratorCalls = 0;
  const notes = [source.fileKey];
  Object.setPrototypeOf(
    notes,
    Object.create(Array.prototype, {
      [Symbol.iterator]: {
        value() {
          iteratorCalls++;
          return { next: () => ({ done: true }) };
        },
      },
    }),
  );
  const privateLocations = [{ kind: 'file-key', value: source.fileKey }];
  assert.throws(() => assertPublicEvidence({ notes }, { privateLocations }), refused);
  assert.throws(() => collectPrivateLocations({ notes }), refused);
  assert.equal(iteratorCalls, 0);
  assert.equal(JSON.stringify({ notes }).includes(source.fileKey), true);
  let proxyCalls = 0;
  const proxy = new Proxy([1, 2], {
    getOwnPropertyDescriptor() {
      proxyCalls++;
      throw new Error('SyntheticTrap');
    },
  });
  assert.throws(() => projectPublicEvidence({ proxy }), refused);
  assert.equal(proxyCalls, 0);
  const topLevelProxy = new Proxy([1, 2], {
    getPrototypeOf() {
      proxyCalls++;
      throw new Error('SyntheticPrototypeTrap');
    },
  });
  assert.throws(() => assertPublicEvidence(topLevelProxy), refused);
  assert.equal(proxyCalls, 0);
  const locations = [{ kind: 'file-key', value: source.fileKey }];
  Object.defineProperty(locations, 'map', {
    get() {
      methodCalls++;
      return Array.prototype.map;
    },
  });
  assert.throws(() => assertPublicEvidence({}, { privateLocations: locations }), refused);
  assert.equal(methodCalls, 0);
});

test('strict JSON arrays reject hidden properties and preserve frozen ordinary controls', () => {
  for (const array of [
    Object.defineProperty([1, 2], 'hidden', { value: 'not JSON data' }),
    Object.assign([1, 2], { extra: true }),
    Object.defineProperty([1, 2], '0', { enumerable: false }),
    Object.defineProperty([1, 2], Symbol.iterator, { value: function* () {} }),
    Object.setPrototypeOf([1, 2], null),
  ])
    assert.throws(() => projectPublicEvidence({ array }), refused);
  const geometry = Object.freeze([1, 2, Object.freeze([3, 4])]);
  const projection = projectPublicEvidence({ geometry });
  assert.deepEqual(projection.evidence, { geometry: [1, 2, [3, 4]] });
  assert.equal(projection.originalSha256, canonicalHash({ geometry: [1, 2, [3, 4]] }));
});

test('safe public control and prototype-like geometry keys survive canonical projection', () => {
  const input = JSON.parse(
    '{"geometry":{"__proto__":{"x":1},"constructor":[1,2]},"url":"https://example.com/docs","version":"1"}',
  );
  const projection = projectPublicEvidence(input);
  assert.deepEqual(projection.evidence, input);
  assert.equal(Object.getPrototypeOf(projection.evidence.geometry), Object.prototype);
  assert.equal({}.x, undefined);
  assert.doesNotThrow(() => assertPublicEvidence({ url: PUBLIC_ICONS_DESIGN_REFERENCE }));
});

test('browser frontier commits free records in every projection and refuses public raw records', () => {
  const raw = {
    mode: 'no-preference',
    stage: 'width-motion',
    member: 'mic-circle/outline',
    elapsedMs: 300,
    completedRecords: 2,
    stageElapsedMs: 100,
    stageCompletedRecords: 1,
    lastCompletedRecord: 'controlled token=private-observation',
    lastCompletedAtMs: 290,
    sinceLastCompletedMs: 10,
    completedStages: [],
  };
  const expected = structuredClone(raw);
  Reflect.deleteProperty(expected, 'lastCompletedRecord');
  expected.lastCompletedRecordSha256 = hash(raw.lastCompletedRecord);
  const projection = projectPublicEvidence({ failure: { browserFrontier: raw } });
  assert.deepEqual(projection.evidence.failure.browserFrontier, expected);
  assert.equal(projection.originalSha256, canonicalHash({ failure: { browserFrontier: raw } }));
  assert.deepEqual(publicBrowserFrontier(expected), expected, 'проекция повторно безопасна');
  assert.doesNotThrow(() => assertPublicEvidence(projection));
  for (const encode of [
    (value) => value,
    JSON.stringify,
    (value) => Buffer.from(JSON.stringify(value)),
  ])
    assert.throws(
      () => assertPublicEvidence(encode({ failure: { browserFrontier: raw } })),
      refused,
    );
  for (const invalid of [
    null,
    [],
    { ...expected, lastCompletedRecord: raw.lastCompletedRecord },
    { ...expected, lastCompletedRecordSha256: 'unverified' },
    { ...raw, stageCompletedRecords: -1 },
    {
      ...raw,
      completedStages: [
        {
          mode: null,
          stage: 'start',
          member: null,
          elapsedMs: 0,
          completedRecords: 0,
          stack: 'raw',
        },
      ],
    },
  ])
    assert.throws(() => publicBrowserFrontier(invalid), refused);
  let calls = 0;
  const accessor = Object.defineProperty({ ...raw }, 'lastCompletedRecord', {
    enumerable: true,
    get() {
      calls++;
      return 'private';
    },
  });
  const proxy = new Proxy(raw, {
    getPrototypeOf() {
      calls++;
      return Object.prototype;
    },
  });
  assert.throws(() => publicBrowserFrontier(accessor), refused);
  assert.throws(() => publicBrowserFrontier(proxy), refused);
  assert.equal(calls, 0);
});
