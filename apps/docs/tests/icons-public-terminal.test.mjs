import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_COMMUNITY_URL,
  PUBLIC_QUALIFICATION,
  PUBLIC_SCENARIO,
  assertPublicProvenance,
  parseIconsJson,
  projectPublicProvenance,
} from './icons-public-provenance.mjs';
import { consumerReceiptLog, terminalReceipt } from './prepare-icons-inputs.mjs';

const DIGEST = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const LEGACY_SCENARIO =
  'LabUI icon-only buttons, reload Outline/Filled и status-circle при schema2, публичный Lab Motion; размер полного consumer без baseline speedup claim';
const LEGACY_QUALIFICATION =
  'Три заданных архива и публичный Motion установлены в отдельный consumer. Producer sourceCommit — входное утверждение; публикация и полная оптическая приёмка этим запуском не доказаны.';
const codecs = [assertPublicProvenance, projectPublicProvenance];
const geometry = { d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' };
const observation = {
  name: 'author-observation',
  link: PUBLIC_COMMUNITY_URL,
  paths: [geometry],
  opacity: 0.375,
  masterSha256: DIGEST,
};
const passed = { schemaVersion: 1, outcome: 'passed', records: [observation] };

function summary(outcome = 'passed') {
  return {
    schemaVersion: 1,
    outcome,
    source: {
      schemaVersion: 1,
      pin: {
        schemaVersion: 2,
        repository: 'Labpics-Team/lab-icons',
        sourceCommit: COMMIT,
        figma: { fileKeySha256: DIGEST, fileKeyLength: 22, version: '1' },
      },
      uiCommit: COMMIT,
      subjectSha256: DIGEST,
      files: [],
    },
    observations: 1,
    failure: null,
    files: [],
    diagnosticDirectorySha256: DIGEST,
  };
}

function packageSubject(schemaVersion) {
  const source = { fileKeySha256: DIGEST, version: '1' };
  const author = { kind: 'figma', ...source, nodeIdSha256: DIGEST };
  const variant = (name) => ({
    sourceFile: `masters/figma/1/${name}/reload.svg`,
    author,
    anatomy: {
      version: 1,
      annotationSha256: DIGEST,
      masterSha256: DIGEST,
      pathFingerprintSha256: DIGEST,
    },
    viewBox: [0, 0, 24, 24],
    paths: [geometry],
    parts: [{ id: 'cycle-body', role: 'control', zIndex: 0, ...geometry }],
    gesture: {
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
          anchor: [12, 12],
          from: 0,
          to: 360,
          unit: 'degrees',
          interpolation: 'linear',
        },
      ],
    },
  });
  const stateReference = (group, defaultState, enclosurePartId) => ({
    group,
    variant: 'outline',
    defaultState,
    enclosurePartId,
    enclosure: geometry,
    states: [],
    proof: {
      law: 'enclosure.replace',
      source,
      enclosureSha256: DIGEST,
      specSha256: DIGEST,
    },
  });
  const packages = {
    icons: '@labpics/icons',
    uiCore: '@labpics/ui-core',
    ...(schemaVersion === 4
      ? { uiMaterials: '@labpics/ui-materials', uiTokens: '@labpics/ui-tokens' }
      : {}),
    uiShadow: '@labpics/ui-shadow',
  };
  return {
    schemaVersion,
    packages: Object.fromEntries(
      Object.entries(packages).map(([key, name]) => [
        key,
        {
          name,
          version: '0.1.0',
          archiveSha256: DIGEST,
          archiveBytes: 1,
          sourceCommit: COMMIT,
          ...(schemaVersion === 4
            ? {
                runtimeDependencies: {
                  dependencies: {},
                  optionalDependencies: {},
                  peerDependencies: {},
                },
              }
            : {}),
        },
      ]),
    ),
    authorReference: {
      fileName: 'Lab UI v2.1',
      ...source,
      icons: { reload: { outline: variant('Outline'), filled: variant('Filled') } },
    },
    stateReferences: {
      'status-circle': stateReference('status-circle', 'question', 'status-enclosure'),
      'expression-face': stateReference('expression-face', 'aloof', 'face-enclosure'),
    },
  };
}

function consumer(scenario = PUBLIC_SCENARIO) {
  return {
    fixtureSha256: DIGEST,
    htmlSha256: DIGEST,
    publicEntries: {},
    moduleGraph: [],
    bundles: [],
    scenario,
  };
}

