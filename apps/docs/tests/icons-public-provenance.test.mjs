import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { finalizeReceipt } from './icons-packed.mjs';
import {
  assertPublicCheck,
  assertPublicProvenance,
  parseIconsJson,
  projectPublicProvenance,
  publicApiRefusal,
  publicDiagnosticError,
  publicFailure,
} from './icons-public-provenance.mjs';
import {
  authorReference,
  consumerReceiptLog,
  parseSummaryInvocation,
  terminalReceipt,
} from './prepare-icons-inputs.mjs';

const PRIVATE_KEY = 'SyntheticFigmaAuthorKey01';
const COMMUNITY =
  'https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const PRIVATE_URL = `https://www.figma.com/design/${PRIVATE_KEY}/fixture`;
const SOURCE_SHA = 'a'.repeat(40);
const UI_SHA = 'b'.repeat(40);

test('public summary rejects successful qualification after evidence refusal', async () => {
  const pin = parseIconsJson(
    await readFile(new URL('./icons-consumer-source.json', import.meta.url)),
  );
  const passed = {
    schemaVersion: 1,
    outcome: 'passed',
    source: {
      schemaVersion: 1,
      pin,
      uiCommit: UI_SHA,
      subjectSha256: hash('subject'),
      files: [],
    },
    observations: 0,
    failure: null,
    files: [],
    diagnosticDirectorySha256: hash('diagnostic-directory'),
  };
  for (const file of ['result/reduce.png', 'result/receipt.json']) {
    const refused = {
      ...passed,
      readbackFailure: { code: 'EVIDENCE_REFUSED', file },
    };
    const failed = { ...refused, outcome: 'failed' };
    for (const validate of [assertPublicProvenance, projectPublicProvenance]) {
      assert.deepEqual(validate(passed, 'summary'), passed);
      assert.deepEqual(validate(failed, 'summary'), failed);
      assert.throws(() => validate(refused, 'summary'), { code: 'PUBLIC_CONTRACT_REFUSED' });
    }
  }
});

test('receipt finalization preserves the original error when public projection refuses', async () => {
  const failure = publicDiagnosticError(Object.assign(new Error(PRIVATE_URL), { code: 'ENOENT' }));
  const rejected = {
    schemaVersion: 1,
    outcome: 'failed',
    records: [{ name: 'author-observation', unowned: PRIVATE_KEY }],
    failure: { phase: 'browser', ...publicFailure(failure) },
  };
  const written = new Map();
  await assert.rejects(
    finalizeReceipt(rejected, {
      out: 'memory',
      phase: 'browser',
      failure,
      write: async (path, bytes) => written.set(basename(path), bytes),
    }),
    (error) => error === failure,
  );
  assert.deepEqual([...written.keys()], ['receipt.json', 'failure.json']);
  const receipt = assertPublicProvenance(
    parseIconsJson(Buffer.from(written.get('receipt.json'))),
    'receipt',
  );
  assert.deepEqual(receipt, {
    schemaVersion: 1,
    outcome: 'failed',
    records: [],
    failure: {
      phase: 'browser',
      code: 'PUBLIC_CONTRACT_REFUSED',
      message: 'icons: PUBLIC_CONTRACT_REFUSED',
    },
  });
  assert.ok(!written.get('receipt.json').includes(PRIVATE_KEY));
  assert.equal(written.get('failure.json'), written.get('receipt.json'));
});

test('receipt finalization preserves lawful Community and geometry bytes', async () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [
      {
        name: 'author-observation',
        link: COMMUNITY,
        opacity: 0.375,
        paths: [{ d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' }],
        masterSha256: 'c'.repeat(64),
      },
    ],
  };
  const written = new Map();
  await finalizeReceipt(receipt, {
    out: 'memory',
    phase: 'browser',
    write: async (path, bytes) => written.set(basename(path), bytes),
  });
  assert.deepEqual([...written.keys()], ['receipt.json']);
  assert.equal(written.get('receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
});

test('receipt finalization preserves lawful failed evidence bytes and the captured error', async () => {
  const failure = publicDiagnosticError(new Error(PRIVATE_URL));
  const receipt = {
    schemaVersion: 1,
    outcome: 'failed',
    records: [
      { name: 'author-observation', link: COMMUNITY, opacity: 0.375, masterSha256: 'c'.repeat(64) },
    ],
    failure: { phase: 'browser', ...publicFailure(failure) },
  };
  const written = new Map();
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      failure,
      write: async (path, bytes) => written.set(basename(path), bytes),
    }),
    (error) => error === failure,
  );
  const expected = `${JSON.stringify(receipt, null, 2)}\n`;
  assert.deepEqual(
    [...written.entries()],
    [
      ['receipt.json', expected],
      ['failure.json', expected],
    ],
  );
});

