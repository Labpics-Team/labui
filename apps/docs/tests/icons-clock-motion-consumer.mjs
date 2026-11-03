import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadedSvg } from './icons-authored-dots-consumer.mjs';
import { createPreparedScalarController } from './icons-width-motion-consumer.mjs';

export const CLOCK_MOTION_ICONS = Object.freeze(['time', 'history']);
export const CLOCK_MOTION_ENTRIES = Object.freeze([
  ...CLOCK_MOTION_ICONS.map((icon) => `@labpics/icons/gestures/${icon}`),
  '@labpics/icons/symbols/time',
]);
export const CLOCK_MOTION_POSES = Object.freeze([
  { id: 'rest', hours: 0 },
  { id: 'separated', hours: 0.375 },
  { id: 'coincident', hours: 3 / 11 },
  { id: 'reverse', hours: -0.25 },
]);
export const CLOCK_MOTION_VISUAL_FILES = Object.freeze(
  ['no-preference', 'reduce'].flatMap((mode) => [
    ...CLOCK_MOTION_POSES.map(({ id }) => `result/${mode}-clock-${id}.png`),
    ...(mode === 'no-preference' ? [`result/${mode}-clock-interrupted.png`] : []),
  ]),
);
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

/** Oracle читает только закреплённые masters и аннотации, без compiler/sampler. */
export async function clockMotionReference(iconsRoot, pin, readAuthorMaster) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const semanticBytes = await readFile(join(iconsRoot, 'semantics/author-anatomy.json'));
  const semantic = JSON.parse(semanticBytes);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(semantic.schemaVersion, 1);
  assert.deepEqual(semantic.source, pin.figma);
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const icons = {};
  for (const icon of CLOCK_MOTION_ICONS) {
    icons[icon] = {};
    for (const variant of ['outline', 'filled']) {
      const record = manifest.icons[icon][variant];
      const sourceFile = `masters/figma/${pin.figma.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`;
      assert.equal(record.master, sourceFile);
      const bytes = await readFile(join(iconsRoot, sourceFile));
      assert.equal(bytes.length, record.bytes);
      assert.equal(hash(bytes), record.sha256);
      const { viewBox, dimensions, paths } = readAuthorMaster(bytes);
      const fingerprint = hash(stableJSON(paths.map((path, index) => ({ index, ...path }))));
      assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
      icons[icon][variant] = {
        sourceFile,
        viewBox,
        dimensions,
        paths,
        declaration: semantic.icons[icon][variant],
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
  return validateClockMotionReference(
    { ...pin.figma, semanticSha256: hash(semanticBytes), icons },
    pin.figma,
  );
}

export function validateClockMotionReference(reference, figma) {
  assert.equal(reference?.fileKey, figma.fileKey);
  assert.equal(reference.version, figma.version);
  assert.match(reference.semanticSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(reference.icons), CLOCK_MOTION_ICONS);
  for (const icon of CLOCK_MOTION_ICONS) {
    assert.deepEqual(Object.keys(reference.icons[icon]).sort(), ['filled', 'outline']);
    for (const variant of ['outline', 'filled']) {
      const item = reference.icons[icon][variant];
      assert.equal(
        item.sourceFile,
        `masters/figma/${figma.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`,
      );
      assert.deepEqual(item.viewBox, [0, 0, 24, 24]);
      assert.deepEqual(item.dimensions, [24, 24]);
      assert.equal(item.author.kind, 'figma');
      assert.equal(item.author.fileKey, figma.fileKey);
      assert.equal(item.author.version, figma.version);
      assert.match(item.author.nodeId, /^\d+:\d+$/);
      for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256'])
        assert.match(item.author[key], /^[a-f0-9]{64}$/);
      assert.equal(
        item.author.pathFingerprintSha256,
        hash(stableJSON(item.paths.map((path, index) => ({ index, ...path })))),
      );
      const declaration = item.declaration;
      assert.equal(declaration.masterSha256, item.author.masterSha256);
      assert.equal(declaration.pathFingerprintSha256, item.author.pathFingerprintSha256);
      assert.deepEqual(declaration.joint, {
        law: 'joint.authored-elbow',
        purpose: 'elapsed-time',
        pathIndex: icon === 'history' ? 1 : 0,
        contourIndex: icon === 'time' && variant === 'filled' ? 1 : 0,
        partIds: { minute: 'clock-minute', hour: 'clock-hour' },
        polarity: icon === 'time' && variant === 'filled' ? 'negative' : 'positive',
      });
      if (declaration.joint.polarity === 'positive') rawClockControls(item);
    }
  }
  return reference;
}

/** Узкий raw decoder нужен oracle; браузер никогда не восстанавливает анатомию. */
export function rawClockControls(reference) {
  const d = reference.paths[reference.declaration.joint.pathIndex].d;
  const tokens = d.match(/[MLHVCZ]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g);
  assert.equal(tokens.join(''), d.replace(/[\s,]/g, ''), 'clock oracle: неизвестная raw grammar');
  const points = [];
  const edges = [];
  let current;
  let start;
  for (let index = 0; index < tokens.length; ) {
    const command = tokens[index++];
    assert.ok(['M', 'L', 'H', 'V', 'C', 'Z'].includes(command));
    const count = { M: 2, L: 2, H: 1, V: 1, C: 6, Z: 0 }[command];
    const values = tokens.slice(index, index + count).map(Number);
    index += count;
    assert.ok(values.every(Number.isFinite));
    const next =
      command === 'H'
        ? [values[0], current[1]]
        : command === 'V'
          ? [current[0], values[0]]
          : command === 'Z'
            ? start
            : values.slice(-2);
    if (command === 'M') start = next;
    else edges.push({ command, start: current, end: next });
    if (command === 'C')
      for (let point = 0; point < values.length; point += 2)
        points.push(values.slice(point, point + 2));
    else if (command !== 'Z') points.push(next);
    current = next;
  }
  const up = edges
    .filter((edge) => ['L', 'V'].includes(edge.command) && edge.end[1] < edge.start[1])
    .sort((a, b) => b.start[1] - b.end[1] - (a.start[1] - a.end[1]))[0];
  const lower = edges
    .filter((edge) => ['L', 'H'].includes(edge.command) && edge.end[0] < edge.start[0])
    .sort((a, b) => b.start[0] - b.end[0] - (a.start[0] - a.end[0]))[0];
  assert.ok(up && lower);
  return {
    bearing: [lower.end[0], up.start[1]],
    minute: points.reduce((a, b) => (b[1] < a[1] ? b : a)),
    hour: points.reduce((a, b) => (b[0] > a[0] ? b : a)),
  };
}

export function clockPathPoints(d) {
  const contours = d.match(/M[^M]*Z/g) ?? [];
  assert.equal(contours.join(''), d);
  assert.equal(contours.length, 2);
  return contours.map((contour) => {
    assert.match(contour, /^M[LC0-9eE+.,\s-]+Z$/);
    const values = [...contour.matchAll(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g)].map(
      (match) => Number(match[0]),
    );
    assert.equal(values.length % 2, 0);
    assert.ok(values.every(Number.isFinite));
    return Array.from({ length: values.length / 2 }, (_, index) =>
      values.slice(index * 2, index * 2 + 2),
    );
  });
}

/** Четверть оборота — перестановка координат raw tip, без runtime тригонометрии. */
export function assertClockQuarterControls(d, reference, hours) {
  const controls = rawClockControls(reference);
  const contours = clockPathPoints(d);
  const [cx, cy] = controls.bearing;
  for (const [limb, rate] of [
    ['minute', 1],
    ['hour', 1 / 12],
  ]) {
    const quarter = hours * rate * 4;
    if (!Number.isInteger(quarter)) continue;
    const point = controls[limb];
    const x = point[0] - cx;
    const y = point[1] - cy;
    const expected = [
      [point[0], point[1]],
      [cx - y, cy + x],
      [cx - x, cy - y],
      [cx + y, cy - x],
    ][((quarter % 4) + 4) % 4];
    const u = Number.EPSILON / 2;
    const gamma = (64 * u) / (1 - 64 * u);
    assert.ok(
      contours[limb === 'minute' ? 0 : 1].some((actual) =>
        actual.every(
          (coordinate, index) =>
            Math.abs(coordinate - expected[index]) <=
            gamma * Math.max(1, Math.abs(coordinate), Math.abs(expected[index])),
        ),
      ),
      `clock oracle: ${limb} rate или authored pivot изменён`,
    );
  }
}

export function createClockHandsController(prepared, binding, value, media) {
  return createPreparedScalarController(prepared, binding, value, media, {
    initial: 0,
    channel: 'hours',
    last: 'lastWrittenHours',
    target: 'targetHours',
    prefix: 'CLOCK_MOTION',
  });
}

export function mountClockMotionConsumer(apis, timeFilledSvg, value) {
  const section = document.createElement('section');
  section.className = 'clock-motion width-motion';
  const heading = document.createElement('h2');
  heading.id = 'clock-motion-heading';
  heading.textContent = 'Ход времени';
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading);
  const entries = [];
  const events = [];
  const listeners = [];
  let disposed = false;
  let disposal;
  const listen = (element, type, handler) => {
    if (disposed) return;
    element.addEventListener(type, handler);
    listeners.push({ element, type, handler });
  };
  for (const [index, icon] of ['time', 'history'].entries())
    for (const variant of ['outline', 'filled']) {
      const result = apis[index].prepareClockHands(variant);
      const capability = apis[index].motionCapabilities(variant);
      if (
        result.ok !== capability.ok ||
        (!result.ok &&
          (icon !== 'time' ||
            variant !== 'filled' ||
            result.reason.code !== 'COMPOSITION_UNSUPPORTED'))
      )
        throw new Error('CLOCK_PREPARATION_MISMATCH');
      const group = document.createElement('div');
      group.className = 'width-motion-group';
      group.dataset.clockIcon = icon;
      group.dataset.variant = variant;
      const title = document.createElement('h3');
      title.textContent = `${icon === 'time' ? 'Время' : 'История'}: ${variant === 'outline' ? 'контурный' : 'залитый'}`;
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
          'aria-label': result.ok
            ? `Продвинуть ${title.textContent.toLowerCase()} на час`
            : title.textContent,
        }))
          button.setAttribute(name, text);
        button.innerHTML = result.ok ? result.prepared.svg : timeFilledSvg;
        const svg = button.querySelector('svg');
        svg.setAttribute('slot', 'icon');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.style.width = `${size}px`;
        svg.style.height = `${size}px`;
        const nodes = [svg, ...svg.querySelectorAll('*')];
        const paths = [...svg.querySelectorAll('path')];
        const originalPaths = paths.map((path) => ({
          d: path.getAttribute('d'),
          fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
        }));
        const targets = result.ok
          ? [...svg.querySelectorAll(result.prepared.renderTarget.selector)]
          : [];
        if (
          result.ok &&
          (targets.length !== 1 ||
            result.prepared.renderTarget.attribute !== 'd' ||
            targets[0].getAttribute('d') !== result.prepared.sample(0).d)
        )
          throw new Error('RENDER_CORRESPONDENCE_MISMATCH');
        const caption = document.createElement('span');
        caption.textContent = `${size} px`;
        row.append(button, caption);
        group.append(row);
        samples.push({
          button,
          svg,
          target: targets[0],
          nodes,
          paths,
          originalPaths,
          size,
          nativeClicks: 0,
          referenceHost: row,
        });
      }
      const controller = result.ok
        ? createClockHandsController(
            result.prepared,
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
                    sample.paths.every(
                      (path, index) =>
                        (path === sample.target ||
                          path.getAttribute('d') === sample.originalPaths[index].d) &&
                        (path.getAttribute('fill-rule') ?? 'nonzero') ===
                          sample.originalPaths[index].fillRule,
                    ) &&
                    sample.nodes.length === sample.svg.querySelectorAll('*').length + 1 &&
                    sample.nodes.every(
                      (node, index) =>
                        node === [sample.svg, ...sample.svg.querySelectorAll('*')][index],
                    ),
                ),
            },
            value,
            matchMedia('(prefers-reduced-motion: reduce)'),
          )
        : null;
      const controls = document.createElement('div');
      controls.className = 'width-motion-controls';
      const status = document.createElement('output');
      status.setAttribute('aria-live', 'polite');
      status.textContent = result.ok
        ? 'Авторская поза'
        : 'Статическая авторская форма. Движение стрелок пока недоступно.';
      if (controller) {
        for (const [hours, text] of [
          [0, 'Авторская поза'],
          [1, 'Вперёд на час'],
          [-1, 'Назад на час'],
        ]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = text;
          button.dataset.hours = String(hours);
          listen(button, 'click', () => {
            const target = hours === 0 ? 0 : controller.read().targetHours + hours;
            controller.request(target);
            status.textContent =
              target === 0 ? 'Авторская поза' : `От авторской позы прошло ${target} ч`;
          });
          controls.append(button);
        }
        for (const [method, text] of [
          ['pause', 'Пауза'],
          ['play', 'Продолжить'],
          ['finish', 'Завершить'],
        ]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = text;
          button.dataset.action = method;
          listen(button, 'click', () => controller[method]());
          controls.append(button);
        }
        for (const sample of samples)
          listen(sample.button, 'click', (event) => {
            const request = controller.request(controller.read().targetHours + 1);
            status.textContent = `От авторской позы прошло ${request.to} ч`;
            events.push({
              icon,
              variant,
              trusted: event.isTrusted,
              composed: event.composed,
              native: event
                .composedPath()
                .includes(sample.button.shadowRoot.querySelector('button')),
              request,
            });
          });
      } else for (const sample of samples) sample.button.setAttribute('disabled', '');
      const exportSvg = () => {
        const svg = samples[1].svg.cloneNode(true);
        svg.removeAttribute('slot');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return svg.outerHTML;
      };
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'clock-motion-download';
      download.textContent = 'Скачать текущий SVG';
      listen(download, 'click', () => {
        const url = URL.createObjectURL(new Blob([exportSvg()], { type: 'image/svg+xml' }));
        const link = document.createElement('a');
        try {
          link.href = url;
          link.download = `${icon}-${variant}.svg`;
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
      entries.push({ icon, variant, result, capability, controller, samples, exportSvg });
    }
  document.body.append(section);
  const find = (icon, variant) =>
    entries.find((entry) => entry.icon === icon && entry.variant === variant);
  const ready = Promise.all(
    entries.flatMap((entry) =>
      entry.samples.map(async (sample) => {
        await sample.button.updateComplete;
        if (!disposed)
          listen(
            sample.button.shadowRoot.querySelector('button'),
            'click',
            () => sample.nativeClicks++,
          );
      }),
    ),
  );
  const readEntry = (entry) => ({
    icon: entry.icon,
    variant: entry.variant,
    supported: entry.result.ok,
    refusal: entry.result.ok ? null : entry.result.reason.code,
    capability: entry.capability.ok ? entry.capability.capabilities : null,
    renderTarget: entry.result.ok ? entry.result.prepared.renderTarget : null,
    ...(entry.controller?.read() ?? { lastWrittenHours: 0 }),
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
      hidden: sample.svg.getAttribute('aria-hidden'),
      focusable: sample.svg.getAttribute('focusable'),
      name: sample.button.getAttribute('aria-label'),
      slot: sample.svg.getAttribute('slot'),
      target: sample.button.shadowRoot.querySelector('button').getBoundingClientRect().toJSON(),
      nativeClicks: sample.nativeClicks,
    })),
  });
  return {
    ready,
    read: () => ({ entries: entries.map(readEntry), events }),
    request: (icon, variant, hours, duration) =>
      find(icon, variant).controller?.request(hours, duration) ?? find(icon, variant).result,
    control: (icon, variant, method, argument) => find(icon, variant).controller[method](argument),
    settle: async (icon, variant) => {
      await find(icon, variant).controller?.settle();
      return readEntry(find(icon, variant));
    },
    preparationRefusals: () =>
      apis.map((api) => ({
        variant: api.prepareClockHands('unknown'),
        sample: api.prepareClockHands('outline').prepared.sample(Number.NaN),
      })),
    showReferences: (raw) => {
      for (const entry of entries)
        for (const sample of entry.samples) {
          const label = document.createElement('span');
          label.textContent = 'Авторский master';
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', raw.icons[entry.icon][entry.variant].viewBox.join(' '));
          svg.setAttribute('width', String(sample.size));
          svg.setAttribute('height', String(sample.size));
          svg.setAttribute('aria-hidden', 'true');
          for (const path of raw.icons[entry.icon][entry.variant].paths) {
            const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            element.setAttribute('d', path.d);
            element.setAttribute('fill-rule', path.fillRule);
            element.setAttribute('fill', 'currentColor');
            svg.append(element);
          }
          sample.referenceHost.append(svg, label);
        }
    },
    cleanup: async () => {
      disposed = true;
      for (const { element, type, handler } of listeners)
        element.removeEventListener(type, handler);
      const receipts = await Promise.all(
        entries.filter((entry) => entry.controller).map((entry) => entry.controller.cleanup()),
      );
      section.remove();
      const before = events.length;
      for (const entry of entries)
        for (const sample of entry.samples)
          sample.button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      disposal = {
        connected: section.isConnected,
        receipts,
        listenersRemoved: before === events.length,
      };
      return disposal;
    },
    disposal: () =>
      disposal && {
        ...disposal,
        current: entries
          .filter((entry) => entry.controller)
          .map((entry) => entry.controller.read()),
      },
  };
}

