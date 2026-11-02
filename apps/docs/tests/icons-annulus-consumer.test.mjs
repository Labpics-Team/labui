import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  ANNULUS_ENTRIES,
  ANNULUS_ICONS,
  annulusBrowserProof,
  annulusDownloadedSvg,
  annulusFixture,
  annulusPresenceGesture,
  annulusReference,
  annulusTypeFixture,
  assertAnnulusObservation,
  assertAnnulusPaths,
  rawAnnulusReference,
  validateAnnulusReference,
} from './icons-annulus-consumer.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-annulus-masters.json', import.meta.url)),
);
const pin = { sourceCommit: snapshot.sourceCommit, figma: snapshot.annotations.source };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Адаптер наблюдает DOM identity и protocol calls; SVG-геометрия остаётся у raw oracle/browser.
function mountedAnnulus({ mutateRendered } = {}) {
  let renders = 0;
  const downloads = [];
  const urls = new Map();
  const revoked = [];
  class Node {
    constructor(tag) {
      this.tag = tag;
      this.attributes = new Map();
      this.dataset = {};
      this.style = {};
      this.children = [];
      this.listeners = new Map();
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    setCustomValidity(value) {
      this.validity = value;
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    append(...nodes) {
      for (const node of nodes)
        if (node instanceof Node) {
          node.parentElement = this;
          this.children.push(node);
        }
    }
    remove() {
      if (this.parentElement)
        this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
      this.parentElement = null;
    }
    get isConnected() {
      return this === body || Boolean(this.parentElement?.isConnected);
    }
    querySelectorAll(selector) {
      const all = this.children.flatMap((node) => [node, ...node.querySelectorAll('*')]);
      return all.filter(
        (node) =>
          selector === '*' ||
          selector === node.tag ||
          (selector === 'path[data-part]' &&
            node.tag === 'path' &&
            node.dataset.part !== undefined),
      );
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    }
    set innerHTML(model) {
      this.children = [];
      const svg = new Node('svg');
      svg.setAttribute('viewBox', model.viewBox.join(' '));
      for (const part of model.parts) {
        const path = new Node('path');
        for (const [name, value] of Object.entries({
          'data-part': part.id,
          'data-role': part.role,
          d: part.d,
          'fill-rule': part.fillRule,
          fill: part.paint.fill,
        }))
          path.setAttribute(name, value);
        svg.append(path);
      }
      this.append(svg);
      mutateRendered?.(svg, model);
    }
    get outerHTML() {
      const attrs = [...this.attributes].map(([name, value]) => `${name}="${value}"`);
      if (this.style.opacity !== undefined) attrs.push(`style="opacity: ${this.style.opacity};"`);
      return `<${this.tag}${attrs.length ? ` ${attrs.join(' ')}` : ''}>${this.children.map((node) => node.outerHTML).join('')}</${this.tag}>`;
    }
    cloneNode(deep) {
      const clone = new Node(this.tag);
      for (const [key, value] of this.attributes) clone.setAttribute(key, value);
      clone.style = { ...this.style };
      if (deep) clone.append(...this.children.map((node) => node.cloneNode(true)));
      return clone;
    }
    getBoundingClientRect() {
      return { width: 48, height: 44 };
    }
    click() {
      this.listeners.get('click')?.({ isTrusted: false });
      if (this.tag === 'a')
        downloads.push({ href: this.href, name: this.download, connected: this.isConnected });
    }
  }
  const body = new Node('body');
  const requests = [];
  const controls = [];
  const gesture = {
    id: 'checkmark-circle.presence',
    kind: 'state',
    progress: 'normalized-0-to-1',
    restProgress: 1,
    partIds: ['confirmation-mark'],
    tracks: [
      {
        partId: 'confirmation-mark',
        kind: 'opacity',
        unit: 'fraction',
        interpolation: 'linear',
        stops: [
          { at: 0, value: 0 },
          { at: 1, value: 1 },
        ],
      },
    ],
  };
  const context = {
    document: { createElement: (tag) => new Node(tag), body },
    window: { __iconsPacked: { cleanup() {} } },
    renderGlyphSvg: (model) => {
      renders++;
      return model;
    },
    getComputedStyle: (node) => ({ opacity: node.style.opacity ?? '1' }),
    navigator: { userActivation: { isActive: true } },
    performance: { now: () => 100 },
    matchMedia: () => ({ matches: false }),
    encodeURIComponent,
    TextEncoder,
    Blob,
    URL: {
      createObjectURL: (blob) => {
        const url = `blob:annulus-${urls.size}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL: (url) => revoked.push(url),
    },
    compileSymbolEffect(model, capability, id, request) {
      requests.push({ model, capability, id, request });
      if (id !== gesture.id) return { ok: false, reason: { code: 'GESTURE_UNSUPPORTED' } };
      return {
        ok: true,
        effect: {
          version: 2,
          icon: model.icon,
          variant: model.variant,
          gesture: id,
          from: request.from,
          to: request.to,
          targets: [
            { partId: gesture.partIds[0], property: 'opacity', from: request.from, to: request.to },
          ],
          unchangedPartIds: [model.parts.at(-1).id],
          stages: [
            {
              partId: gesture.partIds[0],
              property: 'opacity',
              to: request.to,
              at: 0,
              duration: request.reducedMotion ? 0 : request.duration,
            },
          ],
          options: {
            duration: request.reducedMotion ? 0 : request.duration,
            easing: 'linear',
            fill: 'both',
          },
        },
      };
    },
    sequence(steps, options) {
      let resolve;
      const control = {
        state: 'running',
        duration: Math.max(...steps.map((step) => step[2].duration)),
        finished: new Promise((done) => {
          resolve = done;
        }),
        pause() {
          this.state = 'paused';
        },
        seek(time) {
          for (const [node, { opacity }, timing] of steps) {
            const [from, to] = Array.isArray(opacity)
              ? opacity
              : [Number(node.style.opacity), opacity];
            node.style.opacity = String(
              timing.duration === 0 ? to : from + ((to - from) * time) / timing.duration,
            );
          }
        },
        stop() {
          this.state = 'stopped';
          resolve({ status: 'stopped' });
        },
        finish() {
          this.seek(this.duration);
          this.state = 'finished';
          resolve({ status: 'finished' });
        },
      };
      for (const [node, { opacity }] of steps)
        node.style.opacity = String(Array.isArray(opacity) ? opacity[0] : opacity);
      controls.push(control);
      if (options.reducedMotion === 'always') control.finish();
      return control;
    },
    scalarSequenceSteps(effect, byPart, visible) {
      return effect.stages.flatMap((stage) =>
        byPart
          .get(stage.partId)
          .map((node) => [
            node,
            { opacity: [visible.get(node), stage.to] },
            { at: stage.at, duration: stage.duration, ease: 'linear' },
          ]),
      );
    },
  };
  for (const [index, icon] of ANNULUS_ICONS.entries()) {
    const parts = snapshot.annotations.icons[icon].outline.parts.map(({ id, role }, zIndex) => ({
      id,
      role,
      zIndex,
      d: `M${zIndex} 0L1 1Z`,
      fillRule: role === 'container' ? 'evenodd' : 'nonzero',
      paint: { kind: 'fill', fill: 'currentColor' },
    }));
    const sources = Object.fromEntries(
      ['outline', 'filled'].map((variant) => [
        variant,
        {
          icon,
          variant,
          viewBox: [0, 0, 24, 24],
          parts,
          composition: { kind: 'layers' },
          provenance: { kind: 'source', author: { icon, variant } },
        },
      ]),
    );
    context[`annulusSource${index}`] = { glyph: ({ variant }) => sources[variant] };
    context[`annulus${index}`] = {
      glyph(query = {}) {
        const variant = query.variant ?? 'outline';
        const source = sources[variant];
        if (!query.variation || query.variation.enclosureEmphasis === 1) return source;
        const emphasis = query.variation.enclosureEmphasis;
        if (!Number.isFinite(emphasis) || emphasis <= 0)
          throw Object.assign(new Error('input'), { code: 'INVALID_VARIATION' });
        return {
          ...source,
          parts: source.parts.map((part) =>
            part.role === 'container' ? { ...part, d: `M${emphasis} 0L1 1Z` } : part,
          ),
          provenance: { ...source.provenance, kind: 'authored-variation' },
        };
      },
      glyphCapabilities: (variant) => ({
        motion: {
          state: icon === 'checkmark-circle' ? 'gesture-ready' : 'source-only',
          gestures: icon === 'checkmark-circle' ? [gesture] : [],
        },
        ...(variant === 'outline' && {
          variation: {
            law: 'annulus.counter-scale',
            targets: { webEffect: 'existing-part-gestures' },
          },
        }),
      }),
    };
  }
  runInNewContext(annulusFixture().replace(/^import[^\n]*\n/gm, ''), context);
  return {
    context,
    body,
    downloads,
    urls,
    revoked,
    requests,
    controls,
    renders: () => renders,
    item: context.window.__iconsPacked.annulusConsumers['checkmark-circle/outline'],
  };
}

test('accepted enclosure changes preserve mounted paths rather than replacing the content DOM', () => {
  const mounted = mountedAnnulus();
  const before = mounted.body.querySelectorAll('svg');
  const nodes = before.flatMap((svg) => svg.querySelectorAll('*'));
  const renders = mounted.renders();
  assert.equal(mounted.item.update({ enclosureEmphasis: 1.2 }).ok, true);
  assert.ok(mounted.body.querySelectorAll('svg').every((node, index) => node === before[index]));
  assert.ok(
    before
      .flatMap((svg) => svg.querySelectorAll('*'))
      .every((node, index) => node === nodes[index]),
  );
  assert.equal(
    mounted.renders(),
    renders,
    'existing geometry update must not render replacement markup',
  );
});

test('annulus native download captures the visible SVG in a Blob and releases its URL', async () => {
  const mounted = mountedAnnulus();
  const figure = mounted.body
    .querySelectorAll('figure')
    .find((node) => node.dataset.annulus === 'checkmark-circle/outline');
  const button = figure
    .querySelectorAll('button')
    .find((node) => node.textContent === 'Скачать SVG');
  button.listeners.get('click')({ isTrusted: true });
  const [download] = mounted.downloads;
  assert.ok(download.href.startsWith('blob:'));
  assert.equal(await mounted.urls.get(download.href).text(), mounted.item.read().exportSvg);
  assert.equal(mounted.urls.get(download.href).type, 'image/svg+xml');
  assert.deepEqual(mounted.revoked, [download.href]);
  assert.equal(download.name, 'checkmark-circle-outline.svg');
  assert.equal(download.connected, true);
});

test('failed annulus download activation releases the Blob URL and preserves the drawing', () => {
  const mounted = mountedAnnulus();
  const before = mounted.item.read().exportSvg;
  const figure = mounted.body
    .querySelectorAll('figure')
    .find((node) => node.dataset.annulus === 'checkmark-circle/outline');
  const button = figure
    .querySelectorAll('button')
    .find((node) => node.textContent === 'Скачать SVG');
  const error = new Error('native activation failed');
  const create = mounted.context.document.createElement;
  mounted.context.document.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'a')
      node.click = () => {
        throw error;
      };
    return node;
  };
  assert.throws(
    () => button.listeners.get('click')({ isTrusted: true }),
    (observed) => observed === error,
  );
  assert.equal(mounted.revoked.length, 1);
  assert.equal(mounted.body.querySelectorAll('a').length, 0);
  const after = mounted.item.read();
  assert.equal(after.exportSvg, before);
  assert.equal(after.downloadEvents.at(-1).ok, false);
  assert.equal(after.downloadEvents.at(-1).error, error.message);
});

test('presence gesture selection requires unique invertible declared opacity progress', () => {
  const gesture = mountedAnnulus().context.annulus1.glyphCapabilities('outline').motion.gestures[0];
  const capability = (gestures) => ({ motion: { state: 'gesture-ready', gestures } });
  assert.equal(annulusPresenceGesture(capability([gesture])), gesture);
  assert.equal(annulusPresenceGesture(capability([gesture, structuredClone(gesture)])), null);
  assert.equal(
    annulusPresenceGesture({ motion: { state: 'anchored', gestures: [gesture] } }),
    null,
  );
  for (const mutate of [
    (value) => {
      value.restProgress = 0;
    },
    (value) => {
      value.kind = 'cycle';
    },
    (value) => {
      value.partIds.push('other');
    },
    (value) => {
      value.tracks.push(structuredClone(value.tracks[0]));
    },
    (value) => {
      value.tracks[0].partId = 'other';
    },
    (value) => {
      value.tracks[0].kind = 'rotate';
    },
    (value) => {
      value.tracks[0].unit = 'degrees';
    },
    (value) => {
      value.tracks[0].interpolation = 'cubic';
    },
    (value) => {
      value.tracks[0].stops[0].value = 0.1;
    },
    (value) => {
      value.tracks[0].stops.splice(1, 0, { at: 0.5, value: 0.9 });
    },
  ]) {
    const changed = structuredClone(gesture);
    mutate(changed);
    assert.equal(annulusPresenceGesture(capability([changed])), null);
  }
});

test('visible SVG snapshot copies only declared part opacity and preserves the mounted drawing', () => {
  const mounted = mountedAnnulus();
  mounted.item.changeConfirmation(0, 1200);
  mounted.item.pauseConfirmationAt(300);
  const figure = mounted.body
    .querySelectorAll('figure')
    .find((node) => node.dataset.annulus === 'checkmark-circle/outline');
  const svg = figure.querySelectorAll('svg')[1];
  const before = svg.outerHTML;
  const exported = mounted.item.read().exportSvg;
  assert.ok(
    exported.includes('data-part="confirmation-mark"') && exported.includes('opacity: 0.75;'),
  );
  assert.ok(
    !exported.slice(exported.indexOf('data-part="confirmation-enclosure"')).includes('style='),
  );
  assert.equal(svg.outerHTML, before);
  assert.throws(() => mounted.context.visibleAnnulusSvg(svg, ['missing']), /самостоятельная часть/);
});

test('reverse and newer confirmation targets start from the captured visible pose', async () => {
  const mounted = mountedAnnulus();
  mounted.item.changeConfirmation(0, 1200);
  mounted.item.pauseConfirmationAt(300);
  const reversed = mounted.item.changeConfirmation(1, 600);
  assert.equal(reversed.effect.from, 0.75);
  assert.deepEqual(reversed.after, reversed.before);
  assert.equal(mounted.controls[0].state, 'stopped');
  mounted.item.pauseConfirmationAt(200);
  const newer = mounted.item.changeConfirmation(0, 300);
  assert.ok(newer.effect.from > 0.75 && newer.effect.from < 1);
  assert.deepEqual(newer.after, newer.before);
  await Promise.resolve();
  assert.equal(mounted.item.read().confirmation.completion, null);
  mounted.controls.at(-1).finish();
  const terminal = await mounted.item.settleConfirmation();
  assert.equal(terminal.completionStatus, 'finished');
  assert.ok(terminal.confirmation.opacity.every((part) => part.value === 0));
});

test('an older completed occurrence cannot mark a newer confirmation finished', async () => {
  const mounted = mountedAnnulus();
  mounted.item.changeConfirmation(0, 300);
  mounted.controls[0].finish();
  mounted.item.changeConfirmation(1, 600);
  await Promise.resolve();
  assert.equal(mounted.item.read().confirmation.completion, null);
  assert.equal(mounted.item.read().confirmation.playback, 'running');
  mounted.controls[1].finish();
  assert.equal((await mounted.item.settleConfirmation()).confirmation.completion, 'finished');
});

test('active enclosure changes retain motion control, visible pose and content node identity', () => {
  const mounted = mountedAnnulus();
  const figure = mounted.body
    .querySelectorAll('figure')
    .find((node) => node.dataset.annulus === 'checkmark-circle/outline');
  const nodes = figure.querySelectorAll('path');
  mounted.item.changeConfirmation(0, 1200);
  mounted.controls[0].seek(300);
  const before = mounted.item.read();
  const changed = mounted.item.update({ enclosureEmphasis: 1.2 });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.continuity.after, changed.continuity.before);
  assert.equal(changed.continuity.playback, 'running');
  assert.equal(changed.continuity.generation, before.confirmation.generation);
  assert.equal(mounted.controls.length, 1);
  assert.ok(figure.querySelectorAll('path').every((node, index) => node === nodes[index]));
  assert.deepEqual(mounted.item.read().confirmation.opacity, before.confirmation.opacity);
});

test('owner layout, paint and content drift refuse without committing an unaccepted model', () => {
  for (const mutate of [
    (model) => {
      model.viewBox[2] = 48;
    },
    (model) => {
      model.composition.kind = 'compound';
    },
    (model) => {
      model.parts[0].d += 'M9 9Z';
    },
    (model) => {
      model.parts[0].id = 'other';
    },
    (model) => {
      model.parts[0].role = 'container';
    },
    (model) => {
      model.parts[0].zIndex = 5;
    },
    (model) => {
      model.parts[0].fillRule = 'evenodd';
    },
    (model) => {
      model.parts[0].paint.fill = 'red';
    },
    (model) => {
      model.parts[0].paint.kind = 'stroke';
    },
  ]) {
    const mounted = mountedAnnulus();
    assert.equal(mounted.item.update({ enclosureEmphasis: 1.2 }).ok, true);
    const before = mounted.item.read();
    const glyph = mounted.context.annulus1.glyph;
    mounted.context.annulus1.glyph = (query) => {
      const model = structuredClone(glyph(query));
      mutate(model);
      return model;
    };
    const changed = mounted.item.update({ enclosureEmphasis: 0.8 });
    assert.equal(changed.ok, false);
    assert.equal(changed.code, 'RENDER_CORRESPONDENCE_MISMATCH');
    const after = mounted.item.read();
    assert.equal(after.emphasis, before.emphasis);
    assert.equal(after.provenance, before.provenance);
    assert.deepEqual(after.paths, before.paths);
    assert.equal(after.exportSvg, before.exportSvg);
  }
});

test('mounted viewport, paint, path or node drift refuse before a geometry change', () => {
  for (const mutate of [
    (svg) => {
      svg.setAttribute('viewBox', '0 0 48 48');
    },
    (svg) => {
      svg.setAttribute('width', '99');
    },
    (svg) => {
      svg.querySelector('path').setAttribute('fill', 'red');
    },
    (svg) => {
      svg.querySelector('path').setAttribute('stroke', 'red');
    },
    (svg) => {
      svg.querySelector('path').setAttribute('d', 'M0 0Z');
    },
    (svg) => {
      svg.append(svg.querySelector('path').cloneNode(true));
    },
    (svg) => {
      const node = svg.querySelector('path');
      const copy = node.cloneNode(true);
      node.remove();
      svg.append(copy);
    },
  ]) {
    const mounted = mountedAnnulus();
    const figure = mounted.body
      .querySelectorAll('figure')
      .find((node) => node.dataset.annulus === 'checkmark-circle/outline');
    const before = mounted.item.read();
    const svg = figure.querySelectorAll('svg')[1];
    const children = [...svg.children];
    const attributes = new Map(svg.attributes);
    const pathAttributes = children.map((node) => new Map(node.attributes));
    mutate(svg);
    const mutatedDrawing = svg.outerHTML;
    const changed = mounted.item.update({ enclosureEmphasis: 1.2 });
    assert.equal(changed.ok, false);
    assert.equal(changed.code, 'RENDER_CORRESPONDENCE_MISMATCH');
    assert.equal(svg.outerHTML, mutatedDrawing, 'refusal must not partly write the new geometry');
    svg.attributes = attributes;
    svg.children = children;
    for (const [index, node] of children.entries()) {
      node.attributes = pathAttributes[index];
      node.parentElement = svg;
    }
    assert.equal(mounted.item.read().emphasis, 1);
    assert.deepEqual(mounted.item.read().paths, before.paths);
  }
});

test('initial layer binding rejects mismatched markup and removes the unmounted figure', () => {
  let figure;
  assert.throws(
    () =>
      mountedAnnulus({
        mutateRendered: (svg) => {
          figure = svg.parentElement.parentElement.parentElement;
          svg.querySelector('path').setAttribute('data-part', 'other');
        },
      }),
    (error) => error.code === 'RENDER_CORRESPONDENCE_MISMATCH',
  );
  assert.equal(figure.isConnected, false);
});

test('active cleanup stops motion once and rejects further actions', async () => {
  const mounted = mountedAnnulus();
  mounted.item.changeConfirmation(0, 1200);
  mounted.item.cleanup();
  mounted.item.cleanup();
  assert.equal(mounted.controls[0].state, 'stopped');
  const disposed = await mounted.item.disposal();
  assert.equal(disposed.connected, false);
  assert.equal(disposed.completionStatus, 'stopped');
  assert.throws(() => mounted.item.update({ enclosureEmphasis: 1.2 }), /освобождён/);
  assert.throws(() => mounted.item.changeConfirmation(1), /освобождён/);
  assert.throws(() => mounted.item.pauseConfirmationAt(0), /освобождён/);
  await assert.rejects(mounted.item.settleConfirmation(), /не завершилось/);
});

test('download diagnostics retain the original failure even if live diagnostics also fail', async () => {
  for (const diagnosticsFail of [false, true]) {
    const error = new Error('native download timeout');
    const stack = error.stack;
    const page = {
      waitForEvent: async () => {
        throw error;
      },
      evaluate: async () => {
        if (diagnosticsFail) throw new Error('page closed');
        return [{ trusted: true, activated: true, scheme: 'data' }];
      },
    };
    const figure = { getByRole: () => ({ click: async () => {} }) };
    await assert.rejects(
      annulusDownloadedSvg(page, figure, 'checkmark-circle/outline', 'reduce'),
      (observed) => {
        assert.equal(observed, error);
        assert.ok(observed.message.startsWith('native download timeout'));
        assert.ok(observed.stack.startsWith(stack));
        assert.equal(observed.message.includes('annulus-download'), !diagnosticsFail);
        if (!diagnosticsFail) assert.ok(observed.message.includes('"activated":true'));
        return true;
      },
    );
  }
});

async function fixture(t, change = () => {}) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-annulus-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.ok(basename(resolved).startsWith('labui-annulus-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const data = structuredClone(snapshot);
  change(data);
  for (const [file, bytes] of Object.entries({
    'semantics/figma-baseline.json': JSON.stringify(data.manifest),
    'semantics/author-anatomy.json': JSON.stringify(data.annotations),
    ...data.masters,
  })) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  return annulusReference(root, pin, readAuthorMaster);
}

test('schema6 keeps schema5 consumer and adds only the requested annulus entries', () => {
  assert.deepEqual(consumerPublicEntries(6), [...consumerPublicEntries(5), ...ANNULUS_ENTRIES]);
  for (const entry of ANNULUS_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/ir'));
  assert.throws(() => assertIconsImport('@labpics/icons/variations/ellipse'));
  assert.ok(consumerFixture(6).includes(annulusFixture()));
  assert.ok(!consumerFixture(5).includes('annulusConsumers'));
  const parsed = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: consumerFixture(6),
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('the installed type fixture preserves source imports and explicitly refuses Filled geometry', () => {
  const source = annulusTypeFixture();
  for (const entry of ANNULUS_ENTRIES) assert.ok(source.includes(entry));
  assert.equal(source.match(/@ts-expect-error/g).length, 4);
  assert.ok(!source.includes('/dist/'));
  assert.ok(!source.includes('/ir/author-annulus'));
});

test('raw Figma sources retain independent Outline and Filled receipts before producer import', async (t) => {
  const reference = await fixture(t);
  validateAnnulusReference(reference, pin.figma);
  assert.equal(reference.semanticSha256, hash(JSON.stringify(snapshot.annotations)));
  for (const icon of ANNULUS_ICONS)
    for (const variant of ['outline', 'filled']) {
      const item = reference.icons[icon][variant];
      assert.equal(item.author.masterSha256, hash(snapshot.masters[item.sourceFile]));
      if (variant === 'filled') assert.equal(item.declaration, null);
      else
        assert.deepEqual(
          item.declaration.gesture,
          icon === 'checkmark-circle'
            ? { law: 'confirmation.presence', purpose: 'confirmation', partId: 'confirmation-mark' }
            : null,
        );
    }
  assert.equal(
    rawAnnulusReference(reference.icons['plus-circle'].outline.paths, [0, 0, 24, 24]).outerD,
    rawAnnulusReference(reference.icons['minus-circle'].outline.paths, [0, 0, 24, 24]).outerD,
  );
});

test('raw-source drift and transplanted declarations refuse before reading package geometry', async (t) => {
  await assert.rejects(
    fixture(t, (data) => {
      const file = data.manifest.icons['plus-circle'].outline.master;
      data.masters[file] += ' ';
    }),
  );
  await assert.rejects(
    fixture(t, (data) => {
      data.annotations.icons['plus-circle'].outline.parts[0].id = 'decrease-mark';
    }),
  );
  await assert.rejects(
    fixture(t, (data) => {
      data.annotations.icons['plus-circle'].filled = structuredClone(
        data.annotations.icons['plus-circle'].outline,
      );
    }),
  );
});

function variedPaths(reference, emphasis) {
  const raw = rawAnnulusReference(reference.paths, reference.viewBox);
  const scale = (raw.outerRadius - raw.referenceThickness * emphasis) / raw.innerRadius;
  // Другой порядок affine операций нужен только для positive oracle control.
  // Это не producer materializer и не product/render доказательство.
  const numbers = raw.inner.map(
    (value, index) => scale * value + (1 - scale) * raw.center[index % 2],
  );
  const inner = `M${numbers.slice(0, 2).join(' ')}${[0, 1, 2, 3].map((i) => `C${numbers.slice(2 + i * 6, 8 + i * 6).join(' ')}`).join('')}Z`;
  return [
    ...reference.paths.slice(0, -1),
    { d: raw.outerD + inner, fillRule: reference.paths.at(-1).fillRule },
  ];
}

test('countershape oracle admits useful deformation and rejects whole-glyph scaling or silent default', async (t) => {
  const reference = await fixture(t);
  for (const icon of ANNULUS_ICONS) {
    const original = reference.icons[icon].outline;
    assertAnnulusPaths(original.paths, original, 1);
    for (const emphasis of [0.8, 1.2]) {
      const paths = variedPaths(original, emphasis);
      assertAnnulusPaths(paths, original, emphasis);
      assert.notEqual(paths.at(-1).d, original.paths.at(-1).d);
      assert.throws(() => assertAnnulusPaths(original.paths, original, emphasis));
      const scaledExterior = structuredClone(paths);
      scaledExterior.at(-1).d = scaledExterior.at(-1).d.replace('M12 1.5', 'M12 1.6');
      assert.notEqual(scaledExterior.at(-1).d, paths.at(-1).d);
      assert.throws(() => assertAnnulusPaths(scaledExterior, original, emphasis));
      for (let index = 0; index < paths.length - 1; index++) {
        const alteredContent = structuredClone(paths);
        alteredContent[index].d += 'M0 0Z';
        assert.throws(() => assertAnnulusPaths(alteredContent, original, emphasis));
      }
      const wrongEmphasis = variedPaths(original, 1.1);
      assert.throws(() => assertAnnulusPaths(wrongEmphasis, original, emphasis));
    }
  }
});

test('countershape oracle refuses invalid SVG syntax even when every operand is unchanged', async (t) => {
  const reference = await fixture(t);
  for (const icon of ANNULUS_ICONS) {
    const original = reference.icons[icon].outline;
    const paths = variedPaths(original, 1.2);
    assertAnnulusPaths(paths, original, 1.2);
    const innerStart = paths.at(-1).d.lastIndexOf('M') + 1;
    for (const punctuation of ['?', ';', '/', ',', ',,']) {
      const malformed = structuredClone(paths);
      malformed.at(-1).d =
        paths.at(-1).d.slice(0, innerStart) + punctuation + paths.at(-1).d.slice(innerStart);
      assert.throws(() => assertAnnulusPaths(malformed, original, 1.2), punctuation);
    }
  }
});

function observation(reference, icon, variant) {
  const item = reference.icons[icon][variant];
  const paths = item.paths.map((path, index) => ({
    ...path,
    partId: item.declaration?.parts[index].id ?? `source-${index}`,
  }));
  return {
    icon,
    variant,
    author: item.author,
    viewBox: item.viewBox,
    paths,
    defaultIdentity: true,
    sourceDefaultIdentity: true,
    sourceOnlyDefaultIdentity: true,
    explicitDefaultIdentity: variant === 'outline' ? true : null,
    contentIdentity: true,
    domIdentity: true,
    confirmation: { available: false },
    roles: item.declaration?.parts.map(({ id, role }, zIndex) => ({ id, role, zIndex })),
    provenance: { kind: 'source' },
    capability:
      variant === 'filled'
        ? {}
        : {
            variation: {
              version: 1,
              law: 'annulus.counter-scale',
              defaults: { enclosureEmphasis: 1 },
              domain: {
                kind: 'radial-bernstein',
                parameter: 'enclosureEmphasis',
                evaluated: 'actual-binary64-scale',
              },
              targets: {
                svg: 'supported',
                webEffect: 'existing-part-gestures',
                lottie: 'not-exported',
                sfSymbols: 'not-exported',
              },
            },
          },
    samples: [16, 24, 48].map((size) => ({ size, width: size, height: size, paths })),
  };
}

test('generated refusal requests reach the owner without private certificate fields', () => {
  const requests = [];
  const element = () => ({
    dataset: {},
    append() {},
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    setCustomValidity() {},
    querySelector: () => {
      const attributes = new Map([['viewBox', '0 0 24 24']]);
      return {
        setAttribute: (name, value) => attributes.set(name, value),
        getAttribute: (name) => attributes.get(name) ?? null,
        querySelectorAll: () => [],
      };
    },
    querySelectorAll: () => [],
  });
  const context = {
    document: { createElement: element, body: element() },
    window: { __iconsPacked: { cleanup() {} } },
    renderGlyphSvg: () => '<svg/>',
    compileSymbolEffect: () => ({ ok: false }),
  };
  for (const [index] of ANNULUS_ICONS.entries()) {
    const sources = Object.fromEntries(
      ['outline', 'filled'].map((variant) => [
        variant,
        {
          icon: ANNULUS_ICONS[index],
          variant,
          viewBox: [0, 0, 24, 24],
          parts: [],
          composition: { kind: 'compound' },
        },
      ]),
    );
    const capability = {
      variation: {
        law: 'annulus.counter-scale',
        domain: {
          kind: 'radial-bernstein',
          parameter: 'enclosureEmphasis',
          evaluated: 'actual-binary64-scale',
          scale: { minimum: 0.6, minimumInclusive: true, maximum: 1.2, maximumInclusive: false },
        },
      },
    };
    context[`annulusSource${index}`] = {
      glyph: ({ variant }) => sources[variant],
    };
    context[`annulus${index}`] = {
      glyph(query) {
        const variant = query?.variant ?? 'outline';
        if (
          query?.variation === undefined ||
          (variant === 'outline' && query.variation.enclosureEmphasis === 1)
        )
          return sources[variant];
        requests.push(query);
        throw Object.assign(new Error('owner observed request'), { code: 'OWNER_REFUSED' });
      },
      glyphCapabilities: (variant) => (variant === 'outline' ? capability : {}),
    };
  }
  // DOM/renderer здесь обеспечивают только mount. Это проверка запросов, не browser render.
  runInNewContext(annulusFixture().replace(/^import[^\n]*\n/gm, ''), context);
  for (const consumer of Object.values(context.window.__iconsPacked.annulusConsumers)) {
    requests.length = 0;
    const refused = consumer.refuse();
    assert.equal(refused.domain, 'OWNER_REFUSED');
    assert.equal(requests.length, 8);
    const domain = requests[3].variation.enclosureEmphasis;
    assert.ok(Number.isFinite(domain) && domain > 0 && domain < 1);
    assert.equal(requests[0].variation.enclosureEmphasis, 0);
    assert.ok(Number.isNaN(requests[1].variation.enclosureEmphasis));
  }
});

test('browser proof constructs the positive domain-refusal input from the public contract', async (t) => {
  const reference = await fixture(t);
  const icon = ANNULUS_ICONS[0];
  const initial = observation(reference, icon, 'outline');
  const varied = structuredClone(initial);
  varied.defaultIdentity = false;
  varied.paths = variedPaths(reference.icons[icon].outline, 1.2).map((path, index) => ({
    ...path,
    partId: initial.paths[index].partId,
  }));
  varied.samples = [16, 24, 48].map((size) => ({
    size,
    width: size,
    height: size,
    paths: varied.paths,
  }));
  varied.provenance = {
    kind: 'authored-variation',
    variation: {
      version: 1,
      law: 'annulus.counter-scale',
      geometrySha256: 'a'.repeat(64),
      parameters: { enclosureEmphasis: 1.2 },
    },
  };
  varied.events = [{ trusted: true, result: { ok: true } }];
  varied.exportSvg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const inputs = [];
  const captured = new Error('domain input captured');
  let reads = 0;
  const input = {
    fill: async (text) => {
      inputs.push(text);
      if (inputs.length === 2) throw captured;
    },
  };
  const page = {
    evaluate: async () => (reads++ === 0 ? initial : varied),
    locator: () => ({
      getByRole: (role) => (role === 'spinbutton' ? input : { click: async () => {} }),
    }),
    waitForEvent: async () => ({
      failure: async () => null,
      createReadStream: async () =>
        (async function* () {
          yield Buffer.from(varied.exportSvg);
        })(),
    }),
  };
  // Остановимся на доставке второго input: native parsing проверяет self-hosted browser.
  await assert.rejects(
    annulusBrowserProof(page, reference, false, []),
    (error) => error === captured,
  );
  assert.equal(inputs[0], '1.2');
  const domain = Number(inputs[1]);
  assert.ok(Number.isFinite(domain) && domain > 0 && domain < 1);
});

test('browser observation oracle catches lost source identity, shifted sample or invented Filled capability', async (t) => {
  const reference = await fixture(t);
  for (const icon of ANNULUS_ICONS)
    for (const variant of ['outline', 'filled']) {
      const actual = observation(reference, icon, variant);
      assertAnnulusObservation(actual, reference, icon, variant);
      assert.throws(() =>
        assertAnnulusObservation(
          { ...actual, sourceDefaultIdentity: false },
          reference,
          icon,
          variant,
        ),
      );
      assert.throws(() =>
        assertAnnulusObservation(
          { ...actual, sourceOnlyDefaultIdentity: false },
          reference,
          icon,
          variant,
        ),
      );
      const clipped = structuredClone(actual);
      clipped.samples[0].width = 24;
      assert.throws(() => assertAnnulusObservation(clipped, reference, icon, variant));
      if (variant === 'filled') {
        const invented = { ...actual, capability: { variation: { law: 'annulus.counter-scale' } } };
        assert.throws(() => assertAnnulusObservation(invented, reference, icon, variant));
      } else {
        assert.throws(() =>
          assertAnnulusObservation(
            { ...actual, explicitDefaultIdentity: false },
            reference,
            icon,
            variant,
          ),
        );
        const renamed = structuredClone(actual);
        renamed.paths[0].partId = 'unclassified';
        assert.throws(() => assertAnnulusObservation(renamed, reference, icon, variant));
        assert.throws(() =>
          assertAnnulusObservation({ ...actual, contentIdentity: false }, reference, icon, variant),
        );
      }
    }
});