test('receipt finalization refuses unsafe evidence without an earlier error', async () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ name: 'author-observation', link: PRIVATE_URL }],
  };
  const written = new Map();
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      write: async (path, bytes) => written.set(basename(path), bytes),
    }),
    (error) => {
      assert.equal(error.code, 'PUBLIC_CONTRACT_REFUSED');
      assert.equal(error.message, 'icons: PUBLIC_CONTRACT_REFUSED');
      assert.ok(!String(error.stack).includes(PRIVATE_KEY));
      return true;
    },
  );
  assert.equal(receipt.outcome, 'passed', 'verified source stays unchanged');
  assert.equal(JSON.parse(written.get('receipt.json')).outcome, 'failed');
  assert.equal(written.get('failure.json'), written.get('receipt.json'));
  assert.ok(!written.get('receipt.json').includes(PRIVATE_KEY));
});

test('receipt finalization preserves the captured error across artifact write refusals', async (t) => {
  for (const refused of ['receipt.json', 'failure.json', 'both']) {
    await t.test(refused, async () => {
      const failure = publicDiagnosticError(
        Object.assign(new Error(PRIVATE_URL), { code: 'ENOENT' }),
      );
      const receipt = {
        schemaVersion: 1,
        outcome: 'failed',
        records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
        failure: { phase: 'browser', ...publicFailure(failure) },
      };
      const attempts = [];
      const written = new Map();
      await assert.rejects(
        finalizeReceipt(receipt, {
          out: 'memory',
          phase: 'browser',
          failure,
          write: async (path, bytes) => {
            const name = basename(path);
            attempts.push([name, bytes]);
            if (refused === 'both' || name === refused)
              throw Object.assign(new Error(PRIVATE_URL), { code: 'EACCES' });
            written.set(name, bytes);
          },
        }),
        (error) => error === failure,
      );
      if (refused === 'failure.json') {
        assert.deepEqual(
          attempts.map(([name]) => name),
          ['receipt.json', 'failure.json'],
        );
        assert.equal(written.get('receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
      } else {
        assert.deepEqual(
          attempts.map(([name]) => name),
          ['receipt.json', 'receipt.json', 'failure.json'],
        );
        const recovered = JSON.parse(attempts[1][1]);
        assert.deepEqual(recovered.records, []);
        assert.equal(recovered.failure.code, 'EACCES');
        assert.ok(attempts[1][1].length < attempts[0][1].length);
        assert.equal(attempts[2][1], attempts[1][1]);
        assert.equal(written.has('failure.json'), refused === 'receipt.json');
      }
    });
  }
});

test('receipt finalization reports a failed full write even when the minimal receipt succeeds', async () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
  };
  const attempts = [];
  const written = new Map();
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      write: async (path, bytes) => {
        const name = basename(path);
        attempts.push(name);
        if (attempts.length === 1) throw Object.assign(new Error(PRIVATE_URL), { code: 'EACCES' });
        written.set(name, bytes);
      },
    }),
    (error) => {
      assert.equal(error.code, 'EACCES');
      assert.equal(error.message, 'icons: EACCES');
      assert.ok(!String(error.stack).includes(PRIVATE_KEY));
      return true;
    },
  );
  assert.deepEqual(attempts, ['receipt.json', 'receipt.json', 'failure.json']);
  const recovered = assertPublicProvenance(
    parseIconsJson(Buffer.from(written.get('receipt.json'))),
    'receipt',
  );
  assert.equal(recovered.outcome, 'failed');
  assert.equal(recovered.failure.code, 'EACCES');
  assert.deepEqual(recovered.records, []);
  assert.equal(written.get('failure.json'), written.get('receipt.json'));
});

test('receipt finalization reports failure artifact refusal without an earlier error', async () => {
  const receipt = { schemaVersion: 1, outcome: 'failed', records: [] };
  const written = new Map();
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      write: async (path, bytes) => {
        if (basename(path) === 'failure.json')
          throw Object.assign(new Error(PRIVATE_URL), { code: 'EPERM' });
        written.set(basename(path), bytes);
      },
    }),
    (error) => {
      assert.equal(error.code, 'EPERM');
      assert.equal(error.message, 'icons: EPERM');
      return true;
    },
  );
  assert.equal(written.get('receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
});

