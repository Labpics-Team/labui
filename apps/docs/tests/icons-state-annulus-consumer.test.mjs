import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import {
  STATE_ANNULUS_ENTRIES,
  applyStateEnclosurePatch,
  assertStateAnnulusObservation,
  mountStateAnnulusPresentation,
  stateAnnulusFixture,
  stateAnnulusReferenceContract,
  stateAnnulusTypeFixture,
  validateStateAnnulusReference,
  visibleStateEnclosureSvg,
} from './icons-state-annulus-consumer.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

class Node {
  constructor(tag, attributes = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = new Map();
    this.writes = [];
    for (const [key, value] of Object.entries(attributes)) this.setAttribute(key, value);
    this.writes = [];
  }
  setAttribute(key, value) {
    this.attributes.set(key, String(value));
    this.writes.push({ key, value });
    if (key.startsWith('data-')) this.dataset[key.slice(5)] = String(value);
  }
  getAttribute(key) {
    return this.attributes.get(key) ?? null;
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }
  append(...nodes) {
    for (const node of nodes) {
      this.children.push(node);
      if (node instanceof Node) node.parent = this;
    }
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this);
    this.parent = null;
  }
  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }
  setCustomValidity(message) {
    this.validity = message;
  }
  closest() {
    for (let node = this; node; node = node.parent)
      if (node.dataset.state !== undefined) return node;
    return null;
  }
  querySelectorAll(selector) {
    const descendants = this.children
      .filter((node) => node instanceof Node)
      .flatMap((node) => [node, ...node.querySelectorAll('*')]);
    return selector === '*'
      ? descendants
      : descendants.filter((node) => node.dataset.part !== undefined);
  }
  cloneNode() {
    const copy = new Node(this.tagName);
    copy.attributes = new Map(this.attributes);
    copy.dataset = { ...this.dataset };
    copy.style = { ...this.style };
    copy.append(...this.children.map((node) => (node instanceof Node ? node.cloneNode() : node)));
    return copy;
  }
  get outerHTML() {
    const attributes = [...this.attributes].map(([key, value]) => ` ${key}="${value}"`).join('');
    const style = Object.keys(this.style).length
      ? ` style="${Object.entries(this.style)
          .map(([key, value]) => `${key}:${value}`)
          .join(';')}"`
      : '';
    return `<${this.tagName.toLowerCase()}${attributes}${style}>${this.children.map((node) => (node instanceof Node ? node.outerHTML : node)).join('')}</${this.tagName.toLowerCase()}>`;
  }
}

function drawing() {
  const svg = new Node('svg');
  const from = new Node('g', {
    'data-part': 'state-confirmation',
    'data-state': 'confirmation',
    opacity: 0.7,
  });
  const to = new Node('g', {
    'data-part': 'state-dismissal',
    'data-state': 'dismissal',
    opacity: 0.3,
  });
  const content = new Node('path', {
    'data-part': 'confirmation-mark',
    d: 'authored-content',
    'data-role': 'content',
  });
  from.append(content);
  svg.append(from, to);
  const enclosure = new Node('path', {
    'data-part': 'status-enclosure',
    'data-role': 'container',
    d: 'authored-enclosure',
  });
  svg.append(enclosure);
  return { svg, from, to, content, enclosure };
}
const stateCapability = {
  group: 'status-circle',
  variant: 'outline',
  enclosurePartId: 'status-enclosure',
  states: [{ partId: 'state-confirmation' }, { partId: 'state-dismissal' }],
};
const patch = (d) => ({
  ok: true,
  patch: {
    contract: 'labpics.symbol-geometry-patch/1',
    version: 1,
    group: 'status-circle',
    variant: 'outline',
    partId: 'status-enclosure',
    attributes: { d },
  },
});

