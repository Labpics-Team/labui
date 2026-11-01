import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const NOTIFICATION_ICONS = ['notifications', 'notifications-unread'];
export const NOTIFICATION_ENTRIES = [...NOTIFICATION_ICONS, 'notifications-off']
  .map(icon => `@labpics/icons/symbols/${icon}`);
const HASH = /^[a-f0-9]{64}$/;
const factors = [0, 1, -1, 0.5, -0.5, 0];
const stableJSON = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(value).digest('hex');

// Независимый raw-master oracle: шесть cubic рёбер, без parser/bbox производителя.
export function rawNotificationClapperWidth(d) {
  assert.match(d.replace(/[^A-Za-z]/g, ''), /^MCCCCCC[HL]Z$/);
  const numbers = d.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g).map(Number);
  assert.equal(numbers.length, d.includes('H') ? 39 : 40);
  assert.ok(numbers.every(Number.isFinite));
  const xs = [numbers[0], numbers[38]];
  let p0 = numbers[0];
  for (let index = 2; index < 38; index += 6) {
    const p1 = numbers[index];
    const p2 = numbers[index + 2];
    const p3 = numbers[index + 4];
    const a = -p0 + 3 * p1 - 3 * p2 + p3;
    const b = 2 * (p0 - 2 * p1 + p2);
    const c = p1 - p0;
    const discriminant = b * b - 4 * a * c;
    const roots = a === 0 ? b === 0 ? [] : [-c / b] : discriminant < 0 ? []
      : [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)];
    for (const t of [0, 1, ...roots.filter(t => t > 0 && t < 1)])
      xs.push((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3);
    p0 = p3;
  }
  const width = Math.max(...xs) - Math.min(...xs);
  assert.ok(Number.isFinite(width) && width > 0);
  return width;
}

export function notificationPosition(amplitude, progress) {
  assert.ok(Number.isFinite(amplitude) && amplitude > 0 && progress >= 0 && progress <= 1);
  if (progress === 1) return 0;
  const position = progress * 5;
  const index = Math.floor(position);
  const fraction = position - index;
  return amplitude * (factors[index] * (1 - fraction) + factors[index + 1] * fraction);
}

export function validateNotificationReference(reference, author) {
  assert.equal(reference?.fileKey, author.fileKey);
  assert.equal(reference.version, author.version);
  assert.deepEqual(Object.keys(reference.icons ?? {}).sort(), [...NOTIFICATION_ICONS, 'notifications-off'].sort());
  for (const [icon, variants] of Object.entries(reference.icons)) {
    assert.deepEqual(Object.keys(variants).sort(), ['filled', 'outline']);
    for (const [variant, item] of Object.entries(variants)) {
      assert.equal(item.sourceFile, `masters/figma/${reference.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`);
      assert.equal(item.author.kind, 'figma');
      assert.equal(item.author.fileKey, author.fileKey);
      assert.equal(item.author.version, author.version);
      assert.match(item.author.nodeId, /^\d+:\d+$/);
      for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256']) assert.match(item.author[key], HASH);
      assert.ok(item.paths.length > 0);
      assert.equal(hash(stableJSON(item.paths.map((path, index) => ({ index, ...path })))), item.author.pathFingerprintSha256);
      assert.equal(item.viewBox.length, 4);
      assert.ok(item.viewBox.every(Number.isFinite) && item.viewBox[2] > 0 && item.viewBox[3] > 0);
      if (icon === 'notifications-off') {
        assert.equal(item.declaration, undefined);
        continue;
      }
      assert.equal(item.declaration.masterSha256, item.author.masterSha256);
      assert.equal(item.declaration.pathFingerprintSha256, item.author.pathFingerprintSha256);
      assert.deepEqual(item.declaration.gesture, { law: 'notification.ring', purpose: 'incoming-notification', partId: 'notification-clapper' });
      assert.equal(item.parts.length, item.paths.length);
      assert.equal(new Set(item.parts.map(part => part.id)).size, item.parts.length);
      for (const [index, part] of item.parts.entries()) {
        assert.equal(part.zIndex, index);
        assert.deepEqual({ d: part.d, fillRule: part.fillRule }, item.paths[index]);
        assert.equal(part.role, part.id === 'notification-clapper' ? 'content' : 'container');
      }
      const clapper = item.parts.find(part => part.id === 'notification-clapper');
      assert.equal(clapper.fillRule, 'nonzero');
      assert.equal(item.amplitude, rawNotificationClapperWidth(clapper.d) / 4);
      assert.deepEqual(item.unchangedPartIds, item.parts.filter(part => part !== clapper).map(part => part.id));
    }
  }
  return reference;
}