test('receipt codecs reject PASSED with an explicit failure and preserve the same FAILED diagnostics', () => {
  const contradictory = { ...passed, failure: { phase: 'browser' } };
  const failed = { ...contradictory, outcome: 'failed' };
  for (const parse of codecs) {
    assert.deepEqual(parse(passed, 'receipt'), passed);
    assert.throws(() => parse(contradictory, 'receipt'), { code: 'PUBLIC_CONTRACT_REFUSED' });
    assert.deepEqual(parse(failed, 'receipt'), failed);
  }
});

test('receipt codecs reject PASSED with cleanup errors and retain empty cleanup', () => {
  const empty = { ...passed, cleanupErrors: [] };
  const contradictory = {
    ...passed,
    cleanupErrors: [{ code: 'EACCES', message: 'icons: EACCES' }],
  };
  const failed = { ...contradictory, outcome: 'failed' };
  for (const parse of codecs) {
    assert.deepEqual(parse(empty, 'receipt'), empty);
    assert.throws(() => parse(contradictory, 'receipt'), { code: 'PUBLIC_CONTRACT_REFUSED' });
    assert.deepEqual(parse(failed, 'receipt'), failed);
    assert.deepEqual(parse({ ...passed, outcome: 'failed' }, 'receipt'), {
      ...passed,
      outcome: 'failed',
    });
  }
});

test('summary codecs reject PASSED with failure or refused readback and preserve FAILED readback', () => {
  const healthy = summary();
  for (const diagnostic of [
    { failure: { phase: 'browser' } },
    { readbackFailure: { code: 'EVIDENCE_REFUSED', file: 'result/receipt.json' } },
    {
      failure: { phase: 'browser' },
      readbackFailure: { code: 'EVIDENCE_REFUSED', file: 'result/reduce.png' },
    },
  ]) {
    const contradictory = { ...healthy, ...diagnostic };
    const failed = { ...contradictory, outcome: 'failed' };
    for (const parse of codecs) {
      assert.deepEqual(parse(healthy, 'summary'), healthy);
      assert.throws(() => parse(contradictory, 'summary'), { code: 'PUBLIC_CONTRACT_REFUSED' });
      assert.deepEqual(parse(failed, 'summary'), failed);
    }
  }
  for (const parse of codecs)
    assert.throws(() => parse({ ...healthy, cleanupErrors: [{ code: 'EACCES' }] }, 'summary'), {
      code: 'PUBLIC_CONTRACT_REFUSED',
    });
});

test('receipt byte publication refuses a contradictory PASSED packet before encoding', () => {
  const contradictory = Buffer.from(JSON.stringify({ ...passed, failure: { phase: 'browser' } }));
  const healthy = Buffer.from(JSON.stringify(passed));
  const failed = Buffer.from(
    JSON.stringify({ ...passed, outcome: 'failed', failure: { phase: 'browser' } }),
  );
  assert.throws(() => terminalReceipt(contradictory, undefined, 0), {
    code: 'PUBLIC_CONTRACT_REFUSED',
  });
  assert.throws(() => consumerReceiptLog(contradictory, COMMIT, COMMIT), {
    code: 'PUBLIC_CONTRACT_REFUSED',
  });
  assert.deepEqual(terminalReceipt(healthy, undefined, 0), passed);
  assert.match(consumerReceiptLog(healthy, COMMIT, COMMIT), /^LABUI_ICONS_CONSUMER_RECEIPT_BEGIN /);
  assert.equal(terminalReceipt(failed, undefined, 0).outcome, 'failed');
  assert.equal(terminalReceipt(healthy, failed, 0).outcome, 'failed');
  assert.equal(terminalReceipt(healthy, undefined, 1).outcome, 'failed');
});

test('neutral scenario and qualification cover three and five package subjects', () => {
  assert.doesNotMatch(PUBLIC_QUALIFICATION, /^Три(?:\s|$)/i);
  assert.doesNotMatch(PUBLIC_SCENARIO, /schema2/i);
  for (const [schemaVersion, packageCount] of [
    [3, 3],
    [4, 5],
  ]) {
    const subject = packageSubject(schemaVersion);
    assert.equal(Object.keys(subject.packages).length, packageCount);
    const input = {
      ...passed,
      subject,
      consumer: consumer(),
      qualification: PUBLIC_QUALIFICATION,
    };
    for (const parse of codecs) assert.deepEqual(parse(input, 'receipt'), input);
  }
});

