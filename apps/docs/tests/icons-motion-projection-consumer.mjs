import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadedSvg } from './icons-authored-dots-consumer.mjs';

export const MOTION_PROJECTION_ICONS = Object.freeze(['reload', 'refresh', 'timer']);
export const MOTION_PROJECTION_ROTATION_ICONS = Object.freeze(['reload', 'refresh']);
export const MOTION_PROJECTION_ENTRIES = Object.freeze([
  ...MOTION_PROJECTION_ROTATION_ICONS.map((icon) => `@labpics/icons/gestures/${icon}`),
  '@labpics/icons/symbols/timer',
]);
const MODES = ['no-preference', 'reduce'];
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
const HASH = /^[a-f0-9]{64}$/;
const VARIANTS = ['outline', 'filled'];

export function timerRefusalVisualFile(mode) {
  assert.ok(MODES.includes(mode), 'timer refusal: неизвестный режим');
  return `result/${mode}-timer-static-refusal.png`;
}
export const MOTION_PROJECTION_VISUAL_FILES = Object.freeze(MODES.map(timerRefusalVisualFile));

function variantsFor() {
  return VARIANTS;
}
function rawGesture(icon, partId) {
  return {
    id: `${icon}.cycle`,
    kind: 'cycle',
    meaning:
      'Один оборот команды обновления по часовой стрелке; промежуточную позу можно развернуть или продолжить.',
    partIds: [partId],
    progress: 'normalized-0-to-1',
    tracks: [
      {
        partId,
        kind: 'rotate',
        anchor: [0.5, 0.5],
        from: 0,
        to: 360,
        unit: 'degrees',
        interpolation: 'linear',
      },
    ],
  };
}
function expectedDeclaration(icon, item, variant) {
  if (icon === 'timer' && variant === 'filled') return null;
  return {
    ...(icon === 'timer' ? { scope: 'motion' } : {}),
    masterSha256: item.author.masterSha256,
    pathFingerprintSha256: item.author.pathFingerprintSha256,
    parts:
      icon === 'timer'
        ? [
            { pathIndex: 0, id: 'timer-dial', role: 'container' },
            {
              pathIndex: 1,
              id: 'timer-hand',
              role: 'control',
              anchor: [0.5, 0.5],
              anchorMeaning: 'canvas-center',
            },
          ]
        : [
            {
              pathIndex: 0,
              id: 'cycle-body',
              role: 'control',
              anchor: [0.5, 0.5],
              anchorMeaning: 'canvas-center',
            },
          ],
    gesture:
      icon === 'timer'
        ? null
        : {
            law: 'cycle.clockwise',
            partId: 'cycle-body',
          },
  };
}

/** Raw masters и декларации читаются до import установленного producer. */
export async function motionProjectionReference(iconsRoot, pin, readAuthorMaster) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const semantic = JSON.parse(await readFile(join(iconsRoot, 'semantics/author-anatomy.json')));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(semantic.schemaVersion, 1);
  assert.deepEqual(semantic.source, pin.figma);
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const icons = {};
  for (const icon of MOTION_PROJECTION_ICONS) {
    icons[icon] = {};
    for (const variant of variantsFor(icon)) {
      const record = manifest.icons[icon][variant];
      const declaration = semantic.icons[icon][variant] ?? null;
      const sourceFile = `masters/figma/${pin.figma.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`;
      assert.equal(record.master, sourceFile);
      const bytes = await readFile(join(iconsRoot, sourceFile));
      assert.equal(bytes.length, record.bytes, 'motion projection: raw master bytes');
      assert.equal(hash(bytes), record.sha256, 'motion projection: raw master digest');
      const { viewBox, paths } = readAuthorMaster(bytes);
      const fingerprint = hash(stableJSON(paths.map((path, index) => ({ index, ...path }))));
      assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
      const gesture = declaration?.gesture ? rawGesture(icon, declaration.gesture.partId) : null;
      icons[icon][variant] = {
        sourceFile,
        viewBox,
        paths,
        declaration,
        gesture,
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
        anatomy: declaration
          ? {
              version: 1,
              masterSha256: hash(bytes),
              pathFingerprintSha256: fingerprint,
              annotationSha256: hash(
                stableJSON({
                  schemaVersion: 1,
                  source: semantic.source,
                  icon,
                  variant,
                  declaration,
                  gestures: gesture ? [gesture] : [],
                }),
              ),
            }
          : null,
      };
    }
  }
  const reference = { ...pin.figma, icons };
  return validateMotionProjectionReference(reference, pin.figma);
}

