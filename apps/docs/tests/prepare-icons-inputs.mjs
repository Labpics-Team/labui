import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createGitRunner } from './icons-git-diagnostics.mjs';
import {
  assertSelfHostedRunner,
  stateReferenceContract,
  validateSubject,
} from './icons-packed.mjs';
import {
  assertPublicProvenance,
  assertSourceIdentity,
  parseIconsJson,
  projectPublicProvenance,
  publicDiagnosticError,
} from './icons-public-provenance.mjs';

const PIN = new URL('./icons-consumer-source.json', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
const outside = (path) => path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
const git = createGitRunner(process.env.LABUI_ICONS_GIT_DIAGNOSTICS);

export function validateSourcePin(pin) {
  assertPublicProvenance(pin);
  assert.deepEqual(Object.keys(pin).sort(), [
    'figma',
    'repository',
    'schemaVersion',
    'sourceCommit',
  ]);
  assert.equal(pin.schemaVersion, 2);
  assert.equal(pin.repository, 'Labpics-Team/lab-icons');
  assert.match(pin.sourceCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(pin.figma).sort(), ['fileKeySha256', 'version']);
  assert.ok(/^[a-f0-9]{64}$/.test(pin.figma.fileKeySha256), 'pin: source identity digest');
  assert.match(pin.figma.version, /^\d+$/);
  return pin;
}

export function assertCheckout(root, expected) {
  assert.match(expected, /^[a-f0-9]{40}$/);
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), expected);
  assert.equal(git(root, ['status', '--porcelain', '--untracked-files=no']).toString(), '');
}

async function sourceFile(root, commit, file) {
  const bytes = await readFile(join(root, file));
  assert.ok(bytes.equals(git(root, ['show', `${commit}:${file}`])), `изменён источник: ${file}`);
  return { file, sha256: hash(bytes), bytes: bytes.length };
}