test('готовый patch меняет только объявленное d без remount и записи opacity', () => {
  const item = drawing();
  const nodes = [item.svg, ...item.svg.querySelectorAll('*')];
  const result = patch('varied-enclosure');
  assert.equal(applyStateEnclosurePatch(item.svg, stateCapability, result), result);
  assert.deepEqual([item.svg, ...item.svg.querySelectorAll('*')], nodes);
  assert.equal(item.content.getAttribute('d'), 'authored-content');
  assert.equal(item.from.getAttribute('opacity'), '0.7');
  assert.equal(item.to.getAttribute('opacity'), '0.3');
  assert.deepEqual(item.enclosure.writes, [{ key: 'd', value: 'varied-enclosure' }]);
  assert.deepEqual(item.from.writes, []);
  assert.deepEqual(item.to.writes, []);
  applyStateEnclosurePatch(item.svg, stateCapability, result);
  assert.equal(
    item.enclosure.writes.length,
    1,
    'повтор готовой формы не требует лишней DOM-записи',
  );
});

test('precise producer refusal не достигает даже поиска DOM-цели', () => {
  const refusal = { ok: false, reason: { code: 'VARIATION_OUTSIDE_DOMAIN' } };
  const svg = {
    querySelectorAll() {
      throw new Error('DOM не должен читаться');
    },
  };
  assert.equal(applyStateEnclosurePatch(svg, stateCapability, refusal), refusal);
});

test('неподдержанный target protocol и неоднозначная цель отказывают до записи', async (t) => {
  const corruptions = [
    (value) => {
      value.patch.contract = 'unknown/1';
    },
    (value) => {
      value.patch.version = 2;
    },
    (value) => {
      value.patch.group = 'playback-circle';
    },
    (value) => {
      value.patch.variant = 'filled';
    },
    (value) => {
      value.patch.partId = 'confirmation-mark';
    },
    (value) => {
      value.patch.attributes.opacity = 0;
    },
    (value) => {
      value.patch.attributes.d = '';
    },
    (value) => {
      value.patch.attributes = null;
    },
  ];
  for (const [index, mutate] of corruptions.entries())
    await t.test(String(index), () => {
      const item = drawing();
      const bad = patch('changed');
      mutate(bad);
      assert.throws(() => applyStateEnclosurePatch(item.svg, stateCapability, bad), {
        code: 'RENDER_CORRESPONDENCE_MISMATCH',
      });
      assert.equal(item.enclosure.getAttribute('d'), 'authored-enclosure');
      assert.deepEqual(item.enclosure.writes, []);
    });
  for (const mutate of [
    (item) =>
      item.svg.append(
        new Node('path', { 'data-part': 'status-enclosure', 'data-role': 'container' }),
      ),
    (item) => {
      item.enclosure.dataset.role = 'content';
    },
    (item) => {
      item.enclosure.tagName = 'G';
    },
    (item) => {
      item.enclosure.remove();
      item.from.append(item.enclosure);
    },
  ]) {
    const item = drawing();
    mutate(item);
    assert.throws(() => applyStateEnclosurePatch(item.svg, stateCapability, patch('changed')), {
      code: 'RENDER_CORRESPONDENCE_MISMATCH',
    });
    assert.deepEqual(item.enclosure.writes, []);
  }
});

test('видимый SVG snapshot копирует всю промежуточную смесь без изменения mounted DOM', (t) => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (node) => ({ opacity: node === item.from ? '0.7' : '0.3' });
  t.after(() => {
    globalThis.getComputedStyle = previous;
  });
  const item = drawing();
  const original = item.svg.outerHTML;
  const snapshot = visibleStateEnclosureSvg(
    item.svg,
    stateCapability.states.map((state) => state.partId),
  );
  assert.match(snapshot, /data-part="state-confirmation"[^>]*style="opacity:0.7"/);
  assert.match(snapshot, /data-part="state-dismissal"[^>]*style="opacity:0.3"/);
  assert.equal(item.svg.outerHTML, original);
  assert.deepEqual(item.from.style, {});
  assert.deepEqual(item.to.style, {});
  assert.match(snapshot, /d="authored-enclosure"/);
});

test('snapshot отказывает при отсутствующей или повторённой state группе', (t) => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ opacity: '0.5' });
  t.after(() => {
    globalThis.getComputedStyle = previous;
  });
  const item = drawing();
  assert.throws(() => visibleStateEnclosureSvg(item.svg, ['missing']), /отдельную группу/);
  item.svg.append(item.from.cloneNode());
  assert.throws(
    () => visibleStateEnclosureSvg(item.svg, ['state-confirmation']),
    /отдельную группу/,
  );
});