test('legacy receipt wording remains readable for three packages and refuses five package claims', () => {
  const historical = {
    ...passed,
    subject: packageSubject(3),
    consumer: consumer(LEGACY_SCENARIO),
    qualification: LEGACY_QUALIFICATION,
  };
  for (const parse of codecs) assert.deepEqual(parse(historical, 'receipt'), historical);
  for (const claims of [
    { qualification: LEGACY_QUALIFICATION },
    { consumer: consumer(LEGACY_SCENARIO) },
    { qualification: LEGACY_QUALIFICATION, consumer: consumer(LEGACY_SCENARIO) },
  ]) {
    const contradictory = { ...passed, subject: packageSubject(4), ...claims };
    for (const parse of codecs) {
      assert.throws(() => parse(contradictory, 'receipt'), { code: 'PUBLIC_CONTRACT_REFUSED' });
      assert.throws(() => parse({ ...contradictory, outcome: 'failed' }, 'receipt'), {
        code: 'PUBLIC_CONTRACT_REFUSED',
      });
    }
  }
});

test('legacy three-archive wording matches archived package count when subject metadata is absent', () => {
  const archives = ['icons', 'uiCore', 'uiMaterials', 'uiTokens', 'uiShadow'].map((key) => ({
    key,
    inputNameSha256: DIGEST,
    archiveSha256: DIGEST,
    archiveBytes: 1,
    integrity: `sha512-${'A'.repeat(86)}==`,
    snapshot: `archives/${key}.tgz`,
  }));
  const historical = {
    ...passed,
    archives: archives.filter(({ key }) => ['icons', 'uiCore', 'uiShadow'].includes(key)),
    consumer: consumer(LEGACY_SCENARIO),
    qualification: LEGACY_QUALIFICATION,
  };
  assert.equal(historical.archives.length, 3);
  assert.equal(archives.length, 5);
  for (const parse of codecs) {
    assert.deepEqual(parse(historical, 'receipt'), historical);
    assert.throws(() => parse({ ...historical, archives }, 'receipt'), {
      code: 'PUBLIC_CONTRACT_REFUSED',
    });
  }
});

test('legacy count claims require at least one known package or archive count', () => {
  for (const metadata of [{}, { subject: undefined, archives: undefined }, { archives: [] }]) {
    const contradictory = { ...passed, ...metadata, qualification: LEGACY_QUALIFICATION };
    for (const parse of codecs) {
      assert.throws(() => parse(contradictory, 'receipt'), { code: 'PUBLIC_CONTRACT_REFUSED' });
      assert.throws(() => parse({ ...contradictory, outcome: 'failed' }, 'receipt'), {
        code: 'PUBLIC_CONTRACT_REFUSED',
      });
    }
    const bytes = Buffer.from(JSON.stringify(contradictory));
    assert.throws(() => terminalReceipt(bytes, undefined, 0), { code: 'PUBLIC_CONTRACT_REFUSED' });
    assert.throws(() => consumerReceiptLog(bytes, COMMIT, COMMIT), {
      code: 'PUBLIC_CONTRACT_REFUSED',
    });
  }
  const neutral = { ...passed, qualification: PUBLIC_QUALIFICATION };
  for (const parse of codecs) assert.deepEqual(parse(neutral, 'receipt'), neutral);
});

test('public terminal diagnostics and qualifications still refuse arbitrary text', () => {
  for (const extra of [
    { failure: { phase: 'browser', message: 'unowned diagnostic text' } },
    { qualification: 'unowned qualification' },
    { consumer: consumer('unowned scenario') },
  ]) {
    const input = { ...passed, outcome: 'failed', ...extra };
    for (const parse of codecs)
      assert.throws(() => parse(input, 'receipt'), { code: 'PUBLIC_CONTRACT_REFUSED' });
  }
});

test('JSON parser refuses repeated terminal status names before outcome validation', () => {
  assert.throws(
    () => parseIconsJson(Buffer.from('{"outcome":"failed","outcome":"passed"}')),
    /repeated JSON member name/,
  );
  const bytes = Buffer.from(JSON.stringify(passed));
  assert.deepEqual(assertPublicProvenance(parseIconsJson(bytes), 'receipt'), passed);
});