function attributes(source, allowed) {
  const result = {};
  const pattern = /\s+([A-Za-z][A-Za-z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;
  let consumed = 0;
  while (consumed < source.length) {
    if (source.slice(consumed).trim() === '') break;
    pattern.lastIndex = consumed;
    const match = pattern.exec(source);
    assert.ok(match, 'Oracle: неполный XML-атрибут');
    const [, name, double, single] = match;
    const value = double ?? single;
    assert.ok(allowed.includes(name) && !Object.hasOwn(result, name), `Oracle: атрибут ${name}`);
    assert.ok(!/[<&]/.test(value), 'Oracle: entities и вложенный XML не поддержаны');
    result[name] = value;
    consumed = pattern.lastIndex;
  }
  return result;
}

// Узкий независимый язык: нейтральные группы и явно замкнутые author paths.
// Неизвестный paint/transform/clip отвергается, а авторский d не переписывается.
export function readAuthorMaster(bytes) {
  const xml = bytes.toString('utf8');
  assert.deepEqual(Buffer.from(xml), bytes, 'Oracle: нужен UTF-8 master');
  const stack = [];
  const paths = [];
  let root;
  let consumed = 0;
  let closed = false;
  for (const match of xml.matchAll(/<([^>]*)>/g)) {
    assert.equal(xml.slice(consumed, match.index).trim(), '', 'Oracle: текст вне XML-тегов');
    consumed = match.index + match[0].length;
    const token = match[1];
    if (token.startsWith('/')) {
      assert.equal(stack.pop(), token.slice(1).trim(), 'Oracle: несбалансированные группы');
      if (stack.length === 0) closed = true;
      continue;
    }
    assert.ok(!closed, 'Oracle: несколько корней');
    const tag = /^([A-Za-z][A-Za-z0-9]*)\b([\s\S]*?)(\/?)$/.exec(token);
    assert.ok(tag, 'Oracle: неподдержанный XML');
    const [, name, rest, selfClosing] = tag;
    if (name === 'svg') {
      assert.ok(!root && stack.length === 0 && !selfClosing);
      root = attributes(rest, ['width', 'height', 'viewBox', 'fill', 'xmlns']);
      assert.equal(root.fill, 'none');
      assert.equal(root.xmlns, 'http://www.w3.org/2000/svg');
    } else if (name === 'g') {
      assert.ok(root && stack.length > 0 && !selfClosing);
      attributes(rest, ['id', 'data-node-id']);
    } else if (name === 'path') {
      assert.ok(root && stack.length > 0 && selfClosing);
      const path = attributes(rest, ['d', 'fill', 'fill-rule', 'clip-rule', 'id', 'data-node-id']);
      assert.equal(path.fill, '#101012');
      const fillRule = path['fill-rule'] ?? 'nonzero';
      assert.ok(['nonzero', 'evenodd'].includes(fillRule));
      assert.ok(!path['clip-rule'] || ['nonzero', 'evenodd'].includes(path['clip-rule']));
      assert.ok(
        /^M/.test(path.d) &&
          /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(path.d) &&
          path.d.split(/(?=[Mm])/).every((contour) => /[Zz]\s*$/.test(contour)),
        'Oracle: нужны явно замкнутые контуры',
      );
      const numbers = path.d.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g);
      assert.ok(
        numbers?.every((value) => Number.isFinite(Number(value))),
        'Oracle: нечисловая геометрия',
      );
      paths.push({ d: path.d, fillRule });
    } else assert.fail(`Oracle: элемент ${name} не поддержан`);
    if (!selfClosing) stack.push(name);
  }
  assert.equal(xml.slice(consumed).trim(), '');
  assert.ok(root && closed && stack.length === 0 && paths.length > 0);
  const viewBox = root.viewBox.trim().split(/\s+/).map(Number);
  assert.ok(
    viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0,
  );
  for (const key of ['width', 'height']) assert.match(root[key], /^\d+(?:\.\d+)?$/);
  const dimensions = [Number(root.width), Number(root.height)];
  assert.ok(dimensions.every((value) => Number.isFinite(value) && value > 0));
  return { viewBox, dimensions, paths };
}

export function readCycleMaster(bytes) {
  const { viewBox, paths } = readAuthorMaster(bytes);
  assert.ok(
    paths.length === 1 && (paths[0].d.match(/[Mm]/g) ?? []).length === 1,
    'Oracle: cycle требует один целый замкнутый контур',
  );
  return { viewBox, paths };
}

// Expected binding берётся из raw аннотации, поведение — из cycle.clockwise.
// Producer constructor, его helpers, glyph и effect не могут изменить oracle.
export async function authorReference(iconsRoot, pin) {
  const manifest = parseIconsJson(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  assertSourceIdentity(manifest.source, pin.figma);
  const annotations = parseIconsJson(
    await readFile(join(iconsRoot, 'semantics/author-anatomy.json')),
  );
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(annotations.schemaVersion, 1);
  assert.ok(
    Object.keys(annotations.source).sort().join(',') === 'fileKey,version',
    'anatomy: source fields',
  );
  assertSourceIdentity(annotations.source, pin.figma);
  const variants = {};
  for (const variant of ['outline', 'filled']) {
    const record = manifest.icons.reload[variant];
    const declaration = annotations.icons.reload[variant];
    const expectedPath = `masters/figma/${pin.figma.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/reload.svg`;
    assert.equal(record.master, expectedPath);
    const bytes = await readFile(join(iconsRoot, expectedPath));
    assert.equal(bytes.length, record.bytes);
    assert.equal(hash(bytes), record.sha256);
    const { viewBox, paths } = readCycleMaster(bytes);
    const fingerprint = hash(stableJSON(paths.map((path, index) => ({ index, ...path }))));
    assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
    assert.equal(declaration.masterSha256, record.sha256);
    assert.equal(declaration.pathFingerprintSha256, fingerprint);
    assert.deepEqual(declaration.gesture, {
      law: 'cycle.clockwise',
      partId: declaration.parts[0].id,
    });
    assert.equal(declaration.parts.length, 1);
    const part = declaration.parts[0];
    assert.equal(part.pathIndex, 0);
    assert.equal(part.role, 'control');
    assert.match(part.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(part.anchorMeaning, 'canvas-center');
    assert.deepEqual(part.anchor, [0.5, 0.5]);
    const gesture = {
      id: 'reload.cycle',
      kind: 'cycle',
      meaning:
        'Один оборот команды обновления по часовой стрелке; промежуточную позу можно развернуть или продолжить.',
      partIds: [part.id],
      progress: 'normalized-0-to-1',
      tracks: [
        {
          partId: part.id,
          kind: 'rotate',
          anchor: [...part.anchor],
          from: 0,
          to: 360,
          unit: 'degrees',
          interpolation: 'linear',
        },
      ],
    };
    const annotationSha256 = hash(
      stableJSON({
        schemaVersion: 1,
        source: annotations.source,
        icon: 'reload',
        variant,
        declaration,
        gestures: [gesture],
      }),
    );
    variants[variant] = {
      sourceFile: record.master,
      author: {
        kind: 'figma',
        fileKey: manifest.source.fileKey,
        version: pin.figma.version,
        nodeId: record.nodeId,
        nodeSha256: record.nodeSha256,
        masterSha256: hash(bytes),
        normalizedSha256: record.normalizedSource.sha256,
        pathFingerprintSha256: fingerprint,
      },
      anatomy: {
        version: 1,
        annotationSha256,
        masterSha256: hash(bytes),
        pathFingerprintSha256: fingerprint,
      },
      viewBox,
      paths,
      parts: [
        { id: part.id, role: part.role, zIndex: 0, d: paths[0].d, fillRule: paths[0].fillRule },
      ],
      gesture,
    };
  }
  return projectPublicProvenance({
    fileName: manifest.source.name,
    fileKey: manifest.source.fileKey,
    version: manifest.source.version,
    icons: { reload: variants },
  });
}

// Отдельный независимый reference: raw masters и публичная semantic декларация,
// без compiler/glyph/imports производителя. Interior сохраняет исходный порядок.
export async function stateReference(iconsRoot, pin, name = 'status-circle') {
  const contract = stateReferenceContract(name);
  const manifest = parseIconsJson(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const document = parseIconsJson(
    await readFile(join(iconsRoot, 'semantics/author-state-groups.json')),
  );
  const source = { fileKey: manifest.source.fileKey, version: pin.figma.version };
  assert.equal(manifest.schemaVersion, 1);
  assertSourceIdentity(manifest.source, pin.figma);
  assert.ok([1, 2].includes(document.schemaVersion), 'неподдержанная author-state schema');
  assert.ok(
    Object.keys(document.source).sort().join(',') === 'fileKey,version',
    'states: source fields',
  );
  assertSourceIdentity(document.source, pin.figma);
  const group = document.groups[name];
  assert.equal(group.law, 'enclosure.replace');
  assert.equal(group.defaultState, contract.defaultState);
  assert.equal(group.enclosurePartId, contract.enclosurePartId);
  if (name === 'expression-face') assert.equal(document.schemaVersion, 2);
  if (document.schemaVersion === 2) assert.deepEqual(group.sharedParts, contract.sharedParts);
  assert.deepEqual(Object.keys(group.states).sort(), contract.states);
  const states = [];
  const ids = new Set(contract.sharedParts.map((part) => part.id));
  let enclosure;
  let sharedParts;
  for (const id of Object.keys(group.states).sort()) {
    const member = group.states[id];
    assert.match(member.icon, /^[a-z][a-z0-9-]*$/);
    assert.equal(member.variant, 'outline');
    const record = manifest.icons[member.icon]?.outline;
    const sourceFile = `masters/figma/${source.version}/Outline/${member.icon}.svg`;
    assert.equal(record.master, sourceFile);
    const bytes = await readFile(join(iconsRoot, sourceFile));
    assert.equal(bytes.length, record.bytes);
    assert.equal(hash(bytes), record.sha256);
    assert.equal(member.masterSha256, record.sha256);
    const { viewBox, dimensions, paths } = readAuthorMaster(bytes);
    assert.deepEqual(viewBox, [0, 0, 24, 24]);
    assert.deepEqual(dimensions, [24, 24]);
    const fingerprint = hash(stableJSON(paths.map((path, index) => ({ index, ...path }))));
    assert.equal(fingerprint, member.pathFingerprintSha256);
    assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
    if (document.schemaVersion === 1) assert.equal(member.enclosurePathIndex, paths.length - 1);
    else assert.ok(!Object.hasOwn(member, 'enclosurePathIndex'), 'schema2 не содержит path index');
    assert.ok(paths.length >= 2);
    assert.equal(member.contentPartIds.length, paths.length - contract.sharedParts.length);
    assert.ok(member.contentPartIds.length > 0);
    const partId = `state-${id}`;
    for (const part of [partId, ...member.contentPartIds]) {
      assert.match(part, /^[a-z][a-z0-9-]*$/);
      assert.ok(!ids.has(part), 'повторённый semantic part ID');
      ids.add(part);
    }
    const shell = paths.at(-1);
    if (enclosure) assert.deepEqual(shell, enclosure, 'author enclosures не совпадают');
    else enclosure = shell;
    const shared = paths
      .slice(member.contentPartIds.length)
      .map((path, index) => ({ ...path, ...contract.sharedParts[index] }));
    if (sharedParts) assert.deepEqual(shared, sharedParts, 'author shared parts не совпадают');
    else sharedParts = shared;
    states.push({
      id,
      partId,
      icon: member.icon,
      contentPartIds: [...member.contentPartIds],
      sourceFile,
      viewBox,
      dimensions,
      paths,
      author: {
        kind: 'figma',
        ...source,
        nodeId: record.nodeId,
        nodeSha256: record.nodeSha256,
        masterSha256: hash(bytes),
        normalizedSha256: record.normalizedSource.sha256,
        pathFingerprintSha256: fingerprint,
      },
    });
  }
  return projectPublicProvenance({
    group: name,
    variant: 'outline',
    defaultState: group.defaultState,
    enclosurePartId: group.enclosurePartId,
    ...(document.schemaVersion === 2
      ? {
          sharedPartIds: sharedParts.map((part) => part.id),
          ...(name === 'expression-face' ? { sharedParts } : {}),
        }
      : {}),
    enclosure,
    states,
    proof: {
      law: group.law,
      source,
      enclosureSha256: hash(
        stableJSON({
          ...enclosure,
          paint: { kind: 'fill', fill: 'currentColor' },
          viewBox: [0, 0, 24, 24],
          dimensions: [24, 24],
          placement: 'after-content',
        }),
      ),
      specSha256: hash(stableJSON({ schemaVersion: document.schemaVersion, source, name, group })),
      ...(document.schemaVersion === 2
        ? {
            sharedPartsSha256: hash(
              stableJSON({
                parts: sharedParts.map((part) => ({
                  ...part,
                  paint: { kind: 'fill', fill: 'currentColor' },
                })),
                viewBox: [0, 0, 24, 24],
                dimensions: [24, 24],
                placement: 'after-content',
              }),
            ),
          }
        : {}),
    },
  });
}

export function validatePlatformMeasurement(report, sourceSha, artifactFiles, lockfileSha256) {
  assert.equal(report?.sourceSha, sourceSha, 'measurement относится к другому source SHA');
  assert.equal(report.lockfileSha256, lockfileSha256, 'measurement lockfile не совпал');
  assert.ok(Number.isFinite(Date.parse(report.capturedAt)));
  assert.ok(typeof report.environment?.node === 'string');
  assert.deepEqual(
    Object.keys(report.artifacts ?? {}).sort(),
    [...artifactFiles].sort(),
    'measurement не покрывает release contract',
  );
  assert.deepEqual(
    Object.keys(report.candidatePolicies?.package?.artifacts ?? {}).sort(),
    [...artifactFiles].sort(),
    'candidate policy не покрывает измеренные artifacts',
  );
  assert.equal(report.candidatePolicies.package.measurement, report.packageMeasurement);
  assert.equal(report.candidatePolicies.consumer.measurement, report.consumerMeasurement);
  assert.ok(typeof report.packageMeasurement === 'string' && report.packageMeasurement.length > 0);
  assert.ok(
    typeof report.consumerMeasurement === 'string' && report.consumerMeasurement.length > 0,
  );
  assert.ok(Object.keys(report.consumers ?? {}).length > 0);
  assert.deepEqual(
    Object.keys(report.consumers).sort(),
    Object.keys(report.candidatePolicies.consumer.scenarios ?? {}).sort(),
  );
  for (const measured of [...Object.values(report.artifacts), ...Object.values(report.consumers)]) {
    for (const field of ['bytes', 'gzipBytes', 'brotliBytes']) {
      assert.ok(
        Number.isSafeInteger(measured[field]) && measured[field] >= 0,
        `measurement потеряла ${field}`,
      );
    }
  }
  for (const measured of Object.values(report.artifacts))
    assert.match(measured.sha256, /^[a-f0-9]{64}$/);
  assert.ok(
    Array.isArray(report.policyViolations) &&
      report.policyViolations.every((item) => typeof item === 'string' && item.length > 0),
  );
  return report;
}

// Это диагностический запуск producer, не принятие candidatePolicies.
// Guard срабатывает до child process; --update не является допустимым параметром.
async function measurePlatformArtifacts(iconsRoot, sourceSha, out, files) {
  assertSelfHostedRunner();
  const materialFiles = [
    'scripts/measure-platform-artifacts.mjs',
    'scripts/check-package-size.js',
    'scripts/check-consumer-size.js',
    'release/contract.json',
    'release/package-size-ratchet.json',
    'release/consumer-size-ratchet.json',
    'pnpm-lock.yaml',
  ];
  const materials = [];
  for (const file of materialFiles) {
    const item = await sourceFile(iconsRoot, sourceSha, file);
    materials.push(item);
    files.push({ repository: 'Labpics-Team/lab-icons', ...item });
  }
  const artifactFiles = JSON.parse(await readFile(join(iconsRoot, 'release/contract.json'))).files;
  const program = materials[0];
  const file = 'platform-measurement.json';
  execFileSync(process.execPath, [join(iconsRoot, program.file), '--output', join(out, file)], {
    cwd: iconsRoot,
    timeout: 600_000,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  assertCheckout(iconsRoot, sourceSha);
  for (const material of materials)
    assert.deepEqual(await sourceFile(iconsRoot, sourceSha, material.file), material);
  const bytes = await readFile(join(out, file));
  const lockfileSha256 = materials.find((item) => item.file === 'pnpm-lock.yaml').sha256;
  const report = validatePlatformMeasurement(
    JSON.parse(bytes),
    sourceSha,
    artifactFiles,
    lockfileSha256,
  );
  return {
    file,
    sourceSha,
    sha256: hash(bytes),
    bytes: bytes.length,
    program,
    lockfileSha256,
    artifactFiles,
    artifactCount: artifactFiles.length,
    consumerCount: Object.keys(report.consumers).length,
    policyViolations: report.policyViolations.length,
  };
}

function evidenceLog(bytes, prefix, identity, digestField) {
  const compressed = gzipSync(bytes, { level: 9 });
  const chunks = compressed.toString('base64').match(/.{1,4096}/g);
  const digest = hash(bytes);
  const metadata = {
    schemaVersion: 1,
    encoding: 'gzip-base64',
    ...identity,
    [digestField]: digest,
    bytes: bytes.length,
    compressedBytes: compressed.length,
    chunks: chunks.length,
  };
  const lines = [
    `${prefix}_BEGIN ${JSON.stringify(metadata)}`,
    ...chunks.map((chunk, index) => `${prefix}_CHUNK ${index} ${chunk}`),
    `${prefix}_END ${digest}`,
  ].join('\n');
  return `${lines}\n`;
}

export function platformMeasurementLog(bytes, sourceSha) {
  return evidenceLog(bytes, 'LABUI_ICONS_PLATFORM_MEASUREMENT', { sourceSha }, 'reportSha256');
}

const VISUAL_FILES = new Set([
  'result/no-preference.png',
  'result/reduce.png',
  'result/no-preference-failure.png',
  'result/reduce-failure.png',
]);
const CONSUMER_MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;
const VISUAL_MAX_PIXELS = 16 * 1024 * 1024;

// Только PNG известного consumer; лимиты ограничивают log и последующий decode.
export function consumerVisualLog(bytes, file, sourceSha, uiCommit) {
  assert.ok(VISUAL_FILES.has(file), 'visual: неизвестный screenshot');
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.match(uiCommit, /^[a-f0-9]{40}$/);
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length >= 45 && bytes.length <= CONSUMER_MAX_EVIDENCE_BYTES,
    'visual: PNG bytes вне лимита',
  );
  assert.ok(
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    'visual: PNG signature',
  );
  assert.equal(bytes.readUInt32BE(8), 13, 'visual: IHDR length');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'visual: IHDR');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.ok(
    width > 0 && height > 0 && width * height <= VISUAL_MAX_PIXELS,
    'visual: PNG dimensions вне лимита',
  );
  assert.ok(
    bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])),
    'visual: IEND',
  );
  return evidenceLog(
    bytes,
    'LABUI_ICONS_CONSUMER_VISUAL',
    { file, sourceSha, uiCommit, width, height },
    'pngSha256',
  );
}

export function consumerReceiptLog(bytes, sourceSha, uiCommit) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.match(uiCommit, /^[a-f0-9]{40}$/);
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= CONSUMER_MAX_EVIDENCE_BYTES,
    'receipt: bytes вне лимита',
  );
  const receipt = assertPublicProvenance(parseIconsJson(bytes));
  assert.equal(receipt.schemaVersion, 1, 'receipt: schemaVersion');
  assert.equal(receipt.outcome, 'passed', 'receipt: raw packet требует passed outcome');
  assert.ok(Array.isArray(receipt.records), 'receipt: records отсутствуют');
  return evidenceLog(
    bytes,
    'LABUI_ICONS_CONSUMER_RECEIPT',
    { file: 'result/receipt.json', sourceSha, uiCommit },
    'receiptSha256',
  );
}

