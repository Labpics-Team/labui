import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  parseIconsJson,
  projectPublicProvenance,
  publicDiagnosticError,
  publicFailure,
} from './icons-public-provenance.mjs';
import { authorReference, consumerReceiptLog } from './prepare-icons-inputs.mjs';

const PRIVATE_KEY = 'SyntheticFigmaAuthorKey01';
const COMMUNITY =
  'https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const PRIVATE_URL = `https://www.figma.com/design/${PRIVATE_KEY}/fixture`;
const SOURCE_SHA = 'a'.repeat(40);
const UI_SHA = 'b'.repeat(40);

test('publication refuses raw private provenance before gzip encodes the receipt', () => {
  for (const record of [
    { author: { fileKey: PRIVATE_KEY } },
    { link: PRIVATE_URL },
    { author: { fileKey: PRIVATE_KEY }, notes: PRIVATE_KEY },
  ]) {
    const bytes = Buffer.from(
      JSON.stringify({ schemaVersion: 1, outcome: 'passed', records: [record] }),
    );
    assert.throws(() => consumerReceiptLog(bytes, SOURCE_SHA, UI_SHA));
  }
});

test('publication preserves exact Community and geometry evidence bytes', () => {
  const bytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'passed',
      records: [
        {
          link: COMMUNITY,
          paths: [{ d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' }],
          masterSha256: 'c'.repeat(64),
        },
      ],
    }),
  );
  const packet = consumerReceiptLog(bytes, SOURCE_SHA, UI_SHA);
  const chunks = packet
    .split('\n')
    .filter((line) => line.startsWith('LABUI_ICONS_CONSUMER_RECEIPT_CHUNK '));
  const restored = gunzipSync(
    Buffer.from(chunks.map((line) => line.split(' ')[2]).join(''), 'base64'),
  );
  assert.ok(restored.equals(bytes));
});

test('current public source pin has no raw private provenance fields', async () => {
  const bytes = await readFile(new URL('./icons-consumer-source.json', import.meta.url));
  assert.ok(!/"fileKey"\s*:/.test(bytes.toString()), 'public source pin contains raw provenance');
});

