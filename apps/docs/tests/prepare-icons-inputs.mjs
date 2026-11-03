import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evidenceLog, writeStdout } from '../../../scripts/ci/evidence-log.mjs';
import {
  PUBLIC_ICONS_DESIGN_REFERENCE,
  assertPublicEvidence,
  assertSourceIdentity,
  collectPrivateLocations,
  projectPublicEvidence,
  publicBrowserFrontier,
  publicError,
} from '../../../scripts/ci/icons-public-provenance.mjs';
import { assertPublicScreenshot } from '../../../scripts/ci/icons-screenshot-profile.mjs';
import { annulusReference } from './icons-annulus-consumer.mjs';
import {
  AUTHORED_DOT_ICONS,
  validateAuthoredDotsReference,
} from './icons-authored-dots-consumer.mjs';
import { createGitRunner } from './icons-git-diagnostics.mjs';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import {
  MICROPHONE_COMPARISON_VISUAL_FILES,
  MICROPHONE_VISUAL_FILES,
  assertMicrophoneComparisonEvidence,
  assertMicrophoneVisualEvidence,
  microphoneReference,
} from './icons-microphone-consumer.mjs';
import {
  MOTION_PROJECTION_VISUAL_FILES,
  assertTimerRefusalEvidence,
  motionProjectionReference,
} from './icons-motion-projection-consumer.mjs';
import {
  NOTIFICATION_ICONS,
  rawNotificationClapperWidth,
  validateNotificationReference,
} from './icons-notification-consumer.mjs';
import {
  assertSelfHostedRunner,
  stateReferenceContract,
  validateSubject,
} from './icons-packed.mjs';
import {
  ARCHIVE_OPTIONS,
  assertArchiveOptions,
  loadRuntimePackagePlan,
  runtimeDependencyContracts,
  subjectPackagePlan,
} from './icons-runtime-packages.mjs';
import { sourceStateGroups } from './icons-source-state-consumer.mjs';
import {
  WIDTH_MOTION_VISUAL_FILES,
  assertWidthMotionVisualEvidence,
  widthMotionReference,
} from './icons-width-motion-consumer.mjs';

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
  assert.deepEqual(Object.keys(pin).sort(), [
    'repository',
    'schemaVersion',
    'sourceCommit',
    'sourceIdentitySha256',
  ]);
  assert.equal(pin.schemaVersion, 2);
  assert.equal(pin.repository, 'Labpics-Team/lab-icons');
  assert.match(pin.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(pin.sourceIdentitySha256, /^[a-f0-9]{64}$/);
  return pin;
}

// Публичный pin связывает точный источник по commitment; его locator остаётся в runner.
export async function resolveSourcePin(iconsRoot, pin) {
  validateSourcePin(pin);
  const file = 'semantics/figma-baseline.json';
  await sourceFile(iconsRoot, pin.sourceCommit, file);
  const manifest = JSON.parse(await readFile(join(iconsRoot, file)));
  assertSourceIdentity(manifest.source, pin.sourceIdentitySha256);
  return {
    ...pin,
    figma: { fileKey: manifest.source.fileKey, version: manifest.source.version },
  };
}

export function assertCheckout(root, expected) {
  assert.match(expected, /^[a-f0-9]{40}$/);
  assert.equal(git(root, ['rev-parse', 'HEAD']).toString().trim(), expected);
  assert.equal(git(root, ['status', '--porcelain', '--untracked-files=no']).toString(), '');
}

async function sourceFile(root, commit, file) {
  const bytes = await readFile(join(root, file));
  assert.deepEqual(bytes, git(root, ['show', `${commit}:${file}`]), `изменён источник: ${file}`);
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
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const annotations = JSON.parse(await readFile(join(iconsRoot, 'semantics/author-anatomy.json')));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(annotations.schemaVersion, 1);
  assert.deepEqual(annotations.source, { fileKey: pin.figma.fileKey, version: pin.figma.version });
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
        fileKey: pin.figma.fileKey,
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
  return {
    fileName: manifest.source.name,
    fileKey: manifest.source.fileKey,
    version: manifest.source.version,
    icons: { reload: variants },
  };
}