function mounted(t, { mutate } = {}) {
  const previousDocument = globalThis.document;
  const previousStyle = globalThis.getComputedStyle;
  const body = new Node('body');
  globalThis.document = { body, createElement: (tag) => new Node(tag) };
  globalThis.getComputedStyle = (node) => ({ opacity: node.getAttribute('opacity') ?? '1' });
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.getComputedStyle = previousStyle;
  });
  const item = drawing();
  const section = new Node('section');
  section.append(item.svg);
  body.append(section);
  const variation = { group: 'status-circle', variant: 'outline', partId: 'status-enclosure' };
  const original = patch('authored-enclosure');
  const requests = [];
  const api = {
    enclosureVariationCapabilities: () => variation,
    renderEnclosurePatch(request = {}) {
      requests.push(request);
      if (request.variant === 'filled')
        return { ok: false, reason: { code: 'VARIANT_UNSUPPORTED', message: 'unsupported' } };
      const emphasis = request.variation?.enclosureEmphasis ?? 1;
      if (emphasis > 2)
        return { ok: false, reason: { code: 'VARIATION_OUTSIDE_DOMAIN', message: 'outside' } };
      const value = emphasis === 1 ? original : patch(`counter-${emphasis}`);
      mutate?.(value);
      return value;
    },
  };
  const pose = () => ({
    opacity: [
      { partId: 'state-confirmation', value: Number(item.from.getAttribute('opacity')) },
      { partId: 'state-dismissal', value: Number(item.to.getAttribute('opacity')) },
    ],
  });
  const execution = () => ({ generation: 5, playback: 'paused' });
  const presentation = mountStateAnnulusPresentation(api, item.svg, stateCapability, section, {
    pose,
    execution,
  });
  return { ...item, presentation, section, requests, execution };
}

test('geometry request сохраняет видимую смесь и прежнего владельца playback', (t) => {
  const item = mounted(t);
  const before = item.presentation.read();
  const result = item.presentation.update({ variation: { enclosureEmphasis: 1.25 } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.continuity.before, result.continuity.after);
  assert.deepEqual(result.continuity.execution, result.continuity.afterExecution);
  assert.equal(item.presentation.read().identity, true);
  assert.equal(item.presentation.read().emphasis, 1.25);
  assert.equal(item.presentation.read().defaultIdentity, true);
  assert.equal(item.content.getAttribute('d'), 'authored-content');
  assert.equal(item.from.getAttribute('opacity'), '0.7');
  assert.equal(item.to.getAttribute('opacity'), '0.3');
  assert.deepEqual(item.presentation.read().execution, before.execution);
});

test('domain отказ сохраняет форму, mixture и ранее принятое значение', (t) => {
  const item = mounted(t);
  item.presentation.update({ variation: { enclosureEmphasis: 1.25 } });
  const before = item.presentation.read();
  const writes = item.enclosure.writes.length;
  const rejected = item.presentation.update({ variation: { enclosureEmphasis: 3 } });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason.code, 'VARIATION_OUTSIDE_DOMAIN');
  assert.equal(item.enclosure.writes.length, writes);
  assert.equal(item.presentation.read().d, before.d);
  assert.equal(item.presentation.read().emphasis, 1.25);
  assert.deepEqual(rejected.continuity.before, rejected.continuity.after);
  assert.deepEqual(item.presentation.read().execution, before.execution);
});

test('внешний remount обнаруживается до записи нового patch', (t) => {
  const item = mounted(t);
  const replacement = item.enclosure.cloneNode();
  item.enclosure.remove();
  item.svg.append(replacement);
  const result = item.presentation.update({ variation: { enclosureEmphasis: 1.25 } });
  assert.equal(result.ok, false);
  assert.equal(result.reason.code, 'RENDER_CORRESPONDENCE_MISMATCH');
  assert.equal(replacement.getAttribute('d'), 'authored-enclosure');
  assert.deepEqual(replacement.writes, []);
});