export function clockMotionFixture() {
  return `
import * as clockTime from '@labpics/icons/gestures/time';
import * as clockHistory from '@labpics/icons/gestures/history';
import {filled as clockTimeFilled} from '@labpics/icons/symbols/time';
import {value as clockValue} from '@labpics/motion';
${createClockHandsController.toString()}
const clockMotionConsumer=(${mountClockMotionConsumer.toString()})([clockTime,clockHistory],clockTimeFilled,clockValue);
window.__iconsPacked.clockMotionConsumer=clockMotionConsumer;
window.__iconsPacked.ready=Promise.all([window.__iconsPacked.ready,clockMotionConsumer.ready]);
const clockMotionCleanup=window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup=async () => {await clockMotionConsumer.cleanup();return clockMotionCleanup();};
`;
}

export function clockMotionTypeFixture() {
  return `
import {prepareClockHands as prepareTime} from '@labpics/icons/gestures/time';
import {prepareClockHands as prepareHistory} from '@labpics/icons/gestures/history';
import {filled as clockTimeFallback} from '@labpics/icons/symbols/time';
const staticClockSvg:string=clockTimeFallback;
prepareTime('filled'); const preparedClock=prepareHistory('outline');
if(preparedClock.ok) {const sample=preparedClock.prepared.sample(-.25);const attr:'d'=preparedClock.prepared.renderTarget.attribute;const reference:'authored-pose'=preparedClock.prepared.reference;}
type ClockParameter=Parameters<Extract<ReturnType<typeof prepareHistory>,{ok:true}>['prepared']['sample']>[0];
type ClockExpectTrue<T extends true>=T;
type RejectsClockObject=ClockExpectTrue<{hours:number} extends ClockParameter ? false : true>;
type RejectsClockString=ClockExpectTrue<string extends ClockParameter ? false : true>;
type RejectsClockVariant=ClockExpectTrue<'duotone' extends Parameters<typeof prepareTime>[0] ? false : true>;
`;
}

