import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import {
  ANNULUS_ENTRIES,
  annulusBrowserProof,
  annulusFixture,
  annulusTypeFixture,
  validateAnnulusReference,
} from './icons-annulus-consumer.mjs';
import {
  AUTHORED_DOT_ENTRIES,
  authoredDotsBrowserProof,
  authoredDotsFixture,
  authoredDotsTypeFixture,
  validateAuthoredDotsReference,
} from './icons-authored-dots-consumer.mjs';
import {
  NOTIFICATION_ENTRIES,
  assertNotificationAnatomy,
  assertNotificationEffect,
  notificationFixture,
  notificationPosition,
  validateNotificationReference,
} from './icons-notification-consumer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const HASH = /^[a-f0-9]{64}$/;
const outside = (path) => path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

const REQUIRED_PUBLIC_ENTRIES = [
  '@labpics/ui-core/button',
  '@labpics/icons/symbols/reload',
  '@labpics/motion',
];
const STATE_ENTRY = '@labpics/icons/states/status-circle';
const EXPRESSION_ENTRY = '@labpics/icons/states/expression-face';
const STATE_GROUPS = {
  'status-circle': {
    defaultState: 'question',
    enclosurePartId: 'status-enclosure',
    states: ['attention', 'confirmation', 'decrease', 'dismissal', 'increase', 'question'],
    sharedParts: [{ id: 'status-enclosure', role: 'container' }],
    buttonLabel: 'Сменить знак',
    selectLabel: 'Состояние знака',
    labels: {
      attention: 'Внимание',
      confirmation: 'Подтверждение',
      decrease: 'Уменьшение',
      dismissal: 'Закрытие',
      increase: 'Увеличение',
      question: 'Вопрос',
    },
  },
  'expression-face': {
    defaultState: 'aloof',
    enclosurePartId: 'face-enclosure',
    states: ['aloof', 'sad', 'smile'],
    sharedParts: [
      { id: 'face-left-eye', role: 'content' },
      { id: 'face-right-eye', role: 'content' },
      { id: 'face-enclosure', role: 'container' },
    ],
    buttonLabel: 'Сменить выражение',
    selectLabel: 'Выражение лица',
    labels: { aloof: 'Спокойствие', sad: 'Грусть', smile: 'Улыбка' },
  },
};

export function stateReferenceContract(group) {
  assert.ok(Object.hasOwn(STATE_GROUPS, group), 'consumer не запрашивал такую state group');
  return structuredClone(STATE_GROUPS[group]);
}

export function consumerPublicEntries(schemaVersion) {
  assert.ok([1, 2, 3, 4, 5, 6].includes(schemaVersion));
  return [
    ...REQUIRED_PUBLIC_ENTRIES,
    ...(schemaVersion >= 2 ? [STATE_ENTRY] : []),
    ...(schemaVersion >= 3 ? [EXPRESSION_ENTRY] : []),
    ...(schemaVersion >= 4 ? NOTIFICATION_ENTRIES : []),
    ...(schemaVersion >= 5 ? AUTHORED_DOT_ENTRIES : []),
    ...(schemaVersion >= 6 ? ANNULUS_ENTRIES : []),
  ];
}

export function subjectStateReferences(subject) {
  return subject.schemaVersion >= 3
    ? subject.stateReferences
    : subject.schemaVersion === 2
      ? { 'status-circle': subject.stateReference }
      : {};
}

export function assertIconsImport(source) {
  if (!/^@labpics\/icons(?:\/|$)/.test(source)) return;
  assert.ok(
    [
      '@labpics/icons/symbols/reload',
      '@labpics/icons/ir/render',
      '@labpics/icons/motion',
      STATE_ENTRY,
      EXPRESSION_ENTRY,
      ...NOTIFICATION_ENTRIES,
      ...AUTHORED_DOT_ENTRIES,
      ...ANNULUS_ENTRIES,
    ].includes(source),
    `consumer импортирует чужой symbol или whole catalog: ${source}`,
  );
}

// Resolver выбирает установленный публичный entry; facade может исчезнуть при treeshake.
// Поэтому требуется реальный вклад его import-closure, а не частный путь производителя.
export function assertPublicEntryModules(
  modules,
  entries,
  imports,
  required = REQUIRED_PUBLIC_ENTRIES,
) {
  for (const specifier of required) {
    const entry = entries[specifier];
    assert.ok(typeof entry === 'string' && entry.length > 0, `entry не разрешён: ${specifier}`);
    const seen = new Set();
    const pending = [entry];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...(imports.get(id) ?? []));
    }
    assert.ok(
      [...seen].some((id) => modules.has(id)),
      `публичный entry не внёс модулей в bundle: ${specifier}`,
    );
  }
}

export function assertConsumerModuleGraph(
  consumer,
  modules,
  publicEntries,
  imports,
  publicImports = [],
  required = REQUIRED_PUBLIC_ENTRIES,
) {
  for (const source of publicImports) assertIconsImport(source);
  const moduleGraph = [...modules]
    .filter((id) => !id.startsWith('\0'))
    .map((id) => {
      const path = id.split('?')[0];
      assert.ok(!outside(relative(consumer, path)), `consumer импортирует producer: ${path}`);
      return relative(consumer, path).replaceAll('\\', '/');
    })
    .sort();
  assertPublicEntryModules(modules, publicEntries, imports, required);
  return moduleGraph;
}
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

// Импорт harness не устанавливает пакеты и не запускает browser/build.
export function assertSelfHostedRunner(env = process.env) {
  assert.ok(
    env.GITHUB_ACTIONS === 'true' &&
      env.CI === 'true' &&
      /^\d+$/.test(env.GITHUB_RUN_ID ?? '') &&
      env.RUNNER_ENVIRONMENT === 'self-hosted',
    'icons-packed: install/build/browser разрешены только self-hosted GitHub Actions runner',
  );
}

export function validateSubject(subject) {
  assert.ok([1, 2, 3, 4, 5, 6].includes(subject?.schemaVersion));
  assert.deepEqual(Object.keys(subject.packages ?? {}).sort(), ['icons', 'uiCore', 'uiShadow']);
  for (const [key, name] of [
    ['icons', '@labpics/icons'],
    ['uiCore', '@labpics/ui-core'],
    ['uiShadow', '@labpics/ui-shadow'],
  ]) {
    const item = subject.packages?.[key];
    assert.equal(item?.name, name);
    assert.ok(typeof item.version === 'string' && item.version.length > 0);
    assert.match(item.archiveSha256, HASH);
    assert.ok(Number.isSafeInteger(item.archiveBytes) && item.archiveBytes > 0);
    assert.match(item.sourceCommit, /^[a-f0-9]{40}$/);
  }
  const reference = subject.authorReference;
  assert.ok(typeof reference?.fileName === 'string' && /Lab UI.*v2\.1/.test(reference.fileName));
  assert.match(reference.fileKey, /^[A-Za-z0-9]+$/);
  assert.match(reference.version, /^\d+$/);
  assert.deepEqual(Object.keys(reference.icons ?? {}), ['reload']);
  assert.deepEqual(Object.keys(reference.icons.reload).sort(), ['filled', 'outline']);
  for (const variant of ['outline', 'filled']) {
    const item = reference.icons.reload[variant];
    assert.equal(
      item.sourceFile,
      `masters/figma/${reference.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/reload.svg`,
    );
    assert.equal(item.author?.kind, 'figma');
    assert.equal(item.author.fileKey, reference.fileKey);
    assert.equal(item.author.version, reference.version);
    assert.match(item.author.nodeId, /^\d+:\d+$/);
    for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256'])
      assert.match(item.author[key], HASH);
    assert.equal(item.anatomy?.version, 1);
    assert.match(item.anatomy.annotationSha256, HASH);
    assert.equal(item.anatomy.masterSha256, item.author.masterSha256);
    assert.equal(item.anatomy.pathFingerprintSha256, item.author.pathFingerprintSha256);
    assert.ok(
      Array.isArray(item.viewBox) &&
        item.viewBox.length === 4 &&
        item.viewBox.every(Number.isFinite),
    );
    assert.ok(item.viewBox[2] > 0 && item.viewBox[3] > 0);
    assert.ok(Array.isArray(item.paths) && item.paths.length > 0);
    for (const path of item.paths) {
      assert.ok(typeof path.d === 'string' && path.d.length > 0);
      assert.ok(['evenodd', 'nonzero'].includes(path.fillRule));
    }
    const entries = item.paths.map((path, index) => ({
      index,
      d: path.d,
      fillRule: path.fillRule,
    }));
    assert.equal(
      hash(stableJSON(entries)),
      item.author.pathFingerprintSha256,
      'независимый reference fingerprint',
    );
    assert.ok(Array.isArray(item.parts) && item.parts.length === item.paths.length);
    assert.equal(new Set(item.parts.map((part) => part.id)).size, item.parts.length);
    for (const [index, part] of item.parts.entries()) {
      assert.match(part.id, /^[a-z][a-z0-9-]*$/);
      assert.ok(typeof part.role === 'string' && part.role.length > 0);
      assert.ok(Number.isSafeInteger(part.zIndex));
      assert.equal(part.d, item.paths[index].d);
      assert.equal(part.fillRule, item.paths[index].fillRule);
    }
    assert.equal(item.gesture?.id, 'reload.cycle');
    assert.equal(item.gesture.progress, 'normalized-0-to-1');
    assert.deepEqual(
      item.gesture.partIds,
      item.parts.map((part) => part.id),
    );
    assert.ok(
      Array.isArray(item.gesture.tracks) && item.gesture.tracks.length === item.parts.length,
    );
    for (const [index, track] of item.gesture.tracks.entries()) {
      assert.equal(track.partId, item.parts[index].id);
      assert.equal(track.kind, 'rotate');
      assert.equal(track.unit, 'degrees');
      assert.equal(track.interpolation, 'linear');
      assert.ok(
        Number.isFinite(track.from) && Number.isFinite(track.to) && track.from !== track.to,
      );
      assert.ok(
        Array.isArray(track.anchor) &&
          track.anchor.length === 2 &&
          track.anchor.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
      );
    }
  }
  if (subject.schemaVersion >= 3) {
    assert.equal(subject.stateReference, undefined);
    assert.deepEqual(
      Object.keys(subject.stateReferences ?? {}).sort(),
      Object.keys(STATE_GROUPS).sort(),
    );
    for (const [group, state] of Object.entries(subject.stateReferences))
      validateStateReference(state, reference, group);
  } else {
    assert.equal(subject.stateReferences, undefined);
    if (subject.schemaVersion === 2) validateStateReference(subject.stateReference, reference);
    else assert.equal(subject.stateReference, undefined);
  }
  if (subject.schemaVersion >= 4)
    validateNotificationReference(subject.notificationReference, reference);
  else assert.equal(subject.notificationReference, undefined);
  if (subject.schemaVersion >= 5)
    validateAuthoredDotsReference(subject.authoredDotsReference, reference);
  else assert.equal(subject.authoredDotsReference, undefined);
  if (subject.schemaVersion >= 6) validateAnnulusReference(subject.annulusReference, reference);
  else assert.equal(subject.annulusReference, undefined);
  return subject;
}

