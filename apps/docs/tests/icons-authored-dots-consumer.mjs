import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const AUTHORED_DOT_ICONS = ['ellipsis-horizontal', 'ellipsis-vertical'];
export const AUTHORED_DOT_ENTRIES = [
  ...AUTHORED_DOT_ICONS.map((icon) => `@labpics/icons/symbols/${icon}`),
  ...['outline', 'filled'].map(
    (variant) => `@labpics/icons/states/ellipsis-orientation-${variant}`,
  ),
];
const HASH = /^[a-f0-9]{64}$/;
const PART_IDS = ['dot-leading', 'dot-middle', 'dot-trailing'];
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
const hash = (value) => createHash('sha256').update(value).digest('hex');

// Ожидание читается из raw master, отдельно от compiled packet и его sampler.
export function rawDotOperands(d) {
  assert.equal(d.replace(/[eE][+-]?\d+/g, '').replace(/[^A-Za-z]/g, ''), 'MCCCCZ');
  const values = d.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g)?.map(Number);
  assert.equal(values?.length, 26);
  assert.ok(values.every(Number.isFinite));
  assert.equal(values[0], values[24]);
  assert.equal(values[1], values[25]);
  return values;
}

export function validateAuthoredDotsReference(reference, author) {
  assert.equal(reference?.fileKey, author.fileKey);
  assert.equal(reference.version, author.version);
  assert.deepEqual(Object.keys(reference.icons ?? {}).sort(), AUTHORED_DOT_ICONS);
  assert.match(reference.semanticSha256, HASH);
  assert.match(reference.gridSha256, HASH);
  assert.deepEqual(Object.keys(reference.groups ?? {}).sort(), [
    'ellipsis-orientation-filled',
    'ellipsis-orientation-outline',
  ]);
  for (const [icon, variants] of Object.entries(reference.icons)) {
    assert.deepEqual(Object.keys(variants).sort(), ['filled', 'outline']);
    for (const [variant, item] of Object.entries(variants)) {
      assert.equal(
        item.sourceFile,
        `masters/figma/${reference.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`,
      );
      assert.equal(item.author.kind, 'figma');
      assert.equal(item.author.fileKey, author.fileKey);
      assert.equal(item.author.version, author.version);
      assert.match(item.author.nodeId, /^\d+:\d+$/);
      for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256'])
        assert.match(item.author[key], HASH);
      assert.equal(
        hash(stableJSON(item.paths.map((path, index) => ({ index, ...path })))),
        item.author.pathFingerprintSha256,
      );
      assert.deepEqual(item.viewBox, [0, 0, 24, 24]);
      assert.deepEqual(item.dimensions, [24, 24]);
      assert.equal(item.parts.length, 3);
      assert.equal(item.paths.length, 3);
      assert.deepEqual(
        item.parts.map((part) => part.id),
        PART_IDS,
      );
      assert.deepEqual(item.declaration.variation, {
        law: 'dots.affine',
        axis: icon.endsWith('horizontal') ? 'x' : 'y',
      });
      assert.equal(item.declaration.masterSha256, item.author.masterSha256);
      assert.equal(item.declaration.pathFingerprintSha256, item.author.pathFingerprintSha256);
      if (icon.endsWith('horizontal'))
        assert.deepEqual(item.declaration.gesture, {
          law: 'activity.triad',
          purpose: 'loading',
          partIds: PART_IDS,
        });
      else assert.equal(item.declaration.gesture, null);
      for (const [index, part] of item.parts.entries()) {
        assert.deepEqual({ d: part.d, fillRule: part.fillRule }, item.paths[index]);
        assert.equal(part.zIndex, index);
        assert.equal(part.role, 'content');
        rawDotOperands(part.d);
      }
    }
  }
  for (const variant of ['outline', 'filled']) {
    const horizontal = reference.icons['ellipsis-horizontal'][variant];
    const vertical = reference.icons['ellipsis-vertical'][variant];
    assert.deepEqual(
      horizontal.paths[1],
      vertical.paths[1],
      'middle author contour должен сохраняться буквально',
    );
    const group = reference.groups[`ellipsis-orientation-${variant}`];
    assert.equal(group.law, 'dots.orient');
    assert.equal(group.defaultState, 'horizontal');
    assert.deepEqual(group.partIds, PART_IDS);
    assert.deepEqual(Object.keys(group.states).sort(), ['horizontal', 'vertical']);
    for (const [state, item] of Object.entries(group.states)) {
      assert.equal(item.icon, `ellipsis-${state}`);
      assert.equal(item.variant, variant);
      assert.equal(item.masterSha256, reference.icons[item.icon][variant].author.masterSha256);
      assert.equal(
        item.pathFingerprintSha256,
        reference.icons[item.icon][variant].author.pathFingerprintSha256,
      );
    }
  }
  return reference;
}

const close = (actual, expected, message) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9,
    `${message}: ${actual} → ${expected}`,
  );