export function assertClockEntry(entry, raw) {
  const reference = raw.icons[entry.icon][entry.variant];
  const supported = reference.declaration.joint.polarity === 'positive';
  assert.equal(entry.supported, supported);
  assert.equal(entry.refusal, supported ? null : 'COMPOSITION_UNSUPPORTED');
  if (supported) {
    assert.equal(entry.capability.law, 'joint.authored-elbow');
    assert.equal(entry.capability.reference, 'authored-pose');
    assert.equal(entry.capability.parameter, 'elapsed-hours');
    assert.deepEqual(entry.capability.formats, ['svg', 'prepared-clock-hands']);
    assert.deepEqual(entry.capability.author, reference.author);
    assert.match(entry.capability.geometrySha256, /^[a-f0-9]{64}$/);
    assert.equal(entry.renderTarget.attribute, 'd');
    assert.equal(entry.renderTarget.selector, '[data-part="clock-hands"]');
    assert.deepEqual(entry.renderTarget.partIds, ['clock-minute', 'clock-hour']);
    assert.deepEqual(entry.renderTarget.unchangedPartIds, ['clock-enclosure']);
    assert.ok(Number.isFinite(entry.lastWrittenHours));
  }
  assert.deepEqual(
    entry.samples.map((sample) => sample.size),
    [16, 24, 48],
  );
  for (const sample of entry.samples) {
    assert.equal(sample.identity, true);
    assert.equal(sample.width, sample.size);
    assert.equal(sample.height, sample.size);
    assert.deepEqual(sample.viewBox, reference.viewBox);
    assert.equal(sample.hidden, 'true');
    assert.equal(sample.focusable, 'false');
    assert.equal(sample.slot, 'icon');
    assert.ok(sample.name.length > 0);
    assert.ok(sample.target.width >= 44 && sample.target.height >= 44);
    assert.equal(sample.paths.length, reference.paths.length);
    for (const [index, path] of sample.paths.entries()) {
      if (
        !supported ||
        index !== reference.declaration.joint.pathIndex ||
        entry.lastWrittenHours % 12 === 0
      )
        assert.deepEqual(path, reference.paths[index]);
      else {
        assert.equal(path.fillRule, 'nonzero');
        clockPathPoints(path.d);
      }
    }
  }
}