export function validateStateReference(reference, author, group = 'status-circle') {
  const contract = stateReferenceContract(group);
  assert.equal(reference?.group, group);
  assert.equal(reference.variant, 'outline');
  assert.equal(reference.defaultState, contract.defaultState);
  assert.equal(reference.enclosurePartId, contract.enclosurePartId);
  assert.deepEqual(reference.proof?.source, { fileKey: author.fileKey, version: author.version });
  assert.equal(reference.proof.law, 'enclosure.replace');
  assert.match(reference.proof.specSha256, HASH);
  assert.match(reference.proof.enclosureSha256, HASH);
  if (Object.hasOwn(reference, 'sharedPartIds')) {
    assert.deepEqual(
      reference.sharedPartIds,
      contract.sharedParts.map((part) => part.id),
    );
    const shared = reference.sharedParts ?? [
      { ...reference.enclosure, ...contract.sharedParts[0] },
    ];
    assert.equal(shared.length, contract.sharedParts.length);
    for (const [index, part] of shared.entries()) {
      assert.deepEqual(Object.keys(part).sort(), ['d', 'fillRule', 'id', 'role']);
      assert.equal(part.id, contract.sharedParts[index].id);
      assert.equal(part.role, contract.sharedParts[index].role);
      assert.ok(typeof part.d === 'string' && part.d.length > 0);
      assert.ok(['evenodd', 'nonzero'].includes(part.fillRule));
    }
    assert.equal(
      reference.proof.sharedPartsSha256,
      hash(
        stableJSON({
          parts: shared.map((part) => ({ ...part, paint: { kind: 'fill', fill: 'currentColor' } })),
          viewBox: [0, 0, 24, 24],
          dimensions: [24, 24],
          placement: 'after-content',
        }),
      ),
      'независимый shared anatomy fingerprint',
    );
  } else {
    assert.equal(group, 'status-circle', 'expression requires shared anatomy proof');
    assert.ok(!Object.hasOwn(reference.proof, 'sharedPartsSha256'));
    assert.equal(reference.sharedParts, undefined);
  }
  assert.deepEqual(
    reference.states.map((state) => state.id),
    contract.states,
  );
  const ids = new Set(contract.sharedParts.map((part) => part.id));
  const sharedCount = reference.sharedPartIds?.length ?? 1;
  for (const state of reference.states) {
    assert.match(state.icon, /^[a-z][a-z0-9-]*$/);
    assert.equal(state.partId, `state-${state.id}`);
    assert.equal(state.sourceFile, `masters/figma/${author.version}/Outline/${state.icon}.svg`);
    assert.deepEqual(state.viewBox, [0, 0, 24, 24]);
    assert.deepEqual(state.dimensions, [24, 24]);
    assert.equal(state.author.kind, 'figma');
    assert.equal(state.author.fileKey, author.fileKey);
    assert.equal(state.author.version, author.version);
    assert.match(state.author.nodeId, /^\d+:\d+$/);
    for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256'])
      assert.match(state.author[key], HASH);
    assert.ok(state.paths.length >= 2);
    for (const path of state.paths) {
      assert.ok(typeof path.d === 'string' && path.d.length > 0);
      assert.ok(['nonzero', 'evenodd'].includes(path.fillRule));
    }
    assert.equal(
      hash(stableJSON(state.paths.map((path, index) => ({ index, ...path })))),
      state.author.pathFingerprintSha256,
    );
    assert.equal(state.contentPartIds.length, state.paths.length - sharedCount);
    assert.ok(state.contentPartIds.length > 0);
    for (const part of [state.partId, ...state.contentPartIds]) {
      assert.match(part, /^[a-z][a-z0-9-]*$/);
      assert.ok(!ids.has(part));
      ids.add(part);
    }
    assert.deepEqual(state.paths.at(-1), reference.enclosure);
    if (reference.sharedParts)
      assert.deepEqual(
        state.paths.slice(state.contentPartIds.length),
        reference.sharedParts.map(({ d, fillRule }) => ({ d, fillRule })),
      );
  }
  assert.equal(
    hash(
      stableJSON({
        ...reference.enclosure,
        paint: { kind: 'fill', fill: 'currentColor' },
        viewBox: [0, 0, 24, 24],
        dimensions: [24, 24],
        placement: 'after-content',
      }),
    ),
    reference.proof.enclosureSha256,
  );
  return reference;
}

