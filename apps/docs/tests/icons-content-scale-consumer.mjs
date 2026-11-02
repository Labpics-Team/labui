import assert from 'node:assert/strict';
import { ANNULUS_ICONS, rawAnnulusReference } from './icons-annulus-consumer.mjs';
import { downloadedSvg } from './icons-authored-dots-consumer.mjs';

export const CONTENT_SCALE_ENTRIES = ANNULUS_ICONS.map(
  (icon) => `@labpics/icons/content-variations/${icon}`,
);

// Независимый oracle читает абсолютные команды raw master до импорта producer.
export function rawContentCoordinates(d) {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  assert.equal(d.replace(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, ''), '');
  const counts = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };
  const result = [];
  let index = 0;
  let command;
  let x = 0;
  let y = 0;
  let first;
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    assert.ok(Object.hasOwn(counts, command), `Неподдержанная raw команда ${command}`);
    const count = counts[command];
    const values = tokens.slice(index, index + count).map(Number);
    assert.equal(values.length, count);
    assert.ok(values.every(Number.isFinite));
    index += count;
    if (command === 'Z') {
      [x, y] = first;
      command = undefined;
      continue;
    }
    if (command === 'H') {
      x = values[0];
      result.push([x, y]);
    } else if (command === 'V') {
      y = values[0];
      result.push([x, y]);
    } else {
      for (let operand = 0; operand < values.length; operand += 2)
        result.push([values[operand], values[operand + 1]]);
      [x, y] = values.slice(-2);
      if (command === 'M') {
        first = [x, y];
        command = 'L';
      }
    }
  }
  assert.ok(result.length > 0);
  return result;
}

export function assertContentScalePaths(actual, reference, parameters) {
  const { contentScale, enclosureEmphasis } = parameters;
  assert.equal(actual.length, reference.paths.length);
  const ring = rawAnnulusReference(reference.paths, reference.viewBox);
  for (let index = 0; index < actual.length - 1; index++) {
    assert.equal(actual[index].fillRule, reference.paths[index].fillRule);
    if (contentScale === 1) {
      assert.equal(actual[index].d, reference.paths[index].d, 'scale 1 сохраняет исходный content');
      continue;
    }
    const source = rawContentCoordinates(reference.paths[index].d);
    const output = rawContentCoordinates(actual[index].d);
    assert.equal(output.length, source.length);
    for (const [pointIndex, point] of output.entries())
      for (let axis = 0; axis < 2; axis++) {
        const expected =
          ring.center[axis] + contentScale * (source[pointIndex][axis] - ring.center[axis]);
        const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(expected));
        assert.ok(
          Math.abs(point[axis] - expected) <= tolerance,
          `content ${index}/${pointIndex}/${axis}`,
        );
      }
  }
  assert.equal(actual.at(-1).fillRule, reference.paths.at(-1).fillRule);
  const contours = actual.at(-1).d.split(/(?=M)/).filter(Boolean);
  assert.equal(contours[0], ring.outerD, 'outer сохраняется при обоих параметрах');
  if (enclosureEmphasis === 1) {
    assert.equal(actual.at(-1).d, reference.paths.at(-1).d);
  } else {
    const output = rawContentCoordinates(contours[1]);
    const source = rawContentCoordinates(ring.innerD);
    const scale =
      (ring.outerRadius - enclosureEmphasis * ring.referenceThickness) / ring.innerRadius;
    assert.equal(output.length, source.length);
    for (const [index, point] of output.entries())
      for (let axis = 0; axis < 2; axis++) {
        const expected = ring.center[axis] + scale * (source[index][axis] - ring.center[axis]);
        assert.ok(
          Math.abs(point[axis] - expected) <= 8 * Number.EPSILON * Math.max(1, Math.abs(expected)),
        );
      }
  }
}