export async function prepareInputs(options) {
  const pin = validateSourcePin(parseIconsJson(await readFile(PIN)));
  const iconsRoot = await realpath(resolve(options.get('--icons-source')));
  const uiRoot = await realpath(resolve(options.get('--ui-source')));
  const uiCommit = options.get('--ui-commit');
  assertCheckout(iconsRoot, pin.sourceCommit);
  assertCheckout(uiRoot, uiCommit);
  const out = resolve(options.get('--out'));
  const parent = await realpath(dirname(out));
  for (const root of [iconsRoot, uiRoot]) {
    assert.ok(outside(relative(root, parent)), 'Inputs должны находиться вне source checkout');
  }
  const packages = {};
  const files = [];
  for (const [key, option, root, commit, file] of [
    ['icons', '--icons-tarball', iconsRoot, pin.sourceCommit, 'package.json'],
    ['uiCore', '--ui-core-tarball', uiRoot, uiCommit, 'packages/core/package.json'],
    ['uiShadow', '--ui-shadow-tarball', uiRoot, uiCommit, 'packages/shadow/package.json'],
  ]) {
    files.push({
      repository: key === 'icons' ? pin.repository : 'Labpics-Team/labui',
      ...(await sourceFile(root, commit, file)),
    });
    const pkg = JSON.parse(await readFile(join(root, file)));
    const archive = await readFile(resolve(options.get(option)));
    packages[key] = {
      name: pkg.name,
      version: pkg.version,
      archiveSha256: hash(archive),
      archiveBytes: archive.length,
      sourceCommit: commit,
    };
  }
  const reference = await authorReference(iconsRoot, pin);
  const states = await stateReference(iconsRoot, pin);
  const expression = await stateReference(iconsRoot, pin, 'expression-face');
  for (const file of [
    'semantics/figma-baseline.json',
    'semantics/author-anatomy.json',
    'semantics/author-state-groups.json',
    ...Object.values(reference.icons.reload).map((item) => item.sourceFile),
    ...states.states.map((item) => item.sourceFile),
    ...expression.states.map((item) => item.sourceFile),
  ]) {
    files.push({
      repository: pin.repository,
      ...(await sourceFile(iconsRoot, pin.sourceCommit, file)),
    });
  }
  const subject = validateSubject({
    schemaVersion: 3,
    packages,
    authorReference: reference,
    stateReferences: { 'status-circle': states, 'expression-face': expression },
  });
  assertCheckout(iconsRoot, pin.sourceCommit);
  assertCheckout(uiRoot, uiCommit);
  await mkdir(out, { recursive: false, mode: 0o700 });
  const bytes = `${JSON.stringify(subject, null, 2)}\n`;
  await writeFile(join(out, 'subject.json'), bytes, { flag: 'wx', mode: 0o600 });
  // Raw references и их source receipts уже зафиксированы до чтения dist artifacts.
  const measurement = await measurePlatformArtifacts(iconsRoot, pin.sourceCommit, out, files);
  assertCheckout(uiRoot, uiCommit);
  await writeFile(
    join(out, 'source-receipt.json'),
    `${JSON.stringify({ schemaVersion: 1, pin, uiCommit, subjectSha256: hash(bytes), files, measurement }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  process.stdout.write(
    `icons-inputs: ${JSON.stringify({ subjectSha256: hash(bytes), packages })}\n`,
  );
}

function writeStdout(bytes) {
  const output = process.stdout;
  return new Promise((resolve, reject) => {
    output.once('error', reject);
    try {
      output.write(bytes, (error) => {
        if (error) {
          // Writable вызывает callback до события error; once-обработчик остаётся
          // до него, чтобы ошибка потока не затёрла исходную причину.
          reject(error);
          return;
        }
        output.removeListener('error', reject);
        resolve();
      });
    } catch (error) {
      output.removeListener('error', reject);
      reject(error);
    }
  });
}

// Контракт Lab UI сохраняет диагностику локально; Actions storage не участвует.
export async function summarize(directory) {
  const root = await realpath(resolve(directory));
  const files = [];
  const visuals = [];
  for (const name of ['inputs', 'result']) {
    for (const entry of await readdir(join(root, name), { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:json|png)$/.test(entry.name)) continue;
      const path = `${name}/${entry.name}`;
      const bytes = await readFile(join(root, path));
      files.push({ path, sha256: hash(bytes), bytes: bytes.length });
      if (name === 'result' && entry.name.endsWith('.png')) visuals.push({ path, bytes });
    }
  }
  const receiptBytes = await readFile(join(root, 'result/receipt.json'));
  const receipt = assertPublicProvenance(parseIconsJson(receiptBytes));
  const source = assertPublicProvenance(
    parseIconsJson(await readFile(join(root, 'inputs/source-receipt.json'))),
  );
  validateSourcePin(source.pin);
  const subjectBytes = await readFile(join(root, 'inputs/subject.json'));
  const subject = validateSubject(parseIconsJson(subjectBytes));
  assert.equal(hash(subjectBytes), source.subjectSha256);
  assert.equal(subject.packages.icons.sourceCommit, source.pin.sourceCommit);
  if (subject.schemaVersion >= 2) {
    const measurement = source.measurement;
    assert.equal(measurement?.file, 'platform-measurement.json', 'measurement отсутствует');
    assert.equal(measurement.sourceSha, source.pin.sourceCommit);
    const bytes = await readFile(join(root, 'inputs/platform-measurement.json'));
    assert.equal(hash(bytes), measurement.sha256, 'measurement bytes изменились');
    assert.equal(bytes.length, measurement.bytes);
    const program = source.files.find(
      (item) => item.file === 'scripts/measure-platform-artifacts.mjs',
    );
    assert.deepEqual(measurement.program, {
      file: program.file,
      sha256: program.sha256,
      bytes: program.bytes,
    });
    const lockfile = source.files.find((item) => item.file === 'pnpm-lock.yaml');
    assert.equal(lockfile.sha256, measurement.lockfileSha256);
    validatePlatformMeasurement(
      JSON.parse(bytes),
      source.pin.sourceCommit,
      measurement.artifactFiles,
      measurement.lockfileSha256,
    );
    await writeStdout(platformMeasurementLog(bytes, source.pin.sourceCommit));
  }
  const packets = [];
  let readbackFailure;
  const addPacket = (file, encode) => {
    try {
      packets.push(encode());
    } catch (error) {
      readbackFailure ??= { file, error };
    }
  };
  for (const visual of visuals)
    addPacket(visual.path, () =>
      consumerVisualLog(visual.bytes, visual.path, source.pin.sourceCommit, source.uiCommit),
    );
  if (receipt.outcome === 'passed')
    addPacket('result/receipt.json', () =>
      consumerReceiptLog(receiptBytes, source.pin.sourceCommit, source.uiCommit),
    );
  for (const packet of packets) await writeStdout(packet);
  await writeStdout(
    `LABUI_ICONS_CONSUMER_RESULT ${JSON.stringify({
      schemaVersion: 1,
      outcome: receipt.outcome,
      source,
      harness: receipt.harness,
      runner: receipt.runner,
      archives: receipt.archives,
      observations: receipt.records?.length,
      failure: receipt.failure
        ? { phase: receipt.failure.phase, stateContinuity: receipt.failure.stateContinuity }
        : null,
      files,
      diagnosticDirectory: root,
      ...(readbackFailure
        ? { readbackFailure: { code: 'EVIDENCE_REFUSED', file: readbackFailure.file } }
        : {}),
    })}\n`,
  );
  if (readbackFailure) throw readbackFailure.error;
  assert.equal(receipt.outcome, 'passed');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--checkout-ref') {
    process.stdout.write(
      `${validateSourcePin(parseIconsJson(await readFile(PIN))).sourceCommit}\n`,
    );
    return;
  }
  if (args.length === 2 && args[0] === '--summarize') return summarize(args[1]);
  const required = [
    '--icons-source',
    '--ui-source',
    '--ui-commit',
    '--icons-tarball',
    '--ui-core-tarball',
    '--ui-shadow-tarball',
    '--out',
  ];
  const options = new Map();
  assert.equal(args.length, required.length * 2);
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(required.includes(args[index]) && args[index + 1] && !options.has(args[index]));
    options.set(args[index], args[index + 1]);
  }
  return prepareInputs(options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main().catch((error) => {
    throw publicDiagnosticError(error);
  });