test('receipt finalization attempts each minimal artifact once when projection and writes refuse', async () => {
  const failure = publicDiagnosticError(Object.assign(new Error(PRIVATE_URL), { code: 'ENOENT' }));
  const receipt = {
    schemaVersion: 1,
    outcome: 'failed',
    records: [{ name: 'author-observation', unowned: PRIVATE_KEY }],
  };
  const attempts = [];
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      failure,
      write: async (path, bytes) => {
        attempts.push([basename(path), bytes]);
        throw Object.assign(new Error(PRIVATE_URL), { code: 'EACCES' });
      },
    }),
    (error) => error === failure,
  );
  assert.deepEqual(
    attempts.map(([name]) => name),
    ['receipt.json', 'failure.json'],
  );
  assert.equal(JSON.parse(attempts[0][1]).failure.code, 'PUBLIC_CONTRACT_REFUSED');
  assert.equal(attempts[1][1], attempts[0][1]);
});

test('terminal publication rejects stale PASSED evidence after an effect-then-error write', async () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
  };
  const written = new Map();
  const attempts = [];
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      write: async (path, bytes) => {
        const name = basename(path);
        attempts.push(name);
        if (name === 'receipt.json') {
          if (attempts.length === 1) written.set(name, bytes);
          throw Object.assign(new Error(PRIVATE_URL), { code: 'EACCES' });
        }
        written.set(name, bytes);
      },
    }),
    (error) => error.code === 'EACCES',
  );
  assert.deepEqual(attempts, ['receipt.json', 'receipt.json', 'failure.json']);
  const receiptBytes = Buffer.from(written.get('receipt.json'));
  const failureBytes = Buffer.from(written.get('failure.json'));
  assert.equal(parseIconsJson(receiptBytes).outcome, 'passed');
  assert.equal(parseIconsJson(failureBytes).outcome, 'failed');
  assert.equal(terminalReceipt(receiptBytes, failureBytes, 1).outcome, 'failed');
});

test('terminal publication preserves lawful PASSED receipt without a failure marker', () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [
      {
        name: 'author-observation',
        link: COMMUNITY,
        opacity: 0.375,
        paths: [{ d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' }],
        masterSha256: 'c'.repeat(64),
      },
    ],
  };
  const receiptBytes = Buffer.from(JSON.stringify(receipt));
  assert.deepEqual(terminalReceipt(receiptBytes, undefined, 0), receipt);
  assert.match(
    consumerReceiptLog(receiptBytes, SOURCE_SHA, UI_SHA),
    /^LABUI_ICONS_CONSUMER_RECEIPT_BEGIN /m,
  );
});

test('terminal publication retains primary error identity after effect-then-error writes', async () => {
  const failure = publicDiagnosticError(Object.assign(new Error(PRIVATE_URL), { code: 'ENOENT' }));
  const receipt = {
    schemaVersion: 1,
    outcome: 'failed',
    records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
    failure: { phase: 'browser', ...publicFailure(failure) },
  };
  const written = new Map();
  let receiptAttempts = 0;
  await assert.rejects(
    finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      failure,
      write: async (path, bytes) => {
        const name = basename(path);
        if (name === 'receipt.json') {
          if (++receiptAttempts === 1) written.set(name, bytes);
          throw Object.assign(new Error(PRIVATE_URL), { code: 'EACCES' });
        }
        written.set(name, bytes);
      },
    }),
    (error) => error === failure,
  );
  const selected = terminalReceipt(
    Buffer.from(written.get('receipt.json')),
    Buffer.from(written.get('failure.json')),
    1,
  );
  assert.equal(selected.outcome, 'failed');
  assert.ok(!JSON.stringify(selected).includes(PRIVATE_KEY));
});

test('terminal publication accepts a valid FAILED marker when the receipt is absent or unusable', () => {
  const failed = {
    schemaVersion: 1,
    outcome: 'failed',
    records: [],
    failure: { phase: 'browser', code: 'EACCES', message: 'icons: EACCES' },
  };
  const failureBytes = Buffer.from(JSON.stringify(failed));
  for (const receiptBytes of [
    undefined,
    Buffer.from('{'),
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        outcome: 'passed',
        records: [{ name: 'author-observation', link: PRIVATE_URL }],
      }),
    ),
    Buffer.from(JSON.stringify(failed)),
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        outcome: 'passed',
        records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
      }),
    ),
  ]) {
    assert.deepEqual(terminalReceipt(receiptBytes, failureBytes, 0), failed);
    assert.equal(failureBytes.toString(), JSON.stringify(failed));
  }
});

test('terminal publication refuses invalid failure markers beside a lawful PASSED receipt', () => {
  const receiptBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'passed',
      records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
    }),
  );
  for (const failureBytes of [
    receiptBytes,
    Buffer.from('{'),
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        outcome: 'failed',
        records: [{ name: 'author-observation', link: PRIVATE_URL }],
      }),
    ),
    Buffer.from(
      JSON.stringify({ schemaVersion: 1, outcome: 'failed', records: [], unowned: PRIVATE_KEY }),
    ),
    Buffer.from('{"schemaVersion":1,"outcome":"failed","records":[],"outcome":"passed"}'),
  ]) {
    assert.throws(
      () => terminalReceipt(receiptBytes, failureBytes, 0),
      (error) => {
        assert.ok(!String(error.stack).includes(PRIVATE_KEY));
        return true;
      },
    );
  }
});