export function validateMotionProjectionReference(reference, author) {
  assert.equal(reference?.fileKey, author.fileKey);
  assert.equal(reference.version, author.version);
  assert.deepEqual(Object.keys(reference.icons), MOTION_PROJECTION_ICONS);
  for (const icon of MOTION_PROJECTION_ICONS) {
    assert.deepEqual(Object.keys(reference.icons[icon]), variantsFor(icon));
    for (const variant of variantsFor(icon)) {
      const item = reference.icons[icon][variant];
      assert.equal(
        item.sourceFile,
        `masters/figma/${reference.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`,
      );
      assert.equal(item.author?.kind, 'figma');
      assert.equal(item.author.fileKey, reference.fileKey);
      assert.equal(item.author.version, reference.version);
      assert.match(item.author.nodeId, /^\d+:\d+$/);
      for (const field of [
        'nodeSha256',
        'masterSha256',
        'normalizedSha256',
        'pathFingerprintSha256',
      ])
        assert.match(item.author[field], HASH);
      if (item.declaration) {
        assert.equal(item.anatomy.version, 1);
        assert.equal(item.anatomy.masterSha256, item.author.masterSha256);
        assert.equal(item.anatomy.pathFingerprintSha256, item.author.pathFingerprintSha256);
      } else assert.equal(item.anatomy, null);
      assert.deepEqual(item.viewBox, [0, 0, 24, 24]);
      if (icon !== 'timer' || variant === 'outline')
        assert.equal(item.paths.length, icon === 'timer' ? 2 : 1);
      else assert.ok(item.paths.length > 0);
      for (const path of item.paths) {
        assert.ok(typeof path.d === 'string' && path.d.length > 0);
        assert.ok(['nonzero', 'evenodd'].includes(path.fillRule));
      }
      assert.equal(
        hash(stableJSON(item.paths.map((path, index) => ({ index, ...path })))),
        item.author.pathFingerprintSha256,
      );
      assert.deepEqual(item.declaration, expectedDeclaration(icon, item, variant));
      assert.deepEqual(
        item.gesture,
        item.declaration?.gesture ? rawGesture(icon, item.declaration.gesture.partId) : null,
      );
      if (item.declaration)
        assert.equal(
          item.anatomy.annotationSha256,
          hash(
            stableJSON({
              schemaVersion: 1,
              source: { fileKey: reference.fileKey, version: reference.version },
              icon,
              variant,
              declaration: item.declaration,
              gestures: item.gesture ? [item.gesture] : [],
            }),
          ),
        );
    }
  }
  return reference;
}

export function assertMotionProjectionEffect(effect, raw, icon, variant, request) {
  const from = request.from ?? 0;
  const to = request.to ?? 1;
  const track = raw.gesture.tracks[0];
  assert.deepEqual(effect, {
    version: 1,
    icon,
    variant,
    gesture: raw.gesture.id,
    from,
    to,
    targets: [
      {
        partId: track.partId,
        rotation: { from: 360 * from, to: 360 * to, unit: 'degrees' },
        style: { transformBox: 'view-box', transformOrigin: '50% 50%' },
        keyframes: [
          { offset: 0, transform: `rotate(${360 * from}deg)` },
          { offset: 1, transform: `rotate(${360 * to}deg)` },
        ],
      },
    ],
    unchangedPartIds: raw.declaration.parts
      .filter((part) => part.id !== track.partId)
      .map((part) => part.id),
    viewport: { overflow: 'visible' },
    options: {
      duration: request.reducedMotion || from === to ? 0 : request.duration,
      easing: 'linear',
      fill: 'both',
    },
  });
}

export function assertTimerRefusals(refusals) {
  assert.deepEqual(Object.keys(refusals), VARIANTS);
  for (const variant of VARIANTS) {
    assert.equal(refusals[variant].ok, false);
    assert.equal(refusals[variant].reason.code, 'SEMANTIC_MOTION_UNAVAILABLE');
  }
}