// Проверенные bytes переходят в собственный snapshot; input path больше не читается.
export async function snapshotArchive(consumer, key, inputPath, expected) {
  assert.ok(['icons', 'uiCore', 'uiShadow'].includes(key));
  const bytes = await readFile(inputPath);
  assert.equal(hash(bytes), expected.archiveSha256, key);
  assert.equal(bytes.length, expected.archiveBytes, key);
  const directory = join(consumer, 'archives');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${key}.tgz`);
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  const snapshot = await readFile(path);
  assert.equal(hash(snapshot), expected.archiveSha256, `${key}: snapshot SHA256`);
  assert.equal(snapshot.length, expected.archiveBytes, `${key}: snapshot bytes`);
  return {
    key,
    path,
    inputName: basename(inputPath),
    archiveSha256: hash(snapshot),
    archiveBytes: snapshot.length,
    integrity: `sha512-${createHash('sha512').update(snapshot).digest('base64')}`,
  };
}

const HTML = `<!doctype html><html lang="ru" data-theme="light"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Lab Icons в Lab UI</title>
<style>
:root { --lab-label-primary:#16181c; --lab-fill-neutral:#eef0f3; --lab-label-on-neutral:#16181c;
  --lab-border-focus:#007aff; --lab-focus-ring-width:2px; --lab-focus-ring-offset:3px; }
body { margin:0; padding:48px; background:#fff; color:var(--lab-label-primary); }
h1 { margin:0 0 32px; font-size:24px; font-weight:600; }
form { display:flex; gap:48px; } figure { margin:0; display:grid; gap:16px; justify-items:center; }
figcaption { font-size:14px; } svg[slot=icon] { width:24px; height:24px; display:block; }
section { margin-top:48px; } h2 { margin:0 0 20px; font-size:18px; font-weight:600; }
.state-sample { display:flex; align-items:center; gap:24px; }
.state-sample select { min-height:44px; padding:8px 12px; font:inherit; }
.size-samples { display:flex; flex-wrap:wrap; align-items:end; gap:32px; margin-top:24px; }
.size-samples figure { gap:12px; min-width:48px; }
.size-sample-row { display:flex; align-items:end; gap:24px; }
.size-sample-row span { display:grid; justify-items:center; gap:12px; font-size:12px; }
.notification-sample { display:flex; flex-wrap:wrap; align-items:start; gap:48px; }
.notification-sample figure { justify-items:start; }
.notification-sample h3, h3 { font-size:14px; font-weight:500; margin:28px 0 16px; }
.dots-row { display:flex; flex-wrap:wrap; gap:40px; align-items:start; }
.dots-orientation, .dots-variation { justify-items:start; gap:16px; min-width:224px; }
.dots-orientation select, .authored-dots button { min-height:44px; padding:8px 12px; font:inherit; }
.dots-parameters { display:grid; gap:12px; width:100%; }
.dots-parameters label { display:grid; gap:8px; font-size:14px; }
.dots-parameters input { width:100%; min-height:24px; accent-color:#007aff; }
.dots-variation output { max-width:240px; font-size:12px; line-height:1.5; }
.annulus-row { display:flex; flex-wrap:wrap; gap:40px; align-items:start; }
.annulus-sample { justify-items:start; min-width:224px; }
.annulus-parameter { display:grid; gap:8px; width:100%; font-size:14px; }
.annulus-parameter input, .authored-annulus button { min-height:44px; padding:8px 12px; font:inherit; }
.annulus-sample output { max-width:240px; font-size:12px; line-height:1.5; }
@media (max-width:480px) { body { padding:24px; } .state-sample { flex-wrap:wrap; gap:16px; } }
</style><body><h1>Обновить</h1><form id="actions"></form>
<script type="module" src="/consumer.mjs"></script></body></html>`;

const FIXTURE = `import '@labpics/ui-core/button';
import '@labpics/ui-core/theme.css';
import { glyph, glyphCapabilities } from '@labpics/icons/symbols/reload';
import { renderGlyphSvg } from '@labpics/icons/ir/render';
import { compileSymbolEffect } from '@labpics/icons/motion';
import { animate } from '@labpics/motion';

const instances = new Map();
let submissions = 0;
document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); submissions++; });
for (const variant of ['outline', 'filled']) {
  const model = glyph({ variant });
  const capabilities = glyphCapabilities(variant);
  const figure = document.createElement('figure');
  const button = document.createElement('lab-button');
  button.setAttribute('size', 'l');
  button.setAttribute('icon', '');
  button.setAttribute('type', 'neutral');
  button.setAttribute('aria-label', 'Обновить');
  button.dataset.variant = variant;
  button.innerHTML = renderGlyphSvg(model, { instanceId: 'labui-' + variant });
  const svg = button.querySelector('svg');
  svg.setAttribute('slot', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const caption = document.createElement('figcaption');
  caption.textContent = variant === 'outline' ? 'Outline' : 'Filled';
  figure.append(button, caption);
  document.querySelector('form').append(figure);
  instances.set(variant, { model, capabilities, button, svg, controls: [], events: [], nativeClicks: 0, generation: 0, settled: true });
  button.addEventListener('click', event => {
    const initialize = instances.get(variant).settled;
    const transition = start(variant, { from: 0, to: 1, initialize });
    instances.get(variant).events.push({ trusted: event.isTrusted, composed: event.composed,
      native: event.composedPath().includes(button.shadowRoot.querySelector('button')),
      initialize, before: transition.before, after: transition.after, effect: transition.effect });
  });
}

function compile(item, request) {
  const result = compileSymbolEffect(item.model, item.capabilities, 'reload.cycle', request);
  if (!result.ok) throw new Error(result.reason.code);
  if (result.effect.version !== 1) throw new Error('reload требует rotation effect v1');
  return result.effect;
}
function matrices(item) {
  return [...item.svg.querySelectorAll('[data-part]')].map(element => {
    const value = new DOMMatrix(getComputedStyle(element).transform);
    return ['a', 'b', 'c', 'd', 'e', 'f'].map(key => value[key]);
  });
}
function start(variant, { from = 0, to = 1, duration = 600, initialize = false } = {}) {
  const item = instances.get(variant);
  const effect = compile(item, { from, to, duration,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  const before = matrices(item);
  const previous = item.controls;
  const controls = [];
  const generation = ++item.generation;
  try {
    Object.assign(item.svg.style, effect.viewport);
    for (const target of effect.targets) {
      const element = [...item.svg.querySelectorAll('[data-part]')].find(node => node.dataset.part === target.partId);
      if (!element) throw new Error('Потеряна часть ' + target.partId);
      Object.assign(element.style, target.style);
      controls.push(animate(element, { rotate: initialize ? [target.rotation.from, target.rotation.to] : target.rotation.to },
        { duration: effect.options.duration, ease: effect.options.easing,
          reducedMotion: effect.options.duration === 0 ? 'always' : 'user' }));
    }
  } catch (error) { controls.forEach(control => control.stop()); throw error; }
  item.controls = controls;
  previous.forEach(control => control.stop());
  item.settled = false;
  item.completion = Promise.all(controls.map(control => control.finished));
  item.completion.then(results => {
    if (generation === item.generation && results.every(result => result.status === 'finished')) item.settled = true;
  });
  return { before, after: matrices(item), effect, generation };
}
function read(variant) {
  const item = instances.get(variant);
  const native = item.button.shadowRoot?.querySelector('button');
  const rectangle = native?.getBoundingClientRect();
  return { icon: item.model.icon, variant: item.model.variant, provenance: item.model.provenance,
    composition: item.model.composition.kind,
    parts: item.model.parts.map(({ id, role, zIndex, fillRule, d }) => ({ id, role, zIndex, fillRule, d })),
    viewBox: item.svg.getAttribute('viewBox').trim().split(/\\s+/).map(Number),
    paths: [...item.svg.querySelectorAll('path')].map(element => ({ d: element.getAttribute('d'),
      fillRule: element.getAttribute('fill-rule') ?? 'nonzero', id: element.dataset.part, role: element.dataset.role })),
    matrices: matrices(item), svg: item.svg.outerHTML, events: item.events, nativeClicks: item.nativeClicks, submissions,
    target: { width: rectangle?.width, height: rectangle?.height, name: native?.getAttribute('aria-label'),
      type: native?.type, iconHidden: item.svg.getAttribute('aria-hidden'), slotHidden: native?.querySelector('slot[name=icon]')?.getAttribute('aria-hidden') },
    capabilities: item.capabilities, connected: item.button.isConnected };
}
async function settle(variant) {
  const item = instances.get(variant);
  let timer;
  let results;
  try {
    results = await Promise.race([item.completion,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Motion completion timeout')), 20000); })]);
    if (!results || !results.every(result => result.status === 'finished')) throw new Error('Motion не завершил текущий жест');
  } finally { clearTimeout(timer); }
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  return { ...read(variant), completionStatuses: results.map(result => result.status) };
}
function cleanup() {
  for (const item of instances.values()) { item.controls.forEach(control => control.stop()); item.controls = []; }
  document.querySelector('form').replaceChildren();
  return { connected: [...instances.values()].filter(item => item.button.isConnected).length,
    runningNativeAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length };
}
window.__iconsPacked = { ready: Promise.all([...instances.values()].map(async item => {
    await item.button.updateComplete;
    item.button.shadowRoot.querySelector('button').addEventListener('click', () => item.nativeClicks++);
  })),
  read, start, settle, cleanup,
  refuse: variant => {
    const item = instances.get(variant);
    let axis;
    try { glyph({ variant, axes: { weight: 1.1 } }); axis = 'accepted'; } catch (error) { axis = error.code; }
    return { axis, motion: compileSymbolEffect(item.model, item.capabilities, 'reload.morph', { duration: 600 }) };
  } };
`;

const STATE_FIXTURE = `
import * as statusCircle from '@labpics/icons/states/status-circle';
import { sequence } from '@labpics/motion';

function mountStateConsumer(api, configuration) {
const { render, renderStateSvg, compileStateEffect, stateCapabilities, exportStateTransition } = api;
const stateCapabilitiesValue = stateCapabilities();
const stateLabels = configuration.labels;
const stateSection = document.createElement('section');
stateSection.dataset.stateGroup = stateCapabilitiesValue.group;
stateSection.setAttribute('aria-labelledby', stateCapabilitiesValue.group + '-heading');
const stateHeading = document.createElement('h2');
stateHeading.id = stateCapabilitiesValue.group + '-heading'; stateHeading.textContent = configuration.buttonLabel;
const stateSample = document.createElement('div'); stateSample.className = 'state-sample';
const stateButton = document.createElement('lab-button');
for (const [name, value] of Object.entries({ size: 'l', icon: '', type: 'neutral',
  'aria-label': configuration.buttonLabel,
  'data-state-group': stateCapabilitiesValue.group })) stateButton.setAttribute(name, value);
const initialState = renderStateSvg(stateCapabilitiesValue.defaultState);
if (!initialState.ok) throw new Error(initialState.reason.code);
stateButton.innerHTML = initialState.svg;
const stateSvg = stateButton.querySelector('svg');
stateSvg.setAttribute('slot', 'icon'); stateSvg.setAttribute('aria-hidden', 'true');
stateSvg.setAttribute('focusable', 'false');
const stateNodes = new Map([...stateSvg.querySelectorAll('g[data-state][data-part]')]
  .map(node => [node.dataset.part, node]));
const stateEnclosure = stateSvg.querySelector('[data-part="' + stateCapabilitiesValue.enclosurePartId + '"]');
const sharedPartIds = stateCapabilitiesValue.sharedPartIds ?? [stateCapabilitiesValue.enclosurePartId];
const sharedNodes = new Map(sharedPartIds.map(id => {
  const node = stateSvg.querySelector('[data-part="' + id + '"]');
  if (!node) throw new Error('Потеряна общая часть ' + id);
  return [id, node];
}));
const originalStateNodes = [...stateSvg.querySelectorAll('*')];
const stateSelect = document.createElement('select');
stateSelect.setAttribute('aria-label', configuration.selectLabel);
for (const state of stateCapabilitiesValue.states) {
  const option = document.createElement('option'); option.value = state.id;
  option.textContent = stateLabels[state.id]; stateSelect.append(option);
}
stateSelect.value = stateCapabilitiesValue.defaultState;
stateSelect.addEventListener('change', () => changeState(stateSelect.value));
const stateStatus = document.createElement('span');
stateStatus.setAttribute('role', 'status'); stateStatus.textContent = stateLabels[stateSelect.value];
stateSample.append(stateButton, stateSelect, stateStatus);
stateSection.append(stateHeading, stateSample); document.body.append(stateSection);
const sizeSamples = [];
if (configuration.samples) {
  const scale = document.createElement('div'); scale.className = 'size-samples';
  for (const state of stateCapabilitiesValue.states) {
    const figure = document.createElement('figure');
    const row = document.createElement('div'); row.className = 'size-sample-row';
    for (const size of [16, 24, 48]) {
    const result = render(state.id);
    if (!result.ok) throw new Error(result.reason.code);
    const sample = document.createElement('span'); sample.innerHTML = result.svg;
    const svg = sample.querySelector('svg');
    svg.dataset.opticalSize = String(size);
    svg.dataset.sampleState = state.id;
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.style.width = size + 'px'; svg.style.height = size + 'px';
    sample.append(document.createTextNode(size + ' px')); row.append(sample); sizeSamples.push(svg);
    }
    const caption = document.createElement('figcaption'); caption.textContent = stateLabels[state.id];
    figure.append(row, caption); scale.append(figure);
  }
  stateSection.append(scale);
}
let stateControl; let stateCompletion; let stateGeneration = 0;
let stateTarget = stateSelect.value; let stateNativeClicks = 0;
const stateEvents = [];
stateButton.addEventListener('click', event => {
  const ids = stateCapabilitiesValue.states.map(state => state.id);
  const next = ids[(ids.indexOf(stateTarget) + 1) % ids.length];
  const result = changeState(next);
  stateEvents.push({ trusted: event.isTrusted, composed: event.composed,
    native: event.composedPath().includes(stateButton.shadowRoot.querySelector('button')),
    before: result.before, after: result.after, effect: result.effect,
    continuity: result.continuity });
});
function stateOpacity(partTimes) {
  return [...stateNodes.values()].map(node => {
    const readStartedAt = partTimes ? performance.now() : null;
    const value = Number(getComputedStyle(node).opacity);
    partTimes?.push({ partId: node.dataset.part, readStartedAt, readCompletedAt: performance.now() });
    return { partId: node.dataset.part, value };
  });
}
function stateWitness() {
  return { sampledAt: performance.now(), timelineTime: document.timeline.currentTime,
    playback: stateControl?.state ?? null,
    inlineOpacity: [...stateNodes.values()].map(node => ({ partId: node.dataset.part,
      value: node.style.opacity })),
    animations: stateSvg.getAnimations({ subtree: true }).map(animation => {
      const frames = animation.effect.getKeyframes();
      return { partId: animation.effect.target?.dataset.part ?? null,
        sampledAt: performance.now(), currentTime: animation.currentTime,
        startTime: animation.startTime, playState: animation.playState, pending: animation.pending,
        firstKeyframe: frames[0] ?? null, lastKeyframe: frames.at(-1) ?? null };
    }) };
}
function stateOpacityWitness() {
  const readStartedAt = performance.now();
  const partTimes = [];
  const opacity = stateOpacity(partTimes);
  const readCompletedAt = performance.now();
  return { readStartedAt, readCompletedAt, partTimes, opacity, ...stateWitness() };
}
function statePaths(svg) {
  return [...svg.querySelectorAll('path')].map(statePath);
}
function statePath(node) {
  return { d: node.getAttribute('d'),
    fillRule: node.getAttribute('fill-rule') ?? 'nonzero', fill: node.getAttribute('fill'),
    partId: node.dataset.part, role: node.dataset.role };
}
function sharedAncestorsUnchanged(node) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (Number(style.opacity) !== 1 || style.transform !== 'none') return false;
    if (parent === stateSvg) return true;
  }
  return false;
}
function changeState(state, duration = 600) {
  const result = compileStateEffect(state, { duration,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  if (!result.ok) throw new Error(result.reason.code);
  const effect = result.effect;
  // Явный первый кадр сохраняет видимую позу при передаче управления.
  const before = stateOpacityWitness(); const previous = stateControl;
  const visibleOpacity = new Map(before.opacity.map(item => [item.partId, item.value]));
  const next = sequence(effect.stages.map(stage => {
    const node = stateNodes.get(stage.partId);
    if (!node) throw new Error('Потеряна группа ' + stage.partId);
    return [node, { opacity: [visibleOpacity.get(stage.partId), stage.to] },
      { at: stage.at, duration: stage.duration, ease: effect.options.easing }];
  }), { reducedMotion: effect.options.duration === 0 ? 'always' : 'user' });
  const admitted = { ...stateWitness(), playback: next.state, previousPlayback: previous?.state ?? null };
  previous?.stop(); stateControl = next; stateCompletion = next.finished;
  stateGeneration++; stateTarget = state; stateSelect.value = state;
  stateStatus.textContent = stateLabels[state];
  const after = stateOpacityWitness();
  return { effect, before: before.opacity, after: after.opacity, generation: stateGeneration,
    continuity: { before, admitted, after } };
}
function readState() {
  const native = stateButton.shadowRoot?.querySelector('button');
  const rectangle = native?.getBoundingClientRect();
  return { capabilities: stateCapabilitiesValue, opacity: stateOpacity(),
    viewBox: stateSvg.getAttribute('viewBox').split(/\\s+/).map(Number),
    dimensions: ['width', 'height'].map(name => Number(stateSvg.getAttribute(name))),
    groups: [...stateSvg.querySelectorAll('g[data-state][data-part]')].map(node => ({ id: node.dataset.state,
      partId: node.dataset.part, role: node.dataset.role, paths: statePaths(node) })),
    enclosure: statePaths(stateSvg).at(-1), enclosureCount:
      stateSvg.querySelectorAll('[data-part="' + stateCapabilitiesValue.enclosurePartId + '"]').length,
    identity: originalStateNodes.length === stateSvg.querySelectorAll('*').length &&
      originalStateNodes.every((node, index) => node === stateSvg.querySelectorAll('*')[index]) &&
      stateEnclosure === stateSvg.querySelector('[data-part="' + stateCapabilitiesValue.enclosurePartId + '"]'),
    enclosureOpacity: Number(getComputedStyle(stateEnclosure).opacity),
    sharedParts: [...stateSvg.querySelectorAll('[data-part]')]
      .filter(node => sharedNodes.has(node.dataset.part)).map(node => ({ ...statePath(node),
      count: stateSvg.querySelectorAll('[data-part="' + node.dataset.part + '"]').length,
      opacity: Number(getComputedStyle(node).opacity), transform: getComputedStyle(node).transform,
      inStateGroup: node.closest('g[data-state]') !== null,
      ancestorsUnchanged: sharedAncestorsUnchanged(node),
      identity: node === sharedNodes.get(node.dataset.part) })),
    connected: stateButton.isConnected, targetState: stateTarget,
    playback: stateControl?.state, events: stateEvents, nativeClicks: stateNativeClicks,
    target: { width: rectangle?.width, height: rectangle?.height,
      name: native?.getAttribute('aria-label'), type: native?.type,
      iconHidden: stateSvg.getAttribute('aria-hidden'),
      slotHidden: native?.querySelector('slot[name=icon]')?.getAttribute('aria-hidden') },
    statusText: stateStatus.textContent, selected: stateSelect.value };
}
async function settleState() {
  let timer;
  try {
    const completion = await Promise.race([stateCompletion, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('State completion timeout')), 20000);
    })]);
    if (completion?.status !== 'finished') throw new Error('State transition не завершился');
    await new Promise(requestAnimationFrame);
    return { ...readState(), completionStatus: completion.status };
  } finally { clearTimeout(timer); }
}
function staticState(state) {
  const result = render(state);
  if (!result.ok) return result;
  const svg = new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement;
  return { ok: true, paths: statePaths(svg),
    viewBox: svg.getAttribute('viewBox').split(/\\s+/).map(Number),
    dimensions: ['width', 'height'].map(name => Number(svg.getAttribute(name))) };
}
return { readState, changeState, settleState, staticState,
  cleanup: () => { stateControl?.stop(); stateSection.remove(); },
  ready: stateButton.updateComplete.then(() => {
  stateButton.shadowRoot.querySelector('button').addEventListener('click', () => stateNativeClicks++);
  }),
  sizeSamples: () => sizeSamples.map(svg => ({ size: Number(svg.dataset.opticalSize),
    state: svg.dataset.sampleState,
    width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height,
    paths: statePaths(svg), viewBox: svg.getAttribute('viewBox').split(/\\s+/).map(Number) })),
  stateDisposal: async () => ({ connected: stateButton.isConnected,
    completionStatus: (await stateCompletion)?.status, playback: stateControl?.state }),
  pauseState: milliseconds => { stateControl.pause(); if (milliseconds !== undefined) stateControl.seek(milliseconds); return readState(); },
  playState: () => { stateControl.play(); return readState(); },
  stateRefusals: () => ({
    filled: renderStateSvg(stateCapabilitiesValue.defaultState, { variant: 'filled' }),
    nullRequest: compileStateEffect(stateCapabilitiesValue.defaultState, null),
    unknown: render('missing'),
    exports: ['lottie', 'dotlottie', 'sf-symbols'].map(format =>
      exportStateTransition(stateCapabilitiesValue.defaultState, { format, duration: 240 })),
    web: exportStateTransition(stateCapabilitiesValue.states[1].id, { format: 'web-effect', duration: 240 }),
  }),
};
}
const statusConsumer = mountStateConsumer(statusCircle, ${JSON.stringify({
  buttonLabel: STATE_GROUPS['status-circle'].buttonLabel,
  selectLabel: STATE_GROUPS['status-circle'].selectLabel,
  labels: STATE_GROUPS['status-circle'].labels,
})});
const stateConsumers = { 'status-circle': statusConsumer };
const cycleCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { for (const consumer of Object.values(stateConsumers)) consumer.cleanup(); return cycleCleanup(); };
window.__iconsPacked.ready = Promise.all([window.__iconsPacked.ready, statusConsumer.ready]);
window.__iconsPacked.stateConsumers = stateConsumers;
`;

const EXPRESSION_FIXTURE = `
import * as expressionFace from '@labpics/icons/states/expression-face';
const expressionConsumer = mountStateConsumer(expressionFace,
  ${JSON.stringify({
    buttonLabel: STATE_GROUPS['expression-face'].buttonLabel,
    selectLabel: STATE_GROUPS['expression-face'].selectLabel,
    labels: STATE_GROUPS['expression-face'].labels,
    samples: true,
  })});
stateConsumers['expression-face'] = expressionConsumer;
window.__iconsPacked.ready = Promise.all([window.__iconsPacked.ready, expressionConsumer.ready]);
`;

export function consumerFixture(schemaVersion) {
  assert.ok([1, 2, 3, 4, 5, 6].includes(schemaVersion));
  return (
    FIXTURE +
    (schemaVersion >= 2 ? STATE_FIXTURE : '') +
    (schemaVersion >= 3 ? EXPRESSION_FIXTURE : '') +
    (schemaVersion >= 4 ? notificationFixture() : '') +
    (schemaVersion >= 5 ? authoredDotsFixture() : '') +
    (schemaVersion >= 6 ? annulusFixture() : '')
  );
}

function npm(consumer, args) {
  const inherited = process.env.npm_execpath;
  const sibling = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const cli = inherited?.endsWith('npm-cli.js') ? inherited : existsSync(sibling) ? sibling : null;
  return execFileSync(cli ? process.execPath : 'npm', cli ? [cli, ...args] : args, {
    cwd: consumer,
    encoding: 'utf8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function serve(root) {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      assert.equal(outside(relative(root, path)), false);
      const bytes = await readFile(path);
      response.writeHead(200, {
        'content-type':
          { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(path)] ??
          'application/octet-stream',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function samePose(left, right, tolerance = 0.002) {
  assert.equal(left.length, right.length);
  for (const [index, matrix] of left.entries())
    assert.ok(
      matrix.every((value, channel) => Math.abs(value - right[index][channel]) <= tolerance),
      `видимый transform скачет: ${JSON.stringify({ left, right })}`,
    );
}

function sameMotion(effect, gesture, from, to, duration, reduced, variant) {
  assert.equal(effect.version, 1);
  assert.equal(effect.icon, 'reload');
  assert.equal(effect.variant, variant);
  assert.equal(effect.gesture, gesture.id);
  assert.equal(effect.from, from);
  assert.equal(effect.to, to);
  assert.deepEqual(effect.options, {
    duration: reduced ? 0 : duration,
    easing: 'linear',
    fill: 'both',
  });
  assert.deepEqual(effect.viewport, { overflow: 'visible' });
  assert.deepEqual(effect.unchangedPartIds, []);
  assert.deepEqual(
    effect.targets,
    gesture.tracks.map((track) => {
      const start = track.from + (track.to - track.from) * from;
      const end = track.from + (track.to - track.from) * to;
      return {
        partId: track.partId,
        rotation: { from: start, to: end, unit: 'degrees' },
        style: {
          transformBox: 'view-box',
          transformOrigin: `${track.anchor[0] * 100}% ${track.anchor[1] * 100}%`,
        },
        keyframes: [
          { offset: 0, transform: `rotate(${start}deg)` },
          { offset: 1, transform: `rotate(${end}deg)` },
        ],
      };
    }),
  );
}

export function installViewportPointerBlocker(element, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error('Pointer blocker требует конечную точку ввода');
  const document = element.ownerDocument;
  const blocker = document.createElement('div');
  blocker.setAttribute('data-icons-packed-overlay', '');
  const events = [];
  blocker.setAttribute('data-icons-packed-pointer-events', '[]');
  for (const type of ['pointerdown', 'pointerup', 'click'])
    blocker.addEventListener(type, (event) => {
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        target: event.target === blocker,
        button: event.button,
        x: event.clientX,
        y: event.clientY,
      });
      blocker.setAttribute('data-icons-packed-pointer-events', JSON.stringify(events));
    });
  Object.assign(blocker.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'auto',
    zIndex: '2147483647',
  });
  document.body.append(blocker);
  const rectangle = blocker.getBoundingClientRect();
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const witness = {
    width,
    height,
    left: rectangle.left,
    top: rectangle.top,
    right: rectangle.right,
    bottom: rectangle.bottom,
    point: { x: point.x, y: point.y },
    pointHit: document.elementFromPoint(point.x, point.y) === blocker,
  };
  if (
    point.x < rectangle.left ||
    point.y < rectangle.top ||
    point.x >= rectangle.right ||
    point.y >= rectangle.bottom ||
    !witness.pointHit
  )
    throw new Error(`Pointer blocker не перехватывает заданную точку: ${JSON.stringify(witness)}`);
  return witness;
}

export function verifyBlockedPointer(events, point) {
  assert.deepEqual(
    events,
    ['pointerdown', 'pointerup', 'click'].map((type) => ({
      type,
      trusted: true,
      target: true,
      button: 0,
      x: point.x,
      y: point.y,
    })),
    'Overlay должен получить настоящий press/release/click в action point',
  );
}

async function browserProof(browser, url, reference, out, records, browserErrors) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({
      viewport: { width: 640, height: 360 },
      reducedMotion,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (error) => browserErrors.push(error.message));
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__iconsPacked !== undefined);
      await page.evaluate(() => window.__iconsPacked.ready);
      for (const variant of ['outline', 'filled']) {
        const expected = reference.icons.reload[variant];
        const read = () => page.evaluate((id) => window.__iconsPacked.read(id), variant);
        const initial = await read();
        assert.equal(initial.provenance.kind, 'source');
        assert.equal(initial.provenance.file, expected.sourceFile);
        assert.equal(initial.composition, 'layers');
        assert.deepEqual(initial.provenance.author, expected.author);
        assert.deepEqual(initial.provenance.anatomy, expected.anatomy);
        assert.deepEqual(initial.parts, expected.parts);
        assert.deepEqual(initial.viewBox, expected.viewBox);
        assert.deepEqual(
          initial.paths.map(({ d, fillRule }) => ({ d, fillRule })),
          expected.paths,
        );
        assert.deepEqual(
          initial.paths.map(({ id, role }) => ({ id, role })),
          expected.parts.map(({ id, role }) => ({ id, role })),
        );
        assert.deepEqual(initial.capabilities.author, expected.author);
        assert.deepEqual(initial.capabilities.anatomy, expected.anatomy);
        assert.deepEqual(initial.capabilities.motion.gestures, [expected.gesture]);
        assert.deepEqual(initial.capabilities.supportedAxes, []);
        assert.deepEqual(initial.target, {
          width: 48,
          height: 48,
          name: 'Обновить',
          type: 'button',
          iconHidden: 'true',
          slotHidden: 'true',
        });
        const host = page.locator(`lab-button[data-variant="${variant}"]`);
        const button = host.getByRole('button', { name: 'Обновить', exact: true });
        assert.equal(await button.count(), 1, 'native accessible button не найден');
        const other = variant === 'outline' ? 'filled' : 'outline';
        const untouched = await page.evaluate((id) => window.__iconsPacked.read(id), other);
        let pointerControl;
        try {
          // Timeout до hit-test не доказывает перехват. Trial выполняет readiness без клика.
          await host.click({ trial: true });
          const rectangle = await host.boundingBox();
          assert.ok(rectangle && rectangle.width > 0 && rectangle.height > 0);
          const point = {
            x: Math.floor(rectangle.x + rectangle.width / 2),
            y: Math.floor(rectangle.y + rectangle.height / 2),
          };
          const coverage = await host.evaluate(installViewportPointerBlocker, point);
          await page.mouse.click(point.x, point.y);
          const events = JSON.parse(
            await page
              .locator('[data-icons-packed-overlay]')
              .getAttribute('data-icons-packed-pointer-events'),
          );
          verifyBlockedPointer(events, point);
          assert.equal((await read()).nativeClicks, 0);
          pointerControl = { point, coverage, events };
        } finally {
          await page.locator('[data-icons-packed-overlay]').evaluateAll((elements) => {
            for (const element of elements) element.remove();
          });
        }
        // Playwright 1.55 обходит light DOM без assignedSlot: upstream #37777.
        // Host получает обычный pointer-click; native button отдельно подтверждает событие.
        await host.click();
        await host.click({ position: { x: 4, y: initial.target.height / 2 } });
        await button.focus();
        await button.press('Enter');
        await button.press('Space');
        const activated = await read();
        assert.equal(activated.nativeClicks, 4);
        assert.equal(activated.events.length, 4);
        assert.ok(
          activated.events.every((event) => event.trusted && event.composed && event.native),
        );
        for (const event of activated.events)
          sameMotion(
            event.effect,
            expected.gesture,
            0,
            1,
            600,
            reducedMotion === 'reduce',
            variant,
          );
        if (reducedMotion === 'no-preference')
          for (const event of activated.events)
            if (!event.initialize) samePose(event.before, event.after);
        assert.equal(activated.submissions, 0);
        if (reducedMotion === 'no-preference') {
          const forward = await page.evaluate((id) => window.__iconsPacked.settle(id), variant);
          samePose(forward.matrices, initial.matrices);
          records.push({
            name: `${variant}:forward-complete`,
            terminal: forward.matrices,
            completionStatuses: forward.completionStatuses,
          });
          // Прерывание проводится только после наблюдаемого движения, до половины оборота.
          await page.evaluate(
            (id) => window.__iconsPacked.start(id, { initialize: true }),
            variant,
          );
          await page.waitForFunction((id) => {
            const pose = window.__iconsPacked.read(id).matrices[0];
            const phase = Math.atan2(pose[1], pose[0]) / (2 * Math.PI);
            return phase > 0.05 && phase < 0.35;
          }, variant);
          const interrupted = await page.evaluate((id) => {
            const pose = window.__iconsPacked.read(id).matrices[0];
            const from = Math.atan2(pose[1], pose[0]) / (2 * Math.PI);
            return window.__iconsPacked.start(id, { from, to: 0, duration: 240 });
          }, variant);
          assert.ok(interrupted.effect.from > 0.05 && interrupted.effect.from < 0.35);
          sameMotion(
            interrupted.effect,
            expected.gesture,
            interrupted.effect.from,
            0,
            240,
            false,
            variant,
          );
          samePose(interrupted.before, interrupted.after);
          const terminal = await page.evaluate((id) => window.__iconsPacked.settle(id), variant);
          samePose(terminal.matrices, initial.matrices);
          records.push({
            name: `${variant}:interrupt-reverse`,
            effect: interrupted.effect,
            before: interrupted.before,
            after: interrupted.after,
            terminal: terminal.matrices,
          });
        } else {
          const terminal = await page.evaluate((id) => window.__iconsPacked.settle(id), variant);
          samePose(terminal.matrices, initial.matrices);
          const result = await page.evaluate(
            (id) => window.__iconsPacked.start(id, { duration: 600 }),
            variant,
          );
          assert.equal(result.effect.options.duration, 0);
          sameMotion(result.effect, expected.gesture, 0, 1, 600, true, variant);
          records.push({ name: `${variant}:reduced-motion`, effect: result.effect });
        }
        const current = await read();
        assert.deepEqual(current.paths, initial.paths, 'motion изменил authored contours');
        const afterOther = await page.evaluate((id) => window.__iconsPacked.read(id), other);
        assert.equal(afterOther.svg, untouched.svg, 'экземпляр изменил соседний символ');
        assert.deepEqual(afterOther.events, untouched.events);
        const refusal = await page.evaluate((id) => window.__iconsPacked.refuse(id), variant);
        assert.equal(refusal.axis, 'AUTHOR_PARITY_REQUIRED');
        assert.deepEqual(
          { ok: refusal.motion.ok, code: refusal.motion.reason?.code },
          { ok: false, code: 'GESTURE_UNSUPPORTED' },
        );
        records.push({
          name: `${variant}:${reducedMotion}:real-button`,
          target: initial.target,
          pointerControl,
          events: activated.events,
          provenance: initial.provenance,
          refusal,
        });
      }
      for (const stateReference of Object.values(reference.states))
        await stateBrowserProof(page, stateReference, reducedMotion, records);
      if (reference.notifications)
        await notificationBrowserProof(page, reference.notifications, reducedMotion, records);
      if (reference.authoredDots)
        await authoredDotsBrowserProof(page, reference.authoredDots, reducedMotion, records);
      if (reference.annulus)
        await annulusBrowserProof(page, reference.annulus, reducedMotion, records);
      await page.screenshot({ path: join(out, `${reducedMotion}.png`), fullPage: true });
      assert.deepEqual(await page.evaluate(() => window.__iconsPacked.cleanup()), {
        connected: 0,
        runningNativeAnimations: 0,
      });
      for (const group of Object.keys(reference.states)) {
        const disposed = await page.evaluate(
          (group) => window.__iconsPacked.stateConsumers[group].stateDisposal(),
          group,
        );
        assert.equal(disposed.connected, false);
        assert.equal(
          disposed.completionStatus,
          reducedMotion === 'reduce' ? 'finished' : 'stopped',
        );
        records.push({ name: `${group}:${reducedMotion}:dispose`, ...disposed });
      }
      if (reference.notifications)
        for (const icon of ['notifications', 'notifications-unread'])
          for (const variant of ['outline', 'filled']) {
            const id = `${icon}/${variant}`;
            const disposed = await page.evaluate(
              (id) => window.__iconsPacked.notificationConsumers[id].disposal(),
              id,
            );
            assert.equal(disposed.connected, false);
            assert.equal(disposed.playback, reducedMotion === 'reduce' ? 'finished' : 'stopped');
            assert.equal(
              disposed.completionStatus,
              reducedMotion === 'reduce' ? 'finished' : 'stopped',
            );
            records.push({ name: `${id}:${reducedMotion}:dispose`, ...disposed });
          }
      if (reference.authoredDots)
        for (const variant of ['outline', 'filled']) {
          const disposed = await page.evaluate(
            (variant) => window.__iconsPacked.contourConsumers[variant].disposal(),
            variant,
          );
          assert.equal(disposed.connected, false);
          assert.equal(disposed.playback, reducedMotion === 'reduce' ? 'finished' : 'stopped');
          records.push({ name: `ellipsis/${variant}:${reducedMotion}:dispose`, ...disposed });
        }
      if (reference.annulus)
        for (const icon of Object.keys(reference.annulus.icons))
          for (const variant of ['outline', 'filled']) {
            const id = `${icon}/${variant}`;
            const disposed = await page.evaluate(
              (id) => window.__iconsPacked.annulusConsumers[id].disposal(),
              id,
            );
            assert.equal(disposed.connected, false);
            records.push({ name: `${id}:${reducedMotion}:dispose`, ...disposed });
          }
    } catch (error) {
      await page
        .screenshot({ path: join(out, `${reducedMotion}-failure.png`), fullPage: true })
        .catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
}

export function assertNotificationPose(observation, expected, icon, variant, progress) {
  assertNotificationAnatomy(observation, expected, icon, variant);
  assert.deepEqual(
    observation.pose.map((item) => item.partId),
    expected.parts.map((item) => item.id),
  );
  for (const item of observation.pose) {
    const x =
      item.partId === 'notification-clapper'
        ? notificationPosition(expected.amplitude, progress)
        : 0;
    samePose([item.matrix], [[1, 0, 0, 1, x, 0]]);
  }
}

async function notificationBrowserProof(page, reference, reducedMotion, records) {
  const reduced = reducedMotion === 'reduce';
  for (const [icon, label] of [
    ['notifications', 'Входящее уведомление'],
    ['notifications-unread', 'Новое непрочитанное уведомление'],
  ]) {
    for (const variant of ['outline', 'filled']) {
      const id = `${icon}/${variant}`;
      const expected = reference.icons[icon][variant];
      const evaluate = (operation, ...args) =>
        page.evaluate(
          ({ id, operation, args }) =>
            window.__iconsPacked.notificationConsumers[id][operation](...args),
          { id, operation, args },
        );
      const read = () => evaluate('read');
      const matrices = (observation) => observation.pose.map((item) => item.matrix);
      const initial = await read();
      assertNotificationPose(initial, expected, icon, variant, 0);
      assert.deepEqual(initial.target, {
        width: 48,
        height: 48,
        name: label,
        type: 'button',
        iconHidden: 'true',
        slotHidden: 'true',
      });
      for (const [index, size] of [16, 24, 48].entries())
        assert.deepEqual(initial.sizeSamples[index], {
          size,
          width: size,
          height: size,
          viewBox: expected.viewBox,
          paths: expected.paths,
        });
      assert.equal(initial.sizeSamples.length, 3);
      const host = page.locator(`lab-button[data-notification="${id}"]`);
      const button = host.getByRole('button', { name: label, exact: true });
      assert.equal(await button.count(), 1);
      await host.click();
      if (!reduced)
        await page.waitForFunction(
          ({ id, amplitude }) => {
            const current = window.__iconsPacked.notificationConsumers[id].read();
            const x = current.pose.find((item) => item.partId === 'notification-clapper').matrix[4];
            return current.playback === 'running' && Math.abs(x) > amplitude * 0.05;
          },
          { id, amplitude: expected.amplitude },
        );
      await button.focus();
      await button.press('Enter');
      await button.press('Space');
      const activated = await read();
      assertNotificationAnatomy(activated, expected, icon, variant);
      assert.equal(activated.nativeClicks, 3);
      assert.equal(activated.events.length, 3);
      for (const event of activated.events) {
        assert.ok(event.trusted && event.composed && event.native);
        assertNotificationEffect(event.effect, expected, icon, variant, 0, 1, reduced ? 0 : 1000);
        if (!reduced)
          samePose(
            event.before.map((item) => item.matrix),
            event.after.map((item) => item.matrix),
          );
      }
      const terminal = await evaluate('settle');
      assertNotificationPose(terminal, expected, icon, variant, 1);
      assert.equal(terminal.completionStatus, 'finished');
      assert.equal(terminal.knownPhase, 1);
      records.push({
        name: `${id}:${reducedMotion}:trusted-occurrences`,
        events: activated.events,
        target: initial.target,
        source: initial.provenance,
        sizeSamples: initial.sizeSamples,
      });
      if (!reduced) {
        const forward = await evaluate('start', { duration: 1000, initialize: true });
        assertNotificationEffect(forward.effect, expected, icon, variant, 0, 1, 1000);
        const poses = [];
        for (const phase of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
          const observation = await evaluate('pauseAt', phase * 1000);
          assertNotificationPose(observation, expected, icon, variant, phase);
          assert.equal(observation.knownPhase, phase);
          poses.push({ phase, pose: observation.pose });
        }
        const routes = [];
        for (const phase of [0.1, 0.25]) {
          await evaluate('start', { duration: 1000, initialize: true });
          const paused = await evaluate('pauseAt', phase * 1000);
          assertNotificationPose(paused, expected, icon, variant, phase);
          const reverse = await evaluate('start', {
            from: paused.knownPhase,
            to: 0,
            duration: 500,
          });
          assertNotificationEffect(reverse.effect, expected, icon, variant, phase, 0, 500);
          samePose(
            matrices(paused),
            reverse.before.map((item) => item.matrix),
          );
          samePose(
            reverse.before.map((item) => item.matrix),
            reverse.after.map((item) => item.matrix),
          );
          assert.equal(reverse.previousPlayback, 'stopped');
          const reversing = await evaluate('pauseAt', 100);
          assertNotificationPose(reversing, expected, icon, variant, phase * 0.8);
          routes.push({
            from: phase,
            start: paused.pose,
            reverse: reverse.effect,
            intermediate: reversing.pose,
          });
        }
        samePose(
          routes[0].start.map((item) => item.matrix),
          routes[1].start.map((item) => item.matrix),
        );
        const routeX = (route) =>
          route.intermediate.find((item) => item.partId === 'notification-clapper').matrix[4];
        assert.ok(
          routeX(routes[0]) < expected.amplitude / 2 && routeX(routes[1]) > expected.amplitude / 2,
          'Одинаковая координата требует двух разных маршрутов по сохранённой фазе',
        );
        const beforeNew = await read();
        const newer = await evaluate('start', { duration: 800 });
        assertNotificationEffect(newer.effect, expected, icon, variant, 0, 1, 800);
        samePose(
          matrices(beforeNew),
          newer.before.map((item) => item.matrix),
        );
        samePose(
          newer.before.map((item) => item.matrix),
          newer.after.map((item) => item.matrix),
        );
        const interrupted = await evaluate('pauseAt', 320);
        assertNotificationPose(interrupted, expected, icon, variant, 0.4);
        const partial = await evaluate('start', {
          from: interrupted.knownPhase,
          to: 0.7,
          duration: 300,
        });
        assertNotificationEffect(partial.effect, expected, icon, variant, 0.4, 0.7, 300);
        samePose(
          matrices(interrupted),
          partial.before.map((item) => item.matrix),
        );
        samePose(
          partial.before.map((item) => item.matrix),
          partial.after.map((item) => item.matrix),
        );
        assertNotificationPose(await evaluate('pauseAt', 200), expected, icon, variant, 0.6);
        // Новый частичный интервал заканчивается самостоятельно после прерывания.
        const partialEnd = await evaluate('start', { from: 0.6, to: 0.7, duration: 100 });
        assertNotificationEffect(partialEnd.effect, expected, icon, variant, 0.6, 0.7, 100);
        assertNotificationPose(await evaluate('settle'), expected, icon, variant, 0.7);
        records.push({
          name: `${id}:six-stops-reverse-newer-partial`,
          poses,
          routes,
          newer,
          partial,
          partialEnd,
        });
      } else {
        const reducedEnd = await evaluate('start', { from: 0.25, to: 0.6, duration: 800 });
        assertNotificationEffect(reducedEnd.effect, expected, icon, variant, 0.25, 0.6, 0);
        assertNotificationPose(await evaluate('settle'), expected, icon, variant, 0.6);
        records.push({ name: `${id}:reduced-terminal-phase`, effect: reducedEnd.effect });
      }
      const refusal = await evaluate('refuse');
      assert.equal(refusal.axis, 'AUTHOR_PARITY_REQUIRED');
      for (const [key, code] of [
        ['morph', 'GESTURE_UNSUPPORTED'],
        ['off', 'SEMANTIC_MOTION_UNAVAILABLE'],
      ]) {
        assert.equal(refusal[key].ok, false);
        assert.equal(refusal[key].reason.code, code);
      }
      assert.deepEqual(refusal.offPaths, reference.icons['notifications-off'][variant].paths);
      records.push({ name: `${id}:${reducedMotion}:refusals`, refusal });
      const disposing = await evaluate('start', { duration: 1000 });
      assertNotificationEffect(disposing.effect, expected, icon, variant, 0, 1, reduced ? 0 : 1000);
      if (!reduced)
        assertNotificationAnatomy(await evaluate('pauseAt', 200), expected, icon, variant);
      else assertNotificationPose(await evaluate('settle'), expected, icon, variant, 1);
    }
  }
}

export function sameStateOpacity(left, right, witness = null) {
  assert.deepEqual(
    left.map((item) => item.partId),
    right.map((item) => item.partId),
  );
  const differences = left.map((item, index) => ({
    partId: item.partId,
    before: item.value,
    after: right[index].value,
    delta: right[index].value - item.value,
  }));
  for (const difference of differences) {
    try {
      assert.ok(
        Math.abs(difference.delta) <= 0.002,
        `видимая opacity скачет: ${difference.partId}, ${difference.before} -> ${difference.after}, delta=${difference.delta}`,
      );
    } catch (error) {
      error.stateContinuity = { differences, witness };
      throw error;
    }
  }
}

function stateEffect(effect, reference, target, duration) {
  assert.deepEqual(effect, {
    contract: 'labpics.symbol-state-effect/1',
    version: 1,
    kind: 'enclosure-replacement',
    group: reference.group,
    variant: reference.variant,
    targetState: target,
    stages: reference.states.map((state) => ({
      partId: state.partId,
      property: 'opacity',
      to: state.id === target ? 1 : 0,
      at: 0,
      duration,
    })),
    unchangedPartIds: reference.sharedPartIds ?? [reference.enclosurePartId],
    options: { duration, easing: 'linear', fill: 'both' },
  });
}

export function stateCapabilitiesReference(reference) {
  return {
    group: reference.group,
    variant: reference.variant,
    defaultState: reference.defaultState,
    transition: 'enclosure-replacement',
    morph: 'unavailable',
    enclosurePartId: reference.enclosurePartId,
    ...(reference.sharedPartIds ? { sharedPartIds: reference.sharedPartIds } : {}),
    states: reference.states.map(({ id, partId, icon, contentPartIds, author }) => ({
      id,
      partId,
      icon,
      contentPartIds,
      author,
    })),
    formats: { static: ['svg'], transition: ['web-effect'] },
    proof: reference.proof,
  };
}

function sharedStateParts(reference) {
  return (
    reference.sharedParts ?? [
      { ...reference.enclosure, id: reference.enclosurePartId, role: 'container' },
    ]
  );
}

export function staticStatePathsReference(reference, state) {
  const shared = sharedStateParts(reference);
  return state.paths.map((path, index) => ({
    ...path,
    fill: 'currentColor',
    partId:
      index < state.contentPartIds.length
        ? state.contentPartIds[index]
        : shared[index - state.contentPartIds.length].id,
    role:
      index < state.contentPartIds.length
        ? 'content'
        : shared[index - state.contentPartIds.length].role,
  }));
}

// Raw author reference определяет части независимо от установленного renderer.
export function assertStateAnatomy(observation, reference) {
  assert.deepEqual(observation.viewBox, [0, 0, 24, 24]);
  assert.deepEqual(observation.dimensions, [24, 24]);
  assert.equal(observation.identity, true);
  assert.deepEqual(
    observation.groups,
    reference.states.map((state) => ({
      id: state.id,
      partId: state.partId,
      role: 'state',
      paths: staticStatePathsReference(reference, state).slice(0, state.contentPartIds.length),
    })),
  );
  assert.deepEqual(observation.enclosure, {
    ...reference.enclosure,
    fill: 'currentColor',
    partId: reference.enclosurePartId,
    role: 'container',
  });
  assert.equal(observation.enclosureCount, 1);
  assert.equal(observation.enclosureOpacity, 1);
  assert.deepEqual(
    observation.sharedParts,
    sharedStateParts(reference).map(({ id, ...part }) => ({
      ...part,
      fill: 'currentColor',
      partId: id,
      count: 1,
      opacity: 1,
      transform: 'none',
      inStateGroup: false,
      ancestorsUnchanged: true,
      identity: true,
    })),
  );
}

async function stateBrowserProof(page, reference, reducedMotion, records) {
  const evaluate = (operation, ...args) =>
    page.evaluate(
      ({ group, operation, args }) =>
        window.__iconsPacked.stateConsumers[group][operation](...args),
      { group: reference.group, operation, args },
    );
  const read = () => evaluate('readState');
  const contract = stateReferenceContract(reference.group);
  const alternatives = reference.states.filter((state) => state.id !== reference.defaultState);
  const [first, second] = alternatives;
  const selectedTarget = alternatives.at(-1).id;
  const initial = await read();
  assert.deepEqual(initial.capabilities, stateCapabilitiesReference(reference));
  assertStateAnatomy(initial, reference);
  const oneHot = (observation, target) => {
    assert.equal(observation.targetState, target);
    assert.equal(observation.selected, target);
    assert.equal(observation.statusText, contract.labels[target]);
    assert.deepEqual(
      observation.opacity,
      reference.states.map((state) => ({
        partId: state.partId,
        value: state.id === target ? 1 : 0,
      })),
    );
    assertStateAnatomy(observation, reference);
  };
  oneHot(initial, reference.defaultState);
  assert.deepEqual(initial.target, {
    width: 48,
    height: 48,
    name: contract.buttonLabel,
    type: 'button',
    iconHidden: 'true',
    slotHidden: 'true',
  });
  const host = page.locator(`lab-button[data-state-group="${reference.group}"]`);
  const button = host.getByRole('button', { name: contract.buttonLabel, exact: true });
  assert.equal(await button.count(), 1);
  await host.click();
  await button.focus();
  await button.press('Enter');
  await button.press('Space');
  const activated = await read();
  assertStateAnatomy(activated, reference);
  assert.equal(activated.nativeClicks, 3);
  assert.ok(activated.events.every((event) => event.trusted && event.composed && event.native));
  assert.equal(activated.events.length, 3);
  records.push({
    name: `${reference.group}:${reducedMotion}:trusted-activation`,
    events: activated.events,
  });
  for (const [index, event] of activated.events.entries()) {
    stateEffect(
      event.effect,
      reference,
      event.effect.targetState,
      reducedMotion === 'reduce' ? 0 : 600,
    );
    if (reducedMotion === 'no-preference')
      sameStateOpacity(event.before, event.after, { eventIndex: index, ...event });
  }
  await page.getByRole('combobox', { name: contract.selectLabel }).selectOption(selectedTarget);
  oneHot(await evaluate('settleState'), selectedTarget);
  for (const state of reference.states) {
    const svg = await evaluate('staticState', state.id);
    assert.equal(svg.ok, true);
    assert.deepEqual(svg.viewBox, state.viewBox);
    assert.deepEqual(svg.dimensions, state.dimensions);
    assert.deepEqual(svg.paths, staticStatePathsReference(reference, state));
    const result = await evaluate('changeState', state.id, 160);
    stateEffect(result.effect, reference, state.id, reducedMotion === 'reduce' ? 0 : 160);
    const terminal = await evaluate('settleState');
    assert.equal(terminal.completionStatus, 'finished');
    oneHot(terminal, state.id);
    records.push({
      name: `${reference.group}:${state.id}:${reducedMotion}`,
      source: state.author,
      effect: result.effect,
      terminal: terminal.opacity,
      identity: terminal.identity,
      sharedParts: terminal.sharedParts,
    });
  }
  if (reducedMotion === 'no-preference') {
    await evaluate('changeState', reference.defaultState, 0);
    await evaluate('settleState');
    await evaluate('changeState', first.id, 800);
    const paused = await evaluate('pauseState', 280);
    assertStateAnatomy(paused, reference);
    assert.equal(paused.playback, 'paused');
    const mark = paused.opacity.find((item) => item.partId === first.partId).value;
    assert.ok(mark > 0.15 && mark < 0.6, 'прерывание требует видимой промежуточной позы');
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    sameStateOpacity(paused.opacity, (await read()).opacity);
    const resumed = await evaluate('playState');
    assertStateAnatomy(resumed, reference);
    assert.equal(resumed.playback, 'running');
    await evaluate('pauseState', 280);
    const reverse = await evaluate('changeState', reference.defaultState, 300);
    sameStateOpacity(paused.opacity, reverse.before);
    sameStateOpacity(reverse.before, reverse.after, reverse.continuity);
    stateEffect(reverse.effect, reference, reference.defaultState, 300);
    const reversing = await evaluate('pauseState', 90);
    assertStateAnatomy(reversing, reference);
    const newer = await evaluate('changeState', second.id, 300);
    sameStateOpacity(reversing.opacity, newer.before);
    sameStateOpacity(newer.before, newer.after, newer.continuity);
    const mixture = await evaluate('pauseState', 120);
    assertStateAnatomy(mixture, reference);
    assert.equal(
      mixture.opacity.filter((item) => item.value > 0.01).length,
      3,
      'третье намерение должно сохранить всю прежнюю смесь',
    );
    const latest = await evaluate('changeState', first.id, 200);
    sameStateOpacity(mixture.opacity, latest.before);
    sameStateOpacity(latest.before, latest.after, latest.continuity);
    stateEffect(newer.effect, reference, second.id, 300);
    stateEffect(latest.effect, reference, first.id, 200);
    oneHot(await evaluate('settleState'), first.id);
    records.push({
      name: `${reference.group}:paused-reverse-newer-state`,
      paused: paused.opacity,
      reverse,
      newer,
      mixture: mixture.opacity,
      latest,
    });
  }
  if (reference.group === 'expression-face') {
    const samples = await evaluate('sizeSamples');
    assert.equal(samples.length, reference.states.length * 3);
    for (const [index, state] of reference.states.entries())
      for (const [offset, size] of [16, 24, 48].entries())
        assert.deepEqual(samples[index * 3 + offset], {
          state: state.id,
          size,
          width: size,
          height: size,
          viewBox: state.viewBox,
          paths: staticStatePathsReference(reference, state),
        });
    records.push({ name: `${reference.group}:${reducedMotion}:author-size-samples`, samples });
  }
  const refusal = await evaluate('stateRefusals');
  for (const [key, code] of [
    ['filled', 'VARIANT_UNSUPPORTED'],
    ['nullRequest', 'INVALID_REQUEST'],
    ['unknown', 'STATE_UNSUPPORTED'],
  ]) {
    assert.equal(refusal[key].ok, false);
    assert.equal(refusal[key].reason.code, code);
  }
  for (const result of refusal.exports) {
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'FORMAT_UNSUPPORTED');
  }
  assert.equal(refusal.web.ok, true);
  stateEffect(refusal.web.effect, reference, reference.states[1].id, 240);
  records.push({ name: `${reference.group}:${reducedMotion}:public-refusals`, refusal });
  const disposing = await evaluate('changeState', selectedTarget, 1000);
  stateEffect(disposing.effect, reference, selectedTarget, reducedMotion === 'reduce' ? 0 : 1000);
  if (reducedMotion === 'no-preference')
    assertStateAnatomy(await evaluate('pauseState', 200), reference);
}

export async function main(args = process.argv.slice(2)) {
  assertSelfHostedRunner();
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(
      [
        '--icons-tarball',
        '--ui-core-tarball',
        '--ui-shadow-tarball',
        '--subject',
        '--out',
        '--browser-channel',
      ].includes(args[index]),
      args[index],
    );
    assert.ok(args[index + 1] && !options.has(args[index]), `missing or duplicate ${args[index]}`);
    options.set(args[index], args[index + 1]);
  }
  assert.ok(
    ['--icons-tarball', '--ui-core-tarball', '--ui-shadow-tarball', '--subject', '--out'].every(
      (key) => options.has(key),
    ),
    'Нужны три tarball, --subject и новый --out',
  );
  const out = resolve(options.get('--out'));
  assert.ok(outside(relative(ROOT, out)), 'Отчёт должен находиться вне checkout');
  assert.ok(
    outside(relative(await realpath(ROOT), await realpath(dirname(out)))),
    'Родитель отчёта через symlink находится внутри checkout',
  );
  await mkdir(out, { recursive: false });
  const started = new Date().toISOString();
  const records = [];
  const browserErrors = [];
  const receipt = { schemaVersion: 1, started, outcome: 'running', records };
  let consumer;
  let browser;
  let server;
  let proofTimer;
  let failure;
  const cleanupErrors = [];
  let phase = 'subject';
  try {
    const subjectBytes = await readFile(resolve(options.get('--subject')));
    const subject = validateSubject(JSON.parse(subjectBytes));
    const fixture = consumerFixture(subject.schemaVersion);
    const requiredEntries = consumerPublicEntries(subject.schemaVersion);
    receipt.subject = subject;
    receipt.subjectSha256 = hash(subjectBytes);
    const source = (args) =>
      execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 20_000 }).trim();
    const harnessBytes = await readFile(fileURLToPath(import.meta.url));
    const harnessFiles = await Promise.all(
      [
        'icons-packed.mjs',
        'icons-notification-consumer.mjs',
        'icons-authored-dots-consumer.mjs',
        'icons-annulus-consumer.mjs',
      ].map(async (file) => ({
        file: `apps/docs/tests/${file}`,
        sha256: hash(await readFile(new URL(file, import.meta.url))),
      })),
    );
    receipt.harness = {
      commit: source(['rev-parse', 'HEAD']),
      sourceSha256: hash(harnessBytes),
      dirty: source(['status', '--porcelain']) !== '',
      diffSha256: hash(execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT })),
      files: harnessFiles,
    };
    receipt.runner = {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      environment: process.env.RUNNER_ENVIRONMENT,
      name: process.env.RUNNER_NAME,
      os: process.env.RUNNER_OS,
    };
    phase = 'archive snapshots';
    consumer = await mkdtemp(join(tmpdir(), 'labui-icons-consumer-'));
    assert.ok(outside(relative(ROOT, await realpath(consumer))));
    const archives = [];
    for (const [key, option] of [
      ['icons', '--icons-tarball'],
      ['uiCore', '--ui-core-tarball'],
      ['uiShadow', '--ui-shadow-tarball'],
    ]) {
      archives.push(
        await snapshotArchive(consumer, key, resolve(options.get(option)), subject.packages[key]),
      );
    }
    receipt.archives = archives.map(({ path, ...archive }) => ({
      ...archive,
      snapshot: relative(consumer, path).replaceAll('\\', '/'),
    }));
    await writeFile(
      join(consumer, 'package.json'),
      `${JSON.stringify({ private: true, type: 'module' })}\n`,
    );
    phase = 'install';
    await writeFile(
      join(out, 'npm-install.log'),
      npm(consumer, [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        ...archives.map((item) => item.path),
        '@labpics/motion@0.5.0',
      ]),
    );
    await writeFile(join(out, 'dependency-tree.json'), npm(consumer, ['ls', '--all', '--json']));
    const lockBytes = await readFile(join(consumer, 'package-lock.json'));
    const lock = JSON.parse(lockBytes);
    await writeFile(join(out, 'package-lock.json'), lockBytes);
    receipt.lockfileSha256 = hash(lockBytes);
    receipt.installed = [];
    for (const expected of [
      ...Object.values(subject.packages),
      { name: '@labpics/motion', version: '0.5.0' },
    ]) {
      const path = join(consumer, 'node_modules', expected.name, 'package.json');
      assert.ok(
        !outside(relative(consumer, await realpath(path))),
        'package resolution вышла из clean consumer',
      );
      const bytes = await readFile(path);
      const manifest = JSON.parse(bytes);
      assert.equal(manifest.name, expected.name);
      assert.equal(manifest.version, expected.version);
      assert.ok(
        Object.values(manifest.dependencies ?? {}).every(
          (value) => !value.startsWith('workspace:'),
        ),
      );
      const locked =
        lock.packages?.[`node_modules/${expected.name}`] ??
        lock.dependencies?.[expected.name] ??
        {};
      const archive = archives.find((item) => subject.packages[item.key].name === expected.name);
      if (archive && locked.integrity !== undefined) {
        assert.ok(
          typeof locked.integrity === 'string' &&
            locked.integrity.split(/\s+/).includes(archive.integrity),
          `${expected.name}: installed lock integrity не совпадает со snapshot`,
        );
      }
      receipt.installed.push({
        name: manifest.name,
        version: manifest.version,
        manifestSha256: hash(bytes),
        lockIntegrity: locked.integrity ?? null,
        lockResolved: locked.resolved ?? null,
      });
    }
    await writeFile(join(consumer, 'index.html'), HTML);
    await writeFile(join(consumer, 'consumer.mjs'), fixture);
    if (subject.schemaVersion >= 5) {
      phase = 'public types';
      const typeFixture =
        authoredDotsTypeFixture() + (subject.schemaVersion >= 6 ? annulusTypeFixture() : '');
      await writeFile(join(consumer, 'consumer.ts'), typeFixture);
      await writeFile(
        join(consumer, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            types: [],
            lib: ['ES2022', 'DOM'],
          },
          files: ['consumer.ts'],
        }),
      );
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const compiler = require.resolve('typescript/lib/tsc.js');
      let result;
      try {
        result = execFileSync(
          process.execPath,
          [compiler, '--project', join(consumer, 'tsconfig.json')],
          { cwd: consumer, encoding: 'utf8', timeout: 20_000 },
        );
      } catch (error) {
        const diagnostics = `${error.stdout ?? ''}${error.stderr ?? ''}`;
        await writeFile(join(out, 'public-types.log'), diagnostics);
        throw new Error(`Public NodeNext consumer failed: ${diagnostics}`, { cause: error });
      }
      await writeFile(join(out, 'public-types.log'), result);
      receipt.types = {
        outcome: 'passed',
        compilerVersion: require('typescript/package.json').version,
        fixtureSha256: hash(typeFixture),
        resolution: 'NodeNext',
        negativeControls: (typeFixture.match(/@ts-expect-error/g) ?? []).length,
      };
    }
    phase = 'build';
    // Зависимости tooling загружаются только после запрета локального heavy run.
    const { build } = await import('vite');
    const { chromium } = await import('@playwright/test');
    const modules = new Set();
    const bundles = [];
    const publicEntries = {};
    const imports = new Map();
    const publicImports = new Set();
    await build({
      configFile: false,
      root: consumer,
      logLevel: 'warn',
      plugins: [
        {
          name: 'icons-packed-identity',
          enforce: 'pre',
          resolveId(source) {
            publicImports.add(source);
            assertIconsImport(source);
            return null;
          },
          async buildStart() {
            for (const specifier of requiredEntries) {
              const entry = await this.resolve(specifier, join(consumer, 'consumer.mjs'));
              assert.ok(entry && !entry.external, `entry не разрешён в consumer: ${specifier}`);
              publicEntries[specifier] = entry.id;
            }
          },
          generateBundle(_options, output) {
            for (const id of this.getModuleIds()) {
              const info = this.getModuleInfo(id);
              imports.set(id, [...info.importedIds, ...info.dynamicallyImportedIds]);
            }
            for (const item of Object.values(output)) {
              const bytes = Buffer.from(item.type === 'chunk' ? item.code : item.source);
              bundles.push({
                file: item.fileName,
                sha256: hash(bytes),
                raw: bytes.length,
                gzip: gzipSync(bytes).length,
                brotli: brotliCompressSync(bytes).length,
              });
              if (item.type === 'chunk')
                for (const id of Object.keys(item.modules)) modules.add(id);
            }
          },
        },
      ],
      build: { outDir: join(out, 'bundle'), emptyOutDir: false },
    });
    const moduleGraph = assertConsumerModuleGraph(
      consumer,
      modules,
      publicEntries,
      imports,
      publicImports,
      requiredEntries,
    );
    receipt.consumer = {
      fixtureSha256: hash(fixture),
      htmlSha256: hash(HTML),
      publicEntries: Object.fromEntries(
        Object.entries(publicEntries).map(([specifier, id]) => [
          specifier,
          relative(consumer, id).replaceAll('\\', '/'),
        ]),
      ),
      moduleGraph,
      bundles,
      scenario: `LabUI icon-only buttons, reload Outline/Filled${subject.schemaVersion >= 2 ? ', status-circle' : ''}${subject.schemaVersion >= 3 ? ', expression-face' : ''}${subject.schemaVersion >= 4 ? ', notifications/unread Outline/Filled и off controls' : ''}${subject.schemaVersion >= 5 ? ', authored ellipsis variation и contour transition Outline/Filled' : ''}${subject.schemaVersion >= 6 ? ', plus/minus Outline обрамление и независимые Filled masters' : ''}; публичный Lab Motion, размер полного consumer без baseline speedup claim`,
    };
    await writeFile(join(out, 'module-graph.json'), `${JSON.stringify(moduleGraph, null, 2)}\n`);
    await writeFile(join(out, 'bundle-sizes.json'), `${JSON.stringify(bundles, null, 2)}\n`);
    phase = 'browser';
    server = await serve(join(out, 'bundle'));
    browser = await chromium.launch({
      headless: true,
      ...(options.has('--browser-channel') ? { channel: options.get('--browser-channel') } : {}),
    });
    receipt.runner.browser = browser.version();
    await Promise.race([
      browserProof(
        browser,
        `http://127.0.0.1:${server.address().port}`,
        {
          ...subject.authorReference,
          states: subjectStateReferences(subject),
          notifications: subject.notificationReference,
          authoredDots: subject.authoredDotsReference,
          annulus: subject.annulusReference,
        },
        out,
        records,
        browserErrors,
      ),
      new Promise((_, reject) => {
        proofTimer = setTimeout(
          () => reject(new Error('icons-packed browser proof timeout')),
          120_000,
        );
      }),
    ]);
    clearTimeout(proofTimer);
    assert.deepEqual(browserErrors, []);
    assert.equal(source(['rev-parse', 'HEAD']), receipt.harness.commit);
    assert.equal(
      hash(await readFile(fileURLToPath(import.meta.url))),
      receipt.harness.sourceSha256,
    );
    for (const file of receipt.harness.files)
      assert.equal(
        hash(await readFile(join(ROOT, file.file))),
        file.sha256,
        `Изменён source harness: ${file.file}`,
      );
    receipt.outcome = 'passed';
    receipt.qualification =
      'Три заданных архива и публичный Motion установлены в отдельный consumer. Producer sourceCommit — входное утверждение; публикация и полная оптическая приёмка этим запуском не доказаны.';
  } catch (error) {
    receipt.outcome = 'failed';
    receipt.failure = {
      phase,
      browserErrors,
      message: String(error?.stack ?? error),
      ...(error?.stateContinuity ? { stateContinuity: error.stateContinuity } : {}),
    };
    failure = error;
  } finally {
    clearTimeout(proofTimer);
    try {
      await browser?.close();
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    try {
      if (server)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    try {
      if (consumer) {
        const resolved = await realpath(consumer);
        assert.equal(dirname(resolved), await realpath(tmpdir()));
        assert.ok(basename(resolved).startsWith('labui-icons-consumer-'));
        await rm(resolved, { recursive: true, force: true });
      }
    } catch (error) {
      cleanupErrors.push(String(error));
    }
    if (cleanupErrors.length) {
      receipt.outcome = 'failed';
      receipt.cleanupErrors = cleanupErrors;
    }
    receipt.completed = new Date().toISOString();
    await writeFile(join(out, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.outcome === 'failed')
      await writeFile(join(out, 'failure.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.outcome === 'passed')
      process.stdout.write(`icons-packed: passed, ${records.length} observations\n`);
  }
  if (failure) throw failure;
  if (cleanupErrors.length) throw new Error(`icons-packed cleanup: ${cleanupErrors.join('; ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