test('consumer после освобождения не принимает новые geometry requests', (t) => {
  const item = mounted(t);
  item.presentation.cleanup();
  assert.throws(
    () => item.presentation.update({ variation: { enclosureEmphasis: 1.2 } }),
    /освобождён/,
  );
  assert.deepEqual(item.enclosure.writes, []);
});

test('schema7 добавляет только публичные opt-in пути, standard baseline остаётся доступным', () => {
  const old = consumerPublicEntries(6);
  const next = consumerPublicEntries(7);
  assert.ok(old.every((entry) => next.includes(entry)));
  assert.equal(new Set(next).size, next.length);
  for (const entry of STATE_ANNULUS_ENTRIES) {
    assertIconsImport(entry);
    assert.ok(next.includes(entry));
  }
  assert.throws(() => assertIconsImport('@labpics/icons/state-variations/expression-face'));
  assert.throws(() => assertIconsImport('@labpics/icons/ir/state-annulus-runtime'));
  assert.ok(consumerFixture(6).includes('const statusConsumer = mountStateConsumer(statusCircle'));
  assert.ok(!consumerFixture(6).includes('import * as stateAnnulusStatus'));
  const fixture = consumerFixture(7);
  assert.ok(fixture.includes(stateAnnulusFixture()));
  assert.doesNotThrow(() => new Function(fixture.replace(/^import[^\n]*\n/gm, '')));
  assert.equal((stateAnnulusTypeFixture().match(/@ts-expect-error/g) ?? []).length, 3);
  assert.deepEqual(stateAnnulusReferenceContract('playback-circle').states, ['pause', 'play']);
});

const masters = JSON.parse(
  await readFile(new URL('./fixtures/icons-annulus-masters.json', import.meta.url)),
);
const rawAnnulus = {
  icons: Object.fromEntries(
    Object.entries(masters.manifest.icons).map(([icon, variants]) => {
      const item = variants.outline;
      return [
        icon,
        {
          outline: {
            paths: readAuthorMaster(Buffer.from(masters.masters[item.master])).paths,
            declaration: masters.annotations.icons[icon].outline,
            author: {
              kind: 'figma',
              ...masters.annotations.source,
              nodeId: item.nodeId,
              nodeSha256: item.nodeSha256,
              masterSha256: item.sha256,
              normalizedSha256: item.normalizedSource.sha256,
              pathFingerprintSha256: item.normalizedSource.pathFingerprintSha256,
            },
          },
        },
      ];
    }),
  ),
};

function rawStatusWitness() {
  const icons = {
    attention: 'alert-circle',
    confirmation: 'checkmark-circle',
    decrease: 'minus-circle',
    dismissal: 'close-circle',
    increase: 'plus-circle',
    question: 'question-circle',
  };
  const states = Object.entries(icons).map(([id, icon]) => {
    const source = rawAnnulus.icons[icon].outline;
    return {
      id,
      icon,
      partId: `state-${id}`,
      contentPartIds: source.declaration.parts.slice(0, -1).map((part) => part.id),
      author: source.author,
      paths: source.paths,
    };
  });
  const proof = {
    source: masters.annotations.source,
    specSha256: 'a'.repeat(64),
    sharedPartsSha256: 'b'.repeat(64),
  };
  const reference = {
    group: 'status-circle',
    enclosurePartId: 'status-enclosure',
    states,
    proof,
    enclosure: states[0].paths.at(-1),
  };
  const capability = {
    version: 1,
    group: 'status-circle',
    variant: 'outline',
    partId: reference.enclosurePartId,
    law: 'annulus.counter-scale',
    defaults: { enclosureEmphasis: 1 },
    targets: {
      svg: 'supported',
      webEffect: 'existing-state-transitions',
      lottie: 'not-exported',
      sfSymbols: 'not-exported',
    },
    domain: {
      kind: 'radial-bernstein',
      parameter: 'enclosureEmphasis',
      evaluated: 'actual-binary64-scale',
    },
    proof: {
      source: proof.source,
      stateSpecSha256: proof.specSha256,
      sharedPartsSha256: proof.sharedPartsSha256,
      geometrySha256: 'c'.repeat(64),
      gridSha256: 'd'.repeat(64),
      members: states.map((state) => ({
        state: state.id,
        icon: state.icon,
        author: state.author,
        geometrySha256: 'e'.repeat(64),
        sourceEnclosurePartId:
          rawAnnulus.icons[state.icon].outline.declaration.variation.enclosurePartId,
      })),
    },
  };
  const enclosure = {
    ...reference.enclosure,
    partId: reference.enclosurePartId,
    role: 'container',
    fill: 'currentColor',
  };
  const observation = {
    identity: true,
    viewBox: [0, 0, 24, 24],
    enclosure,
    enclosureCount: 1,
    enclosureOpacity: 1,
    enclosurePresentation: {
      identity: true,
      defaultIdentity: true,
      emphasis: 1,
      d: enclosure.d,
      capability,
    },
    groups: states.map((state) => ({
      id: state.id,
      partId: state.partId,
      role: 'state',
      paths: state.paths.slice(0, -1).map((path, index) => ({
        ...path,
        partId: state.contentPartIds[index],
        role: 'content',
        fill: 'currentColor',
      })),
    })),
  };
  return { reference, observation };
}