export async function notificationReference(iconsRoot, pin) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const annotations = JSON.parse(await readFile(join(iconsRoot, 'semantics/author-anatomy.json')));
  assert.deepEqual(annotations.source, { fileKey: pin.figma.fileKey, version: pin.figma.version });
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const icons = {};
  for (const icon of [...NOTIFICATION_ICONS, 'notifications-off']) {
    icons[icon] = {};
    for (const variant of ['outline', 'filled']) {
      const record = manifest.icons[icon][variant];
      const bytes = await readFile(join(iconsRoot, record.master));
      assert.equal(bytes.length, record.bytes);
      assert.equal(hash(bytes), record.sha256);
      const { viewBox, paths } = readAuthorMaster(bytes);
      const fingerprint = hash(stableJSON(paths.map((path, index) => ({ index, ...path }))));
      assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
      const author = {
        kind: 'figma',
        fileKey: pin.figma.fileKey,
        version: pin.figma.version,
        nodeId: record.nodeId,
        nodeSha256: record.nodeSha256,
        masterSha256: hash(bytes),
        normalizedSha256: record.normalizedSource.sha256,
        pathFingerprintSha256: fingerprint,
      };
      const item = { sourceFile: record.master, author, viewBox, paths };
      const declaration = annotations.icons[icon]?.[variant];
      if (icon === 'notifications-off') assert.equal(declaration, undefined);
      else {
        assert.ok(declaration);
        item.declaration = declaration;
        item.parts = declaration.parts.map(({ pathIndex, id, role }, index) => {
          assert.equal(pathIndex, index);
          return { id, role, zIndex: index, ...paths[index] };
        });
        const clapper = item.parts.find((part) => part.id === 'notification-clapper');
        assert.ok(clapper);
        item.amplitude = rawNotificationClapperWidth(clapper.d) / 4;
        item.unchangedPartIds = item.parts
          .filter((part) => part !== clapper)
          .map((part) => part.id);
      }
      icons[icon][variant] = item;
    }
  }
  return validateNotificationReference(
    { fileKey: pin.figma.fileKey, version: pin.figma.version, icons },
    pin.figma,
  );
}

// Никакие generated payloads не формируют этот oracle: только закреплённые raw masters.
export async function authoredDotsReference(iconsRoot, pin) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const annotations = JSON.parse(await readFile(join(iconsRoot, 'semantics/author-anatomy.json')));
  const semanticBytes = await readFile(join(iconsRoot, 'semantics/author-state-groups.json'));
  const semantic = JSON.parse(semanticBytes);
  const gridBytes = await readFile(join(iconsRoot, 'semantics/grid.json'));
  assert.deepEqual(annotations.source, pin.figma);
  assert.deepEqual(semantic.source, pin.figma);
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const icons = {};
  for (const icon of AUTHORED_DOT_ICONS) {
    icons[icon] = {};
    for (const variant of ['outline', 'filled']) {
      const record = manifest.icons[icon][variant];
      const bytes = await readFile(join(iconsRoot, record.master));
      assert.equal(bytes.length, record.bytes);
      assert.equal(hash(bytes), record.sha256);
      const { viewBox, dimensions, paths } = readAuthorMaster(bytes);
      const fingerprint = hash(stableJSON(paths.map((path, index) => ({ index, ...path }))));
      assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
      const declaration = annotations.icons[icon][variant];
      icons[icon][variant] = {
        sourceFile: record.master,
        viewBox,
        dimensions,
        paths,
        declaration,
        parts: declaration.parts.map(({ pathIndex, id, role }, index) => {
          assert.equal(pathIndex, index);
          return { id, role, zIndex: index, ...paths[index] };
        }),
        author: {
          kind: 'figma',
          ...pin.figma,
          nodeId: record.nodeId,
          nodeSha256: record.nodeSha256,
          masterSha256: hash(bytes),
          normalizedSha256: record.normalizedSource.sha256,
          pathFingerprintSha256: fingerprint,
        },
      };
    }
  }
  const groups = Object.fromEntries(
    ['outline', 'filled'].map((variant) => {
      const name = `ellipsis-orientation-${variant}`;
      return [name, semantic.groups[name]];
    }),
  );
  return validateAuthoredDotsReference(
    {
      ...pin.figma,
      semanticSha256: hash(semanticBytes),
      gridSha256: hash(gridBytes),
      icons,
      groups,
    },
    pin.figma,
  );
}