test('terminal publication refuses absent or malformed receipt without a failure marker', () => {
  assert.throws(() => terminalReceipt(undefined, undefined, 0), { code: 'ENOENT' });
  assert.throws(() => terminalReceipt(Buffer.from('{'), undefined, 0), /icons: invalid JSON/);
});

test('terminal publication honors known consumer failure when every failure artifact write rejects', async () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
  };
  const written = new Map();
  const attempts = [];
  let consumerExitCode = 0;
  try {
    await finalizeReceipt(receipt, {
      out: 'memory',
      phase: 'browser',
      write: async (path, bytes) => {
        const name = basename(path);
        attempts.push(name);
        if (attempts.length === 1) written.set(name, bytes);
        throw Object.assign(new Error(PRIVATE_URL), { code: 'EACCES' });
      },
    });
  } catch (error) {
    assert.equal(error.code, 'EACCES');
    consumerExitCode = 1;
  }
  assert.equal(consumerExitCode, 1);
  assert.deepEqual(attempts, ['receipt.json', 'receipt.json', 'failure.json']);
  assert.equal(written.has('failure.json'), false);
  const receiptBytes = Buffer.from(written.get('receipt.json'));
  assert.equal(parseIconsJson(receiptBytes).outcome, 'passed');
  const terminal = terminalReceipt(receiptBytes, undefined, consumerExitCode);
  assert.equal(terminal.outcome, 'failed');
  assert.deepEqual(terminal.records, receipt.records);
});

test('terminal publication preserves healthy bytes with a known successful consumer outcome', async () => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [
      {
        name: 'author-observation',
        link: COMMUNITY,
        opacity: 0.375,
        paths: [{ d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' }],
        masterSha256: 'c'.repeat(64),
      },
    ],
  };
  const written = new Map();
  await finalizeReceipt(receipt, {
    out: 'memory',
    phase: 'browser',
    write: async (path, bytes) => written.set(basename(path), bytes),
  });
  const receiptBytes = Buffer.from(written.get('receipt.json'));
  assert.deepEqual(terminalReceipt(receiptBytes, undefined, 0), receipt);
  assert.equal(receiptBytes.toString(), `${JSON.stringify(receipt, null, 2)}\n`);
  assert.match(
    consumerReceiptLog(receiptBytes, SOURCE_SHA, UI_SHA),
    /^LABUI_ICONS_CONSUMER_RECEIPT_BEGIN /m,
  );
});

test('terminal publication requires known consumer completion instead of inferring success from receipt bytes', () => {
  const receiptBytes = Buffer.from(
    JSON.stringify({ schemaVersion: 1, outcome: 'passed', records: [] }),
  );
  for (const consumerExitCode of [
    undefined,
    null,
    false,
    '0',
    '1',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    0.5,
    256,
  ]) {
    assert.throws(
      () => terminalReceipt(receiptBytes, undefined, consumerExitCode),
      /icons: consumer completion/,
    );
  }
});

test('terminal publication preserves FAILED readback without a usable receipt after known consumer failure', () => {
  for (const consumerExitCode of [1, 130, 255]) {
    for (const receiptBytes of [
      undefined,
      Buffer.from('{'),
      Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          outcome: 'passed',
          records: [{ name: 'author-observation', link: PRIVATE_URL }],
        }),
      ),
    ]) {
      const receipt = terminalReceipt(receiptBytes, undefined, consumerExitCode);
      assert.deepEqual(receipt, { schemaVersion: 1, outcome: 'failed', records: [] });
      assert.equal(assertPublicProvenance(receipt, 'receipt'), receipt);
      assert.ok(!JSON.stringify(receipt).includes(PRIVATE_KEY));
    }
  }
});

test('summary invocation parser requires a complete observed consumer exit code', () => {
  for (const consumerExitCode of [0, 1, 130, 255]) {
    assert.deepEqual(
      parseSummaryInvocation([
        '--summarize',
        'output',
        '--consumer-exit-code',
        String(consumerExitCode),
      ]),
      {
        directory: 'output',
        consumerExitCode,
      },
    );
  }
  for (const args of [
    ['--summarize', 'output'],
    ['--summarize', '', '--consumer-exit-code', '0'],
    ['--summarize', 'output', '--consumer-exit-code', ''],
    ['--summarize', 'output', '--consumer-exit-code', '01'],
    ['--summarize', 'output', '--consumer-exit-code', '0x0'],
    ['--summarize', 'output', '--consumer-exit-code', '256'],
    ['--summarize', 'output', '--consumer-exit-code', '-1'],
    ['--summarize', 'output', '--consumer-exit-code', '0.5'],
    ['--summarize', 'output', '--consumer-exit-code', PRIVATE_KEY],
    ['--summarize', 'output', '--consumer-exit-code', '0', '--extra'],
    ['--summarize', 'output', '--other', '0'],
  ]) {
    assert.throws(
      () => parseSummaryInvocation(args),
      (error) => {
        assert.ok(!String(error.stack).includes(PRIVATE_KEY));
        return true;
      },
    );
  }
});

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
          name: 'author-observation',
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
      figma: { fileKeyLength: PRIVATE_KEY.length, fileKeySha256: hash(PRIVATE_KEY), version: '1' },
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