async function sourceFixture(t) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-icons-public-source-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.match(basename(resolved), /^labui-icons-public-source-/);
    await rm(resolved, { recursive: true });
  });
  const d = 'M0 0L1 0L1 1Z';
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="#101012"/></svg>`;
  const bytes = Buffer.from(svg);
  // Fixed input geometry, independently spelled canonical path-entry serialization.
  const fingerprint = hash('[{"d":"M0 0L1 0L1 1Z","fillRule":"nonzero","index":0}]');
  const manifest = {
    schemaVersion: 1,
    source: { fileKey: PRIVATE_KEY, version: '1', name: '🧪Lab UI (v2.1)' },
    icons: { reload: {} },
  };
  const annotations = {
    schemaVersion: 1,
    source: { fileKey: PRIVATE_KEY, version: '1' },
    icons: { reload: {} },
  };
  for (const variant of ['outline', 'filled']) {
    const master = `masters/figma/1/${variant === 'outline' ? 'Outline' : 'Filled'}/reload.svg`;
    manifest.icons.reload[variant] = {
      master,
      bytes: bytes.length,
      sha256: hash(bytes),
      nodeId: '10:20',
      nodeSha256: 'c'.repeat(64),
      normalizedSource: { sha256: 'd'.repeat(64), pathFingerprintSha256: fingerprint },
    };
    annotations.icons.reload[variant] = {
      masterSha256: hash(bytes),
      pathFingerprintSha256: fingerprint,
      parts: [
        {
          pathIndex: 0,
          id: 'cycle-body',
          role: 'control',
          anchor: [0.5, 0.5],
          anchorMeaning: 'canvas-center',
        },
      ],
      gesture: { law: 'cycle.clockwise', partId: 'cycle-body' },
    };
    await mkdir(dirname(join(root, master)), { recursive: true });
    await writeFile(join(root, master), bytes);
  }
  await mkdir(join(root, 'semantics'));
  await writeFile(join(root, 'semantics/figma-baseline.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'semantics/author-anatomy.json'), JSON.stringify(annotations));
  return {
    root,
    annotations,
    d,
    masterSha256: hash(bytes),
    fingerprint,
    pin: {
      schemaVersion: 2,
      repository: 'Labpics-Team/lab-icons',
      sourceCommit: SOURCE_SHA,
      figma: { fileKeySha256: hash(PRIVATE_KEY), version: '1' },
    },
  };
}

test('source identity refusal never formats raw actual or expected values', async (t) => {
  const { root, pin } = await sourceFixture(t);
  pin.figma.fileKeySha256 = '0'.repeat(64);
  let error;
  try {
    await authorReference(root, pin);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, 'a mismatched source identity must refuse');
  assert.ok(
    !String(error.stack).includes(PRIVATE_KEY),
    'source diagnostic exposes private provenance',
  );
  assert.ok(
    !JSON.stringify(error).includes(PRIVATE_KEY),
    'source error properties expose private provenance',
  );
});

test('public oracle retains raw SVG binding, anatomy and clockwise gesture', async (t) => {
  const { root, pin, d, masterSha256, fingerprint } = await sourceFixture(t);
  const reference = await authorReference(root, pin);
  assert.ok(!JSON.stringify(reference).includes(PRIVATE_KEY));
  assert.equal(reference.fileKeySha256, pin.figma.fileKeySha256);
  for (const variant of ['outline', 'filled']) {
    const item = reference.icons.reload[variant];
    assert.deepEqual(item.paths, [{ d, fillRule: 'nonzero' }]);
    assert.equal(item.author.masterSha256, masterSha256);
    assert.equal(item.author.pathFingerprintSha256, fingerprint);
    assert.equal(item.author.nodeIdSha256, hash('10:20'));
    assert.equal(item.anatomy.masterSha256, masterSha256);
    assert.equal(item.gesture.tracks[0].to, 360);
    assert.equal(item.gesture.tracks[0].from, 0);
    assert.equal(item.gesture.tracks[0].interpolation, 'linear');
  }
});

test('source JSON refuses repeated decoded member names before identity collection', async (t) => {
  const { root, pin, annotations } = await sourceFixture(t);
  const original = JSON.stringify(annotations);
  const duplicate = original.replace(
    '"source":',
    `"so\\u0075rce":{"fileKey":"OtherSyntheticKey01","version":"1"},"source":`,
  );
  await writeFile(join(root, 'semantics/author-anatomy.json'), duplicate);
  await assert.rejects(authorReference(root, pin));
});

test('public observation projection preserves binding and lawful metadata without changing geometry', () => {
  const raw = {
    author: {
      kind: 'figma',
      fileKey: PRIVATE_KEY,
      version: '1',
      nodeId: '10:20',
      masterSha256: 'c'.repeat(64),
    },
    proof: { source: { fileKey: PRIVATE_KEY, version: '1' }, specSha256: 'd'.repeat(64) },
    paths: [{ d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' }],
    link: COMMUNITY,
    first: { notes: 'public author metadata' },
    second: { notes: 'public author metadata' },
  };
  const projected = projectPublicProvenance(raw);
  assert.ok(!JSON.stringify(projected).includes(PRIVATE_KEY));
  assert.equal(projected.author.fileKeySha256, hash(PRIVATE_KEY));
  assert.equal(projected.author.nodeIdSha256, hash('10:20'));
  assert.equal(projected.proof.source.fileKeySha256, hash(PRIVATE_KEY));
  assert.deepEqual(projected.paths, raw.paths);
  assert.equal(projected.author.masterSha256, raw.author.masterSha256);
  assert.equal(projected.proof.specSha256, raw.proof.specSha256);
  assert.equal(projected.link, COMMUNITY);
  assert.deepEqual(projected.first, projected.second);
  assert.equal(
    raw.author.fileKey,
    PRIVATE_KEY,
    'projection must not mutate the verified raw source',
  );
  const special = parseIconsJson(
    '{"__proto__":{"notes":"public"},"author":{"fileKey":"SyntheticFigmaAuthorKey01"}}',
  );
  assert.ok(Object.hasOwn(projectPublicProvenance(special), '__proto__'));
});

test('copied, encoded and conflicting private identities refuse at observation projection', () => {
  for (const notes of [
    PRIVATE_KEY,
    [...PRIVATE_KEY].map((character) => `%${character.charCodeAt(0).toString(16)}`).join(''),
    [...PRIVATE_KEY]
      .map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .join(''),
    PRIVATE_URL,
  ])
    assert.throws(() => projectPublicProvenance({ author: { fileKey: PRIVATE_KEY }, notes }));
  assert.throws(() =>
    projectPublicProvenance({ author: { fileKey: PRIVATE_KEY, fileKeySha256: hash(PRIVATE_KEY) } }),
  );
  assert.throws(() => projectPublicProvenance({ author: { fileKey: 'invalid key' } }));
  assert.throws(() => projectPublicProvenance({ author: { nodeId: 'invalid-node' } }));
});

test('failed API diagnostics retain check and numerical continuity without arbitrary text or error properties', () => {
  let error;
  try {
    assert.equal(PRIVATE_KEY, 'OtherSyntheticKey01');
  } catch (caught) {
    error = caught;
  }
  error.stateContinuity = {
    differences: [{ partId: 'state-question', before: 0.3, after: 0.5, delta: 0.2 }],
    witness: { at: 20 },
  };
  const failure = publicFailure(error);
  assert.equal(failure.code, 'ERR_ASSERTION');
  assert.deepEqual(failure.stateContinuity, error.stateContinuity);
  assert.ok(!JSON.stringify(failure).includes(PRIVATE_KEY));
  assert.ok(!String(publicDiagnosticError(error).stack).includes(PRIVATE_KEY));
  assert.ok(!JSON.stringify(publicFailure(new Error(PRIVATE_URL))).includes(PRIVATE_URL));
});

async function summaryFixture(t, receipt) {
  const { root, pin } = await sourceFixture(t);
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
        sourceCommit: SOURCE_SHA,
        archiveSha256: 'c'.repeat(64),
        archiveBytes: 1,
      },
    ]),
  );
  const subject = { schemaVersion: 1, packages, authorReference: await authorReference(root, pin) };
  const subjectBytes = JSON.stringify(subject);
  const source = {
    schemaVersion: 1,
    pin,
    uiCommit: UI_SHA,
    subjectSha256: hash(subjectBytes),
    files: [],
  };
  const output = join(root, 'summary');
  await mkdir(join(output, 'inputs'), { recursive: true });
  await mkdir(join(output, 'result'));
  await writeFile(join(output, 'inputs/subject.json'), subjectBytes);
  await writeFile(join(output, 'inputs/source-receipt.json'), JSON.stringify(source));
  await writeFile(join(output, 'result/receipt.json'), JSON.stringify(receipt));
  return {
    output,
    source,
    invoke: () =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./prepare-icons-inputs.mjs', import.meta.url)),
          '--summarize',
          output,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
      ),
  };
}

test('public stdout summary and its gzip receipt retain exact Community observations and hashes', async (t) => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ link: COMMUNITY, masterSha256: 'c'.repeat(64), opacity: 0.375 }],
  };
  const fixture = await summaryFixture(t, receipt);
  const result = fixture.invoke();
  assert.equal(result.status, 0);
  assert.ok(!result.stdout.includes(PRIVATE_KEY));
  const summary = JSON.parse(result.stdout.split('LABUI_ICONS_CONSUMER_RESULT ')[1]);
  assert.equal(summary.source.pin.figma.fileKeySha256, hash(PRIVATE_KEY));
  assert.equal(summary.source.pin.sourceCommit, SOURCE_SHA);
  const chunks = result.stdout
    .split('\n')
    .filter((line) => line.startsWith('LABUI_ICONS_CONSUMER_RECEIPT_CHUNK '));
  const bytes = gunzipSync(
    Buffer.from(chunks.map((line) => line.split(' ')[2]).join(''), 'base64'),
  );
  assert.ok(bytes.equals(Buffer.from(JSON.stringify(receipt))));
  assert.equal(
    summary.files.find((entry) => entry.path === 'result/receipt.json').sha256,
    hash(bytes),
  );
});

test('summary refuses legacy raw source receipts before any stdout publication', async (t) => {
  const fixture = await summaryFixture(t, { schemaVersion: 1, outcome: 'passed', records: [] });
  fixture.source.pin = {
    ...fixture.source.pin,
    schemaVersion: 1,
    figma: { fileKey: PRIVATE_KEY, version: '1' },
  };
  await writeFile(
    join(fixture.output, 'inputs/source-receipt.json'),
    JSON.stringify(fixture.source),
  );
  const result = fixture.invoke();
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.ok(!result.stderr.includes(PRIVATE_KEY));
});

test('summary failure path refuses private error URLs and preserves lawful numerical diagnostics', async (t) => {
  const fixture = await summaryFixture(t, {
    schemaVersion: 1,
    outcome: 'failed',
    records: [],
    failure: { phase: 'browser', message: PRIVATE_URL },
  });
  const refused = fixture.invoke();
  assert.notEqual(refused.status, 0);
  assert.equal(refused.stdout, '');
  assert.ok(!refused.stderr.includes(PRIVATE_KEY));
  const continuity = {
    differences: [{ partId: 'state-question', before: 0.3, after: 0.5, delta: 0.2 }],
    witness: { at: 20 },
  };
  await writeFile(
    join(fixture.output, 'result/receipt.json'),
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'failed',
      records: [],
      failure: { phase: 'browser', code: 'ERR_ASSERTION', stateContinuity: continuity },
    }),
  );
  const failed = fixture.invoke();
  assert.notEqual(failed.status, 0);
  const summary = JSON.parse(failed.stdout.split('LABUI_ICONS_CONSUMER_RESULT ')[1]);
  assert.deepEqual(summary.failure.stateContinuity, continuity);
  assert.ok(!failed.stdout.includes(PRIVATE_KEY));
  assert.ok(!failed.stderr.includes(PRIVATE_KEY));
});