const close = (actual, expected, message) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9, `${message}: ${actual} → ${expected}`);

export function assertNotificationAnatomy(actual, expected, icon, variant) {
  assert.equal(actual.icon, icon);
  assert.equal(actual.variant, variant);
  assert.equal(actual.composition, 'layers');
  assert.equal(actual.provenance.kind, 'source');
  assert.equal(actual.provenance.file, expected.sourceFile);
  assert.deepEqual(actual.provenance.author, expected.author);
  assert.deepEqual(actual.parts, expected.parts);
  assert.deepEqual(actual.paths, expected.parts.map(({ d, fillRule, id, role }) => ({ d, fillRule, id, role })));
  assert.deepEqual(actual.viewBox, expected.viewBox);
  assert.deepEqual(actual.capabilities.author, expected.author);
  assert.deepEqual(actual.capabilities.supportedAxes, []);
  const gestures = actual.capabilities.motion.gestures;
  assert.equal(gestures.length, 1);
  const [gesture] = gestures;
  assert.equal(gesture.id, `${icon}.ring`);
  assert.equal(gesture.kind, 'cycle');
  assert.equal(gesture.meaning, 'Входящее уведомление: один затухающий горизонтальный цикл язычка; корпус и badge остаются неподвижными.');
  assert.equal(gesture.progress, 'normalized-0-to-1');
  assert.equal(gesture.restProgress, 0);
  assert.deepEqual(gesture.partIds, ['notification-clapper']);
  assert.equal(gesture.tracks.length, 1);
  const [track] = gesture.tracks;
  assert.deepEqual(Object.keys(track).sort(), ['axis', 'interpolation', 'kind', 'partId', 'stops', 'unit']);
  assert.deepEqual({ ...track, stops: undefined }, { partId: 'notification-clapper', kind: 'translate', axis: 'x', unit: 'viewBox', interpolation: 'linear', stops: undefined });
  assert.equal(track.stops.length, 6);
  track.stops.forEach((stop, index) => {
    assert.equal(stop.at, index / 5);
    close(stop.value, expected.amplitude * factors[index], 'raw clapper amplitude');
  });
  // Hash проверяет independently-qualified gesture вместе с raw декларацией.
  // Координатная ширина из другого polynomial evaluator не округляется ради hash.
  const annotationSha256 = hash(stableJSON({ schemaVersion: 1,
    source: { fileKey: expected.author.fileKey, version: expected.author.version }, icon, variant,
    declaration: expected.declaration, gestures }));
  const anatomy = { version: 1, annotationSha256, masterSha256: expected.author.masterSha256,
    pathFingerprintSha256: expected.author.pathFingerprintSha256 };
  assert.deepEqual(actual.provenance.anatomy, anatomy);
  assert.deepEqual(actual.capabilities.anatomy, anatomy);
  assert.equal(actual.identity, true);
  for (const part of actual.fixed) {
    assert.ok(expected.unchangedPartIds.includes(part.id));
    assert.equal(part.count, 1);
    assert.equal(part.identity, true);
    assert.equal(part.ancestorsUnchanged, true);
    assert.equal(part.opacity, 1);
    assert.deepEqual(part.matrix, [1, 0, 0, 1, 0, 0]);
  }
  assert.deepEqual(actual.fixed.map(part => part.id), expected.unchangedPartIds);
}