export function assertContourPose(observation, reference, variant, progress) {
  const horizontal = reference.icons['ellipsis-horizontal'][variant];
  const vertical = reference.icons['ellipsis-vertical'][variant];
  assert.ok(progress >= 0 && progress <= 1);
  assert.equal(observation.variant, variant);
  assert.equal(observation.identity, true, 'переход заменил DOM node');
  assert.deepEqual(
    observation.paths.map((part) => part.partId),
    PART_IDS,
  );
  assert.deepEqual(observation.viewBox, horizontal.viewBox);
  for (const [index, path] of observation.paths.entries()) {
    assert.equal(path.fillRule, horizontal.paths[index].fillRule);
    if (progress === 0 || progress === 1 || index === 1) {
      assert.equal(path.d, (progress === 1 ? vertical : horizontal).paths[index].d);
      continue;
    }
    const a = rawDotOperands(horizontal.paths[index].d);
    const b = rawDotOperands(vertical.paths[index].d);
    rawDotOperands(path.d).forEach((value, operand) =>
      close(value, a[operand] + (b[operand] - a[operand]) * progress, 'raw contour correspondence'),
    );
  }
  assert.equal(observation.middleIdentity, true);
  assert.equal(observation.middleMutations, 0, 'executor изменил неподвижную среднюю точку');
}

export function assertDotVariation(observation, reference, icon, variant, parameters) {
  const source = reference.icons[icon][variant];
  assert.equal(observation.icon, icon);
  assert.equal(observation.variant, variant);
  assert.deepEqual(observation.viewBox, source.viewBox);
  assert.deepEqual(observation.author, source.author);
  assert.deepEqual(
    observation.paths.map((part) => part.partId),
    PART_IDS,
  );
  const dotScale = parameters.dotScale ?? 1;
  const spacingScale = parameters.spacingScale ?? 1;
  if (dotScale === 1 && spacingScale === 1) {
    assert.equal(observation.provenance.kind, 'source');
    assert.equal(observation.defaultIdentity, true);
    assert.deepEqual(
      observation.paths.map(({ d, fillRule }) => ({ d, fillRule })),
      source.paths,
    );
    return;
  }
  assert.equal(observation.provenance.kind, 'authored-variation');
  assert.deepEqual(observation.provenance.variation.parameters, { dotScale, spacingScale });
  assert.equal(observation.provenance.variation.law, 'dots.affine');
  const axis = icon.endsWith('horizontal') ? 0 : 1;
  const centers = source.paths.map(({ d }) => {
    const points = rawDotOperands(d);
    return [0, 1].map((coordinate) => {
      const values = points.filter((_, index) => index % 2 === coordinate);
      return (Math.min(...values) + Math.max(...values)) / 2;
    });
  });
  for (const [index, path] of observation.paths.entries()) {
    const raw = rawDotOperands(source.paths[index].d);
    assert.equal(path.fillRule, source.paths[index].fillRule);
    rawDotOperands(path.d).forEach((value, operand) => {
      const coordinate = operand % 2;
      const center = centers[index][coordinate];
      const offset =
        coordinate === axis ? (spacingScale - 1) * (center - centers[1][coordinate]) : 0;
      close(value, center + (raw[operand] - center) * dotScale + offset, 'raw authored variation');
    });
  }
}