export function assertTimerRefusalEvidence(visuals, records, reference) {
  for (const mode of MODES) {
    const file = timerRefusalVisualFile(mode);
    const images = visuals.filter((image) => image.path === file);
    const receipts = records.filter(
      (record) => record.name === `${mode}:timer-static-refusal:capture`,
    );
    assert.equal(images.length, 1, `timer refusal: нужен один ${file}`);
    assert.equal(receipts.length, 1, `timer refusal: нужен один receipt ${file}`);
    const record = receipts[0];
    assert.equal(record.result, 'PASS');
    assert.equal(record.file, file);
    assert.deepEqual(record.variants, VARIANTS);
    assert.equal(record.icon, 'timer');
    assert.deepEqual(record.sizes, [16, 24, 48]);
    assert.equal(record.samples, 6);
    assert.equal(record.pngSha256, hash(images[0].bytes));
    assertTimerStaticSamples(record.poses, reference);
    assertTimerRefusals(record.refusals);
  }
}

/** В consumer нет геометрии: DOM создаётся из готового SVG, anchors из packet. */
export function mountMotionProjectionConsumer(apis, timerApi, compileSymbolEffect, animate) {
  const section = document.createElement('section');
  section.className = 'motion-projection';
  section.setAttribute('aria-labelledby', 'motion-projection-heading');
  const heading = document.createElement('h2');
  heading.id = 'motion-projection-heading';
  heading.textContent = 'Движение символов';
  section.append(heading);
  const entries = apis.flatMap((api, index) => {
    const icon = ['reload', 'refresh'][index];
    return ['outline', 'filled'].map((variant) => ({
      api,
      icon,
      variant,
    }));
  });
  entries.push(
    ...['outline', 'filled'].map((variant) => ({ api: timerApi, icon: 'timer', variant })),
  );
  const bindings = [];
  const events = [];
  let disposed = false;
  let disposal;
  function requireActive() {
    if (disposed) throw new Error('MOTION_PROJECTION_DISPOSED');
  }
  const labels = { reload: 'Обновить', refresh: 'Синхронизировать', timer: 'Таймер' };
  const timerRows = document.createElement('div');
  timerRows.className = 'timer-static-refusal';
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'motion-projection-row';
    row.dataset.motionIcon = entry.icon;
    row.dataset.variant = entry.variant;
    const title = document.createElement('h3');
    title.textContent = `${labels[entry.icon]}: ${entry.variant === 'outline' ? 'контурный' : 'залитый'}`;
    row.append(title);
    for (const size of [16, 24, 48]) {
      const model = entry.icon === 'timer' ? timerApi.glyph({ variant: entry.variant }) : null;
      const rendered = model
        ? { ok: true, svg: model.svg }
        : entry.api.renderMotionSvg(entry.variant);
      const capability = model
        ? { ok: true, capabilities: timerApi.glyphCapabilities(entry.variant) }
        : entry.api.motionCapabilities(entry.variant);
      if (!rendered.ok || !capability.ok) throw new Error('MOTION_PROJECTION_REFUSED');
      const figure = document.createElement('figure');
      const button = document.createElement('lab-button');
      for (const [name, value] of Object.entries({
        size: 'l',
        icon: '',
        type: 'neutral',
        'aria-label': labels[entry.icon],
      }))
        button.setAttribute(name, value);
      button.innerHTML = rendered.svg;
      const svg = button.querySelector('svg');
      svg.setAttribute('slot', 'icon');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.style.width = `${size}px`;
      svg.style.height = `${size}px`;
      const caption = document.createElement('figcaption');
      caption.textContent = `${size} px`;
      figure.append(button, caption);
      row.append(figure);
      const nodes = [...svg.querySelectorAll('[data-part]')];
      const item = {
        ...entry,
        model,
        size,
        svg,
        button,
        nodes,
        capability: capability.capabilities,
        controls: [],
        generation: 0,
        settled: true,
        nativeClicks: 0,
        completion: Promise.resolve([]),
      };
      bindings.push(item);
      item.click = (event) => {
        const initialize = item.settled;
        const transition = start(item, { from: 0, to: 1, initialize });
        events.push({
          icon: item.icon,
          variant: item.variant,
          size,
          trusted: event.isTrusted,
          composed: event.composed,
          native: event.composedPath().includes(button.shadowRoot.querySelector('button')),
          initialize,
          ...transition,
        });
      };
      button.addEventListener('click', item.click);
    }
    (entry.icon === 'timer' ? timerRows : section).append(row);
  }
  section.append(timerRows);
  const controls = document.createElement('div');
  controls.className = 'motion-projection-controls';
  const pose = document.createElement('output');
  pose.textContent = 'Таймер: анимация недоступна';
  pose.setAttribute('aria-live', 'polite');
  const timerItems = bindings.filter((item) => item.icon === 'timer');
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'motion-projection-download';
  download.textContent = 'Скачать исходный SVG таймера';
  const downloadHandler = () => {
    requireActive();
    const svg = timerApi.outline;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    try {
      link.href = url;
      link.download = 'timer-outline.svg';
      document.body.append(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  };
  download.addEventListener('click', downloadHandler);
  controls.append(download, pose);
  timerRows.append(controls);
  document.body.append(section);
  function matrices(item) {
    return item.nodes.map((node) => {
      const matrix = new DOMMatrix(getComputedStyle(node).transform);
      return ['a', 'b', 'c', 'd', 'e', 'f'].map((field) => matrix[field]);
    });
  }
  function start(item, { from = 0, to = 1, duration = 600, initialize = false } = {}) {
    requireActive();
    if (item.icon === 'timer') {
      const before = matrices(item);
      const refusal = compileSymbolEffect(item.model, item.capability, 'timer.advance', {
        from,
        to,
        duration,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
      if (refusal.ok || refusal.reason.code !== 'SEMANTIC_MOTION_UNAVAILABLE')
        throw new Error('TIMER_MOTION_ADMISSION_DRIFT');
      pose.value = 'Таймер: анимация недоступна';
      return { refusal, before, after: matrices(item), generation: item.generation };
    }
    const result = item.api.compileMotionEffect(item.capability.gestures[0].id, {
      variant: item.variant,
      from,
      to,
      duration,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    if (!result.ok) throw new Error(result.reason.code);
    const effect = result.effect;
    const before = matrices(item);
    const previous = item.controls;
    const controls = [];
    const generation = ++item.generation;
    try {
      Object.assign(item.svg.style, effect.viewport);
      for (const target of effect.targets) {
        const node = item.nodes.find((node) => node.dataset.part === target.partId);
        if (!node) throw new Error('MOTION_PART_MISSING');
        Object.assign(node.style, target.style);
        controls.push(
          animate(
            node,
            {
              rotate: initialize ? [target.rotation.from, target.rotation.to] : target.rotation.to,
            },
            {
              duration: effect.options.duration,
              ease: effect.options.easing,
              reducedMotion: effect.options.duration === 0 ? 'always' : 'user',
            },
          ),
        );
      }
    } catch (error) {
      for (const control of controls) control.stop();
      throw error;
    }
    item.controls = controls;
    for (const control of previous) control.stop();
    item.settled = false;
    item.completion = Promise.all(controls.map((control) => control.finished));
    item.completion.then((results) => {
      if (generation === item.generation && results.every((result) => result.status === 'finished'))
        item.settled = true;
    });
    return { effect, before, after: matrices(item), generation };
  }
  const find = (icon, variant = 'outline', size = 24) => {
    const item = bindings.find(
      (item) => item.icon === icon && item.variant === variant && item.size === size,
    );
    if (!item) throw new Error('MOTION_INSTANCE_MISSING');
    return item;
  };
  const readItem = (item) => {
    const target = item.button.shadowRoot.querySelector('button');
    return {
      icon: item.icon,
      variant: item.variant,
      size: item.size,
      capability: item.capability,
      viewBox: item.svg.getAttribute('viewBox').split(/\s+/).map(Number),
      paths: [...item.svg.querySelectorAll('path')].map((node) => ({
        id: node.dataset.part,
        role: node.dataset.role,
        d: node.getAttribute('d'),
        fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
      })),
      matrices: matrices(item),
      identity:
        item.nodes.length === item.svg.querySelectorAll('path').length &&
        item.nodes.every((node, index) => node === item.svg.querySelectorAll('path')[index]),
      styles: item.nodes.map((node) => ({
        transformBox: node.style.transformBox,
        transformOrigin: node.style.transformOrigin,
      })),
      width: item.svg.getBoundingClientRect().width,
      height: item.svg.getBoundingClientRect().height,
      target: {
        width: target.getBoundingClientRect().width,
        height: target.getBoundingClientRect().height,
        name: target.getAttribute('aria-label'),
        type: target.type,
      },
      hidden: item.svg.getAttribute('aria-hidden'),
      focusable: item.svg.getAttribute('focusable'),
      slot: item.svg.getAttribute('slot'),
      nativeClicks: item.nativeClicks,
      generation: item.generation,
      animations: item.svg.getAnimations({ subtree: true }).length,
    };
  };
  async function settleItem(item) {
    let timer;
    try {
      const results = await Promise.race([
        item.completion,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('MOTION_PROJECTION_TIMEOUT')), 10000);
        }),
      ]);
      if (!results.length || !results.every((result) => result.status === 'finished'))
        throw new Error('MOTION_PROJECTION_NOT_FINISHED');
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return { ...readItem(item), statuses: results.map((result) => result.status) };
    } finally {
      clearTimeout(timer);
    }
  }
  const ready = Promise.all(
    bindings.map(async (item) => {
      await item.button.updateComplete;
      item.nativeClick = () => item.nativeClicks++;
      item.button.shadowRoot.querySelector('button').addEventListener('click', item.nativeClick);
    }),
  );
  return {
    ready,
    read: () => {
      requireActive();
      return { samples: bindings.map(readItem), events, pose: pose.value };
    },
    start: (icon, variant, request) => start(find(icon, variant), request),
    settle: (icon, variant) => settleItem(find(icon, variant)),
    timerSamples: () => {
      requireActive();
      return timerItems.map(readItem);
    },
    refuse: () => ({
      timer: Object.fromEntries(
        ['outline', 'filled'].map((variant) => [
          variant,
          compileSymbolEffect(
            timerApi.glyph({ variant }),
            timerApi.glyphCapabilities(variant),
            'timer.advance',
            { duration: 600 },
          ),
        ]),
      ),
      gesture: apis[0].compileMotionEffect('reload.morph', { duration: 300 }),
      phase: apis[0].compileMotionEffect('reload.cycle', { duration: 300, to: 1.1 }),
    }),
    disposal: () => disposal,
    cleanup: async () => {
      let listenersRemoved = disposal?.listenersRemoved ?? false;
      if (!disposed) {
        disposed = true;
        for (const item of bindings) {
          item.button.removeEventListener('click', item.click);
          item.button.shadowRoot
            ?.querySelector('button')
            ?.removeEventListener('click', item.nativeClick);
          for (const control of item.controls) control.stop();
        }
        download.removeEventListener('click', downloadHandler);
        section.remove();
        const eventCount = events.length;
        const clickCount = bindings.reduce((sum, item) => sum + item.nativeClicks, 0);
        for (const item of bindings) {
          item.button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
          item.button.shadowRoot
            ?.querySelector('button')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        }
        download.dispatchEvent(new MouseEvent('click'));
        listenersRemoved =
          events.length === eventCount &&
          bindings.reduce((sum, item) => sum + item.nativeClicks, 0) === clickCount;
      }
      const statuses = (
        await Promise.all(
          bindings.flatMap((item) => item.controls.map((control) => control.finished)),
        )
      ).map((result) => result.status);
      disposal = {
        connected: bindings.filter((item) => item.button.isConnected).length,
        statuses,
        listenersRemoved,
      };
      return disposal;
    },
  };
}

export function motionProjectionFixture() {
  return `
${MOTION_PROJECTION_ROTATION_ICONS.map((icon, index) => `import * as projectedMotion${index} from '@labpics/icons/gestures/${icon}';`).join('\n')}
import * as staticTimer from '@labpics/icons/symbols/timer';
const motionProjectionConsumer = (${mountMotionProjectionConsumer.toString()})([projectedMotion0, projectedMotion1], staticTimer, compileSymbolEffect, animate);
window.__iconsPacked.motionProjectionConsumer = motionProjectionConsumer;
window.__iconsPacked.ready = Promise.all([window.__iconsPacked.ready, motionProjectionConsumer.ready]);
const motionProjectionCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = async () => { await motionProjectionConsumer.cleanup(); return motionProjectionCleanup(); };
`;
}

export function motionProjectionTypeFixture() {
  return `
import { glyph as timerGlyph, glyphCapabilities as timerCapabilities } from '@labpics/icons/symbols/timer';
import { compileSymbolEffect } from '@labpics/icons/motion';
import { renderMotionSvg as renderReload, compileMotionEffect as reloadEffect } from '@labpics/icons/gestures/reload';
import { compileMotionEffect as refreshEffect } from '@labpics/icons/gestures/refresh';
renderReload('filled');
for (const variant of ['outline', 'filled'] as const)
  compileSymbolEffect(timerGlyph({ variant }), timerCapabilities(variant), 'timer.advance', {duration:300});
reloadEffect('reload.cycle', {variant:'filled',duration:300});
refreshEffect('refresh.cycle', {duration:300,reducedMotion:true});
// @ts-expect-error: неизвестное начертание не должно проходить types.
timerGlyph({variant:'other'});
// @ts-expect-error: неизвестный жест не имеет export.
reloadEffect('reload.morph', {duration:300});
// @ts-expect-error: неподдержанная ось не должна проходить types.
reloadEffect('reload.cycle', {duration:300,weight:1});
`;
}

function sameMatrices(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++)
    for (let field = 0; field < 6; field++)
      assert.ok(
        Math.abs(actual[index][field] - expected[index][field]) < 1e-5,
        `motion pose: ${index}/${field}`,
      );
}
function rotationMatrix(phase) {
  const angle = phase * 2 * Math.PI;
  return [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0];
}
function assertSample(sample, reference) {
  const raw = reference.icons[sample.icon][sample.variant];
  assert.deepEqual(sample.viewBox, raw.viewBox);
  if (sample.icon === 'timer') {
    assert.deepEqual(
      sample.paths.map(({ d, fillRule }) => ({ d, fillRule })),
      raw.paths,
    );
    for (const path of sample.paths) {
      assert.match(path.id, /^source-[a-f0-9]{12}(?:-[1-9][0-9]*)?$/);
      assert.equal(path.role, 'unclassified');
    }
    assert.equal(new Set(sample.paths.map((path) => path.id)).size, sample.paths.length);
    assert.deepEqual(sample.capability.author, raw.author);
    assert.equal(sample.capability.icon, 'timer');
    assert.equal(sample.capability.variant, sample.variant);
    assert.equal(sample.capability.motion.state, 'source-only');
    assert.deepEqual(sample.capability.motion.gestures, []);
    assert.equal(sample.capability.anatomy, undefined);
  } else {
    assert.deepEqual(
      sample.paths,
      raw.paths.map((path, index) => ({
        ...path,
        id: raw.declaration.parts[index].id,
        role: raw.declaration.parts[index].role,
      })),
    );
    assert.deepEqual(sample.capability, {
      icon: sample.icon,
      variant: sample.variant,
      gestures: [{ id: raw.gesture.id, kind: raw.gesture.kind, meaning: raw.gesture.meaning }],
      formats: ['svg', 'web-effect'],
      author: raw.author,
      anatomy: raw.anatomy,
    });
  }
  assert.equal(sample.identity, true);
  assert.equal(sample.width, sample.size);
  assert.equal(sample.height, sample.size);
  assert.ok(sample.target.width >= 44 && sample.target.height >= 44);
  assert.ok(sample.target.name.length > 0);
  assert.equal(sample.target.type, 'button');
  assert.equal(sample.hidden, 'true');
  assert.equal(sample.focusable, 'false');
  assert.equal(sample.slot, 'icon');
  for (const [index, part] of sample.paths.entries())
    if (sample.icon === 'timer' || part.id !== raw.gesture.partIds[0]) {
      sameMatrices([sample.matrices[index]], [[1, 0, 0, 1, 0, 0]]);
      assert.deepEqual(sample.styles[index], { transformBox: '', transformOrigin: '' });
    }
}