export function assertNotificationEffect(effect, expected, icon, variant, from, to, duration) {
  assert.equal(effect.version, 3);
  assert.equal(effect.icon, icon);
  assert.equal(effect.variant, variant);
  assert.equal(effect.gesture, `${icon}.ring`);
  assert.equal(effect.from, from);
  assert.equal(effect.to, to);
  assert.deepEqual(effect.options, { duration, easing: 'linear', fill: 'both' });
  assert.deepEqual(effect.viewport, { overflow: 'visible' });
  assert.deepEqual(effect.unchangedPartIds, expected.unchangedPartIds);
  assert.equal(effect.targets.length, 1);
  const [target] = effect.targets;
  assert.equal(target.partId, 'notification-clapper');
  assert.equal(target.property, 'x');
  assert.equal(target.unit, 'viewBox');
  close(target.from, notificationPosition(expected.amplitude, from), 'effect from');
  close(target.to, notificationPosition(expected.amplitude, to), 'effect to');
  const inside = [0.2, 0.4, 0.6, 0.8].filter(at => at > Math.min(from, to) && at < Math.max(from, to));
  if (from > to) inside.reverse();
  const points = duration === 0 ? [to] : [...inside, to];
  assert.equal(effect.stages.length, points.length);
  let previousAt = 0;
  effect.stages.forEach((stage, index) => {
    assert.equal(stage.partId, target.partId);
    assert.equal(stage.property, 'x');
    assert.equal(stage.unit, 'viewBox');
    close(stage.to, notificationPosition(expected.amplitude, points[index]), 'stage target');
    const end = duration === 0 ? 0 : duration * Math.abs((points[index] - from) / (to - from));
    close(stage.at, previousAt, 'stage at');
    close(stage.duration, end - previousAt, 'stage duration');
    previousAt = end;
  });
}

// Общий перевод публичного effect v3. Видимое начало читается один раз до admission.
export function translationSequenceSteps(effect, byPart, visible) {
  if (effect.version !== 3 || effect.targets.length === 0 || effect.stages.length === 0 ||
      !Number.isFinite(effect.options.duration) || effect.options.duration < 0)
    throw new Error('Нужен непустой translation effect v3');
  const targets = new Map();
  const ends = new Map();
  const finalValues = new Map();
  for (const target of effect.targets) {
    const key = `${target.partId}:${target.property}`;
    if (!['x', 'y'].includes(target.property) || target.unit !== 'viewBox' || !byPart.has(target.partId) ||
        targets.has(key) || effect.unchangedPartIds.includes(target.partId) ||
        !Number.isFinite(target.from) || !Number.isFinite(target.to) || !Number.isFinite(visible.get(key)))
      throw new Error('Цель сдвига не объявлена или потеряла видимую позу');
    targets.set(key, target);
  }
  const steps = effect.stages.map(stage => {
    const key = `${stage.partId}:${stage.property}`;
    if (!targets.has(key) ||
        stage.unit !== 'viewBox' || !Number.isFinite(stage.to) || !Number.isFinite(stage.at) ||
        !Number.isFinite(stage.duration) || stage.at < 0 || stage.duration < 0 ||
        Math.abs(stage.at - (ends.get(key) ?? 0)) > 1e-9)
      throw new Error('Этап сдвига не соответствует цели');
    const value = ends.has(key) ? stage.to : [visible.get(key), stage.to];
    ends.set(key, stage.at + stage.duration); finalValues.set(key, stage.to);
    return [byPart.get(stage.partId), { [stage.property]: value },
      { at: stage.at, duration: stage.duration, ease: effect.options.easing }];
  });
  for (const [key, target] of targets)
    if (!ends.has(key) || Math.abs(ends.get(key) - effect.options.duration) > 1e-9 || finalValues.get(key) !== target.to)
      throw new Error('Сдвиг не покрывает полный интервал и конечную позу цели');
  return steps;
}