test('public observation projection preserves binding and owned metadata without changing geometry', () => {
  const raw = {
    name: 'author-observation',
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
  };
  const projected = projectPublicProvenance(raw, 'author-observation');
  assert.ok(!JSON.stringify(projected).includes(PRIVATE_KEY));
  assert.equal(projected.author.fileKeySha256, hash(PRIVATE_KEY));
  assert.equal(projected.author.nodeIdSha256, hash('10:20'));
  assert.equal(projected.proof.source.fileKeySha256, hash(PRIVATE_KEY));
  assert.deepEqual(projected.paths, raw.paths);
  assert.equal(projected.author.masterSha256, raw.author.masterSha256);
  assert.equal(projected.proof.specSha256, raw.proof.specSha256);
  assert.equal(projected.link, COMMUNITY);
  assert.notEqual(projected.paths, raw.paths);
  assert.equal(
    raw.author.fileKey,
    PRIVATE_KEY,
    'projection must not mutate the verified raw source',
  );
  const special = parseIconsJson(
    '{"__proto__":{"notes":"public"},"name":"author-observation","author":{"kind":"figma","fileKey":"SyntheticFigmaAuthorKey01","version":"1","nodeId":"10:20"}}',
  );
  assert.throws(() => projectPublicProvenance(special, 'author-observation'));
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
    assert.throws(() =>
      projectPublicProvenance({ name: 'author-observation', notes }, 'author-observation'),
    );
  const rawAuthor = { kind: 'figma', fileKey: PRIVATE_KEY, nodeId: '10:20', version: '1' };
  assert.doesNotThrow(() => projectPublicProvenance(rawAuthor, 'author'));
  assert.throws(() =>
    projectPublicProvenance({ ...rawAuthor, fileKeySha256: hash(PRIVATE_KEY) }, 'author'),
  );
  assert.throws(() => projectPublicProvenance({ ...rawAuthor, fileKey: 'invalid key' }, 'author'));
  assert.throws(() => projectPublicProvenance({ ...rawAuthor, nodeId: 'invalid-node' }, 'author'));
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

test('public refusal reasons survive wrapping without reflecting changed messages or private assertion values', () => {
  assert.doesNotThrow(() => assertPublicCheck(true, 'MEASUREMENT_SOURCE_MISMATCH'));
  let error;
  try {
    assertPublicCheck(false, 'MEASUREMENT_SOURCE_MISMATCH');
  } catch (caught) {
    error = caught;
  }
  assert.equal(error.code, 'MEASUREMENT_SOURCE_MISMATCH');
  error.message = PRIVATE_URL;
  error.stack = PRIVATE_KEY;
  error.actual = PRIVATE_KEY;
  error.expected = { fileKey: PRIVATE_KEY };
  const wrapped = publicDiagnosticError(publicDiagnosticError(error));
  const result = publicFailure(wrapped);
  assert.equal(result.code, 'MEASUREMENT_SOURCE_MISMATCH');
  assert.equal(result.message, 'measurement относится к другому source SHA');
  assert.ok(!JSON.stringify(result).includes(PRIVATE_KEY));
  assert.ok(!String(wrapped.stack).includes(PRIVATE_KEY));
  assert.ok(!Object.hasOwn(wrapped, 'actual') && !Object.hasOwn(wrapped, 'expected'));
  assert.throws(() => assertPublicCheck(false, PRIVATE_KEY), /invalid public check/);
  assert.doesNotMatch(
    publicFailure(new Error('unrelated failure')).message,
    /measurement относится к другому source SHA/,
  );
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
          '--consumer-exit-code',
          '0',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
      ),
  };
}

test('public stdout summary and its gzip receipt retain exact Community observations and hashes', async (t) => {
  const receipt = {
    schemaVersion: 1,
    outcome: 'passed',
    records: [
      { name: 'author-observation', link: COMMUNITY, masterSha256: 'c'.repeat(64), opacity: 0.375 },
    ],
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

async function publicationFixture(t, mutatePin = () => {}) {
  const { root } = await sourceFixture(t);
  const publication = join(root, 'publication');
  const modules = join(publication, 'apps/docs/tests');
  await mkdir(modules, { recursive: true });
  // Preserve the public entry's relative imports into the shared log codec.
  const logModule = join(publication, 'scripts/ci/evidence-log.mjs');
  await mkdir(dirname(logModule), { recursive: true });
  await writeFile(
    logModule,
    await readFile(new URL('../../../scripts/ci/evidence-log.mjs', import.meta.url)),
  );
  // Exact source copies exercise the real public entry with its own synthetic pin.
  // No runner identity or environment is supplied, and no install/build/GUI entry runs.
  for (const name of [
    'prepare-icons-inputs.mjs',
    'icons-packed.mjs',
    'icons-public-provenance.mjs',
    'icons-git-diagnostics.mjs',
  ]) {
    await writeFile(join(modules, name), await readFile(new URL(name, import.meta.url)));
  }
  const pin = parseIconsJson(
    await readFile(new URL('./icons-consumer-source.json', import.meta.url)),
  );
  pin.figma.fileKeySha256 = hash(PRIVATE_KEY);
  pin.figma.fileKeyLength = PRIVATE_KEY.length;
  mutatePin(pin);
  await writeFile(join(modules, 'icons-consumer-source.json'), JSON.stringify(pin));
  return {
    modules,
    inputs: await import(pathToFileURL(join(modules, 'prepare-icons-inputs.mjs'))),
    privacy: await import(pathToFileURL(join(modules, 'icons-public-provenance.mjs'))),
  };
}

test('missing privacy context refuses bare and nested copies at the real publication entry', async (t) => {
  const { inputs, privacy } = await publicationFixture(t);
  for (const notes of [
    PRIVATE_KEY,
    `note:${PRIVATE_KEY}:end`,
    `prefix${PRIVATE_KEY}suffix`,
    { nested: [PRIVATE_KEY] },
    { [`prefix${PRIVATE_KEY}suffix`]: 'copied key' },
  ]) {
    const receipt = {
      schemaVersion: 1,
      outcome: 'passed',
      records: [{ name: 'author-observation', notes }],
    };
    const bytes = Buffer.from(JSON.stringify(receipt));
    assert.throws(() => inputs.consumerReceiptLog(bytes, SOURCE_SHA, UI_SHA));
    assert.throws(() => privacy.assertPublicProvenance(receipt, 'receipt'));
    assert.throws(() => privacy.assertPublicProvenance(receipt, new Set()));
  }
  const lawful = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'passed',
      records: [{ name: 'author-observation', link: COMMUNITY, opacity: 0.375 }],
    }),
  );
  assert.match(inputs.consumerReceiptLog(lawful, SOURCE_SHA, UI_SHA), /_BEGIN /);
});

test('publication cannot initialize from missing or invalid owned identity policy', async (t) => {
  for (const mutatePin of [
    (pin) => {
      Reflect.deleteProperty(pin.figma, 'fileKeyLength');
    },
    (pin) => {
      Reflect.deleteProperty(pin.figma, 'fileKeySha256');
    },
    (pin) => {
      pin.figma.fileKeyLength = 0;
    },
    (pin) => {
      pin.figma.fileKeySha256 = PRIVATE_KEY;
    },
  ])
    await assert.rejects(
      publicationFixture(t, mutatePin),
      /publication policy unavailable or invalid/,
    );
});

test('private Figma document URLs refuse independently of their document route', () => {
  for (const path of ['slides', 'design', 'file', 'proto', 'board', 'unknown-document-kind']) {
    const bytes = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        outcome: 'passed',
        records: [
          {
            name: 'author-observation',
            link: `https://www.figma.com/${path}/${PRIVATE_KEY}/fixture`,
          },
        ],
      }),
    );
    assert.throws(() => consumerReceiptLog(bytes, SOURCE_SHA, UI_SHA));
  }
  for (const link of [
    `figma://slides/${PRIVATE_KEY}/fixture`,
    `https://api.figma.com/v1/files/${PRIVATE_KEY}`,
    'https://www.figma.com:444/community/file/1527814209910933331',
  ])
    assert.throws(() =>
      consumerReceiptLog(
        Buffer.from(
          JSON.stringify({
            schemaVersion: 1,
            outcome: 'passed',
            records: [{ name: 'author-observation', link }],
          }),
        ),
        SOURCE_SHA,
        UI_SHA,
      ),
    );
});