test('raw Figma default oracle различает потерю геометрии, semantic IDs и source receipts', () => {
  const { reference, observation } = rawStatusWitness();
  assert.doesNotThrow(() => assertStateAnnulusObservation(observation, reference, rawAnnulus, 1));
  for (const mutate of [
    (value) => {
      value.groups[0].paths[0].d = 'M0 0Z';
    },
    (value) => {
      value.groups[0].paths[0].partId = 'unknown';
    },
    (value) => {
      value.groups[0].paths[0].role = 'container';
    },
    (value) => {
      value.groups[0].partId = 'state-missing';
    },
    (value) => {
      value.groups[0].role = 'content';
    },
    (value) => {
      value.enclosure.d = 'M0 0Z';
      value.enclosurePresentation.d = 'M0 0Z';
    },
    (value) => {
      value.enclosurePresentation.capability.proof.members[0].author.masterSha256 = 'f'.repeat(64);
    },
    (value) => {
      value.enclosurePresentation.capability.proof.members[0].sourceEnclosurePartId = 'unknown';
    },
    (value) => {
      value.enclosurePresentation.capability.targets.lottie = 'supported';
    },
  ]) {
    const changed = structuredClone(observation);
    mutate(changed);
    assert.throws(() => assertStateAnnulusObservation(changed, reference, rawAnnulus, 1));
  }
});

test('schema7 raw reference требует обе реальные группы и точные raw member paths', () => {
  const { reference } = rawStatusWitness();
  const playback = {
    group: 'playback-circle',
    enclosure: reference.enclosure,
    states: ['pause-circle', 'play-circle'].map((icon) => ({
      icon,
      author: rawAnnulus.icons[icon].outline.author,
      paths: rawAnnulus.icons[icon].outline.paths,
    })),
  };
  const value = {
    ...masters.annotations.source,
    groups: { 'status-circle': reference, 'playback-circle': playback },
  };
  const visited = [];
  assert.equal(
    validateStateAnnulusReference(
      value,
      masters.annotations.source,
      rawAnnulus,
      (_reference, _author, group) => visited.push(group),
    ),
    value,
  );
  assert.deepEqual(visited.sort(), ['playback-circle', 'status-circle']);
  for (const mutate of [
    (changed) => {
      changed.groups['playback-circle'] = undefined;
    },
    (changed) => {
      changed.groups.extra = reference;
    },
    (changed) => {
      changed.groups['status-circle'].states[0].icon = 'missing';
    },
    (changed) => {
      changed.groups['playback-circle'].states[0].paths[0].d = 'M0 0Z';
    },
  ]) {
    const changed = structuredClone(value);
    mutate(changed);
    assert.throws(() =>
      validateStateAnnulusReference(changed, masters.annotations.source, rawAnnulus, () => {}),
    );
  }
});
