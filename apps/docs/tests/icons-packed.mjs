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

export function assertIconsImport(source) {
  if (!/^@labpics\/icons(?:\/|$)/.test(source)) return;
  assert.ok(
    [
      '@labpics/icons/symbols/reload',
      '@labpics/icons/ir/render',
      '@labpics/icons/motion',
      STATE_ENTRY,
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
  assert.ok([1, 2].includes(subject?.schemaVersion));
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
  if (subject.schemaVersion === 2) validateStateReference(subject.stateReference, reference);
  else assert.equal(subject.stateReference, undefined);
  return subject;
}

export function validateStateReference(reference, author) {
  assert.equal(reference?.group, 'status-circle');
  assert.equal(reference.variant, 'outline');
  assert.equal(reference.defaultState, 'question');
  assert.equal(reference.enclosurePartId, 'status-enclosure');
  assert.deepEqual(reference.proof?.source, { fileKey: author.fileKey, version: author.version });
  assert.equal(reference.proof.law, 'enclosure.replace');
  assert.match(reference.proof.specSha256, HASH);
  assert.match(reference.proof.enclosureSha256, HASH);
  assert.deepEqual(
    reference.states.map((state) => state.id),
    ['attention', 'confirmation', 'decrease', 'dismissal', 'increase', 'question'],
  );
  const ids = new Set([reference.enclosurePartId]);
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
    assert.equal(state.contentPartIds.length, state.paths.length - 1);
    for (const part of [state.partId, ...state.contentPartIds]) {
      assert.match(part, /^[a-z][a-z0-9-]*$/);
      assert.ok(!ids.has(part));
      ids.add(part);
    }
    assert.deepEqual(state.paths.at(-1), reference.enclosure);
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
import { render, renderStateSvg, compileStateEffect, stateCapabilities, exportStateTransition }
  from '@labpics/icons/states/status-circle';
import { sequence } from '@labpics/motion';

const stateCapabilitiesValue = stateCapabilities();
const stateLabels = { attention: 'Внимание', confirmation: 'Подтверждение', decrease: 'Уменьшение',
  dismissal: 'Закрытие', increase: 'Увеличение', question: 'Вопрос' };
const stateSection = document.createElement('section');
stateSection.setAttribute('aria-labelledby', 'state-heading');
const stateHeading = document.createElement('h2');
stateHeading.id = 'state-heading'; stateHeading.textContent = 'Сменить знак';
const stateSample = document.createElement('div'); stateSample.className = 'state-sample';
const stateButton = document.createElement('lab-button');
for (const [name, value] of Object.entries({ size: 'l', icon: '', type: 'neutral',
  'aria-label': 'Сменить знак', 'data-status-circle': '' })) stateButton.setAttribute(name, value);
const initialState = renderStateSvg(stateCapabilitiesValue.defaultState);
if (!initialState.ok) throw new Error(initialState.reason.code);
stateButton.innerHTML = initialState.svg;
const stateSvg = stateButton.querySelector('svg');
stateSvg.setAttribute('slot', 'icon'); stateSvg.setAttribute('aria-hidden', 'true');
stateSvg.setAttribute('focusable', 'false');
const stateNodes = new Map([...stateSvg.querySelectorAll('g[data-state][data-part]')]
  .map(node => [node.dataset.part, node]));
const stateEnclosure = stateSvg.querySelector('[data-part="' + stateCapabilitiesValue.enclosurePartId + '"]');
const originalStateNodes = [...stateSvg.querySelectorAll('*')];
const stateSelect = document.createElement('select');
stateSelect.setAttribute('aria-label', 'Состояние знака');
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
  return [...svg.querySelectorAll('path')].map(node => ({ d: node.getAttribute('d'),
    fillRule: node.getAttribute('fill-rule') ?? 'nonzero', fill: node.getAttribute('fill'),
    partId: node.dataset.part, role: node.dataset.role }));
}
function changeState(state, duration = 600) {
  const result = compileStateEffect(state, { duration,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
  if (!result.ok) throw new Error(result.reason.code);
  const effect = result.effect;
  // Снимки сохраняют clock и native keyframes, не меняя ход анимации.
  const before = stateOpacityWitness(); const previous = stateControl;
  const next = sequence(effect.stages.map(stage => {
    const node = stateNodes.get(stage.partId);
    if (!node) throw new Error('Потеряна группа ' + stage.partId);
    return [node, { opacity: stage.to },
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
    groups: [...stateNodes.values()].map(node => ({ id: node.dataset.state,
      partId: node.dataset.part, role: node.dataset.role, paths: statePaths(node) })),
    enclosure: statePaths(stateSvg).at(-1), enclosureCount:
      stateSvg.querySelectorAll('[data-part="' + stateCapabilitiesValue.enclosurePartId + '"]').length,
    identity: originalStateNodes.length === stateSvg.querySelectorAll('*').length &&
      originalStateNodes.every((node, index) => node === stateSvg.querySelectorAll('*')[index]) &&
      stateEnclosure === stateSvg.querySelector('[data-part="' + stateCapabilitiesValue.enclosurePartId + '"]'),
    enclosureOpacity: Number(getComputedStyle(stateEnclosure).opacity),
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
const cycleCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { stateControl?.stop(); stateSection.remove(); return cycleCleanup(); };
const cycleReady = window.__iconsPacked.ready;
window.__iconsPacked.ready = Promise.all([cycleReady, stateButton.updateComplete.then(() => {
  stateButton.shadowRoot.querySelector('button').addEventListener('click', () => stateNativeClicks++);
})]);
Object.assign(window.__iconsPacked, { readState, changeState, settleState, staticState,
  stateDisposal: async () => ({ connected: stateButton.isConnected,
    completionStatus: (await stateCompletion)?.status, playback: stateControl?.state }),
  pauseState: milliseconds => { stateControl.pause(); if (milliseconds !== undefined) stateControl.seek(milliseconds); return readState(); },
  playState: () => { stateControl.play(); return readState(); },
  stateRefusals: () => ({
    filled: renderStateSvg('question', { variant: 'filled' }),
    nullRequest: compileStateEffect('question', null),
    unknown: render('missing'),
    exports: ['lottie', 'dotlottie', 'sf-symbols'].map(format =>
      exportStateTransition('question', { format, duration: 240 })),
    web: exportStateTransition('confirmation', { format: 'web-effect', duration: 240 }),
  }),
});
`;

export function consumerFixture(schemaVersion) {
  assert.ok([1, 2].includes(schemaVersion));
  return FIXTURE + (schemaVersion === 2 ? STATE_FIXTURE : '');
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
        await host.evaluate((element) => {
          const rectangle = element.getBoundingClientRect();
          const blocker = document.createElement('div');
          blocker.setAttribute('data-icons-packed-overlay', '');
          Object.assign(blocker.style, {
            position: 'fixed',
            left: `${rectangle.x}px`,
            top: `${rectangle.y}px`,
            width: `${rectangle.width}px`,
            height: `${rectangle.height}px`,
            zIndex: '2147483647',
          });
          document.body.append(blocker);
        });
        try {
          await assert.rejects(host.click({ timeout: 750 }), (error) => {
            assert.match(error.message, /intercepts pointer events/);
            assert.match(error.message, /data-icons-packed-overlay/);
            return true;
          });
          assert.equal((await read()).nativeClicks, 0);
        } finally {
          await page.locator('[data-icons-packed-overlay]').evaluate((element) => element.remove());
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
          events: activated.events,
          provenance: initial.provenance,
          refusal,
        });
      }
      if (reference.states) await stateBrowserProof(page, reference.states, reducedMotion, records);
      await page.screenshot({ path: join(out, `${reducedMotion}.png`), fullPage: true });
      assert.deepEqual(await page.evaluate(() => window.__iconsPacked.cleanup()), {
        connected: 0,
        runningNativeAnimations: 0,
      });
      if (reference.states) {
        const disposed = await page.evaluate(() => window.__iconsPacked.stateDisposal());
        assert.equal(disposed.connected, false);
        assert.equal(
          disposed.completionStatus,
          reducedMotion === 'reduce' ? 'finished' : 'stopped',
        );
        records.push({ name: `status-circle:${reducedMotion}:dispose`, ...disposed });
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
    unchangedPartIds: [reference.enclosurePartId],
    options: { duration, easing: 'linear', fill: 'both' },
  });
}

async function stateBrowserProof(page, reference, reducedMotion, records) {
  const read = () => page.evaluate(() => window.__iconsPacked.readState());
  const initial = await read();
  assert.deepEqual(initial.capabilities, {
    group: reference.group,
    variant: reference.variant,
    defaultState: reference.defaultState,
    transition: 'enclosure-replacement',
    morph: 'unavailable',
    enclosurePartId: reference.enclosurePartId,
    states: reference.states.map(({ id, partId, icon, contentPartIds, author }) => ({
      id,
      partId,
      icon,
      contentPartIds,
      author,
    })),
    formats: { static: ['svg'], transition: ['web-effect'] },
    proof: reference.proof,
  });
  assert.deepEqual(initial.viewBox, [0, 0, 24, 24]);
  assert.deepEqual(initial.dimensions, [24, 24]);
  const enclosure = {
    ...reference.enclosure,
    fill: 'currentColor',
    partId: reference.enclosurePartId,
    role: 'container',
  };
  assert.deepEqual(initial.enclosure, enclosure);
  assert.equal(initial.enclosureCount, 1);
  assert.equal(initial.enclosureOpacity, 1);
  assert.equal(initial.identity, true);
  assert.deepEqual(
    initial.groups,
    reference.states.map((state) => ({
      id: state.id,
      partId: state.partId,
      role: 'state',
      paths: state.paths
        .slice(0, -1)
        .map((path, index) => ({
          ...path,
          fill: 'currentColor',
          partId: state.contentPartIds[index],
          role: 'content',
        })),
    })),
  );
  const oneHot = (observation, target) => {
    assert.equal(observation.targetState, target);
    assert.equal(observation.selected, target);
    assert.deepEqual(
      observation.opacity,
      reference.states.map((state) => ({
        partId: state.partId,
        value: state.id === target ? 1 : 0,
      })),
    );
    assert.equal(observation.identity, true);
    assert.equal(observation.enclosureCount, 1);
    assert.equal(observation.enclosureOpacity, 1);
    assert.deepEqual(observation.enclosure, enclosure);
    assert.deepEqual(observation.groups, initial.groups);
  };
  oneHot(initial, reference.defaultState);
  assert.deepEqual(initial.target, {
    width: 48,
    height: 48,
    name: 'Сменить знак',
    type: 'button',
    iconHidden: 'true',
    slotHidden: 'true',
  });
  const host = page.locator('lab-button[data-status-circle]');
  const button = host.getByRole('button', { name: 'Сменить знак', exact: true });
  assert.equal(await button.count(), 1);
  await host.click();
  await button.focus();
  await button.press('Enter');
  await button.press('Space');
  const activated = await read();
  assert.equal(activated.nativeClicks, 3);
  assert.ok(activated.events.every((event) => event.trusted && event.composed && event.native));
  assert.equal(activated.events.length, 3);
  records.push({ name: `status-circle:${reducedMotion}:trusted-activation`, events: activated.events });
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
  await page.getByRole('combobox', { name: 'Состояние знака' }).selectOption('increase');
  oneHot(await page.evaluate(() => window.__iconsPacked.settleState()), 'increase');
  assert.equal((await read()).statusText, 'Увеличение');
  for (const state of reference.states) {
    const svg = await page.evaluate((id) => window.__iconsPacked.staticState(id), state.id);
    assert.equal(svg.ok, true);
    assert.deepEqual(svg.viewBox, state.viewBox);
    assert.deepEqual(svg.dimensions, state.dimensions);
    assert.deepEqual(
      svg.paths,
      state.paths.map((path, index) => ({
        ...path,
        fill: 'currentColor',
        partId:
          index === state.paths.length - 1
            ? reference.enclosurePartId
            : state.contentPartIds[index],
        role: index === state.paths.length - 1 ? 'container' : 'content',
      })),
    );
    const result = await page.evaluate((id) => window.__iconsPacked.changeState(id, 160), state.id);
    stateEffect(result.effect, reference, state.id, reducedMotion === 'reduce' ? 0 : 160);
    const terminal = await page.evaluate(() => window.__iconsPacked.settleState());
    assert.equal(terminal.completionStatus, 'finished');
    oneHot(terminal, state.id);
    records.push({
      name: `status-circle:${state.id}:${reducedMotion}`,
      source: state.author,
      effect: result.effect,
      terminal: terminal.opacity,
      identity: terminal.identity,
    });
  }
  if (reducedMotion === 'no-preference') {
    await page.evaluate(() => window.__iconsPacked.changeState('question', 0));
    await page.evaluate(() => window.__iconsPacked.settleState());
    await page.evaluate(() => window.__iconsPacked.changeState('confirmation', 800));
    const paused = await page.evaluate(() => window.__iconsPacked.pauseState(280));
    assert.equal(paused.playback, 'paused');
    const mark = paused.opacity.find((item) => item.partId === 'state-confirmation').value;
    assert.ok(mark > 0.15 && mark < 0.6, 'прерывание требует видимой промежуточной позы');
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    });
    sameStateOpacity(paused.opacity, (await read()).opacity);
    const resumed = await page.evaluate(() => window.__iconsPacked.playState());
    assert.equal(resumed.playback, 'running');
    await page.evaluate(() => window.__iconsPacked.pauseState(280));
    const reverse = await page.evaluate(() => window.__iconsPacked.changeState('question', 300));
    sameStateOpacity(paused.opacity, reverse.before);
    sameStateOpacity(reverse.before, reverse.after, reverse.continuity);
    stateEffect(reverse.effect, reference, 'question', 300);
    const reversing = await page.evaluate(() => window.__iconsPacked.pauseState(90));
    const newer = await page.evaluate(() => window.__iconsPacked.changeState('attention', 300));
    sameStateOpacity(reversing.opacity, newer.before);
    sameStateOpacity(newer.before, newer.after, newer.continuity);
    const mixture = await page.evaluate(() => window.__iconsPacked.pauseState(120));
    assert.equal(
      mixture.opacity.filter((item) => item.value > 0.01).length,
      3,
      'третье намерение должно сохранить всю прежнюю смесь',
    );
    const latest = await page.evaluate(() => window.__iconsPacked.changeState('increase', 200));
    sameStateOpacity(mixture.opacity, latest.before);
    sameStateOpacity(latest.before, latest.after, latest.continuity);
    oneHot(await page.evaluate(() => window.__iconsPacked.settleState()), 'increase');
    records.push({
      name: 'status-circle:paused-reverse-newer-state',
      paused: paused.opacity,
      reverse,
      newer,
      mixture: mixture.opacity,
      latest,
    });
  }
  const refusal = await page.evaluate(() => window.__iconsPacked.stateRefusals());
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
  stateEffect(refusal.web.effect, reference, 'confirmation', 240);
  records.push({ name: `status-circle:${reducedMotion}:public-refusals`, refusal });
  const disposing = await page.evaluate(() => window.__iconsPacked.changeState('dismissal', 1000));
  stateEffect(disposing.effect, reference, 'dismissal', reducedMotion === 'reduce' ? 0 : 1000);
  if (reducedMotion === 'no-preference')
    await page.evaluate(() => window.__iconsPacked.pauseState(200));
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
    const requiredEntries = [
      ...REQUIRED_PUBLIC_ENTRIES,
      ...(subject.schemaVersion === 2 ? [STATE_ENTRY] : []),
    ];
    receipt.subject = subject;
    receipt.subjectSha256 = hash(subjectBytes);
    const source = (args) =>
      execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 20_000 }).trim();
    const harnessBytes = await readFile(fileURLToPath(import.meta.url));
    receipt.harness = {
      commit: source(['rev-parse', 'HEAD']),
      sourceSha256: hash(harnessBytes),
      dirty: source(['status', '--porcelain']) !== '',
      diffSha256: hash(execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT })),
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
      scenario:
        'LabUI icon-only buttons, reload Outline/Filled и status-circle при schema2, публичный Lab Motion; размер полного consumer без baseline speedup claim',
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
        { ...subject.authorReference, states: subject.stateReference },
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