/** Одна настройка набора; сначала все восемь admissions, затем изменение DOM. */
export function mountContentScaleConsumer(apis) {
  const labels = [
    'Внимание',
    'Подтвердить',
    'Закрыть',
    'Убрать',
    'Пауза',
    'Воспроизвести',
    'Добавить',
    'Вопрос',
  ];
  const section = document.createElement('section');
  section.className = 'content-scale-set';
  const heading = document.createElement('h2');
  heading.textContent = 'Знак и обрамление';
  section.append(heading);
  const bindings = [];
  let selectedIndex = 6;
  for (const size of [16, 20, 24, 32, 48]) {
    const row = document.createElement('div');
    row.className = 'content-scale-row';
    row.setAttribute('aria-label', `${size} px`);
    for (const [index, api] of apis.entries()) {
      const model = api.glyph();
      const button = document.createElement('lab-button');
      button.setAttribute('size', 'l');
      button.setAttribute('icon', '');
      button.setAttribute('type', 'neutral');
      button.setAttribute('aria-label', labels[index]);
      button.setAttribute('title', labels[index]);
      button.addEventListener('click', () => {
        selectedIndex = index;
        download.textContent = `Скачать SVG: ${labels[index]}`;
      });
      button.innerHTML = renderGlyphSvg(model, { instanceId: `content-${model.icon}-${size}` });
      const svg = button.querySelector('svg');
      svg.setAttribute('slot', 'icon');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.style.width = `${size}px`;
      svg.style.height = `${size}px`;
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const nodes = [...svg.querySelectorAll('path[data-part]')];
      if (nodes.length !== model.parts.length)
        throw new Error('Нужны самостоятельные authored parts');
      bindings.push({ api, index, size, button, svg, nodes, model, original: model });
      row.append(button);
    }
    const caption = document.createElement('span');
    caption.textContent = `${size} px`;
    row.append(caption);
    section.append(row);
  }
  const controls = document.createElement('div');
  controls.className = 'content-scale-controls';
  const status = document.createElement('output');
  status.id = 'content-scale-status';
  status.setAttribute('aria-live', 'polite');
  const inputs = {};
  const events = [];
  let parameters = { contentScale: 1, enclosureEmphasis: 1 };
  let refusal = null;
  let disposed = false;
  let confirmationControl;
  let confirmationGeneration = 0;
  const confirmationBindings = bindings.filter(
    (binding) => binding.model.icon === 'checkmark-circle',
  );
  const presence = annulusPresenceGesture(confirmationBindings[0].api.glyphCapabilities());
  if (!presence) throw new Error('У подтверждения нет semantic presence gesture');
  const confirmationNodes = confirmationBindings.map((binding) =>
    binding.nodes.find((node) => node.dataset.part === presence.partIds[0]),
  );
  const phase = () => confirmationNodes.map((node) => Number(getComputedStyle(node).opacity));
  const requireActive = () => {
    if (disposed) throw new Error('Consumer освобождён');
  };
  function update(next) {
    requireActive();
    let models;
    try {
      models = apis.map((api) => api.glyph({ variation: next }));
      for (const binding of bindings) {
        const model = models[binding.index];
        if (
          annulusRenderKey(model) !== annulusRenderKey(binding.original) ||
          binding.nodes.some(
            (node, index) =>
              node !== binding.svg.querySelectorAll('path[data-part]')[index] ||
              node.dataset.part !== binding.model.parts[index].id ||
              node.getAttribute('d') !== binding.model.parts[index].d,
          )
        )
          throw Object.assign(new Error('Потеряна correspondence'), {
            code: 'RENDER_CORRESPONDENCE_MISMATCH',
          });
      }
    } catch (error) {
      refusal = error.code ?? 'RENDER_CORRESPONDENCE_MISMATCH';
      status.textContent =
        refusal === 'INVALID_VARIATION'
          ? 'Введите положительные числа. Сохранена предыдущая форма.'
          : 'Это сочетание недоступно. Сохранена предыдущая форма.';
      for (const input of Object.values(inputs)) {
        input.setCustomValidity(status.textContent);
        input.setAttribute('aria-invalid', 'true');
      }
      return { ok: false, code: refusal };
    }
    const before = phase();
    for (const binding of bindings) {
      const model = models[binding.index];
      for (const [index, part] of model.parts.entries())
        if (binding.nodes[index].getAttribute('d') !== part.d)
          binding.nodes[index].setAttribute('d', part.d);
      binding.model = model;
    }
    parameters = {
      contentScale: next?.contentScale ?? 1,
      enclosureEmphasis: next?.enclosureEmphasis ?? 1,
    };
    refusal = null;
    for (const [name, input] of Object.entries(inputs)) {
      input.value = String(parameters[name]);
      input.setCustomValidity('');
      input.removeAttribute('aria-invalid');
    }
    status.textContent = `Знак ×${parameters.contentScale}, обрамление ×${parameters.enclosureEmphasis}`;
    return { ok: true, continuity: { before, after: phase(), generation: confirmationGeneration } };
  }
  for (const [name, text] of [
    ['contentScale', 'Размер знака'],
    ['enclosureEmphasis', 'Толщина обрамления'],
  ]) {
    const label = document.createElement('label');
    label.textContent = text;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.min = '0';
    input.value = '1';
    input.setAttribute('aria-label', text);
    input.setAttribute('aria-describedby', status.id);
    inputs[name] = input;
    input.addEventListener('input', (event) => {
      const next = Object.fromEntries(
        Object.entries(inputs).map(([key, field]) => [key, field.valueAsNumber]),
      );
      const result = update(next);
      events.push({ trusted: event.isTrusted, parameters: next, result });
    });
    label.append(input);
    controls.append(label);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Авторская форма';
  reset.addEventListener('click', () => update({ contentScale: 1, enclosureEmphasis: 1 }));
  function changeConfirmation(to, duration = 600) {
    requireActive();
    const before = phase();
    const binding = confirmationBindings.find((item) => item.size === 24);
    const result = compileSymbolEffect(
      binding.model,
      binding.api.glyphCapabilities(),
      presence.id,
      {
        from: before[0],
        to,
        duration,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
    );
    if (!result.ok) throw new Error(result.reason.code);
    const previous = confirmationControl;
    const next = sequence(
      scalarSequenceSteps(
        result.effect,
        new Map([[presence.partIds[0], confirmationNodes]]),
        new Map(confirmationNodes.map((node, index) => [node, before[index]])),
      ),
      {
        reducedMotion: result.effect.options.duration === 0 ? 'always' : 'user',
      },
    );
    confirmationControl = next;
    confirmationGeneration++;
    previous?.stop();
    return { before, after: phase(), effect: result.effect, generation: confirmationGeneration };
  }
  for (const [to, text] of [
    [0, 'Скрыть подтверждение'],
    [1, 'Показать подтверждение'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', () => changeConfirmation(to));
    controls.append(button);
  }
  const download = document.createElement('button');
  download.type = 'button';
  download.textContent = `Скачать SVG: ${labels[selectedIndex]}`;
  download.className = 'content-scale-download';
  download.addEventListener('click', () => {
    requireActive();
    const binding = bindings.find((item) => item.index === selectedIndex && item.size === 24);
    const text = visibleAnnulusSvg(
      binding.svg,
      binding.model.icon === 'checkmark-circle' ? presence.partIds : [],
    );
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    let link;
    try {
      link = document.createElement('a');
      link.href = url;
      link.download = `${binding.model.icon}-outline.svg`;
      document.body.append(link);
      link.click();
    } finally {
      link?.remove();
      URL.revokeObjectURL(url);
    }
  });
  controls.append(reset, download, status);
  section.append(controls);
  document.body.append(section);
  update(parameters);
  const read = () => ({
    parameters,
    refusal,
    events,
    selectedIcon: apis[selectedIndex].glyph().icon,
    confirmation: {
      phase: phase(),
      generation: confirmationGeneration,
      playback: confirmationControl?.state ?? null,
    },
    models: bindings
      .filter((item) => item.size === 24)
      .map(({ model, original, api }) => ({
        icon: model.icon,
        provenance: model.provenance,
        defaultIdentity: model === original,
        sourceOnlyIdentity: api.glyph({ modelMode: 'source-only' }) === original,
        explicitDefaultIdentity:
          api.glyph({ variation: { contentScale: 1, enclosureEmphasis: 1 } }) === original,
        capability: api.glyphCapabilities('outline'),
        paths: model.parts.map(({ d, fillRule }) => ({ d, fillRule })),
      })),
    samples: bindings.map(({ index, size, svg, nodes, button, model }) => ({
      icon: model.icon,
      index,
      size,
      domIdentity: nodes.every(
        (node, index) => node === svg.querySelectorAll('path[data-part]')[index],
      ),
      paths: [...svg.querySelectorAll('path[data-part]')].map((node) => ({
        d: node.getAttribute('d'),
        fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
      })),
      svg: svg.outerHTML,
      width: svg.getBoundingClientRect().width,
      height: svg.getBoundingClientRect().height,
      label: button.getAttribute('aria-label'),
      target: button.shadowRoot?.querySelector('button')?.getBoundingClientRect().toJSON(),
    })),
  });
  return {
    read,
    update,
    changeConfirmation,
    attempt: (icon, request) => {
      requireActive();
      const api = apis.find((api) => api.glyph().icon === icon);
      if (!api) throw new Error('Неподдержанный consumer icon');
      try {
        api.glyph(request);
        return 'accepted';
      } catch (error) {
        return error.code;
      }
    },
    exportSvg: () => {
      requireActive();
      const binding = bindings.find((item) => item.index === selectedIndex && item.size === 24);
      return visibleAnnulusSvg(
        binding.svg,
        binding.model.icon === 'checkmark-circle' ? presence.partIds : [],
      );
    },
    pauseConfirmationAt: (milliseconds) => {
      requireActive();
      confirmationControl.pause();
      confirmationControl.seek(milliseconds);
      return read();
    },
    settleConfirmation: async () => {
      requireActive();
      const generation = confirmationGeneration;
      const result = await confirmationControl.finished;
      requireActive();
      assertGeneration(generation);
      return { ...read(), completion: result.status };
    },
    cleanup: () => {
      if (disposed) return;
      disposed = true;
      confirmationGeneration++;
      confirmationControl?.stop();
      section.remove();
    },
  };
  function assertGeneration(generation) {
    if (confirmationGeneration !== generation) throw new Error('Подтверждение заменено');
  }
}

export function contentScaleFixture() {
  return `
${ANNULUS_ICONS.map((icon, index) => `import * as contentScale${index} from '@labpics/icons/content-variations/${icon}';`).join('\n')}
${mountContentScaleConsumer.toString()}
const contentScaleConsumer = mountContentScaleConsumer([${ANNULUS_ICONS.map((_, index) => `contentScale${index}`).join(',')}]);
window.__iconsPacked.contentScaleConsumer = contentScaleConsumer;
const contentScaleCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { contentScaleConsumer.cleanup(); return contentScaleCleanup(); };
`;
}

export function contentScaleTypeFixture() {
  return `
import { glyph as contentGlyph, glyphCapabilities as contentCapabilities } from '@labpics/icons/content-variations/plus-circle';
contentGlyph({variation:{contentScale:.9,enclosureEmphasis:1.1}});
const contentLaw: 'annulus.content-counter-scale' = contentCapabilities().variation.law;
// @ts-expect-error Filled has independent authorship.
contentGlyph({variant:'filled',variation:{contentScale:1}});
// @ts-expect-error Content size is not a global weight axis.
contentGlyph({variation:{weight:1}});
`;
}

export function assertContentMotionTransfer(observation, reducedMotion, target) {
  if (reducedMotion === 'reduce') {
    assert.equal(observation.effect.options.duration, 0);
    assert.ok(observation.after.every((value) => value === target));
  } else {
    assert.ok(
      observation.before.every(
        (value, index) => Math.abs(value - observation.after[index]) < 0.000001,
      ),
    );
  }
}

export async function contentScaleBrowserProof(page, reference, reducedMotion, records) {
  const read = () => page.evaluate(() => window.__iconsPacked.contentScaleConsumer.read());
  const check = async (parameters) => {
    const observed = await read();
    assert.deepEqual(observed.parameters, parameters);
    assert.equal(observed.refusal, null);
    assert.deepEqual(
      observed.models.map((item) => item.icon),
      ANNULUS_ICONS,
    );
    for (const item of observed.models) {
      assert.equal(item.capability.variation.law, 'annulus.content-counter-scale');
      assert.equal(item.sourceOnlyIdentity, true);
      assert.equal(item.explicitDefaultIdentity, true);
      assertContentScalePaths(item.paths, reference.icons[item.icon].outline, parameters);
    }
    for (const sample of observed.samples) {
      assert.equal(sample.domIdentity, true);
      assert.equal(sample.width, sample.size);
      assert.equal(sample.height, sample.size);
      assert.ok(sample.label.length > 0);
      assert.ok(sample.target.width >= 44 && sample.target.height >= 44);
      assertContentScalePaths(sample.paths, reference.icons[sample.icon].outline, parameters);
    }
    return observed;
  };
  await check({ contentScale: 1, enclosureEmphasis: 1 });
  const section = page.locator('section.content-scale-set');
  await section.getByRole('spinbutton', { name: 'Размер знака', exact: true }).fill('0.9');
  await section.getByRole('spinbutton', { name: 'Толщина обрамления', exact: true }).fill('1.1');
  const changed = await check({ contentScale: 0.9, enclosureEmphasis: 1.1 });
  assert.ok(changed.events.some((event) => event.trusted && event.result.ok));
  const prior = changed.samples.map((item) => item.paths);
  const refused = await page.evaluate(() =>
    window.__iconsPacked.contentScaleConsumer.update({ contentScale: 10, enclosureEmphasis: 1 }),
  );
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'VARIATION_OUTSIDE_DOMAIN');
  assert.deepEqual(
    (await read()).samples.map((item) => item.paths),
    prior,
  );
  const call = (method, ...args) =>
    page.evaluate(
      ({ method, args }) => window.__iconsPacked.contentScaleConsumer[method](...args),
      { method, args },
    );
  assert.equal(
    await call('attempt', 'plus-circle', { variation: { contentScale: 1.3 } }),
    'accepted',
  );
  assert.equal(
    await call('attempt', 'plus-circle', { variation: { enclosureEmphasis: 2.2 } }),
    'accepted',
  );
  assert.equal(
    await call('attempt', 'plus-circle', {
      variation: { contentScale: 1.3, enclosureEmphasis: 2.2 },
    }),
    'VARIATION_OUTSIDE_DOMAIN',
  );
  assert.equal(
    await call('attempt', 'plus-circle', { variant: 'filled', variation: { contentScale: 1 } }),
    'AUTHOR_VARIATION_UNSUPPORTED',
  );
  assert.equal(
    await call('attempt', 'plus-circle', {
      modelMode: 'source-only',
      variation: { contentScale: 0.9 },
    }),
    'AUTHOR_PARITY_REQUIRED',
  );
  assert.equal(
    await call('attempt', 'plus-circle', { variation: { contentScale: 0 } }),
    'INVALID_VARIATION',
  );
  // Геометрия и видимый прогресс меняются разными владельцами.
  const first = await call('changeConfirmation', 0, 1000);
  if (reducedMotion === 'reduce') {
    assert.equal(first.effect.options.duration, 0);
    assert.ok(first.after.every((value) => value === 0));
  } else {
    await call('pauseConfirmationAt', 400);
  }
  const phaseBefore = (await read()).confirmation;
  if (reducedMotion !== 'reduce')
    assert.ok(phaseBefore.phase.every((value) => value > 0 && value < 1));
  const pathsBeforeMotionUpdate = (await read()).samples.map((item) => item.paths);
  const variedDuringMotion = await call('update', { contentScale: 1, enclosureEmphasis: 1 });
  assert.equal(variedDuringMotion.ok, true);
  assert.deepEqual(variedDuringMotion.continuity.before, variedDuringMotion.continuity.after);
  assert.equal(variedDuringMotion.continuity.generation, phaseBefore.generation);
  assert.notDeepEqual(
    (await read()).samples.map((item) => item.paths),
    pathsBeforeMotionUpdate,
  );
  await check({ contentScale: 1, enclosureEmphasis: 1 });
  const reverse = await call('changeConfirmation', 1, 1000);
  assertContentMotionTransfer(reverse, reducedMotion, 1);
  await call('changeConfirmation', 0, 1000);
  if (reducedMotion !== 'reduce') await call('pauseConfirmationAt', 200);
  assert.equal((await call('update', { contentScale: 0.9, enclosureEmphasis: 1.1 })).ok, true);
  await section
    .locator('.content-scale-row')
    .nth(2)
    .getByRole('button', { name: 'Подтвердить', exact: true })
    .click();
  const exported = await downloadedSvg(page, section.locator('button.content-scale-download'));
  assert.equal(exported, await call('exportSvg'));
  assert.equal((await read()).selectedIcon, 'checkmark-circle');
  const exportedPaths = await page.evaluate(
    (text) =>
      [...new DOMParser().parseFromString(text, 'image/svg+xml').querySelectorAll('path')].map(
        (node) => ({
          d: node.getAttribute('d'),
          fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
        }),
      ),
    exported,
  );
  assertContentScalePaths(exportedPaths, reference.icons['checkmark-circle'].outline, {
    contentScale: 0.9,
    enclosureEmphasis: 1.1,
  });
  await section.getByRole('button', { name: 'Авторская форма', exact: true }).click();
  const reset = await check({ contentScale: 1, enclosureEmphasis: 1 });
  assert.ok(reset.models.every((item) => item.defaultIdentity));
  records.push({
    name: `${reducedMotion}:content-scale-neighbor-buttons-joint-refusal-reset`,
    result: 'PASS',
    observations: changed,
  });
  records.push({
    name: `${reducedMotion}:content-scale-motion-continuity-visible-export`,
    result: 'PASS',
    observations: reset.confirmation,
  });
}