function mountNotificationConsumer(api, icon, variant, label, parent) {
  const model = api.glyph({ variant });
  const capabilities = api.glyphCapabilities(variant);
  const figure = document.createElement('figure');
  const button = document.createElement('lab-button');
  const id = `${icon}/${variant}`;
  for (const [name, value] of Object.entries({ size: 'l', icon: '', type: 'neutral', 'aria-label': label,
    'data-notification': id })) button.setAttribute(name, value);
  button.innerHTML = renderGlyphSvg(model, { instanceId: `notification-${icon}-${variant}` });
  const svg = button.querySelector('svg');
  svg.setAttribute('slot', 'icon'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const byPart = new Map([...svg.querySelectorAll('[data-part]')].map(node => [node.dataset.part, node]));
  const originalNodes = [...svg.querySelectorAll('*')];
  const gesture = capabilities.motion.gestures.find(item => item.id === `${icon}.ring`);
  if (!gesture) throw new Error('Не объявлено входящее уведомление');
  const movable = new Set(gesture.partIds);
  const fixedNodes = new Map([...byPart].filter(([partId]) => !movable.has(partId)));
  const caption = document.createElement('figcaption'); caption.textContent = variant === 'outline' ? 'Outline' : 'Filled';
  figure.append(button, caption); parent.append(figure);
  let control;
  let completion;
  let effect;
  let generation = 0;
  let knownPhase = 0;
  let nativeClicks = 0;
  const events = [];
  const samples = [];
  const matrix = node => {
    const transform = getComputedStyle(node).transform;
    const value = transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
    return ['a', 'b', 'c', 'd', 'e', 'f'].map(key => value[key]);
  };
  const pose = () => [...byPart].map(([partId, node]) => ({ partId, matrix: matrix(node) }));
  function fixedAncestors(node) {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (Number(style.opacity) !== 1 || style.transform !== 'none') return false;
      if (parent === svg) return true;
    }
    return false;
  }
  function start({ from = 0, to = 1, duration = 1000, initialize = false } = {}) {
    const result = compileSymbolEffect(model, capabilities, `${icon}.ring`, { from, to, duration,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
    if (!result.ok) throw new Error(result.reason.code);
    const nextEffect = result.effect;
    const before = pose();
    const visible = new Map();
    for (const target of nextEffect.targets) {
      const node = byPart.get(target.partId);
      if (!node) throw new Error('Потеряна часть уведомления');
      const value = matrix(node)[target.property === 'x' ? 4 : 5];
      visible.set(`${target.partId}:${target.property}`, initialize ? target.from : value);
    }
    const previous = control;
    Object.assign(svg.style, nextEffect.viewport);
    const next = sequence(translationSequenceSteps(nextEffect, byPart, visible),
      { reducedMotion: nextEffect.options.duration === 0 ? 'always' : 'user' });
    control = next; effect = nextEffect; const current = ++generation;
    completion = next.finished; knownPhase = nextEffect.options.duration === 0 ? to : null;
    previous?.stop();
    completion.then(result => { if (current === generation && result.status === 'finished') knownPhase = to; });
    return { effect, before, after: pose(), generation, previousPlayback: previous?.state ?? null };
  }
  button.addEventListener('click', event => {
    // Каждое входящее событие — новая occurrence. Позу берём до admission.
    const transition = start();
    events.push({ trusted: event.isTrusted, composed: event.composed,
      native: event.composedPath().includes(button.shadowRoot.querySelector('button')), ...transition });
  });
  function read() {
    const native = button.shadowRoot?.querySelector('button');
    const rectangle = native?.getBoundingClientRect();
    return { icon: model.icon, variant: model.variant, provenance: model.provenance, capabilities,
      composition: model.composition.kind,
      parts: model.parts.map(({ id, role, zIndex, fillRule, d }) => ({ id, role, zIndex, fillRule, d })),
      paths: [...svg.querySelectorAll('path')].map(node => ({ d: node.getAttribute('d'),
        fillRule: node.getAttribute('fill-rule') ?? 'nonzero', id: node.dataset.part, role: node.dataset.role })),
      viewBox: svg.getAttribute('viewBox').split(/\s+/).map(Number), pose: pose(), events, nativeClicks,
      identity: originalNodes.length === svg.querySelectorAll('*').length && originalNodes.every((node, index) => node === svg.querySelectorAll('*')[index]),
      fixed: [...fixedNodes].map(([id, node]) => ({ id, count: svg.querySelectorAll(`[data-part="${id}"]`).length,
        identity: node === byPart.get(id), matrix: matrix(node), opacity: Number(getComputedStyle(node).opacity),
        ancestorsUnchanged: fixedAncestors(node) })),
      knownPhase, playback: control?.state ?? null, connected: button.isConnected,
      sizeSamples: samples.map(sample => ({ size: Number.parseFloat(sample.style.width),
        width: sample.getBoundingClientRect().width, height: sample.getBoundingClientRect().height,
        viewBox: sample.getAttribute('viewBox').split(/\s+/).map(Number),
        paths: [...sample.querySelectorAll('path')].map(node => ({ d: node.getAttribute('d'),
          fillRule: node.getAttribute('fill-rule') ?? 'nonzero' })) })),
      target: { width: rectangle?.width, height: rectangle?.height, name: native?.getAttribute('aria-label'), type: native?.type,
        iconHidden: svg.getAttribute('aria-hidden'), slotHidden: native?.querySelector('slot[name=icon]')?.getAttribute('aria-hidden') } };
  }
  const frames = async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
  async function settle() {
    let timer;
    try {
      const result = await Promise.race([completion, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Notification completion timeout')), 20000);
      })]);
      if (result?.status !== 'finished') throw new Error('Уведомление не завершено');
      await frames(); return { ...read(), completionStatus: result.status };
    } finally { clearTimeout(timer); }
  }
  async function pauseAt(milliseconds) {
    if (!effect || effect.options.duration === 0 || !Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > effect.options.duration)
      throw new Error('Фаза требует действующего конечного прогона');
    control.pause(); control.seek(milliseconds);
    // Публичная перемотка задаёт фазу; неоднозначная координата её не определяет.
    knownPhase = effect.from + (effect.to - effect.from) * milliseconds / effect.options.duration;
    await frames(); return read();
  }
  for (const size of [16, 24, 48]) {
    const sample = document.createElement('span');
    sample.innerHTML = renderGlyphSvg(model, { instanceId: `${id}-size-${size}`.replaceAll('/', '-') });
    const sampleSvg = sample.querySelector('svg'); sampleSvg.setAttribute('aria-hidden', 'true');
    sampleSvg.style.width = `${size}px`; sampleSvg.style.height = `${size}px`;
    sample.append(document.createTextNode(`${size} px`)); samples.push(sampleSvg);
  }
  const scale = document.createElement('div'); scale.className = 'size-sample-row';
  scale.append(...samples.map(svg => svg.parentElement)); figure.append(scale);
  return { read, start, settle, pauseAt,
    ready: button.updateComplete.then(() => button.shadowRoot.querySelector('button').addEventListener('click', () => nativeClicks++)),
    cleanup: () => { control?.stop(); figure.remove(); },
    disposal: async () => ({ connected: button.isConnected, playback: control?.state, completionStatus: (await completion)?.status }),
    refuse: () => {
      let axis;
      try { api.glyph({ variant, axes: { weight: 1.1 } }); axis = 'accepted'; } catch (error) { axis = error.code; }
      const off = notificationOff.glyph({ variant });
      return { axis,
        morph: compileSymbolEffect(model, capabilities, `${icon}.morph`, { duration: 1000 }),
        off: compileSymbolEffect(off, notificationOff.glyphCapabilities(variant), 'notifications-off.ring', { duration: 1000 }),
        offPaths: [...new DOMParser().parseFromString(renderGlyphSvg(off,
          { instanceId: `notification-${icon}-${variant}-off` }), 'image/svg+xml').querySelectorAll('path')]
          .map(node => ({ d: node.getAttribute('d'), fillRule: node.getAttribute('fill-rule') ?? 'nonzero' })) };
    },
  };
}