// Отдельный независимый reference: raw masters и публичная semantic декларация,
// без compiler/glyph/imports производителя. Interior сохраняет исходный порядок.
export async function stateReference(iconsRoot, pin, name = 'status-circle') {
  const contract = stateReferenceContract(name);
  const sourceReplacement = contract.law === 'source.replace';
  const variant = contract.variant ?? 'outline';
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const document = JSON.parse(
    await readFile(join(iconsRoot, 'semantics/author-state-groups.json')),
  );
  const source = { fileKey: pin.figma.fileKey, version: pin.figma.version };
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source.fileKey, source.fileKey);
  assert.equal(manifest.source.version, source.version);
  assert.ok([1, 2].includes(document.schemaVersion), 'неподдержанная author-state schema');
  assert.deepEqual(document.source, source);
  const group = document.groups[name];
  assert.equal(group.law, sourceReplacement ? 'source.replace' : 'enclosure.replace');
  assert.equal(group.defaultState, contract.defaultState);
  assert.equal(group.enclosurePartId ?? null, contract.enclosurePartId);
  if (name === 'expression-face') assert.equal(document.schemaVersion, 2);
  if (document.schemaVersion === 2) assert.deepEqual(group.sharedParts, contract.sharedParts);
  assert.deepEqual(Object.keys(group.states).sort(), contract.states);
  const states = [];
  const ids = new Set(contract.sharedParts.map((part) => part.id));
  let enclosure = sourceReplacement ? null : undefined;
  let sharedParts = sourceReplacement ? [] : undefined;
  for (const id of Object.keys(group.states).sort()) {
    const member = group.states[id];
    assert.match(member.icon, /^[a-z][a-z0-9-]*$/);
    assert.equal(member.variant, variant);
    if (sourceReplacement) assert.equal(member.icon, contract.icons[id]);
    const record = manifest.icons[member.icon]?.[variant];
    const sourceFile = `masters/figma/${source.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${member.icon}.svg`;
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
    assert.ok(paths.length >= (sourceReplacement ? 1 : 2));
    assert.equal(member.contentPartIds.length, paths.length - contract.sharedParts.length);
    assert.ok(member.contentPartIds.length > 0);
    const partId = `state-${id}`;
    for (const part of [partId, ...member.contentPartIds]) {
      assert.match(part, /^[a-z][a-z0-9-]*$/);
      assert.ok(!ids.has(part), 'повторённый semantic part ID');
      ids.add(part);
    }
    if (!sourceReplacement) {
      const shell = paths.at(-1);
      if (enclosure) assert.deepEqual(shell, enclosure, 'author enclosures не совпадают');
      else enclosure = shell;
    }
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
  return {
    group: name,
    variant,
    defaultState: group.defaultState,
    enclosurePartId: sourceReplacement ? null : group.enclosurePartId,
    ...(document.schemaVersion === 2
      ? {
          sharedPartIds: sharedParts.map((part) => part.id),
          ...(name === 'expression-face' || sourceReplacement ? { sharedParts } : {}),
        }
      : {}),
    enclosure,
    states,
    proof: {
      law: group.law,
      source,
      enclosureSha256: sourceReplacement
        ? null
        : hash(
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
  };
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

// Потолки остаются у producer; consumer проверяет его точную проекцию отказа.
export function platformPolicyFailure(report) {
  const violations = new Set(report.policyViolations);
  for (const [kind, measured, policies] of [
    ['artifact', report.artifacts, report.candidatePolicies.package.artifacts],
    ['consumer', report.consumers, report.candidatePolicies.consumer.scenarios],
  ]) {
    for (const [name, item] of Object.entries(measured)) {
      for (const [field, ceiling] of [
        ['bytes', 'maxBytes'],
        ['gzipBytes', 'maxGzipBytes'],
      ]) {
        const limit = policies[name]?.[ceiling];
        if (!Number.isSafeInteger(limit) || limit < 0)
          violations.add(`${kind} ${name}: отсутствует допустимый owner-projected ${ceiling}`);
        else if (item[field] > limit)
          violations.add(`${kind} ${name}: ${field} ${item[field]} > ${ceiling} ${limit}`);
      }
    }
  }
  return violations.size
    ? { code: 'PLATFORM_POLICY_REFUSED', violations: [...violations] }
    : undefined;
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

export function projectJsonBytes(
  bytes,
  privateLocations = collectPrivateLocations(JSON.parse(bytes)),
) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0, 'public: нужны точные JSON bytes');
  const projection = {
    ...projectPublicEvidence(JSON.parse(bytes), { privateLocations }),
    originalBytesSha256: hash(bytes),
    originalBytes: bytes.length,
  };
  assertPublicEvidence(projection, { privateLocations });
  return Buffer.from(`${JSON.stringify(projection, null, 2)}\n`);
}

export function platformMeasurementLog(bytes, sourceSha, privateLocations) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  return evidenceLog(
    projectJsonBytes(bytes, privateLocations),
    'LABUI_ICONS_PLATFORM_MEASUREMENT',
    {
      sourceSha,
      projectionVersion: 1,
      originalBytesSha256: hash(bytes),
      originalBytes: bytes.length,
    },
    'reportSha256',
  );
}

const VISUAL_FILES = new Set([
  'result/no-preference.png',
  'result/reduce.png',
  'result/no-preference-failure.png',
  'result/reduce-failure.png',
  ...MICROPHONE_VISUAL_FILES,
  ...MICROPHONE_COMPARISON_VISUAL_FILES,
  ...MOTION_PROJECTION_VISUAL_FILES,
  ...WIDTH_MOTION_VISUAL_FILES,
]);
const CONSUMER_MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

// Только PNG известного consumer; лимиты ограничивают log и последующий decode.
export function consumerVisualLog(bytes, file, sourceSha, uiCommit, privateLocations = []) {
  assert.ok(VISUAL_FILES.has(file), 'visual: неизвестный screenshot');
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.match(uiCommit, /^[a-f0-9]{40}$/);
  const { width, height } = assertPublicScreenshot(bytes);
  assertPublicEvidence(bytes, { privateLocations });
  return evidenceLog(
    bytes,
    'LABUI_ICONS_CONSUMER_VISUAL',
    { file, sourceSha, uiCommit, width, height },
    'pngSha256',
  );
}

export function consumerReceiptLog(bytes, sourceSha, uiCommit, privateLocations) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.match(uiCommit, /^[a-f0-9]{40}$/);
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= CONSUMER_MAX_EVIDENCE_BYTES,
    'receipt: bytes вне лимита',
  );
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.schemaVersion, 1, 'receipt: schemaVersion');
  assert.equal(receipt.outcome, 'passed', 'receipt: raw packet требует passed outcome');
  assert.ok(Array.isArray(receipt.records), 'receipt: records отсутствуют');
  return evidenceLog(
    projectJsonBytes(bytes, privateLocations),
    'LABUI_ICONS_CONSUMER_RECEIPT',
    {
      file: 'result/receipt.json',
      sourceSha,
      uiCommit,
      projectionVersion: 1,
      originalBytesSha256: hash(bytes),
      originalBytes: bytes.length,
    },
    'receiptSha256',
  );
}

