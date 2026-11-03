import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { downloadedSvg } from './icons-authored-dots-consumer.mjs';
import { MICROPHONE_ICONS, assertMicrophonePaths } from './icons-microphone-consumer.mjs';
import legacyWidthMotionFixture from './fixtures/icons-width-motion-v14.json' with { type: 'json' };

export const WIDTH_MOTION_ENTRIES = Object.freeze(
  MICROPHONE_ICONS.map((icon) => `@labpics/icons/gestures/${icon}`),
);
export const WIDTH_MOTION_POSES = Object.freeze([1, 0.92, 0.8]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(legacyWidthMotionFixture.sourceCommit, 'a5cc910cb1e0402dec634dc12e51aa4c2e94e440');
assert.equal(
  legacyWidthMotionFixture.sha256,
  '8b88a52f0a7bf094889ea5cd5c5a9543af71212806e6b60312a5d6eb797ca7cd',
);
assert.equal(hash(legacyWidthMotionFixture.fixture), legacyWidthMotionFixture.sha256);
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
export function widthMotionReference(raw) {
  return {
    version: 1,
    law: 'capsule.width',
    rawSha256: hash(stableJSON(raw)),
    poses: [...WIDTH_MOTION_POSES],
  };
}
export function validateWidthMotionReference(reference, raw) {
  assert.deepEqual(reference, widthMotionReference(raw));
  return reference;
}
export const WIDTH_MOTION_VISUAL_FILES = Object.freeze(
  ['no-preference', 'reduce'].flatMap((mode) =>
    WIDTH_MOTION_POSES.map((width) => `result/${mode}-width-motion-${width}.png`),
  ),
);

/** Один writer хранит только успешно записанный параметр. Часы принадлежат Motion. */
export function createPreparedScalarController(
  prepared,
  binding,
  value,
  media,
  {
    initial = 1,
    channel = 'width',
    last = 'lastWrittenWidth',
    target = 'targetWidth',
    prefix = 'WIDTH_MOTION',
  } = {},
) {
  let lastWrittenWidth = initial;
  const rest = prepared.sample(initial);
  if (!rest.ok) throw new Error(rest.reason.code);
  let lastD = rest.d;
  let targetWidth = initial;
  let generation = 0;
  let scalar;
  let playback;
  let unsubscribe = () => {};
  let disposed = false;
  let writes = 0;
  let notifications = 0;
  let stale = 0;
  let lastCompletion = null;
  let lastError = null;
  let retiredCompletion;
  let writerFailure = { cause: null };
  let retiredWriterFailure = null;
  const refusal = (code) => ({ ok: false, reason: { code } });
  const errorText = (error) => (error instanceof Error ? error.message : String(error));
  const active = () => {
    if (disposed) throw new Error(`${prefix}_DISPOSED`);
  };
  function rejectCorrespondence(raise = true) {
    // Отказ отзывает канал до эффекта; остановка Motion не стирает ошибку writer.
    generation++;
    unsubscribe();
    writerFailure.cause = 'RENDER_CORRESPONDENCE_MISMATCH';
    lastCompletion = 'failed';
    lastError = writerFailure.cause;
    scalar?.dispose();
    if (raise) throw new Error(writerFailure.cause);
    return refusal(writerFailure.cause);
  }
  function commit(width, current, admitted) {
    if (disposed || current !== generation) {
      stale++;
      return;
    }
    notifications++;
    const pose = admitted ?? prepared.sample(width);
    if (!pose.ok) throw new Error(pose.reason.code);
    if (!binding.valid(lastD)) return rejectCorrespondence();
    if (Object.is(width, lastWrittenWidth) && pose.d === lastD) return;
    binding.write(pose.d);
    lastD = pose.d;
    lastWrittenWidth = width;
    writes++;
  }
  function observeCompletion(current) {
    void playback.finished.then(
      (result) => {
        if (current === generation && !disposed) lastCompletion = result.status;
      },
      (error) => {
        if (current === generation && !disposed) {
          lastCompletion = 'failed';
          lastError = errorText(error);
        }
      },
    );
  }
  function request(width, duration = 500) {
    active();
    const admitted = prepared.sample(width);
    if (!admitted.ok) return admitted;
    if (!Number.isFinite(duration) || duration < 0) return refusal('INVALID_REQUEST');
    if (!binding.valid(lastD)) return rejectCorrespondence(false);
    const before = { [channel]: lastWrittenWidth, d: lastD };
    const current = ++generation;
    unsubscribe();
    if (playback) {
      retiredCompletion = playback.finished;
    }
    if (writerFailure.cause) retiredWriterFailure = writerFailure.cause;
    writerFailure = { cause: null };
    scalar?.dispose();
    scalar = value(lastWrittenWidth);
    targetWidth = width;
    lastCompletion = null;
    lastError = null;
    unsubscribe = scalar.subscribe((next) => commit(next, current));
    if (media.matches || duration === 0) commit(width, current, admitted);
    playback = scalar.animate(width, {
      duration: media.matches ? 0 : duration,
      ease: 'linear',
      reducedMotion: media.matches ? 'always' : 'user',
    });
    observeCompletion(current);
    return {
      ok: true,
      from: before[channel],
      to: width,
      generation,
      before,
      after: { [channel]: lastWrittenWidth, d: lastD },
    };
  }
  function terminate(method, raise = true) {
    active();
    if (!playback || !['running', 'paused'].includes(playback.state)) return;
    if (method === 'finish') {
      const admitted = prepared.sample(targetWidth);
      if (!admitted.ok || !binding.valid(lastD)) return rejectCorrespondence(raise);
      playback.finish();
      commit(targetWidth, generation, admitted);
    }
    // Завершение закрывает канал, включая уже сохранённый callback.
    const current = ++generation;
    unsubscribe();
    if (method === 'stop') playback.stop();
    scalar?.dispose();
    observeCompletion(current);
  }
  const preferenceChange = (event) => {
    if (event.matches && !disposed && playback) terminate('finish', false);
  };
  media.addEventListener('change', preferenceChange);
  return {
    request,
    read: () => ({
      [last]: lastWrittenWidth,
      [target]: targetWidth,
      generation,
      writes,
      notifications,
      stale,
      lastCompletion,
      lastError,
      playback: playback?.state ?? null,
      d: lastD,
    }),
    pause: () => {
      active();
      playback?.pause();
    },
    play: () => {
      active();
      playback?.play();
    },
    seek: (milliseconds) => {
      active();
      playback?.seek(milliseconds);
    },
    stop: () => terminate('stop'),
    finish: () => terminate('finish'),
    settle: async () => {
      active();
      // Waiter сохраняет исход своего исполнения, даже если уже принят successor.
      const failure = writerFailure;
      if (failure.cause) throw new Error(failure.cause);
      let timer;
      try {
        const result = await Promise.race([
          playback.finished,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${prefix}_TIMEOUT`)), 10000);
          }),
        ]);
        if (failure.cause) throw new Error(failure.cause);
        if (result.status !== 'finished')
          throw new Error(`${prefix}_${result.status.toUpperCase()}`);
        return result;
      } finally {
        clearTimeout(timer);
      }
    },
    cleanup: async () => {
      if (!disposed) {
        disposed = true;
        generation++;
        media.removeEventListener('change', preferenceChange);
        unsubscribe();
        scalar?.dispose();
      }
      const completions = [retiredCompletion, playback?.finished].filter(Boolean);
      // Ошибка остаётся в receipt, но не прерывает освобождение mounted DOM.
      const results = await Promise.allSettled(completions);
      return {
        disposed,
        [last]: lastWrittenWidth,
        writes,
        notifications,
        stale,
        statuses: results.map((result) =>
          result.status === 'fulfilled' ? result.value.status : 'failed',
        ),
        failures: [retiredWriterFailure, writerFailure.cause]
          .filter(Boolean)
          .concat(
            results
              .filter((result) => result.status === 'rejected')
              .map((result) => errorText(result.reason)),
          ),
      };
    },
  };
}

export function createBodyWidthController(prepared, binding, value, media) {
  return createPreparedScalarController(prepared, binding, value, media);
}

/** Baseline выполняет тот же width-закон полным публичным glyph() на каждом кадре. */
export function prepareFullGlyphWidth(api, variant) {
  const source = api.glyph({ variant });
  const ids = source.parts.map((part) => part.id);
  const compound = source.composition.kind === 'compound';
  const capability = api.glyphCapabilities(variant).variation;
  const partId = capability.targets.svg === 'supported' ? 'microphone-body' : null;
  const selector = compound ? `[data-parts="${ids.join(' ')}"]` : `[data-part="${partId}"]`;
  return {
    ok: true,
    prepared: {
      version: 1,
      icon: source.icon,
      variant,
      law: 'capsule.width',
      svg: source.svg,
      domain: { minimum: capability.domain.minimum, maximum: capability.domain.maximum },
      renderTarget: {
        selector,
        attribute: 'd',
        partId,
        unchangedPartIds: ids.filter((id) => id !== partId),
      },
      sample: (width) => {
        try {
          const glyph = api.glyph({ variant, variation: { bodyWidth: width } });
          return {
            ok: true,
            bodyWidth: width,
            d: compound
              ? glyph.parts.map((part) => part.d).join('')
              : glyph.parts.find((part) => part.id === partId).d,
          };
        } catch (error) {
          return { ok: false, reason: { code: error.code } };
        }
      },
    },
  };
}

/** Prepared и full-glyph измеряются на одинаковом mounted path и lifecycle. */
export function mountWidthWorkload(host, prepare, value, variant = 'outline') {
  const result = prepare(variant);
  if (!result.ok) throw new Error(result.reason.code);
  const prepared = result.prepared;
  host.innerHTML = prepared.svg;
  const svg = host.querySelector('svg');
  const targets = [...svg.querySelectorAll(prepared.renderTarget.selector)];
  if (targets.length !== 1 || prepared.renderTarget.attribute !== 'd')
    throw new Error('RENDER_CORRESPONDENCE_MISMATCH');
  const target = targets[0];
  const nodes = [svg, ...svg.querySelectorAll('*')];
  const original = prepared.sample(1);
  if (!original.ok || original.d !== target.getAttribute('d'))
    throw new Error('RENDER_CORRESPONDENCE_MISMATCH');
  const controller = createBodyWidthController(
    prepared,
    {
      read: () => target.getAttribute('d'),
      write: (d) => target.setAttribute('d', d),
      valid: (expected) =>
        target.isConnected &&
        nodes.every((node, index) => node === [svg, ...svg.querySelectorAll('*')][index]) &&
        target.getAttribute('d') === expected,
    },
    value,
    matchMedia('(prefers-reduced-motion: reduce)'),
  );
  return {
    controller,
    prepared,
    svg,
    target,
    read: () => ({
      ...controller.read(),
      paths: [...svg.querySelectorAll('path')].map((path) => ({
        d: path.getAttribute('d'),
        fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
      })),
    }),
    cleanup: async () => {
      const receipt = await controller.cleanup();
      host.replaceChildren();
      return receipt;
    },
  };
}

export function mountWidthMotionConsumer(apis, staticApis, peers, value) {
  const section = document.createElement('section');
  section.className = 'width-motion';
  const heading = document.createElement('h2');
  heading.id = 'width-motion-heading';
  heading.textContent = 'Форма в движении';
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading);
  const entries = [];
  const events = [];
  const listeners = [];
  let disposed = false;
  let disposal;
  const listen = (element, event, handler) => {
    if (disposed) return;
    element.addEventListener(event, handler);
    listeners.push({ element, event, handler });
  };
  for (const [iconIndex, api] of apis.entries())
    for (const variant of ['outline', 'filled']) {
      const result = api.prepareBodyWidth(variant);
      const capability = api.motionCapabilities(variant);
      if (!result.ok || !capability.ok) throw new Error('WIDTH_PREPARATION_REFUSED');
      const prepared = result.prepared;
      const group = document.createElement('div');
      group.className = 'width-motion-group';
      group.dataset.widthIcon = prepared.icon;
      group.dataset.variant = variant;
      const title = document.createElement('h3');
      title.textContent = `${iconIndex ? 'Микрофон в круге' : 'Микрофон'}: ${variant === 'outline' ? 'контурный' : 'залитый'}`;
      group.append(title);
      const samples = [];
      for (const size of [16, 24, 48]) {
        const row = document.createElement('div');
        row.className = 'width-motion-row';
        const button = document.createElement('lab-button');
        for (const [name, text] of Object.entries({
          size: 'l',
          icon: '',
          type: 'neutral',
          'aria-label': title.textContent,
        }))
          button.setAttribute(name, text);
        button.innerHTML = prepared.svg;
        const svg = button.querySelector('svg');
        svg.setAttribute('slot', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.style.width = `${size}px`;
        svg.style.height = `${size}px`;
        const targets = [...svg.querySelectorAll(prepared.renderTarget.selector)];
        if (targets.length !== 1 || targets[0].getAttribute('d') !== prepared.sample(1).d)
          throw new Error('RENDER_CORRESPONDENCE_MISMATCH');
        const nodes = [svg, ...svg.querySelectorAll('*')];
        const paths = [...svg.querySelectorAll('path')];
        const original = paths.map((path) => ({
          d: path.getAttribute('d'),
          fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
        }));
        row.append(button);
        const peerSamples = [];
        if (iconIndex === 1)
          for (const [index, peer] of peers.entries()) {
            const peerButton = document.createElement('lab-button');
            for (const [name, text] of Object.entries({
              size: 'l',
              icon: '',
              type: 'neutral',
              'aria-label': index === 0 ? 'Помощь' : 'Воспроизвести',
            }))
              peerButton.setAttribute(name, text);
            peerButton.innerHTML = peer.glyph({ variant }).svg;
            const peerSvg = peerButton.querySelector('svg');
            peerSvg.setAttribute('slot', 'icon');
            peerSvg.setAttribute('aria-hidden', 'true');
            peerSvg.setAttribute('focusable', 'false');
            peerSvg.style.width = `${size}px`;
            peerSvg.style.height = `${size}px`;
            peerSamples.push({ button: peerButton, svg: peerSvg, original: peerSvg.outerHTML });
            row.append(peerButton);
          }
        const caption = document.createElement('span');
        caption.textContent = `${size} px`;
        row.append(caption);
        group.append(row);
        samples.push({
          button,
          svg,
          target: targets[0],
          nodes,
          paths,
          original,
          size,
          peers: peerSamples,
          nativeClicks: 0,
        });
      }
      const controller = createBodyWidthController(
        prepared,
        {
          read: () => samples[0].target.getAttribute('d'),
          write: (d) => {
            for (const sample of samples) sample.target.setAttribute('d', d);
          },
          valid: (expected) =>
            samples.every(
              (sample) =>
                sample.target.isConnected &&
                sample.target.getAttribute('d') === expected &&
                sample.nodes.length === sample.svg.querySelectorAll('*').length + 1 &&
                sample.nodes.every(
                  (node, index) =>
                    node === [sample.svg, ...sample.svg.querySelectorAll('*')][index],
                ),
            ),
        },
        value,
        matchMedia('(prefers-reduced-motion: reduce)'),
      );
      const controls = document.createElement('div');
      controls.className = 'width-motion-controls';
      const status = document.createElement('output');
      status.setAttribute('aria-live', 'polite');
      status.textContent = 'Авторская ширина';
      for (const [width, label] of [
        [1, 'Авторская ширина'],
        [0.8, 'Узкий корпус'],
        [0.92, 'Ширина 92%'],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.width = String(width);
        listen(button, 'click', (event) => {
          const result = controller.request(width);
          events.push({ trusted: event.isTrusted, icon: prepared.icon, variant, result });
          status.textContent = `Ширина корпуса ${width}`;
        });
        controls.append(button);
      }
      for (const [method, label] of [
        ['pause', 'Пауза'],
        ['play', 'Продолжить'],
        ['finish', 'Завершить'],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.action = method;
        listen(button, 'click', () => controller[method]());
        controls.append(button);
      }
      const download = document.createElement('button');
      download.type = 'button';
      download.textContent = 'Скачать текущий SVG';
      download.className = 'width-motion-download';
      const exportSvg = () => {
        const svg = samples[1].svg.cloneNode(true);
        svg.removeAttribute('slot');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return svg.outerHTML;
      };
      listen(download, 'click', () => {
        const url = URL.createObjectURL(new Blob([exportSvg()], { type: 'image/svg+xml' }));
        const link = document.createElement('a');
        try {
          link.href = url;
          link.download = `${prepared.icon}-${variant}.svg`;
          document.body.append(link);
          link.click();
        } finally {
          link.remove();
          URL.revokeObjectURL(url);
        }
      });
      controls.append(download, status);
      group.append(controls);
      section.append(group);
      const entry = {
        api,
        staticApi: staticApis[iconIndex],
        icon: prepared.icon,
        variant,
        prepared,
        capability: capability.capabilities,
        controller,
        samples,
        group,
        exportSvg,
      };
      entries.push(entry);
      for (const sample of samples)
        listen(sample.button, 'click', (event) => {
          const target = controller.read().targetWidth === 1 ? 0.8 : 1;
          const result = controller.request(target);
          status.textContent = `Целевая ширина корпуса ${target}`;
          events.push({
            icon: prepared.icon,
            variant,
            trusted: event.isTrusted,
            composed: event.composed,
            native: event.composedPath().includes(sample.button.shadowRoot.querySelector('button')),
            result,
          });
        });
    }
  document.body.append(section);
  const find = (icon, variant) =>
    entries.find((entry) => entry.icon === icon && entry.variant === variant);
  const ready = Promise.all(
    entries.flatMap((entry) =>
      entry.samples.map(async (sample) => {
        await sample.button.updateComplete;
        if (disposed) return;
        const element = sample.button.shadowRoot.querySelector('button');
        const handler = () => sample.nativeClicks++;
        listen(element, 'click', handler);
      }),
    ),
  );
  const readEntry = (entry) => ({
    icon: entry.icon,
    variant: entry.variant,
    ...entry.controller.read(),
    capability: entry.capability,
    renderTarget: entry.prepared.renderTarget,
    staticCapability: entry.staticApi.glyphCapabilities(entry.variant).variation,
    samples: entry.samples.map((sample) => ({
      size: sample.size,
      width: sample.svg.getBoundingClientRect().width,
      height: sample.svg.getBoundingClientRect().height,
      viewBox: sample.svg.getAttribute('viewBox').split(/\s+/).map(Number),
      identity:
        sample.nodes.length === sample.svg.querySelectorAll('*').length + 1 &&
        sample.nodes.every(
          (node, index) => node === [sample.svg, ...sample.svg.querySelectorAll('*')][index],
        ),
      paths: [...sample.svg.querySelectorAll('path')].map((path) => ({
        d: path.getAttribute('d'),
        fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
      })),
      target: sample.button.shadowRoot.querySelector('button').getBoundingClientRect().toJSON(),
      hidden: sample.svg.getAttribute('aria-hidden'),
      focusable: sample.svg.getAttribute('focusable'),
      name: sample.button.getAttribute('aria-label'),
      nativeClicks: sample.nativeClicks,
      peersUnchanged: sample.peers.every((peer) => peer.svg.outerHTML === peer.original),
    })),
  });
  return {
    ready,
    read: () => ({ entries: entries.map(readEntry), events }),
    request: (icon, variant, width, duration) =>
      find(icon, variant).controller.request(width, duration),
    control: (icon, variant, method, argument) => find(icon, variant).controller[method](argument),
    settle: async (icon, variant) => {
      await find(icon, variant).controller.settle();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return readEntry(find(icon, variant));
    },
    staticPaths: (icon, variant, width) => {
      const glyph = find(icon, variant).staticApi.glyph({
        variant,
        variation: { bodyWidth: width },
      });
      return glyph.composition.kind === 'compound'
        ? [{ d: glyph.parts.map((part) => part.d).join(''), fillRule: glyph.composition.fillRule }]
        : glyph.parts.map(({ d, fillRule }) => ({ d, fillRule }));
    },
    preparationRefusals: () =>
      apis.map((api) => ({
        variant: api.prepareBodyWidth('unknown'),
        sample: api.prepareBodyWidth().prepared.sample(Number.NaN),
      })),
    cleanup: async () => {
      disposed = true;
      for (const item of listeners) item.element.removeEventListener(item.event, item.handler);
      const receipts = await Promise.all(entries.map((entry) => entry.controller.cleanup()));
      section.remove();
      const before = events.length;
      for (const entry of entries)
        for (const sample of entry.samples)
          sample.button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      disposal = {
        connected: section.isConnected,
        receipts,
        listenersRemoved: events.length === before,
      };
      return disposal;
    },
    disposal: () =>
      disposal && { ...disposal, current: entries.map((entry) => entry.controller.read()) },
  };
}

export function widthMotionFixture(schemaVersion = 15) {
  // Записанные schemas сохраняют literal fixture; новый consumer использует текущий executor.
  if (schemaVersion < 15) return legacyWidthMotionFixture.fixture;
  return `
import * as widthMotionMic from '@labpics/icons/gestures/mic';
import * as widthMotionCircle from '@labpics/icons/gestures/mic-circle';
import { value as widthMotionValue } from '@labpics/motion';
${createPreparedScalarController.toString()}
${createBodyWidthController.toString()}
const widthMotionConsumer=(${mountWidthMotionConsumer.toString()})([widthMotionMic,widthMotionCircle],[microphone0,microphone1],[microphoneQuestionSource,microphonePlaybackSource],widthMotionValue);
window.__iconsPacked.widthMotionConsumer=widthMotionConsumer;
window.__iconsPacked.ready=Promise.all([window.__iconsPacked.ready,widthMotionConsumer.ready]);
const widthMotionCleanup=window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup=async () => {await widthMotionConsumer.cleanup();return widthMotionCleanup();};
`;
}

export function widthMotionTypeFixture() {
  return `
import {prepareBodyWidth as prepareMic} from '@labpics/icons/gestures/mic';
import {prepareBodyWidth as prepareMicCircle} from '@labpics/icons/gestures/mic-circle';
prepareMic('outline'); const preparedWidth=prepareMicCircle('filled');
if(preparedWidth.ok) {preparedWidth.prepared.sample(.92);const attr:'d'=preparedWidth.prepared.renderTarget.attribute;}
// @ts-expect-error: gesture preparation принимает только variant.
prepareMic({bodyWidth:.8});
// @ts-expect-error: чужой variant не имеет target.
prepareMicCircle('duotone');
// @ts-expect-error: ширина — скаляр, геометрия принадлежит compiler.
if(preparedWidth.ok) preparedWidth.prepared.sample({width:.9});
`;
}

function assertWidthEntry(entry, raw) {
  const reference = raw.icons[entry.icon][entry.variant];
  assert.ok(entry.lastWrittenWidth >= 0.8 && entry.lastWrittenWidth <= 1);
  assert.equal(entry.capability.law, 'capsule.width');
  assert.deepEqual(entry.capability.formats, ['svg', 'prepared-width']);
  assert.deepEqual(entry.capability.author, reference.author);
  assert.equal(entry.capability.geometrySha256, entry.staticCapability.geometrySha256);
  assert.deepEqual(entry.capability.domain, entry.staticCapability.domain);
  assert.equal(entry.capability.anatomy.masterSha256, reference.author.masterSha256);
  assert.equal(
    entry.capability.anatomy.pathFingerprintSha256,
    reference.author.pathFingerprintSha256,
  );
  assert.equal(entry.renderTarget.attribute, 'd');
  assert.equal(entry.renderTarget.partId, 'microphone-body');
  assert.equal(
    entry.renderTarget.selector,
    reference.declaration.composition
      ? `[data-parts="${reference.declaration.parts.map((part) => part.id).join(' ')}"]`
      : '[data-part="microphone-body"]',
  );
  assert.deepEqual(
    entry.samples.map((sample) => sample.size),
    [16, 24, 48],
  );
  assert.deepEqual(
    entry.renderTarget.unchangedPartIds,
    reference.declaration.parts
      .filter((part) => part.id !== 'microphone-body')
      .map((part) => part.id),
  );
  for (const sample of entry.samples) {
    assert.equal(sample.identity, true);
    assert.equal(sample.peersUnchanged, true);
    assert.equal(sample.width, sample.size);
    assert.equal(sample.height, sample.size);
    assert.deepEqual(sample.viewBox, reference.viewBox);
    assert.ok(sample.target.width >= 44 && sample.target.height >= 44);
    assert.ok(sample.name.length > 0);
    assert.equal(sample.hidden, 'true');
    assert.equal(sample.focusable, 'false');
    assertMicrophonePaths(sample.paths, reference, entry.lastWrittenWidth);
  }
}

export function assertWidthMotionVisualEvidence(visuals, records, raw) {
  for (const mode of ['no-preference', 'reduce'])
    for (const width of WIDTH_MOTION_POSES) {
      const file = `result/${mode}-width-motion-${width}.png`;
      const images = visuals.filter((image) => image.path === file);
      const receipts = records.filter(
        (record) => record.name === `${mode}:width-motion-${width}:capture`,
      );
      assert.equal(images.length, 1);
      assert.equal(receipts.length, 1);
      const record = receipts[0];
      assert.equal(record.result, 'PASS');
      assert.equal(record.file, file);
      assert.equal(record.width, width);
      assert.equal(record.pngSha256, hash(images[0].bytes));
      assert.equal(record.entries.length, 4);
      assert.deepEqual(
        record.entries.map((entry) => `${entry.icon}/${entry.variant}`),
        MICROPHONE_ICONS.flatMap((icon) =>
          ['outline', 'filled'].map((variant) => `${icon}/${variant}`),
        ),
      );
      for (const entry of record.entries) {
        assert.equal(entry.lastWrittenWidth, width);
        assertWidthEntry(entry, raw);
      }
    }
}

export async function widthMotionBrowserProof(page, raw, mode, records, out) {
  const call = (method, ...args) =>
    page.evaluate(({ method, args }) => window.__iconsPacked.widthMotionConsumer[method](...args), {
      method,
      args,
    });
  const read = () => call('read');
  const check = async () => {
    const observation = await read();
    assert.equal(observation.entries.length, 4);
    for (const entry of observation.entries) assertWidthEntry(entry, raw);
    return observation;
  };
  const section = page.locator('section[aria-labelledby="width-motion-heading"]');
  await check();
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const group = section.locator(`[data-width-icon="${icon}"][data-variant="${variant}"]`);
      const host = group.locator('lab-button').nth(icon === 'mic' ? 1 : 3);
      await host.click();
      const native = host.getByRole('button');
      await native.focus();
      await native.press('Enter');
      await native.press('Space');
      await call('settle', icon, variant);
      const activated = await check();
      const nativeEvents = activated.events.filter(
        (event) => event.icon === icon && event.variant === variant,
      );
      assert.equal(nativeEvents.length, 3);
      assert.ok(
        nativeEvents.every(
          (event) => event.trusted && event.composed && event.native && event.result.ok,
        ),
      );
      assert.equal(
        activated.entries.find((entry) => entry.icon === icon && entry.variant === variant)
          .samples[1].nativeClicks,
        3,
      );
      records.push({
        name: `${mode}:${icon}/${variant}:width-native-input`,
        result: 'PASS',
        events: nativeEvents,
      });
      await call('request', icon, variant, 1, 0);
      await call('settle', icon, variant);
      const started = await call('request', icon, variant, 0.8, 800);
      assert.equal(started.ok, true);
      if (mode === 'no-preference') {
        const paused = await page.evaluate(
          ({ icon, variant }) => {
            const consumer = window.__iconsPacked.widthMotionConsumer;
            consumer.control(icon, variant, 'pause');
            consumer.control(icon, variant, 'seek', 280);
            return consumer
              .read()
              .entries.find((entry) => entry.icon === icon && entry.variant === variant);
          },
          { icon, variant },
        );
        assert.ok(Math.abs(paused.lastWrittenWidth - 0.93) < 1e-8);
        assert.ok(
          paused.samples[0].paths.some(
            (path, index) => path.d !== raw.icons[icon][variant].paths[index].d,
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        const beforeRefusal = await read();
        const refusal = await call('request', icon, variant, 0.79, 400);
        assert.equal(refusal.ok, false);
        assert.equal(refusal.reason.code, 'VARIATION_OUTSIDE_DOMAIN');
        const afterRefusal = await read();
        assert.deepEqual(afterRefusal, beforeRefusal);
        const reverse = await call('request', icon, variant, 1, 800);
        assert.deepEqual(reverse.before, reverse.after);
        assert.equal(reverse.from, paused.lastWrittenWidth);
        await call('control', icon, variant, 'pause');
        await call('control', icon, variant, 'seek', 200);
        const newer = await call('request', icon, variant, 0.92, 300);
        assert.deepEqual(newer.before, newer.after);
        const terminal = await call('settle', icon, variant);
        assert.equal(terminal.lastWrittenWidth, 0.92);
        assertWidthEntry(terminal, raw);
        await call('request', icon, variant, 0.8, 800);
        await call('control', icon, variant, 'pause');
        await call('control', icon, variant, 'seek', 280);
        const stopped = await call('control', icon, variant, 'stop');
        const stoppedPose = await read();
        await page.evaluate(() => new Promise(requestAnimationFrame));
        await page.evaluate(() => new Promise(requestAnimationFrame));
        assert.deepEqual(await read(), stoppedPose);
        await call('request', icon, variant, 1, 600);
        await call('control', icon, variant, 'finish');
        await call('settle', icon, variant);
        records.push({
          name: `${mode}:${icon}/${variant}:width-interrupt-lifecycle`,
          result: 'PASS',
          paused,
          reverse,
          newer,
          stopped,
        });
      } else {
        const terminal = await call('settle', icon, variant);
        assert.equal(terminal.lastWrittenWidth, 0.8);
        assertWidthEntry(terminal, raw);
      }
      const latest = await page.evaluate(
        ({ icon, variant }) => {
          const consumer = window.__iconsPacked.widthMotionConsumer;
          return [1, 0.8, 0.95, 0.84, 0.92].map((width) =>
            consumer.request(icon, variant, width, 100),
          );
        },
        { icon, variant },
      );
      assert.ok(latest.every((result) => result.ok));
      const terminal = await call('settle', icon, variant);
      assert.equal(terminal.lastWrittenWidth, 0.92);
      assertWidthEntry(terminal, raw);
      const staticPaths = await call('staticPaths', icon, variant, 0.92);
      assert.deepEqual(terminal.samples[0].paths, staticPaths);
      records.push({
        name: `${mode}:${icon}/${variant}:width-latest-wins`,
        result: 'PASS',
        latest,
        terminal,
      });
    }
  const refusals = await call('preparationRefusals');
  for (const result of refusals) {
    assert.equal(result.variant.reason.code, 'INVALID_REQUEST');
    assert.equal(result.sample.reason.code, 'INVALID_REQUEST');
  }
  records.push({ name: `${mode}:width-precise-refusals`, result: 'PASS', refusals });
  if (mode === 'no-preference') {
    await call('request', 'mic', 'outline', 1, 0);
    await call('request', 'mic', 'outline', 0.8, 800);
    await call('control', 'mic', 'outline', 'pause');
    await call('control', 'mic', 'outline', 'seek', 280);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(
      () => window.__iconsPacked.widthMotionConsumer.read().entries[0].lastWrittenWidth === 0.8,
    );
    const final = (await check()).entries[0];
    assert.equal(final.lastWrittenWidth, 0.8);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    records.push({ name: `${mode}:width-live-reduced-preference`, result: 'PASS', final });
  }
  for (const width of WIDTH_MOTION_POSES) {
    for (const icon of MICROPHONE_ICONS)
      for (const variant of ['outline', 'filled']) {
        await call('request', icon, variant, width, 0);
        await call('settle', icon, variant);
      }
    const observed = await check();
    for (const entry of observed.entries)
      assert.deepEqual(
        entry.samples[0].paths,
        await call('staticPaths', entry.icon, entry.variant, width),
      );
    const file = `result/${mode}-width-motion-${width}.png`;
    const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
    let png;
    try {
      png = await section.screenshot({ path: join(out, file.slice(7)) });
    } finally {
      await page.evaluate(([x, y]) => window.scrollTo(x, y), scroll);
    }
    await check();
    records.push({
      name: `${mode}:width-motion-${width}:capture`,
      result: 'PASS',
      file,
      width,
      pngSha256: hash(png),
      entries: observed.entries,
    });
  }
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const group = section.locator(`[data-width-icon="${icon}"][data-variant="${variant}"]`);
      const text = await downloadedSvg(page, group.locator('.width-motion-download'));
      const paths = await page.evaluate(
        (text) =>
          [...new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('path')].map(
            (path) => ({
              d: path.getAttribute('d'),
              fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
            }),
          ),
        text,
      );
      assert.deepEqual(paths, await call('staticPaths', icon, variant, 0.8));
      records.push({
        name: `${mode}:${icon}/${variant}:width-current-svg`,
        result: 'PASS',
        sha256: hash(text),
      });
    }
}

export async function widthMotionArmDisposal(page) {
  await page.evaluate(() =>
    window.__iconsPacked.widthMotionConsumer.request('mic', 'outline', 1, 20000),
  );
}
export async function widthMotionDisposalProof(page, mode, records) {
  const disposal = await page.evaluate(() => window.__iconsPacked.widthMotionConsumer.disposal());
  assert.equal(disposal.connected, false);
  assert.equal(disposal.listenersRemoved, true);
  if (mode === 'no-preference') assert.ok(disposal.receipts[0].statuses.includes('stopped'));
  await page.emulateMedia({ reducedMotion: mode === 'reduce' ? 'no-preference' : 'reduce' });
  assert.deepEqual(
    await page.evaluate(() => window.__iconsPacked.widthMotionConsumer.disposal()),
    disposal,
  );
  await page.emulateMedia({ reducedMotion: mode });
  records.push({ name: `${mode}:width-disposal`, result: 'PASS', disposal });
}

export function widthMotionMeasurementFixtures() {
  return MICROPHONE_ICONS.flatMap((icon) =>
    ['prepared', 'full-glyph'].map((kind) => ({
      key: `width-${icon}-${kind}`,
      entry: `@labpics/icons/${kind === 'prepared' ? 'gestures' : 'variations'}/${icon}`,
      source: `import * as api from '@labpics/icons/${kind === 'prepared' ? 'gestures' : 'variations'}/${icon}';\nimport {value} from '@labpics/motion';\n${createPreparedScalarController.toString()}\n${createBodyWidthController.toString()}\n${kind === 'full-glyph' ? prepareFullGlyphWidth.toString() : ''}\n${mountWidthWorkload.toString()}\nexport const mount=(host,variant) => mountWidthWorkload(host,${kind === 'prepared' ? 'api.prepareBodyWidth' : '(variant) => prepareFullGlyphWidth(api,variant)'},value,variant);\n`,
    })),
  );
}

/** Полная полезная closure включает один символ и реально используемый value executor. */
export async function measureWidthMotionConsumers(
  build,
  consumer,
  out,
  sourceIdentity,
  assertGraph,
) {
  const measurements = [];
  for (const scenario of widthMotionMeasurementFixtures()) {
    const entry = join(consumer, `${scenario.key}.mjs`);
    await writeFile(entry, scenario.source);
    const modules = new Set();
    const imports = new Map();
    const publicImports = new Set();
    const publicEntries = {};
    let code;
    await build({
      configFile: false,
      root: consumer,
      logLevel: 'warn',
      plugins: [
        {
          name: 'width-motion-identity',
          resolveId(source) {
            publicImports.add(source);
            return null;
          },
          async buildStart() {
            for (const name of [scenario.entry, '@labpics/motion']) {
              const resolved = await this.resolve(name, entry);
              assert.ok(resolved && !resolved.external);
              publicEntries[name] = resolved.id;
            }
          },
          generateBundle(_options, output) {
            for (const id of this.getModuleIds()) {
              const info = this.getModuleInfo(id);
              imports.set(id, [...info.importedIds, ...info.dynamicallyImportedIds]);
            }
            const chunks = Object.values(output);
            assert.equal(chunks.length, 1);
            assert.equal(chunks[0].type, 'chunk');
            code = chunks[0].code;
            for (const id of Object.keys(chunks[0].modules)) modules.add(id);
          },
        },
      ],
      build: {
        write: false,
        minify: true,
        lib: { entry, formats: ['es'], fileName: scenario.key },
      },
    });
    const graph = assertGraph(consumer, modules, publicEntries, imports, publicImports, [
      scenario.entry,
      '@labpics/motion',
    ]);
    const bytes = Buffer.from(code);
    const file = `width-motion-${scenario.key}.js`;
    await writeFile(join(out, 'bundle', file), bytes);
    measurements.push({
      key: scenario.key,
      entry: scenario.entry,
      ...sourceIdentity,
      sourceSha256: hash(scenario.source),
      sha256: hash(bytes),
      file,
      raw: bytes.length,
      gzip: gzipSync(bytes).length,
      brotli: brotliCompressSync(bytes).length,
      moduleGraph: graph,
      publicEntries: Object.fromEntries(
        Object.entries(publicEntries).map(([name, id]) => [
          name,
          relative(consumer, id).replaceAll('\\', '/'),
        ]),
      ),
    });
  }
  await writeFile(
    join(out, 'width-motion-measurements.json'),
    `${JSON.stringify(measurements, null, 2)}\n`,
  );
  return measurements;
}

export async function widthMotionMeasurementBrowserProof(page, measurements, raw, mode, records) {
  for (const measurement of measurements)
    for (const variant of ['outline', 'filled']) {
      const result = await page.evaluate(
        async ({ file, variant }) => {
          const api = await import(`/${file}`);
          const host = document.createElement('div');
          document.body.append(host);
          const workload = api.mount(host, variant);
          try {
            const first = workload.controller.request(0.8, 60);
            await workload.controller.settle();
            const narrow = workload.read();
            const last = workload.controller.request(0.92, 60);
            await workload.controller.settle();
            const final = workload.read();
            const disposal = await workload.cleanup();
            return { first, last, narrow, final, disposal };
          } finally {
            host.remove();
          }
        },
        { file: measurement.file, variant },
      );
      const icon = measurement.key.includes('mic-circle') ? 'mic-circle' : 'mic';
      assert.equal(result.first.ok, true);
      assert.equal(result.last.ok, true);
      assert.equal(result.narrow.lastWrittenWidth, 0.8);
      assert.equal(result.final.lastWrittenWidth, 0.92);
      assert.ok(result.narrow.writes > 0);
      assert.ok(result.final.writes > result.narrow.writes);
      assertMicrophonePaths(result.narrow.paths, raw.icons[icon][variant], 0.8);
      assertMicrophonePaths(result.final.paths, raw.icons[icon][variant], 0.92);
      records.push({
        name: `${mode}:${measurement.key}/${variant}:measured-useful-work`,
        result: 'PASS',
        measurementSha256: measurement.sha256,
        resultData: result,
      });
    }
}