test('failure diagnostics refuse private witness copies without an optional privacy context', async (t) => {
  const { privacy } = await publicationFixture(t);
  const error = new Error('consumer check failed');
  error.stateContinuity = {
    notes: PRIVATE_KEY,
    differences: [{ partId: 'state-question', before: 0.3, after: 0.5, delta: 0.2 }],
  };
  const refused = privacy.publicFailure(error);
  assert.equal(refused.stateContinuityRefused, true);
  assert.ok(!JSON.stringify(refused).includes(PRIVATE_KEY));
  assert.ok(!String(privacy.publicDiagnosticError(error).stack).includes(PRIVATE_KEY));
  error.stateContinuity = {
    differences: [{ partId: 'state-question', before: 0.3, after: 0.5, delta: 0.2 }],
    witness: { at: 20 },
  };
  assert.deepEqual(privacy.publicFailure(error).stateContinuity, error.stateContinuity);
});

function percentLayers(text, count) {
  let encoded = [...text].map((character) => `%${character.charCodeAt(0).toString(16)}`).join('');
  for (let layer = 1; layer < count; layer++) encoded = encodeURIComponent(encoded);
  return encoded;
}

test('valid escape segments cannot hide private identity beside a literal percent sign', async (t) => {
  const { inputs, privacy } = await publicationFixture(t);
  for (const notes of [
    `50% complete; ${percentLayers(PRIVATE_KEY, 1)}`,
    percentLayers(PRIVATE_KEY, 3),
    [...PRIVATE_KEY]
      .map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .join(''),
  ]) {
    assert.throws(() =>
      inputs.consumerReceiptLog(
        Buffer.from(
          JSON.stringify({
            schemaVersion: 1,
            outcome: 'passed',
            records: [{ name: 'author-observation', notes }],
          }),
        ),
        SOURCE_SHA,
        UI_SHA,
      ),
    );
    assert.throws(() =>
      privacy.projectPublicProvenance({ name: 'author-observation', notes }, 'author-observation'),
    );
    const error = new Error('consumer check failed');
    error.stateContinuity = { notes };
    assert.equal(privacy.publicFailure(error).stateContinuityRefused, true);
  }
  const lawful = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      outcome: 'passed',
      records: [
        {
          name: 'author-observation',
          opacity: 0.5,
          link: COMMUNITY,
          paths: [{ d: 'M0 0L1 0L1 1Z', fillRule: 'nonzero' }],
          masterSha256: 'c'.repeat(64),
        },
      ],
    }),
  );
  const packet = inputs.consumerReceiptLog(lawful, SOURCE_SHA, UI_SHA);
  const chunks = packet
    .split('\n')
    .filter((line) => line.startsWith('LABUI_ICONS_CONSUMER_RECEIPT_CHUNK '));
  assert.ok(
    gunzipSync(Buffer.from(chunks.map((line) => line.split(' ')[2]).join(''), 'base64')).equals(
      lawful,
    ),
  );
});

