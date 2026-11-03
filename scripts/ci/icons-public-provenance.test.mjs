import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  PUBLIC_ICONS_DESIGN_REFERENCE,
  assertPublicEvidence,
  assertSourceIdentity,
  collectPrivateLocations,
  projectPublicEvidence,
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