export function notificationFixture() {
  return `
import * as notificationPlain from '@labpics/icons/symbols/notifications';
import * as notificationUnread from '@labpics/icons/symbols/notifications-unread';
import * as notificationOff from '@labpics/icons/symbols/notifications-off';
${translationSequenceSteps.toString()}
${mountNotificationConsumer.toString()}
const notificationSection = document.createElement('section');
notificationSection.setAttribute('aria-labelledby', 'notifications-heading');
const notificationHeading = document.createElement('h2'); notificationHeading.id = 'notifications-heading';
notificationHeading.textContent = 'Входящие уведомления'; notificationSection.append(notificationHeading);
const notificationConsumers = {};
for (const [api, icon, label] of [
  [notificationPlain, 'notifications', 'Входящее уведомление'],
  [notificationUnread, 'notifications-unread', 'Новое непрочитанное уведомление'],
]) {
  const row = document.createElement('div'); row.className = 'notification-sample';
  const heading = document.createElement('h3'); heading.textContent = label; notificationSection.append(heading, row);
  for (const variant of ['outline', 'filled'])
    notificationConsumers[icon + '/' + variant] = mountNotificationConsumer(api, icon, variant, label, row);
}
document.body.append(notificationSection);
window.__iconsPacked.notificationConsumers = notificationConsumers;
window.__iconsPacked.ready = Promise.all([window.__iconsPacked.ready, ...Object.values(notificationConsumers).map(item => item.ready)]);
const previousCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { for (const item of Object.values(notificationConsumers)) item.cleanup(); notificationSection.remove(); return previousCleanup(); };
`;
}