test('ambiguous or excessive provenance encoding refuses instead of leaving an unchecked tail', async (t) => {
  const { inputs } = await publicationFixture(t);
  for (const [notes, reason] of [
    [percentLayers(PRIVATE_KEY, 12), /public contract refused/],
    ['literal byte %F0', /public contract refused/],
  ]) {
    assert.throws(
      () =>
        inputs.consumerReceiptLog(
          Buffer.from(
            JSON.stringify({
              schemaVersion: 1,
              outcome: 'passed',
              records: [{ name: 'author-observation', notes }],
            }),
          ),
          SOURCE_SHA,
          UI_SHA,
        ),
      reason,
    );
  }
});

test('raw summary inputs cannot publish private copies in source, receipt or failed witness', async (t) => {
  const publication = await publicationFixture(t);
  for (const target of ['source', 'receipt', 'failure']) {
    const fixture = await summaryFixture(t, { schemaVersion: 1, outcome: 'passed', records: [] });
    if (target === 'source') {
      fixture.source.notes = { nested: `prefix${PRIVATE_KEY}suffix` };
      await writeFile(
        join(fixture.output, 'inputs/source-receipt.json'),
        JSON.stringify(fixture.source),
      );
    } else {
      const receipt =
        target === 'receipt'
          ? { schemaVersion: 1, outcome: 'passed', records: [{ notes: { nested: PRIVATE_KEY } }] }
          : {
              schemaVersion: 1,
              outcome: 'failed',
              records: [],
              failure: { phase: 'browser', stateContinuity: { notes: PRIVATE_KEY } },
            };
      await writeFile(join(fixture.output, 'result/receipt.json'), JSON.stringify(receipt));
    }
    const result = spawnSync(
      process.execPath,
      [
        join(publication.modules, 'prepare-icons-inputs.mjs'),
        '--summarize',
        fixture.output,
        '--consumer-exit-code',
        '0',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes(PRIVATE_KEY));
  }
});

test('typed publication refuses unowned encoded fields across receipt and continuity sinks', async (t) => {
  const { inputs, privacy } = await publicationFixture(t);
  const representations = {
    base64: Buffer.from(PRIVATE_KEY).toString('base64'),
    entities: [...PRIVATE_KEY].map((character) => `&#${character.charCodeAt(0)};`).join(''),
    nested: { nested: { copied: Buffer.from(PRIVATE_KEY).toString('base64') } },
    key: { [Buffer.from(PRIVATE_KEY).toString('base64')]: 0.375 },
  };
  for (const [name, notes] of Object.entries(representations)) {
    await t.test(`${name}: receipt`, () => {
      const bytes = Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          outcome: 'passed',
          records: [{ name: 'author-observation', notes }],
        }),
      );
      assert.throws(() => inputs.consumerReceiptLog(bytes, SOURCE_SHA, UI_SHA));
    });
    await t.test(`${name}: observation`, () => {
      assert.throws(() =>
        privacy.projectPublicProvenance(
          { name: 'author-observation', notes },
          'author-observation',
        ),
      );
    });
    await t.test(`${name}: continuity`, () => {
      const error = new Error('consumer check failed');
      error.stateContinuity = {
        differences: [{ partId: 'state-question', before: 0.3, after: 0.5, delta: 0.2 }],
        witness: { notes },
      };
      assert.equal(privacy.publicFailure(error).stateContinuityRefused, true);
    });
  }
});