function mountContourConsumer(api, variant, parent) {
  const capability = api.stateCapabilities();
  const initial = api.renderStateSvg('horizontal');
  if (!initial.ok) throw new Error(initial.reason.code);
  const figure = document.createElement('figure');
  figure.className = 'dots-orientation';
  const button = document.createElement('lab-button');
  for (const [name, text] of Object.entries({
    size: 'l',
    icon: '',
    type: 'neutral',
    'aria-label': 'Сменить ориентацию многоточия',
    'data-dots-orientation': variant,
  }))
    button.setAttribute(name, text);
  button.innerHTML = initial.svg;
  const svg = button.querySelector('svg');
  svg.setAttribute('slot', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const paths = [...svg.querySelectorAll('path[data-part]')];
  const byPart = new Map(paths.map((path) => [path.dataset.part, path]));
  const caption = document.createElement('figcaption');
  caption.textContent = variant === 'outline' ? 'Outline' : 'Filled';
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Ориентация ${caption.textContent}`);
  for (const [id, text] of [
    ['horizontal', 'Горизонтально'],
    ['vertical', 'Вертикально'],
  ]) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = text;
    select.append(option);
  }
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Скачать SVG';
  const samples = document.createElement('div');
  samples.className = 'size-sample-row';
  const sampleSvgs = [];
  for (const size of [16, 24, 48]) {
    const item = document.createElement('span');
    item.innerHTML = initial.svg;
    const sample = item.querySelector('svg');
    sample.setAttribute('width', String(size));
    sample.setAttribute('height', String(size));
    sampleSvgs.push(sample);
    item.append(`${size} px`);
    samples.append(item);
  }
  figure.append(button, caption, select, exportButton, samples);
  parent.append(figure);
  let progress = contourValue(0);
  let prepared;
  let control;
  let effect;
  let generation = 0;
  let targetState = 'horizontal';
  let nativeClicks = 0;
  let notifications = 0;
  let middleMutations = 0;
  let lastCompletion = null;
  const events = [];
  const middle = byPart.get('dot-middle');
  const mutationObserver = new MutationObserver((records) => {
    middleMutations += records.length;
  });
  mutationObserver.observe(middle, { attributes: true });
  const renderedProgress = () => Number(svg.dataset.progress ?? 0);
  const pose = () =>
    paths.map((node) => ({
      partId: node.dataset.part,
      d: node.getAttribute('d'),
      fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
    }));
  const boundPaths = new Map([...byPart].map(([partId, node]) => [partId, [node]]));
  for (const sample of sampleSvgs)
    for (const node of sample.querySelectorAll('path[data-part]'))
      boundPaths.get(node.dataset.part).push(node);
  const visiblePaths = new Map(
    [...byPart].map(([partId, node]) => [partId, node.getAttribute('d')]),
  );
  const apply = (p) => {
    const sampled = prepared.sample(p);
    if (!sampled.ok) throw new Error(sampled.reason.code);
    for (const part of sampled.parts) {
      const nodes = boundPaths.get(part.partId);
      if (!nodes) throw new Error('Потеряна объявленная часть');
      if (visiblePaths.get(part.partId) === part.d) continue;
      for (const node of nodes) node.setAttribute('d', part.d);
      visiblePaths.set(part.partId, part.d);
    }
    svg.dataset.progress = String(p);
    notifications++;
  };
  let unsubscribe = () => {};
  function change(state, duration = 600) {
    const from = renderedProgress();
    const result = api.compileStateEffect(state, {
      from,
      duration,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    if (!result.ok) throw new Error(result.reason.code);
    // JSON — реальная граница данных между владельцем символа и исполнителем.
    const nextEffect = JSON.parse(JSON.stringify(result.effect));
    const next = prepareContourStateEffect(nextEffect);
    if (!next.ok) throw new Error(next.reason.code);
    const admission = next.sample(from);
    if (!admission.ok) throw new Error(admission.reason.code);
    if (admission.parts.some((part) => visiblePaths.get(part.partId) !== part.d))
      throw new Error('Начало перехода не совпадает с видимой позой');
    const before = pose();
    const previous = control;
    // Старый канал может снять более позднюю позу при admission новой цели.
    // Отписка сохраняет DOM, новый public value начинает с записанного кадра.
    unsubscribe();
    progress.dispose();
    progress = contourValue(from);
    prepared = next;
    effect = nextEffect;
    targetState = state;
    select.value = state;
    const current = ++generation;
    lastCompletion = null;
    unsubscribe = progress.subscribe(apply);
    control = progress.animate(effect.to, {
      duration: effect.options.duration,
      ease: effect.options.easing,
      reducedMotion: effect.options.duration === 0 ? 'always' : 'user',
    });
    // Завершение прежнего occurrence не меняет статус нового перехода.
    control.finished.then((result) => {
      if (generation === current) lastCompletion = result.status;
    });
    return {
      before,
      after: pose(),
      from,
      renderedFrom: renderedProgress(),
      effect,
      generation,
      previousPlayback: previous?.state ?? null,
    };
  }
  button.addEventListener('click', (event) => {
    const transition = change(targetState === 'horizontal' ? 'vertical' : 'horizontal');
    events.push({
      trusted: event.isTrusted,
      composed: event.composed,
      native: event.composedPath().includes(button.shadowRoot.querySelector('button')),
      ...transition,
    });
  });
  select.addEventListener('change', () => change(select.value));
  function exported() {
    const document = svg.cloneNode(true);
    document.removeAttribute('slot');
    document.removeAttribute('data-progress');
    document.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return document.outerHTML;
  }
  exportButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exported()], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ellipsis-${variant}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  });
  function read() {
    const native = button.shadowRoot?.querySelector('button');
    const rectangle = native?.getBoundingClientRect();
    middleMutations += mutationObserver.takeRecords().length;
    return {
      variant,
      progress: progress.get(),
      renderedProgress: renderedProgress(),
      targetState,
      paths: pose(),
      viewBox: svg.getAttribute('viewBox').trim().split(/\s+/).map(Number),
      capability,
      identity: paths.every(
        (node, index) => node === svg.querySelectorAll('path[data-part]')[index],
      ),
      middleIdentity: byPart.get('dot-middle') === middle && middle.isConnected,
      middleMutations,
      notifications,
      nativeClicks,
      events,
      target: {
        width: rectangle?.width,
        height: rectangle?.height,
        name: native?.getAttribute('aria-label'),
        hidden: svg.getAttribute('aria-hidden'),
      },
      samples: sampleSvgs.map((sample) => ({
        size: Number(sample.getAttribute('width')),
        paths: [...sample.querySelectorAll('path')].map((node) => ({
          partId: node.dataset.part,
          d: node.getAttribute('d'),
          fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
        })),
      })),
      exportSvg: exported(),
      effect,
      lastCompletion,
    };
  }
  async function settle() {
    const result = await control.finished;
    if (result.status !== 'finished') throw new Error('Текущая ориентация не завершена');
    return { ...read(), completionStatus: result.status };
  }
  return {
    ready: button.updateComplete.then(() => {
      button.shadowRoot.querySelector('button').addEventListener('click', () => nativeClicks++);
    }),
    read,
    phase: renderedProgress,
    change,
    settle,
    pauseAt: (milliseconds) => {
      control.pause();
      control.seek(milliseconds);
      return read();
    },
    exportSvg: exported,
    refuse: () => ({
      variation: api.compileStateEffect('vertical', {
        duration: 600,
        variation: { dotScale: 1.1, spacingScale: 0.9 },
      }),
      variant: api.compileStateEffect('vertical', {
        duration: 600,
        variant: variant === 'outline' ? 'filled' : 'outline',
      }),
      format: api.exportStateTransition('vertical', { duration: 600, format: 'lottie' }),
      state: api.compileStateEffect('unknown', { duration: 600 }),
      invalid: prepared?.sample(-1),
    }),
    cleanup: () => {
      unsubscribe();
      progress.dispose();
      mutationObserver.disconnect();
      figure.remove();
    },
    disposal: () => ({
      connected: figure.isConnected,
      notifications,
      playback: control?.state ?? null,
      lastCompletion,
    }),
  };
}

export function scalarSequenceSteps(effect, byPart, visible) {
  if (effect.version !== 2) throw new Error('Нужен scalar effect v2');
  const admitted = new Set();
  return effect.stages.flatMap((stage) => {
    const nodes = byPart.get(stage.partId);
    if (!nodes || stage.property !== 'opacity')
      throw new Error('Не найдена объявленная opacity часть');
    const first = !admitted.has(stage.partId);
    admitted.add(stage.partId);
    return nodes.map((node) => [
      node,
      { opacity: first ? [visible.get(node), stage.to] : stage.to },
      { at: stage.at, duration: stage.duration, ease: effect.options.easing },
    ]);
  });
}

function mountDotVariationConsumer(api, icon, variant, parent) {
  const original = api.glyph({ variant });
  const capability = api.glyphCapabilities(variant);
  const figure = document.createElement('figure');
  figure.className = 'dots-variation';
  figure.dataset.dotsVariation = `${icon}/${variant}`;
  const caption = document.createElement('figcaption');
  caption.textContent = `${icon.endsWith('horizontal') ? 'Горизонтально' : 'Вертикально'}, ${variant === 'outline' ? 'Outline' : 'Filled'}`;
  const samples = document.createElement('div');
  samples.className = 'size-sample-row';
  const cells = [16, 24, 48].map((size) => {
    const cell = document.createElement('span');
    samples.append(cell);
    return { cell, size };
  });
  const inputs = {};
  const status = document.createElement('output');
  status.setAttribute('aria-live', 'polite');
  let model = original;
  let parameters = { dotScale: 1, spacingScale: 1 };
  let refusal;
  const events = [];
  let activityControl;
  let activityEffect;
  let activityStatus;
  const activityEvents = [];
  function update(next) {
    let generated;
    try {
      generated = api.glyph({ variant, variation: next });
    } catch (error) {
      refusal = error.code;
      status.textContent = 'Такое сочетание размера и расстояния выходит за допустимую область.';
      return { ok: false, code: error.code };
    }
    activityControl?.stop();
    model = generated;
    parameters = { dotScale: next.dotScale ?? 1, spacingScale: next.spacingScale ?? 1 };
    refusal = null;
    for (const { cell, size } of cells) {
      cell.innerHTML = renderGlyphSvg(model, { instanceId: `dots-${icon}-${variant}-${size}` });
      const svg = cell.querySelector('svg');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      cell.append(`${size} px`);
    }
    for (const [key, input] of Object.entries(inputs)) input.value = String(parameters[key]);
    status.textContent = `Размер ${parameters.dotScale.toFixed(2)}; расстояние ${parameters.spacingScale.toFixed(2)}`;
    return { ok: true };
  }
  const controls = document.createElement('div');
  controls.className = 'dots-parameters';
  for (const [key, text] of [
    ['dotScale', 'Размер точки'],
    ['spacingScale', 'Расстояние'],
  ]) {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0.8';
    input.max = '1.2';
    input.step = '0.05';
    input.value = '1';
    input.setAttribute('aria-label', `${text}: ${caption.textContent}`);
    inputs[key] = input;
    input.addEventListener('input', (event) => {
      const result = update({ ...parameters, [key]: Number(input.value) });
      events.push({ key, trusted: event.isTrusted, value: Number(input.value), result });
    });
    label.append(input);
    controls.append(label);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Авторский размер';
  reset.addEventListener('click', () => update({ dotScale: 1, spacingScale: 1 }));
  const download = document.createElement('button');
  download.type = 'button';
  download.textContent = 'Скачать SVG';
  download.addEventListener('click', () => {
    const svg = cells[1].cell.querySelector('svg');
    const url = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${icon}-${variant}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  });
  figure.append(caption, samples, controls, status, reset, download);
  parent.append(figure);
  update(parameters);
  function opacityPose() {
    return cells.flatMap(({ cell, size }) =>
      [...cell.querySelectorAll('path[data-part]')].map((path) => ({
        size,
        partId: path.dataset.part,
        d: path.getAttribute('d'),
        value: Number(getComputedStyle(path).opacity),
      })),
    );
  }
  function activity(duration = 360) {
    const result = compileSymbolEffect(model, capability, `${icon}.activity`, {
      duration,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    if (!result.ok) return result;
    if (result.effect.version !== 2) throw new Error('Многоточие требует scalar effect');
    const nextEffect = result.effect;
    const before = opacityPose();
    const byPart = new Map();
    const visible = new Map();
    for (const { cell } of cells) {
      for (const node of cell.querySelectorAll('path[data-part]')) {
        const id = node.dataset.part;
        if (!byPart.has(id)) byPart.set(id, []);
        byPart.get(id).push(node);
        visible.set(node, Number(getComputedStyle(node).opacity));
      }
    }
    const previous = activityControl;
    const next = sequence(scalarSequenceSteps(nextEffect, byPart, visible), {
      reducedMotion: nextEffect.options.duration === 0 ? 'always' : 'user',
    });
    activityControl = next;
    activityEffect = nextEffect;
    previous?.stop();
    next.finished.then((result) => {
      if (activityControl === next) activityStatus = result.status;
    });
    return {
      ok: true,
      effect: nextEffect,
      before,
      after: opacityPose(),
      previousPlayback: previous?.state ?? null,
    };
  }
  if (icon.endsWith('horizontal')) {
    const activityButton = document.createElement('button');
    activityButton.type = 'button';
    activityButton.textContent = 'Один цикл загрузки';
    activityButton.addEventListener('click', (event) =>
      activityEvents.push({ trusted: event.isTrusted, ...activity() }),
    );
    figure.append(activityButton);
  }
  function read() {
    const svg = cells[1].cell.querySelector('svg');
    return {
      icon,
      variant,
      parameters,
      provenance: model.provenance,
      author: model.provenance.author,
      defaultIdentity: model === original,
      paths: [...svg.querySelectorAll('path')].map((path) => ({
        partId: path.dataset.part,
        d: path.getAttribute('d'),
        fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
      })),
      viewBox: [...model.viewBox],
      capability,
      refusal,
      events,
      activityEvents,
      opacity: opacityPose(),
      activityEffect,
      activityStatus,
      samples: cells.map(({ size, cell }) => ({ size, svg: cell.querySelector('svg').outerHTML })),
      exportSvg: svg.outerHTML,
    };
  }
  return {
    read,
    update,
    activity,
    pauseActivity: (milliseconds) => {
      activityControl.pause();
      activityControl.seek(milliseconds);
      return read();
    },
    settleActivity: async () => {
      const result = await activityControl.finished;
      if (result.status !== 'finished') throw new Error('Loading cycle не завершён');
      return { ...read(), completionStatus: result.status };
    },
    cleanup: () => {
      activityControl?.stop();
      figure.remove();
    },
    refuse: () => {
      const requests = [{ dotScale: 0 }, { dotScale: Number.NaN }, { spacingScale: 100 }];
      return requests.map((variation) => {
        try {
          api.glyph({ variant, variation });
          return 'accepted';
        } catch (error) {
          return error.code;
        }
      });
    },
  };
}

export function authoredDotsFixture() {
  return `
import * as dotsHorizontal from '@labpics/icons/symbols/ellipsis-horizontal';
import * as dotsVertical from '@labpics/icons/symbols/ellipsis-vertical';
import * as dotsOutlineState from '@labpics/icons/states/ellipsis-orientation-outline';
import * as dotsFilledState from '@labpics/icons/states/ellipsis-orientation-filled';
import { prepareContourStateEffect } from '@labpics/icons/motion';
import { value as contourValue } from '@labpics/motion';
${mountContourConsumer.toString()}
${scalarSequenceSteps.toString()}
${mountDotVariationConsumer.toString()}
const dotsSection = document.createElement('section'); dotsSection.className = 'authored-dots';
dotsSection.setAttribute('aria-labelledby', 'dots-heading');
const dotsHeading = document.createElement('h2'); dotsHeading.id = 'dots-heading'; dotsHeading.textContent = 'Многоточие';
const orientationRow = document.createElement('div'); orientationRow.className = 'dots-row';
const variationHeading = document.createElement('h3'); variationHeading.textContent = 'Размер и расстояние';
const variationRows = document.createElement('div'); variationRows.className = 'dots-row';
dotsSection.append(dotsHeading, orientationRow, variationHeading, variationRows); document.body.append(dotsSection);
const contourConsumers = {};
for (const [api, variant] of [[dotsOutlineState, 'outline'], [dotsFilledState, 'filled']]) contourConsumers[variant] = mountContourConsumer(api, variant, orientationRow);
const dotVariationConsumers = {};
for (const [api, icon] of [[dotsHorizontal, 'ellipsis-horizontal'], [dotsVertical, 'ellipsis-vertical']])
  for (const variant of ['outline', 'filled']) dotVariationConsumers[icon + '/' + variant] = mountDotVariationConsumer(api, icon, variant, variationRows);
window.__iconsPacked.contourConsumers = contourConsumers; window.__iconsPacked.dotVariationConsumers = dotVariationConsumers;
window.__iconsPacked.ready = Promise.all([window.__iconsPacked.ready, ...Object.values(contourConsumers).map(item => item.ready)]);
const dotsPreviousCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { for (const item of [...Object.values(contourConsumers), ...Object.values(dotVariationConsumers)]) item.cleanup(); dotsSection.remove(); return dotsPreviousCleanup(); };
`;
}

export function authoredDotsTypeFixture() {
  return `import { glyph as horizontal } from '@labpics/icons/symbols/ellipsis-horizontal';
import { glyph as vertical } from '@labpics/icons/symbols/ellipsis-vertical';
import { compileStateEffect as outline } from '@labpics/icons/states/ellipsis-orientation-outline';
import { compileStateEffect as filled } from '@labpics/icons/states/ellipsis-orientation-filled';
import { prepareContourStateEffect } from '@labpics/icons/motion';
import { value } from '@labpics/motion';

horizontal({ variant: 'outline', variation: { dotScale: 1.1, spacingScale: 0.9 } });
vertical({ variant: 'filled', variation: { dotScale: 1.1, spacingScale: 0.9 } });
for (const compile of [outline, filled]) {
  const result = compile('vertical', { duration: 300, from: 0.5, reducedMotion: false });
  if (result.ok) {
    const prepared = prepareContourStateEffect(result.effect);
    if (prepared.ok) {
      const progress = value(result.effect.from);
      const off = progress.subscribe(p => prepared.sample(p));
      progress.animate(result.effect.to, { duration: result.effect.options.duration, ease: 'linear' });
      off(); progress.dispose();
    }
  }
}

// @ts-expect-error Неизвестное состояние не является частью публичной группы.
outline('unknown', { duration: 300 });
// @ts-expect-error Прогресс принадлежит численной шкале.
filled('vertical', { duration: 300, from: 'half' });
// @ts-expect-error Потребитель не задаёт внутренние координаты точек.
horizontal({ variation: { center: [12, 12] } });
`;
}

export async function downloadedSvg(page, button) {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const stream = await download.createReadStream();
  assert.ok(stream, 'SVG download не предоставил файл');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    assert.ok(bytes <= 64 * 1024, 'SVG download вышел за пределы одного символа');
    chunks.push(chunk);
  }
  assert.equal(await download.failure(), null);
  return Buffer.concat(chunks).toString('utf8');
}

export async function authoredDotsBrowserProof(page, reference, reducedMotion, records) {
  const evaluate = (variant, method, ...args) =>
    page.evaluate(
      ({ variant, method, args }) =>
        window.__iconsPacked.contourConsumers[variant][method](...args),
      { variant, method, args },
    );
  for (const variant of ['outline', 'filled']) {
    const initial = await evaluate(variant, 'read');
    assertContourPose(initial, reference, variant, 0);
    assert.equal(initial.capability.group, `ellipsis-orientation-${variant}`);
    assert.equal(initial.capability.morph, 'topology-proven');
    assert.equal(initial.capability.variation, 'exact-default-only');
    assert.equal(initial.capability.proof.law, 'dots.orient');
    assert.deepEqual(initial.capability.proof.source, {
      fileKey: reference.fileKey,
      version: reference.version,
    });
    assert.deepEqual(
      initial.capability.states.map(({ id, icon, author }) => ({ id, icon, author })),
      ['horizontal', 'vertical'].map((id) => ({
        id,
        icon: `ellipsis-${id}`,
        author: reference.icons[`ellipsis-${id}`][variant].author,
      })),
    );
    assert.deepEqual(initial.target, {
      width: 48,
      height: 48,
      name: 'Сменить ориентацию многоточия',
      hidden: 'true',
    });
    assert.deepEqual(
      initial.samples.map((sample) => sample.size),
      [16, 24, 48],
    );
    const host = page.locator(`lab-button[data-dots-orientation="${variant}"]`);
    const button = host.getByRole('button', { name: 'Сменить ориентацию многоточия', exact: true });
    await button.focus();
    await button.press('Enter');
    const vertical = await evaluate(variant, 'settle');
    assertContourPose(vertical, reference, variant, 1);
    assert.equal(vertical.completionStatus, 'finished');
    assert.equal(vertical.events[0].trusted, true);
    assert.equal(vertical.events[0].native, true);
    for (const sample of vertical.samples) assert.deepEqual(sample.paths, vertical.paths);
    await button.press('Space');
    const horizontal = await evaluate(variant, 'settle');
    assertContourPose(horizontal, reference, variant, 0);
    assert.equal(horizontal.nativeClicks, 2);
    if (reducedMotion === 'no-preference') {
      await evaluate(variant, 'change', 'vertical', 1200);
      await page.waitForFunction((variant) => {
        const p = window.__iconsPacked.contourConsumers[variant].phase();
        return p > 0.1 && p < 0.4;
      }, variant);
      const interrupted = await evaluate(variant, 'change', 'horizontal', 600);
      assert.ok(interrupted.from > 0.1 && interrupted.from < 0.4);
      assert.deepEqual(
        interrupted.after,
        interrupted.before,
        'разворот должен начать с видимой позы',
      );
      assert.equal(interrupted.previousPlayback, 'stopped');
      const pose = await evaluate(variant, 'read');
      assertContourPose(pose, reference, variant, pose.renderedProgress);
      const reversed = await evaluate(variant, 'pauseAt', 200);
      assertContourPose(reversed, reference, variant, reversed.renderedProgress);
      close(reversed.renderedProgress, interrupted.from * (1 - 200 / 600), 'reverse public seek');
      const newest = await evaluate(variant, 'change', 'vertical', 300);
      assert.deepEqual(newest.after, newest.before, 'новая цель должна сохранить видимую позу');
      const terminal = await evaluate(variant, 'settle');
      assertContourPose(terminal, reference, variant, 1);
      records.push({
        name: `ellipsis/${variant}:interrupt-reverse-new-target`,
        interrupted,
        reversed: reversed.paths,
        newest,
        terminal: terminal.paths,
      });
    } else {
      const changed = await evaluate(variant, 'change', 'vertical', 1200);
      assert.equal(changed.effect.options.duration, 0);
      const terminal = await evaluate(variant, 'settle');
      assertContourPose(terminal, reference, variant, 1);
      assert.ok(
        terminal.notifications - horizontal.notifications <= 1,
        'reduced motion создал промежуточные кадры',
      );
      records.push({
        name: `ellipsis/${variant}:reduced-motion`,
        effect: changed.effect,
        terminal: terminal.paths,
      });
    }
    const refusals = await evaluate(variant, 'refuse');
    assert.deepEqual(
      Object.fromEntries(Object.entries(refusals).map(([key, item]) => [key, item.reason.code])),
      {
        variation: 'VARIATION_UNSUPPORTED',
        variant: 'VARIANT_UNSUPPORTED',
        format: 'FORMAT_UNSUPPORTED',
        state: 'STATE_UNSUPPORTED',
        invalid: 'INVALID_REQUEST',
      },
    );
    const exported = await evaluate(variant, 'exportSvg');
    const downloaded = await downloadedSvg(
      page,
      page
        .locator('figure.dots-orientation')
        .filter({ has: host })
        .getByRole('button', { name: 'Скачать SVG', exact: true }),
    );
    assert.equal(downloaded, exported, 'реальная загрузка SVG не сохранила видимую позу');
    const paths = await page.evaluate(
      (text) =>
        [...new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('path')].map(
          (path) => ({
            partId: path.dataset.part,
            d: path.getAttribute('d'),
            fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
          }),
        ),
      exported,
    );
    assert.deepEqual(
      paths,
      (await evaluate(variant, 'read')).paths,
      'SVG экспорт не сохранил текущую геометрию',
    );
    records.push({
      name: `ellipsis/${variant}:${reducedMotion}:public-contour`,
      initial: initial.paths,
      vertical: vertical.paths,
      horizontal: horizontal.paths,
      refusals,
      exported,
    });
  }
  for (const icon of AUTHORED_DOT_ICONS)
    for (const variant of ['outline', 'filled']) {
      const id = `${icon}/${variant}`;
      const read = () =>
        page.evaluate((id) => window.__iconsPacked.dotVariationConsumers[id].read(), id);
      const initial = await read();
      assertDotVariation(initial, reference, icon, variant, {});
      assert.equal(initial.capability.variation.domain.kind, 'convex-linear');
      const parameters = { dotScale: 1.1, spacingScale: 0.9 };
      const figure = page.locator(`figure[data-dots-variation="${id}"]`);
      const size = figure.getByRole('slider', { name: /Размер точки/ });
      const spacing = figure.getByRole('slider', { name: /Расстояние/ });
      await size.focus();
      await size.press('ArrowRight');
      await size.press('ArrowRight');
      await spacing.focus();
      await spacing.press('ArrowLeft');
      await spacing.press('ArrowLeft');
      const varied = await read();
      assertDotVariation(varied, reference, icon, variant, parameters);
      assert.equal(varied.events.length, 4);
      assert.ok(
        varied.events.every((event) => event.trusted && event.result.ok),
        'variation controls не получили реальные keyboard events',
      );
      if (icon.endsWith('horizontal')) {
        assert.deepEqual(
          varied.capability.motion.gestures.map((gesture) => gesture.id),
          ['ellipsis-horizontal.activity', 'ellipsis-horizontal.idle'],
        );
        await figure.getByRole('button', { name: 'Один цикл загрузки', exact: true }).click();
        const activated = await read();
        assert.equal(activated.activityEvents[0].trusted, true);
        assert.equal(activated.activityEffect.version, 2);
        assert.equal(activated.activityEffect.icon, icon);
        assert.equal(activated.activityEffect.variant, variant);
        assert.deepEqual(
          activated.activityEffect.targets.map((target) => target.partId),
          PART_IDS,
        );
        if (reducedMotion === 'no-preference') {
          const paused = await page.evaluate(
            (id) => window.__iconsPacked.dotVariationConsumers[id].pauseActivity(180),
            id,
          );
          assertDotVariation(paused, reference, icon, variant, parameters);
          assert.ok(
            paused.opacity.some((part) => part.value < 0.5) &&
              paused.opacity.some((part) => part.value > 0.5),
          );
          const newer = await page.evaluate(
            (id) => window.__iconsPacked.dotVariationConsumers[id].activity(),
            id,
          );
          assert.deepEqual(
            newer.after,
            newer.before,
            'новый loading cycle должен сохранить видимую непрозрачность',
          );
          assert.equal(newer.previousPlayback, 'stopped');
        } else assert.equal(activated.activityEffect.options.duration, 0);
        const terminal = await page.evaluate(
          (id) => window.__iconsPacked.dotVariationConsumers[id].settleActivity(),
          id,
        );
        assertDotVariation(terminal, reference, icon, variant, parameters);
        assert.ok(terminal.opacity.every((part) => part.value === 1));
        records.push({
          name: `${id}:${reducedMotion}:varied-loading-cycle`,
          effect: activated.activityEffect,
          geometry: terminal.paths,
          completionStatus: terminal.completionStatus,
        });
      } else {
        assert.deepEqual(varied.capability.motion.gestures, []);
        const unsupported = await page.evaluate(
          (id) => window.__iconsPacked.dotVariationConsumers[id].activity(),
          id,
        );
        assert.equal(unsupported.ok, false);
        assert.equal(unsupported.reason.code, 'SEMANTIC_MOTION_UNAVAILABLE');
      }
      const exportPose = await read();
      const exported = await page.evaluate(
        (text) =>
          [...new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('path')].map(
            (path) => ({
              partId: path.dataset.part,
              d: path.getAttribute('d'),
              fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
            }),
          ),
        exportPose.exportSvg,
      );
      assert.equal(
        await downloadedSvg(page, figure.getByRole('button', { name: 'Скачать SVG', exact: true })),
        exportPose.exportSvg,
        'реальная variation загрузка не сохранила геометрию',
      );
      assert.deepEqual(exported, varied.paths, 'variation export не сохранил изменённую геометрию');
      const refused = await page.evaluate(
        (id) => window.__iconsPacked.dotVariationConsumers[id].refuse(),
        id,
      );
      assert.deepEqual(refused, [
        'INVALID_VARIATION',
        'INVALID_VARIATION',
        'VARIATION_OUTSIDE_DOMAIN',
      ]);
      const unchanged = await read();
      assert.deepEqual(unchanged.paths, varied.paths);
      await page.evaluate((id) => window.__iconsPacked.dotVariationConsumers[id].update({}), id);
      const restored = await read();
      assertDotVariation(restored, reference, icon, variant, {});
      // Снимок сохраняет реальную nondefault форму в трёх размерах.
      await page.evaluate(
        ({ id, parameters }) => window.__iconsPacked.dotVariationConsumers[id].update(parameters),
        { id, parameters },
      );
      records.push({
        name: `${id}:${reducedMotion}:authored-variation`,
        initial: initial.paths,
        varied: varied.paths,
        restored: restored.paths,
        parameters,
        refused,
        author: varied.author,
        exported: exportPose.exportSvg,
        events: varied.events,
      });
    }
  // Пауза оставляет незавершённую операцию для проверки dispose независимо от screenshot latency.
  for (const variant of ['outline', 'filled']) {
    await evaluate(variant, 'change', 'horizontal', 1000);
    if (reducedMotion === 'no-preference') {
      const paused = await evaluate(variant, 'pauseAt', 200);
      assertContourPose(paused, reference, variant, paused.renderedProgress);
    } else await evaluate(variant, 'settle');
  }
}