export function assertClockMotionVisualEvidence(visuals, records, raw) {
  for (const file of CLOCK_MOTION_VISUAL_FILES) {
    const matches = visuals.filter((visual) => visual.path === file);
    const captures = records.filter(
      (record) => record.file === file && record.name.endsWith(':clock-capture'),
    );
    assert.equal(matches.length, 1);
    assert.equal(captures.length, 1);
    const capture = captures[0];
    assert.equal(capture.result, 'PASS');
    assert.equal(capture.pngSha256, hash(matches[0].bytes));
    assert.deepEqual(
      capture.entries.map((entry) => `${entry.icon}/${entry.variant}`),
      ['time/outline', 'time/filled', 'history/outline', 'history/filled'],
    );
    for (const entry of capture.entries) assertClockEntry(entry, raw);
    const pose = CLOCK_MOTION_POSES.find(({ id }) => file.endsWith(`-${id}.png`));
    for (const entry of capture.entries.filter((entry) => entry.supported)) {
      if (pose) assert.equal(entry.lastWrittenHours, pose.hours);
      else assert.equal(entry.lastWrittenHours, 0.375);
    }
  }
}

export async function clockMotionBrowserProof(page, raw, mode, records, out) {
  const call = (method, ...args) =>
    page.evaluate(({ method, args }) => window.__iconsPacked.clockMotionConsumer[method](...args), {
      method,
      args,
    });
  const check = async () => {
    const read = await call('read');
    assert.equal(read.entries.length, 4);
    for (const entry of read.entries) assertClockEntry(entry, raw);
    return read;
  };
  const section = page.locator('section.clock-motion');
  await call('showReferences', raw);
  await check();
  const capture = async (id) => {
    const observation = await check();
    const file = `result/${mode}-clock-${id}.png`;
    const scroll = await page.evaluate(() => [scrollX, scrollY]);
    let png;
    try {
      png = await section.screenshot({ path: join(out, file.slice(7)) });
    } finally {
      await page.evaluate(([x, y]) => scrollTo(x, y), scroll);
    }
    records.push({
      name: `${mode}:${id}:clock-capture`,
      result: 'PASS',
      file,
      pngSha256: hash(png),
      entries: observation.entries,
    });
  };
  for (const icon of CLOCK_MOTION_ICONS)
    for (const variant of ['outline', 'filled']) {
      const group = section.locator(`[data-clock-icon="${icon}"][data-variant="${variant}"]`);
      if (icon === 'time' && variant === 'filled') {
        const refusal = await call('request', icon, variant, 1, 200);
        assert.equal(refusal.reason.code, 'COMPOSITION_UNSUPPORTED');
        assert.equal(await group.locator('[data-hours]').count(), 0);
        records.push({ name: `${mode}:time/filled:clock-static-refusal`, result: 'PASS', refusal });
        continue;
      }
      const host = group.locator('lab-button').nth(1);
      const native = host.getByRole('button');
      await host.click();
      await native.focus();
      await native.press('Enter');
      await native.press('Space');
      const activated = await call('settle', icon, variant);
      assertClockEntry(activated, raw);
      assert.equal(activated.samples[1].nativeClicks, 3);
      const events = (await check()).events.filter(
        (event) => event.icon === icon && event.variant === variant,
      );
      assert.equal(events.length, 3);
      assert.ok(
        events.every(
          (event) => event.trusted && event.composed && event.native && event.request.ok,
        ),
      );
      records.push({
        name: `${mode}:${icon}/${variant}:clock-native-input`,
        result: 'PASS',
        events,
      });
      for (const hours of [-0.25, 0.25, 3, -3, 12]) {
        await call('request', icon, variant, hours, 0);
        const observed = await call('settle', icon, variant);
        assertClockEntry(observed, raw);
        if (hours % 12 !== 0)
          assertClockQuarterControls(observed.d, raw.icons[icon][variant], hours);
        records.push({
          name: `${mode}:${icon}/${variant}:clock-quarters-${hours}`,
          result: 'PASS',
          hours,
          d: observed.d,
        });
      }
      await call('request', icon, variant, 0, 0);
      await call('settle', icon, variant);
      if (mode === 'no-preference') {
        const paused = await page.evaluate(
          ({ icon, variant }) => {
            const consumer = window.__iconsPacked.clockMotionConsumer;
            consumer.request(icon, variant, 1, 800);
            consumer.control(icon, variant, 'pause');
            consumer.control(icon, variant, 'seek', 300);
            return consumer
              .read()
              .entries.find((entry) => entry.icon === icon && entry.variant === variant);
          },
          { icon, variant },
        );
        assert.equal(paused.lastWrittenHours, 0.375);
        assertClockEntry(paused, raw);
        const invalid = await call('request', icon, variant, '1', 500);
        assert.equal(invalid.reason.code, 'INVALID_REQUEST');
        const before = (await check()).entries.find(
          (entry) => entry.icon === icon && entry.variant === variant,
        );
        assert.equal(before.d, paused.d);
        const reverse = await call('request', icon, variant, -1, 800);
        assert.deepEqual(reverse.before, reverse.after);
        assert.equal(reverse.from, paused.lastWrittenHours);
        await call('control', icon, variant, 'pause');
        await call('control', icon, variant, 'seek', 200);
        const newer = await call('request', icon, variant, 0.25, 500);
        assert.deepEqual(newer.before, newer.after);
        await call('control', icon, variant, 'finish');
        await call('settle', icon, variant);
        await call('request', icon, variant, -1, 800);
        await call('control', icon, variant, 'pause');
        await call('control', icon, variant, 'seek', 300);
        await call('control', icon, variant, 'stop');
        const stopped = await call('read');
        await page.evaluate(() => new Promise(requestAnimationFrame));
        await page.evaluate(() => new Promise(requestAnimationFrame));
        assert.deepEqual(await call('read'), stopped);
        records.push({
          name: `${mode}:${icon}/${variant}:clock-interrupt-lifecycle`,
          result: 'PASS',
          paused,
          reverse,
          newer,
          stopped,
        });
      }
      const latest = await page.evaluate(
        ({ icon, variant }) =>
          [-1, 0.5, 1, -0.25].map((hours) =>
            window.__iconsPacked.clockMotionConsumer.request(icon, variant, hours, 120),
          ),
        { icon, variant },
      );
      assert.ok(latest.every((receipt) => receipt.ok));
      const final = await call('settle', icon, variant);
      assert.equal(final.lastWrittenHours, -0.25);
      assertClockEntry(final, raw);
      records.push({
        name: `${mode}:${icon}/${variant}:clock-latest-wins`,
        result: 'PASS',
        latest,
        final,
      });
    }
  const refusals = await call('preparationRefusals');
  for (const refusal of refusals) {
    assert.equal(refusal.variant.reason.code, 'INVALID_REQUEST');
    assert.equal(refusal.sample.reason.code, 'INVALID_REQUEST');
  }
  records.push({ name: `${mode}:clock-precise-refusals`, result: 'PASS', refusals });
  if (mode === 'no-preference') {
    for (const icon of CLOCK_MOTION_ICONS)
      for (const variant of ['outline', 'filled'])
        if (!(icon === 'time' && variant === 'filled')) {
          await call('request', icon, variant, 0, 0);
          await call('settle', icon, variant);
          await page.evaluate(
            ({ icon, variant }) => {
              const consumer = window.__iconsPacked.clockMotionConsumer;
              consumer.request(icon, variant, 1, 800);
              consumer.control(icon, variant, 'pause');
              consumer.control(icon, variant, 'seek', 300);
            },
            { icon, variant },
          );
        }
    await capture('interrupted');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() =>
      window.__iconsPacked.clockMotionConsumer
        .read()
        .entries.filter((entry) => entry.supported)
        .every((entry) => entry.lastWrittenHours === 1),
    );
    const reduced = await check();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    records.push({ name: `${mode}:clock-live-reduced-preference`, result: 'PASS', reduced });
  }
  for (const pose of CLOCK_MOTION_POSES) {
    for (const icon of CLOCK_MOTION_ICONS)
      for (const variant of ['outline', 'filled'])
        if (!(icon === 'time' && variant === 'filled')) {
          await call('request', icon, variant, pose.hours, 0);
          await call('settle', icon, variant);
        }
    await capture(pose.id);
  }
  for (const icon of CLOCK_MOTION_ICONS)
    for (const variant of ['outline', 'filled']) {
      const group = section.locator(`[data-clock-icon="${icon}"][data-variant="${variant}"]`);
      const text = await downloadedSvg(page, group.locator('.clock-motion-download'));
      const exported = await page.evaluate((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        return {
          error: Boolean(doc.querySelector('parsererror')),
          xmlns: doc.documentElement.getAttribute('xmlns'),
          paths: [...doc.querySelectorAll('path')].map((path) => ({
            d: path.getAttribute('d'),
            fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
          })),
        };
      }, text);
      assert.equal(exported.error, false);
      assert.equal(exported.xmlns, 'http://www.w3.org/2000/svg');
      assert.deepEqual(
        exported.paths,
        (await check()).entries.find((entry) => entry.icon === icon && entry.variant === variant)
          .samples[1].paths,
      );
      const png = await page.evaluate(async (text) => {
        const blob = new Blob([text], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          return { width: image.naturalWidth, height: image.naturalHeight };
        } finally {
          URL.revokeObjectURL(url);
        }
      }, text);
      assert.equal(png.width, 24);
      assert.equal(png.height, 24);
      records.push({
        name: `${mode}:${icon}/${variant}:clock-current-svg`,
        result: 'PASS',
        sha256: hash(text),
        bytes: Buffer.byteLength(text),
      });
    }
}

export async function clockMotionArmDisposal(page) {
  await page.evaluate(() =>
    window.__iconsPacked.clockMotionConsumer.request('time', 'outline', 1, 20000),
  );
}
export async function clockMotionDisposalProof(page, mode, records) {
  const read = () => page.evaluate(() => window.__iconsPacked.clockMotionConsumer.disposal());
  const disposal = await read();
  assert.equal(disposal.connected, false);
  assert.equal(disposal.listenersRemoved, true);
  assert.ok(disposal.receipts.every((receipt) => receipt.disposed));
  if (mode === 'no-preference') assert.ok(disposal.receipts[0].statuses.includes('stopped'));
  await page.emulateMedia({ reducedMotion: mode === 'reduce' ? 'no-preference' : 'reduce' });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.deepEqual(await read(), disposal);
  await page.emulateMedia({ reducedMotion: mode });
  records.push({ name: `${mode}:clock-disposal`, result: 'PASS', disposal });
}