test('URL publication classifies the WHATWG-normalized Figma host before its document route', async (t) => {
  const { privacy } = await publicationFixture(t);
  assert.deepEqual(privacy.projectPublicProvenance({ link: COMMUNITY }, 'community-reference'), {
    link: COMMUNITY,
  });
  for (const [name, host] of [
    ['ASCII tab', 'fi\tgma.com'],
    ['DNS root dot', 'figma.com.'],
  ]) {
    await t.test(name, () => {
      assert.deepEqual(
        privacy.projectPublicProvenance(
          {
            link: `https://${host}/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1`,
          },
          'community-reference',
        ),
        { link: COMMUNITY },
      );
      assert.throws(() =>
        privacy.projectPublicProvenance(
          { link: `https://${host}/design/UnlistedDocumentReference02/fixture` },
          'community-reference',
        ),
      );
    });
  }
});

test('API refusal publication derives a fixed message from the validated code and refuses extra members', () => {
  const messages = {
    GESTURE_UNSUPPORTED: 'Жест не поддерживается.',
    VARIANT_UNSUPPORTED: 'Вариант не поддерживается.',
    INVALID_REQUEST: 'Запрос не соответствует контракту.',
    STATE_UNSUPPORTED: 'Состояние не поддерживается.',
    FORMAT_UNSUPPORTED: 'Формат не поддерживается.',
  };
  for (const [code, message] of Object.entries(messages)) {
    const raw = {
      ok: false,
      reason: { code, message: Buffer.from(PRIVATE_URL).toString('base64') },
    };
    const published = publicApiRefusal(raw);
    assert.deepEqual(published, { ok: false, reason: { code, message } });
    assert.equal(assertPublicProvenance(published, 'api-refusal'), published);
    assert.ok(!JSON.stringify(published).includes(raw.reason.message));
    assert.throws(() => publicApiRefusal({ ...raw, notes: { copied: PRIVATE_KEY } }));
    assert.throws(() =>
      publicApiRefusal({ ...raw, reason: { ...raw.reason, notes: PRIVATE_KEY } }),
    );
    const changed = {
      ok: false,
      reason: { code, message: Object.values(messages).find((item) => item !== message) },
    };
    assert.throws(() => assertPublicProvenance(changed, 'api-refusal'));
  }
  assert.throws(() =>
    publicApiRefusal({ ok: false, reason: { code: PRIVATE_KEY, message: PRIVATE_URL } }),
  );
});

test('projection refuses hidden fields and accessors before invoking untrusted object properties', () => {
  const lawful = { name: 'author-observation', link: COMMUNITY, opacity: 0.375 };
  assert.deepEqual(projectPublicProvenance(lawful, 'record'), lawful);
  for (const make of [
    () => Object.defineProperty({ ...lawful }, 'notes', { value: PRIVATE_KEY }),
    () => ({ ...lawful, [Symbol('notes')]: PRIVATE_KEY }),
    () => Object.assign(Object.create({ notes: PRIVATE_KEY }), lawful),
  ])
    assert.throws(() => projectPublicProvenance(make(), 'record'));
  let reads = 0;
  const untrusted = Object.defineProperty({ ...lawful }, 'link', {
    enumerable: true,
    get() {
      reads++;
      return COMMUNITY;
    },
  });
  assert.throws(() => projectPublicProvenance(untrusted, 'record'));
  assert.equal(reads, 0);
  assert.throws(() => projectPublicProvenance(lawful));
  assert.throws(() => projectPublicProvenance(lawful, 'unowned-report'));
});