export function assertTimerStaticSamples(samples, reference) {
  assert.deepEqual(
    samples.map((sample) => [sample.variant, sample.size]),
    VARIANTS.flatMap((variant) => [16, 24, 48].map((size) => [variant, size])),
  );
  for (const sample of samples) {
    assert.equal(sample.icon, 'timer');
    assertSample(sample, reference);
    sameMatrices(
      sample.matrices,
      sample.paths.map(() => [1, 0, 0, 1, 0, 0]),
    );
    assert.equal(sample.generation, 0);
    assert.equal(sample.animations, 0);
  }
}

export async function motionProjectionBrowserProof(page, reference, mode, records, out) {
  const call = (method, ...args) =>
    page.evaluate(
      ({ method, args }) => window.__iconsPacked.motionProjectionConsumer[method](...args),
      { method, args },
    );
  const read = () => call('read');
  const check = async () => {
    const observation = await read();
    assert.equal(observation.samples.length, 18);
    for (const sample of observation.samples) assertSample(sample, reference);
    return observation;
  };
  const section = page.locator('section.motion-projection');
  const initial = await check();
  for (const icon of MOTION_PROJECTION_ROTATION_ICONS)
    for (const variant of variantsFor(icon)) {
      const raw = reference.icons[icon][variant];
      const host = section
        .locator(`[data-motion-icon="${icon}"][data-variant="${variant}"] lab-button`)
        .nth(1);
      const native = host.getByRole('button');
      await host.click();
      await native.focus();
      await native.press('Enter');
      await native.press('Space');
      const activated = await check();
      const sample = activated.samples.find(
        (item) => item.icon === icon && item.variant === variant && item.size === 24,
      );
      const events = activated.events.filter(
        (item) => item.icon === icon && item.variant === variant && item.size === 24,
      );
      assert.equal(sample.nativeClicks, 3);
      assert.equal(events.length, 3);
      for (const event of events) {
        assert.ok(event.trusted && event.composed && event.native);
        assertMotionProjectionEffect(event.effect, raw, icon, variant, {
          duration: 600,
          reducedMotion: mode === 'reduce',
        });
        if (mode === 'no-preference' && !event.initialize) sameMatrices(event.before, event.after);
      }
      const terminal = await call('settle', icon, variant);
      sameMatrices(
        terminal.matrices,
        initial.samples.find(
          (item) => item.icon === icon && item.variant === variant && item.size === 24,
        ).matrices,
      );
      records.push({
        name: `${mode}:${icon}/${variant}:thin-native-forward`,
        result: 'PASS',
        statuses: terminal.statuses,
        events,
      });
    }
  if (mode === 'no-preference') {
    for (const target of [0, 0.5]) {
      await call('start', 'reload', 'outline', { from: 0, to: 1, duration: 800, initialize: true });
      await page.waitForFunction(() => {
        const item = window.__iconsPacked.motionProjectionConsumer
          .read()
          .samples.find(
            (item) => item.icon === 'reload' && item.variant === 'outline' && item.size === 24,
          );
        const index = item.paths.findIndex((path) => path.role === 'control');
        const phase = Math.atan2(item.matrices[index][1], item.matrices[index][0]) / (2 * Math.PI);
        return phase > 0.05 && phase < 0.3;
      });
      const transfer = await page.evaluate((to) => {
        const consumer = window.__iconsPacked.motionProjectionConsumer;
        const item = consumer
          .read()
          .samples.find(
            (item) => item.icon === 'reload' && item.variant === 'outline' && item.size === 24,
          );
        const index = item.paths.findIndex((path) => path.role === 'control');
        const from = Math.atan2(item.matrices[index][1], item.matrices[index][0]) / (2 * Math.PI);
        return consumer.start('reload', 'outline', { from, to, duration: 240 });
      }, target);
      assert.ok(transfer.effect.from > 0.05 && transfer.effect.from < 0.3);
      sameMatrices(transfer.before, transfer.after);
      assertMotionProjectionEffect(
        transfer.effect,
        reference.icons.reload.outline,
        'reload',
        'outline',
        {
          from: transfer.effect.from,
          to: target,
          duration: 240,
        },
      );
      const terminal = await call('settle', 'reload', 'outline');
      const index = terminal.paths.findIndex((part) => part.role === 'control');
      sameMatrices([terminal.matrices[index]], [rotationMatrix(target)]);
      await check();
      records.push({
        name: `${mode}:reload:interrupt-${target === 0 ? 'reverse' : 'newer'}`,
        result: 'PASS',
        transfer,
        terminal,
      });
    }
  } else {
    const result = await call('start', 'reload', 'outline', {
      from: 0.125,
      to: 0.5,
      duration: 600,
      initialize: true,
    });
    assertMotionProjectionEffect(
      result.effect,
      reference.icons.reload.outline,
      'reload',
      'outline',
      {
        from: 0.125,
        to: 0.5,
        duration: 600,
        reducedMotion: true,
      },
    );
    const terminal = await call('settle', 'reload', 'outline');
    const index = terminal.paths.findIndex((part) => part.role === 'control');
    sameMatrices([terminal.matrices[index]], [rotationMatrix(0.5)]);
    records.push({
      name: `${mode}:reload:thin-reduced`,
      result: 'PASS',
      effect: result.effect,
      terminal,
    });
  }
  const refusals = await call('refuse');
  assertTimerRefusals(refusals.timer);
  for (const [field, code] of Object.entries({
    gesture: 'GESTURE_UNSUPPORTED',
    phase: 'INVALID_REQUEST',
  })) {
    assert.equal(refusals[field].ok, false);
    assert.equal(refusals[field].reason.code, code);
  }
  records.push({ name: `${mode}:thin-motion-precise-refusals`, result: 'PASS', refusals });
  for (const variant of VARIANTS) {
    const host = section
      .locator(`[data-motion-icon="timer"][data-variant="${variant}"] lab-button`)
      .nth(1);
    const native = host.getByRole('button');
    await host.click();
    await native.focus();
    await native.press('Enter');
    await native.press('Space');
    const observation = await check();
    const sample = observation.samples.find(
      (item) => item.icon === 'timer' && item.variant === variant && item.size === 24,
    );
    const events = observation.events.filter(
      (item) => item.icon === 'timer' && item.variant === variant && item.size === 24,
    );
    assert.equal(sample.nativeClicks, 3);
    assert.equal(events.length, 3);
    for (const event of events) {
      assert.ok(event.trusted && event.composed && event.native);
      assert.equal(event.refusal.ok, false);
      assert.equal(event.refusal.reason.code, 'SEMANTIC_MOTION_UNAVAILABLE');
      sameMatrices(event.before, event.after);
      assert.equal(event.generation, 0);
    }
    records.push({
      name: `${mode}:timer/${variant}:static-native-refusal`,
      result: 'PASS',
      events,
    });
  }
  const poses = await call('timerSamples');
  assertTimerStaticSamples(poses, reference);
  const file = timerRefusalVisualFile(mode);
  const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
  let png;
  try {
    png = await section
      .locator('.timer-static-refusal')
      .screenshot({ path: join(out, file.slice('result/'.length)) });
  } finally {
    await page.evaluate(([x, y]) => window.scrollTo(x, y), scroll);
  }
  await check();
  records.push({
    name: `${mode}:timer-static-refusal:capture`,
    result: 'PASS',
    file,
    icon: 'timer',
    variants: VARIANTS,
    sizes: [16, 24, 48],
    samples: 6,
    pngSha256: hash(png),
    poses,
    refusals: refusals.timer,
  });
  const exported = await downloadedSvg(page, section.locator('button.motion-projection-download'));
  const paths = await page.evaluate((text) => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    return {
      viewBox: svg.getAttribute('viewBox').split(/\s+/).map(Number),
      paths: [...svg.querySelectorAll('path')].map((path) => ({
        d: path.getAttribute('d'),
        fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
      })),
    };
  }, exported);
  assert.deepEqual(paths, {
    viewBox: reference.icons.timer.outline.viewBox,
    paths: reference.icons.timer.outline.paths,
  });
  records.push({
    name: `${mode}:timer:thin-svg-download`,
    result: 'PASS',
    svgSha256: hash(exported),
  });
  await check();
}

export async function motionProjectionDisposalProof(page, mode, records) {
  const cleanup = await page.evaluate(() =>
    window.__iconsPacked.motionProjectionConsumer.disposal(),
  );
  assert.equal(cleanup.connected, 0);
  assert.equal(cleanup.listenersRemoved, true);
  assert.ok(cleanup.statuses.length > 0);
  assert.ok(cleanup.statuses.every((status) => ['finished', 'stopped'].includes(status)));
  if (mode === 'no-preference') assert.ok(cleanup.statuses.includes('stopped'));
  await assert.rejects(
    page.evaluate(() => window.__iconsPacked.motionProjectionConsumer.read()),
    /MOTION_PROJECTION_DISPOSED/,
  );
  assert.equal(await page.locator('section.motion-projection').count(), 0);
  records.push({ name: `${mode}:thin-motion-disposal`, result: 'PASS', cleanup });
}

export async function motionProjectionArmDisposal(page) {
  await page.evaluate(() =>
    window.__iconsPacked.motionProjectionConsumer.start('reload', 'outline', {
      from: 0,
      to: 1,
      duration: 20000,
      initialize: true,
    }),
  );
}