export function consumerResultLog(bytes, privateLocations) {
  assert.ok(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= CONSUMER_MAX_EVIDENCE_BYTES,
    'result: bytes вне лимита',
  );
  const projected = projectJsonBytes(bytes, privateLocations);
  assert.ok(projected.length <= CONSUMER_MAX_EVIDENCE_BYTES, 'result: projection вне лимита');
  return evidenceLog(
    projected,
    'LABUI_ICONS_CONSUMER_RESULT',
    {
      projectionVersion: 1,
      originalBytesSha256: hash(bytes),
      originalBytes: bytes.length,
    },
    'resultSha256',
  );
}

export async function prepareInputs(options) {
  const sourcePin = validateSourcePin(JSON.parse(await readFile(PIN)));
  const iconsRoot = await realpath(resolve(options.get('--icons-source')));
  const uiRoot = await realpath(resolve(options.get('--ui-source')));
  const uiCommit = options.get('--ui-commit');
  assertCheckout(iconsRoot, sourcePin.sourceCommit);
  const pin = await resolveSourcePin(iconsRoot, sourcePin);
  assertCheckout(uiRoot, uiCommit);
  const out = resolve(options.get('--out'));
  const parent = await realpath(dirname(out));
  for (const root of [iconsRoot, uiRoot]) {
    assert.ok(outside(relative(root, parent)), 'Inputs должны находиться вне source checkout');
  }
  const packages = {};
  const files = [];
  const { manifests, plan } = await loadRuntimePackagePlan(iconsRoot, uiRoot);
  assertArchiveOptions(options, plan);
  const contracts = runtimeDependencyContracts(
    Object.fromEntries(plan.map(({ key }) => [key, manifests[key]])),
  );
  for (const { key, option, source, directory } of plan) {
    const root = source === 'icons' ? iconsRoot : uiRoot;
    const commit = source === 'icons' ? pin.sourceCommit : uiCommit;
    const file = directory === '.' ? 'package.json' : `${directory}/package.json`;
    files.push({
      repository: key === 'icons' ? pin.repository : 'Labpics-Team/labui',
      ...(await sourceFile(root, commit, file)),
    });
    const pkg = manifests[key];
    const archive = await readFile(resolve(options.get(option)));
    packages[key] = {
      name: pkg.name,
      version: pkg.version,
      archiveSha256: hash(archive),
      archiveBytes: archive.length,
      sourceCommit: commit,
      runtimeDependencies: contracts[key],
    };
  }
  const reference = await authorReference(iconsRoot, pin);
  const states = await stateReference(iconsRoot, pin);
  const expression = await stateReference(iconsRoot, pin, 'expression-face');
  const notifications = await notificationReference(iconsRoot, pin);
  const dots = await authoredDotsReference(iconsRoot, pin);
  const annulus = await annulusReference(iconsRoot, pin, readAuthorMaster);
  const microphones = await microphoneReference(iconsRoot, pin, readAuthorMaster);
  const motionProjection = await motionProjectionReference(iconsRoot, pin, readAuthorMaster);
  const sourceStates = Object.fromEntries(
    await Promise.all(
      Object.keys(sourceStateGroups(14)).map(async (group) => [
        group,
        await stateReference(iconsRoot, pin, group),
      ]),
    ),
  );
  const playback = await stateReference(iconsRoot, pin, 'playback-circle');
  for (const file of [
    'semantics/figma-baseline.json',
    'semantics/author-anatomy.json',
    'semantics/author-state-groups.json',
    'semantics/grid.json',
    ...Object.values(reference.icons.reload).map((item) => item.sourceFile),
    ...states.states.map((item) => item.sourceFile),
    ...expression.states.map((item) => item.sourceFile),
    ...Object.values(notifications.icons).flatMap((variants) =>
      Object.values(variants).map((item) => item.sourceFile),
    ),
    ...Object.values(dots.icons).flatMap((variants) =>
      Object.values(variants).map((item) => item.sourceFile),
    ),
    ...Object.values(annulus.icons).flatMap((variants) =>
      Object.values(variants).map((item) => item.sourceFile),
    ),
    ...Object.values(microphones.icons).flatMap((variants) =>
      Object.values(variants).map((item) => item.sourceFile),
    ),
    ...Object.values(motionProjection.icons).flatMap((variants) =>
      Object.values(variants).map((item) => item.sourceFile),
    ),
    ...Object.values(sourceStates).flatMap((group) => group.states.map((item) => item.sourceFile)),
  ]) {
    files.push({
      repository: pin.repository,
      ...(await sourceFile(iconsRoot, pin.sourceCommit, file)),
    });
  }
  for (const file of ICONS_HARNESS_FILES)
    files.push({ repository: 'Labpics-Team/labui', ...(await sourceFile(uiRoot, uiCommit, file)) });
  const subject = validateSubject({
    schemaVersion: 14,
    packages,
    authorReference: reference,
    stateReferences: { 'status-circle': states, 'expression-face': expression },
    notificationReference: notifications,
    authoredDotsReference: dots,
    annulusReference: annulus,
    microphoneReference: microphones,
    motionProjectionReference: motionProjection,
    widthMotionReference: widthMotionReference(microphones),
    sourceStateReferences: sourceStates,
    stateAnnulusReference: {
      fileKey: pin.figma.fileKey,
      version: pin.figma.version,
      groups: { 'status-circle': states, 'playback-circle': playback },
    },
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
    `${JSON.stringify({ schemaVersion: 1, pin: sourcePin, uiCommit, subjectSha256: hash(bytes), files, measurement }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  );
  process.stdout.write(
    `icons-inputs: ${JSON.stringify({ subjectSha256: hash(bytes), packages })}\n`,
  );
}

// Preparation и browser receipt должны описывать один исполненный consumer.
function assertConsumerSourceIdentity(source, receipt, subject, subjectBytes) {
  assert.match(source.uiCommit, /^[a-f0-9]{40}$/, 'source: отсутствует Lab UI commit');
  assert.equal(receipt.harness?.commit, source.uiCommit, 'consumer: изменён Lab UI HEAD');
  assert.equal(receipt.subjectSha256, hash(subjectBytes), 'consumer: изменён subject SHA');
  assert.deepEqual(receipt.subject, subject, 'consumer: изменён исполненный subject');
  for (const { key } of subjectPackagePlan(subject.schemaVersion, subject.packages).filter(
    (item) => item.source === 'ui',
  ))
    assert.equal(
      subject.packages[key].sourceCommit,
      source.uiCommit,
      `consumer: ${key} относится к другому Lab UI commit`,
    );
  assert.ok(Array.isArray(source.files), 'source: отсутствует список исходников');
  const expected = source.files.filter(
    (item) => item.repository === 'Labpics-Team/labui' && ICONS_HARNESS_FILES.includes(item.file),
  );
  assert.deepEqual(
    expected.map((item) => item.file),
    ICONS_HARNESS_FILES,
    'source: неполный или изменённый набор исходников harness',
  );
  for (const item of expected)
    assert.match(item.sha256, /^[a-f0-9]{64}$/, `source: неверный SHA ${item.file}`);
  assert.deepEqual(
    receipt.harness.files,
    expected.map(({ file, sha256 }) => ({ file, sha256 })),
    'consumer: исходники harness отличаются от preparation',
  );
  assert.equal(
    receipt.harness.sourceSha256,
    expected.find((item) => item.file === 'apps/docs/tests/icons-packed.mjs').sha256,
    'consumer: изменён entrypoint SHA',
  );
}

// Контракт Lab UI сохраняет диагностику локально; Actions storage не участвует.
const PUBLIC_JSON_FILES = new Set([
  'subject.json',
  'source-receipt.json',
  'receipt.json',
  'failure.json',
  'platform-measurement.json',
  'consumer-result.json',
]);

const isPublicFile = (name) => PUBLIC_JSON_FILES.has(name) || VISUAL_FILES.has(`result/${name}`);

// После остановки producer проверяется весь закрытый набор; наличие marker недостаточно.
export async function verifyPublicExport(directory) {
  try {
    const requested = resolve(directory);
    const rootStat = await lstat(requested);
    assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink());
    const root = await realpath(requested);
    const marker = join(root, 'manifest.json');
    const markerStat = await lstat(marker);
    assert.ok(markerStat.isFile() && !markerStat.isSymbolicLink());
    const manifest = JSON.parse(await readFile(marker));
    assert.deepEqual(Object.keys(manifest).sort(), [
      'files',
      'projectionVersion',
      'publicDesignReference',
    ]);
    assert.equal(manifest.projectionVersion, 1);
    assert.equal(manifest.publicDesignReference, PUBLIC_ICONS_DESIGN_REFERENCE);
    assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
    const names = new Set();
    for (const item of manifest.files) {
      assert.deepEqual(Object.keys(item).sort(), ['bytes', 'file', 'sha256']);
      assert.ok(typeof item.file === 'string' && isPublicFile(item.file) && !names.has(item.file));
      assert.match(item.sha256, /^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(item.bytes) && item.bytes > 0);
      names.add(item.file);
    }
    const entries = await readdir(root, { withFileTypes: true });
    assert.ok(entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()));
    assert.deepEqual(entries.map((entry) => entry.name).sort(), ['manifest.json', ...names].sort());
    for (const item of manifest.files) {
      const path = join(root, item.file);
      const stat = await lstat(path);
      assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size === item.bytes);
      const bytes = await readFile(path);
      assert.equal(bytes.length, item.bytes);
      assert.equal(hash(bytes), item.sha256);
      if (PUBLIC_JSON_FILES.has(item.file)) {
        const projection = JSON.parse(bytes);
        assert.deepEqual(Object.keys(projection).sort(), [
          'evidence',
          'originalBytes',
          'originalBytesSha256',
          'originalSha256',
          'projectionVersion',
          'publicDesignReference',
        ]);
        assert.equal(projection.projectionVersion, 1);
        assert.equal(projection.publicDesignReference, PUBLIC_ICONS_DESIGN_REFERENCE);
        for (const key of ['originalBytesSha256', 'originalSha256'])
          assert.match(projection[key], /^[a-f0-9]{64}$/);
        assert.ok(Number.isSafeInteger(projection.originalBytes) && projection.originalBytes > 0);
        assertPublicEvidence(projection);
      } else {
        assertPublicScreenshot(bytes);
        assertPublicEvidence(bytes);
      }
    }
    assertPublicEvidence(manifest);
    return manifest;
  } catch {
    throw Object.assign(new Error('Публичный export не завершён или изменён'), {
      name: 'PublicEvidenceRefusal',
      code: 'PUBLIC_EVIDENCE_REFUSED',
    });
  }
}

// Экспорт получает только уже проверенные документы. Manifest завершает публикацию
// каталога; прерванная запись не даёт shell право экспортировать частичный результат.
export async function exportPublicEvidence(directory, { jsonFiles, visuals, privateLocations }) {
  const root = await realpath(resolve(directory));
  const publicRoot = join(root, 'public');
  try {
    const stat = await lstat(publicRoot);
    assert.ok(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'public: каталог не должен быть ссылкой',
    );
    await unlink(join(publicRoot, 'manifest.json'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const material = new Map();
  assert.ok(jsonFiles instanceof Map, 'public: нужен явный набор документов');
  for (const [name, bytes] of jsonFiles) {
    assert.ok(
      PUBLIC_JSON_FILES.has(name) && Buffer.isBuffer(bytes),
      'public: неизвестный документ',
    );
    material.set(name, projectJsonBytes(bytes, privateLocations));
  }
  for (const visual of visuals) {
    assert.ok(VISUAL_FILES.has(visual.path), 'public: неизвестный screenshot');
    consumerVisualLog(visual.bytes, visual.path, '0'.repeat(40), '0'.repeat(40), privateLocations);
    const name = visual.path.slice('result/'.length);
    assert.ok(!material.has(name), 'public: повторён artifact');
    material.set(name, visual.bytes);
  }
  // Никакие файлы прежнего/чужого экспорта не примешиваются к allowlist.
  try {
    const stat = await lstat(publicRoot);
    assert.ok(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'public: каталог не должен быть ссылкой',
    );
    const entries = await readdir(publicRoot, { withFileTypes: true });
    for (const entry of entries)
      assert.ok(
        entry.isFile() &&
          (entry.name === 'manifest.json' ||
            PUBLIC_JSON_FILES.has(entry.name) ||
            VISUAL_FILES.has(`result/${entry.name}`)),
        'public: неизвестный или связанный файл',
      );
    for (const entry of entries) await unlink(join(publicRoot, entry.name));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await mkdir(publicRoot, { recursive: false, mode: 0o700 });
  }
  const files = [];
  for (const [name, bytes] of material) {
    assertPublicEvidence(bytes, { privateLocations });
    await writeFile(join(publicRoot, name), bytes, { flag: 'wx', mode: 0o600 });
    files.push({ file: name, sha256: hash(bytes), bytes: bytes.length });
  }
  const manifest = {
    projectionVersion: 1,
    publicDesignReference: PUBLIC_ICONS_DESIGN_REFERENCE,
    files,
  };
  assertPublicEvidence(manifest, { privateLocations });
  const pending = join(publicRoot, `.manifest-${randomUUID()}.pending`);
  let publicationFailure;
  try {
    await writeFile(pending, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(pending, join(publicRoot, 'manifest.json'));
  } catch (error) {
    publicationFailure = error;
    throw error;
  } finally {
    await unlink(pending).catch((error) => {
      if (error?.code !== 'ENOENT' && !publicationFailure) throw error;
    });
  }
  return manifest;
}

export async function summarize(directory) {
  const root = await realpath(resolve(directory));
  try {
    const publicRoot = join(root, 'public');
    const stat = await lstat(publicRoot);
    assert.ok(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'public: каталог не должен быть ссылкой',
    );
    await unlink(join(publicRoot, 'manifest.json'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
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
  const receipt = JSON.parse(receiptBytes);
  const sourceBytes = await readFile(join(root, 'inputs/source-receipt.json'));
  const source = JSON.parse(sourceBytes);
  const subjectBytes = await readFile(join(root, 'inputs/subject.json'));
  const subject = validateSubject(JSON.parse(subjectBytes));
  const privateLocations = collectPrivateLocations({ source, subject, receipt });
  const publicDocuments = new Map([
    ['subject.json', subjectBytes],
    ['source-receipt.json', sourceBytes],
    ['receipt.json', receiptBytes],
  ]);
  if (receipt.outcome === 'failed') publicDocuments.set('failure.json', receiptBytes);
  let sourceIdentityError;
  try {
    validateSourcePin(source.pin);
    assertSourceIdentity(subject.authorReference, source.pin.sourceIdentitySha256);
    assert.equal(hash(subjectBytes), source.subjectSha256, 'source: изменён subject SHA');
    assert.equal(subject.packages.icons.sourceCommit, source.pin.sourceCommit);
    if (receipt.outcome === 'passed')
      assertConsumerSourceIdentity(source, receipt, subject, subjectBytes);
  } catch (error) {
    sourceIdentityError = Object.assign(error, { code: 'CONSUMER_SOURCE_IDENTITY_REFUSED' });
  }
  const sourceFiles = Array.isArray(source.files) ? source.files : [];
  const program = sourceFiles.find(
    (item) => item?.file === 'scripts/measure-platform-artifacts.mjs',
  );
  const lockfile = sourceFiles.find((item) => item?.file === 'pnpm-lock.yaml');
  if (subject.schemaVersion >= 2 && (!program || !lockfile))
    sourceIdentityError ??= Object.assign(
      new Error('source: отсутствует receipt программы или lockfile measurement'),
      {
        code: 'CONSUMER_SOURCE_IDENTITY_REFUSED',
      },
    );
  let policyFailure;
  if (subject.schemaVersion >= 2 && program && lockfile) {
    const measurement = source.measurement;
    assert.equal(measurement?.file, 'platform-measurement.json', 'measurement отсутствует');
    assert.equal(measurement.sourceSha, source.pin.sourceCommit);
    const bytes = await readFile(join(root, 'inputs/platform-measurement.json'));
    assert.equal(hash(bytes), measurement.sha256, 'measurement bytes изменились');
    assert.equal(bytes.length, measurement.bytes);
    assert.deepEqual(measurement.program, {
      file: program.file,
      sha256: program.sha256,
      bytes: program.bytes,
    });
    assert.equal(lockfile.sha256, measurement.lockfileSha256);
    const report = validatePlatformMeasurement(
      JSON.parse(bytes),
      source.pin.sourceCommit,
      measurement.artifactFiles,
      measurement.lockfileSha256,
    );
    policyFailure = platformPolicyFailure(report);
    publicDocuments.set('platform-measurement.json', bytes);
    await writeStdout(platformMeasurementLog(bytes, source.pin.sourceCommit, privateLocations));
  }
  const packets = [];
  let readbackFailure;
  let browserFrontier;
  if (receipt.failure?.browserFrontier !== undefined) {
    try {
      browserFrontier = publicBrowserFrontier(receipt.failure.browserFrontier, privateLocations);
    } catch (error) {
      readbackFailure = { file: 'result/browser-frontier-evidence', error };
    }
  }
  const addPacket = (file, encode) => {
    try {
      packets.push(encode());
    } catch (error) {
      readbackFailure ??= { file, error };
    }
  };
  if (!sourceIdentityError) {
    if (subject.schemaVersion >= 9 && receipt.outcome === 'passed') {
      try {
        assertMicrophoneVisualEvidence(visuals, receipt.records);
        assertMicrophoneComparisonEvidence(visuals, receipt.records);
      } catch (error) {
        readbackFailure ??= { file: 'result/microphone-optical-evidence', error };
      }
    }
    if (subject.schemaVersion >= 11 && receipt.outcome === 'passed') {
      try {
        assertTimerRefusalEvidence(visuals, receipt.records, subject.motionProjectionReference);
      } catch (error) {
        readbackFailure ??= { file: 'result/timer-refusal-evidence', error };
      }
    }
    if (subject.schemaVersion >= 12 && receipt.outcome === 'passed') {
      try {
        assertWidthMotionVisualEvidence(visuals, receipt.records, subject.microphoneReference);
      } catch (error) {
        readbackFailure ??= { file: 'result/width-motion-visual-evidence', error };
      }
    }
    for (const visual of visuals)
      addPacket(visual.path, () =>
        consumerVisualLog(
          visual.bytes,
          visual.path,
          source.pin.sourceCommit,
          source.uiCommit,
          privateLocations,
        ),
      );
    if (receipt.outcome === 'passed')
      addPacket('result/receipt.json', () =>
        consumerReceiptLog(
          receiptBytes,
          source.pin.sourceCommit,
          source.uiCommit,
          privateLocations,
        ),
      );
  }
  const summary = JSON.parse(
    JSON.stringify({
      schemaVersion: 1,
      outcome: policyFailure || sourceIdentityError || readbackFailure ? 'failed' : receipt.outcome,
      ...(policyFailure || sourceIdentityError || readbackFailure
        ? { browserOutcome: receipt.outcome }
        : {}),
      ...(policyFailure ? { policyFailure } : {}),
      ...(sourceIdentityError
        ? {
            sourceIdentityFailure: {
              code: sourceIdentityError.code,
              diagnostic: publicError(sourceIdentityError, { privateLocations }),
            },
          }
        : {}),
      source,
      harness: receipt.harness,
      runner: receipt.runner,
      archives: receipt.archives,
      observations: receipt.records?.length,
      failure: receipt.failure
        ? {
            phase: receipt.failure.phase,
            stateContinuity: receipt.failure.stateContinuity,
            ...(browserFrontier ? { browserFrontier } : {}),
          }
        : null,
      files,
      ...(readbackFailure
        ? { readbackFailure: { code: 'EVIDENCE_REFUSED', file: readbackFailure.file } }
        : {}),
    }),
  );
  const summaryBytes = Buffer.from(`${JSON.stringify(summary)}\n`);
  publicDocuments.set('consumer-result.json', summaryBytes);
  const resultPacket = consumerResultLog(summaryBytes, privateLocations);
  // Отказ передаёт frontier до PNG; успешный RESULT по-прежнему завершает все packets.
  if (summary.outcome === 'failed') await writeStdout(resultPacket);
  for (const packet of packets) await writeStdout(packet);
  if (summary.outcome !== 'failed') await writeStdout(resultPacket);
  if (!sourceIdentityError && !readbackFailure)
    await exportPublicEvidence(root, { jsonFiles: publicDocuments, visuals, privateLocations });
  if (readbackFailure) throw readbackFailure.error;
  if (sourceIdentityError) throw sourceIdentityError;
  if (policyFailure)
    throw Object.assign(
      new Error(`Platform policy отказала: ${policyFailure.violations.join('\n')}`),
      policyFailure,
    );
  assert.equal(receipt.outcome, 'passed');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--checkout-ref') {
    process.stdout.write(`${validateSourcePin(JSON.parse(await readFile(PIN))).sourceCommit}\n`);
    return;
  }
  if (args.length === 2 && args[0] === '--verify-public') {
    await verifyPublicExport(args[1]);
    return;
  }
  if (args.length === 2 && args[0] === '--summarize') {
    try {
      return await summarize(args[1]);
    } catch (error) {
      if (error?.code !== 'PLATFORM_POLICY_REFUSED') throw error;
      // Отказ уже записан в RESULT; второй поток не разрывает evidence packets.
      process.exitCode = 1;
      return;
    }
  }
  const required = [
    '--icons-source',
    '--ui-source',
    '--ui-commit',
    '--icons-tarball',
    '--ui-core-tarball',
    '--out',
  ];
  const options = new Map();
  const allowed = [...new Set([...required, ...ARCHIVE_OPTIONS])];
  assert.equal(args.length % 2, 0);
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(allowed.includes(args[index]) && args[index + 1] && !options.has(args[index]));
    options.set(args[index], args[index + 1]);
  }
  assert.ok(
    required.every((key) => options.has(key)),
    'Неполные source/archive inputs',
  );
  return prepareInputs(options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`LABUI_ICONS_CONSUMER_ERROR ${JSON.stringify(publicError(error))}\n`);
    process.exitCode = 1;
  }
}
