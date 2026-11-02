import assert from 'node:assert/strict';
import { assertAnnulusPaths, rawAnnulusReference } from './icons-annulus-consumer.mjs';
import { downloadedSvg } from './icons-authored-dots-consumer.mjs';

const GROUPS = {
  'status-circle': {
    label: 'Статусы',
    defaultState: 'question',
    enclosurePartId: 'status-enclosure',
    states: ['attention', 'confirmation', 'decrease', 'dismissal', 'increase', 'question'],
    sharedParts: [{ id: 'status-enclosure', role: 'container' }],
    buttonLabel: 'Сменить знак с выбранным обрамлением',
    selectLabel: 'Знак с выбранным обрамлением',
    labels: {
      attention: 'Внимание',
      confirmation: 'Подтверждение',
      decrease: 'Уменьшение',
      dismissal: 'Закрытие',
      increase: 'Увеличение',
      question: 'Вопрос',
    },
  },
  'playback-circle': {
    label: 'Воспроизведение',
    defaultState: 'play',
    enclosurePartId: 'playback-enclosure',
    states: ['pause', 'play'],
    sharedParts: [{ id: 'playback-enclosure', role: 'container' }],
    buttonLabel: 'Сменить воспроизведение с выбранным обрамлением',
    selectLabel: 'Воспроизведение с выбранным обрамлением',
    labels: { pause: 'Пауза', play: 'Воспроизвести' },
  },
};

export const STATE_ANNULUS_ENTRIES = Object.keys(GROUPS).flatMap((group) => [
  `@labpics/icons/states/${group}`,
  `@labpics/icons/state-variations/${group}`,
]);

export function stateAnnulusReferenceContract(group) {
  assert.ok(Object.hasOwn(GROUPS, group), 'Consumer не запрашивал такую вариативную группу');
  const { label, ...contract } = GROUPS[group];
  return structuredClone(contract);
}

export function validateStateAnnulusReference(reference, author, annulus, validateState) {
  assert.equal(reference?.fileKey, author.fileKey);
  assert.equal(reference?.version, author.version);
  assert.deepEqual(Object.keys(reference.groups ?? {}).sort(), Object.keys(GROUPS).sort());
  for (const [group, members] of Object.entries(reference.groups)) {
    validateState(members, author, group);
    for (const member of members.states) {
      const source = annulus.icons[member.icon]?.outline;
      assert.ok(source, 'Группа должна состоять из реальных авторских annulus members');
      assert.deepEqual(member.author, source.author);
      assert.deepEqual(member.paths, source.paths);
      assert.deepEqual(member.paths.at(-1), members.enclosure);
    }
  }
  return reference;
}

/** Consumer связывает готовую SVG-цель по producer ID, не восстанавливает геометрию. */
export function applyStateEnclosurePatch(svg, capability, result) {
  if (result?.ok === false) return result;
  const patch = result?.patch;
  const invalid = () =>
    Object.assign(new Error('Patch не соответствует общей части символа'), {
      code: 'RENDER_CORRESPONDENCE_MISMATCH',
    });
  if (
    result?.ok !== true ||
    patch?.contract !== 'labpics.symbol-geometry-patch/1' ||
    patch.version !== 1 ||
    patch.group !== capability.group ||
    patch.variant !== capability.variant ||
    patch.partId !== capability.enclosurePartId ||
    !patch.attributes ||
    Object.keys(patch.attributes).join(',') !== 'd' ||
    typeof patch.attributes.d !== 'string' ||
    !patch.attributes.d.length
  )
    throw invalid();
  const targets = [...svg.querySelectorAll('[data-part]')].filter(
    (node) => node.dataset.part === patch.partId,
  );
  if (
    targets.length !== 1 ||
    targets[0].tagName.toLowerCase() !== 'path' ||
    targets[0].dataset.role !== 'container' ||
    targets[0].closest('[data-state]')
  )
    throw invalid();
  if (targets[0].getAttribute('d') !== patch.attributes.d)
    targets[0].setAttribute('d', patch.attributes.d);
  return result;
}

/** Snapshot снимает видимые opacity; mounted DOM и уже выбранное d остаются на месте. */
export function visibleStateEnclosureSvg(svg, statePartIds) {
  const originals = [...svg.querySelectorAll('[data-part]')];
  const clone = svg.cloneNode(true);
  const copies = [...clone.querySelectorAll('[data-part]')];
  const values = statePartIds.map((partId) => {
    const indices = originals.flatMap((node, index) =>
      node.dataset.part === partId ? [index] : [],
    );
    if (indices.length !== 1 || originals[indices[0]].tagName.toLowerCase() !== 'g')
      throw new Error('Snapshot требует отдельную группу состояния');
    const opacity = getComputedStyle(originals[indices[0]]).opacity;
    if (opacity === '' || !Number.isFinite(Number(opacity)))
      throw new Error('Видимая opacity неизвестна');
    return { index: indices[0], opacity };
  });
  for (const { index, opacity } of values) copies[index].style.opacity = opacity;
  return clone.outerHTML;
}

export function mountStateAnnulusPresentation(api, svg, capability, section, lifecycle) {
  const variation = api.enclosureVariationCapabilities();
  if (
    variation.group !== capability.group ||
    variation.variant !== capability.variant ||
    variation.partId !== capability.enclosurePartId
  )
    throw new Error('Вариативность принадлежит другой группе');
  const all = [svg, ...svg.querySelectorAll('*')];
  const target = [...svg.querySelectorAll('[data-part]')].find(
    (node) => node.dataset.part === variation.partId,
  );
  if (!target) throw new Error('Нет общей части символа');
  const originalD = target.getAttribute('d');
  const defaultPatch = api.renderEnclosurePatch();
  if (!defaultPatch.ok || defaultPatch.patch.attributes.d !== originalD)
    throw new Error('Default изменил авторскую оболочку');
  const defaultIdentity =
    defaultPatch === api.renderEnclosurePatch({ variation: { enclosureEmphasis: 1 } });
  const panel = document.createElement('div');
  panel.className = 'state-enclosure-controls';
  const label = document.createElement('label');
  label.textContent = 'Толщина общего обрамления';
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.min = '0';
  input.value = '1';
  input.setAttribute('aria-label', `Толщина общего обрамления: ${variation.group}`);
  const status = document.createElement('output');
  status.id = `state-enclosure-status-${variation.group}`;
  status.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', status.id);
  let emphasis = 1;
  let expectedD = originalD;
  let refusal = null;
  let disposed = false;
  const events = [];
  const downloadEvents = [];
  const currentNodes = () => [svg, ...svg.querySelectorAll('*')];
  function binding() {
    const current = currentNodes();
    if (
      current.length !== all.length ||
      current.some((node, index) => node !== all[index]) ||
      target.getAttribute('d') !== expectedD
    )
      throw Object.assign(new Error('Mounted символ изменился вне consumer'), {
        code: 'RENDER_CORRESPONDENCE_MISMATCH',
      });
  }
  function update(request = {}) {
    if (disposed) throw new Error('Consumer уже освобождён');
    const before = lifecycle.pose();
    const execution = lifecycle.execution();
    let result;
    try {
      result = api.renderEnclosurePatch(request);
      if (!result.ok) {
        refusal = result.reason.code;
        status.textContent = `${refusal}: это обрамление недоступно.`;
        input.setCustomValidity(status.textContent);
        input.setAttribute('aria-invalid', 'true');
        return { ...result, continuity: { before, after: lifecycle.pose(), execution } };
      }
      binding();
      applyStateEnclosurePatch(svg, capability, result);
    } catch (error) {
      refusal = error.code ?? 'RENDER_CORRESPONDENCE_MISMATCH';
      status.textContent = `${refusal}: это обрамление недоступно.`;
      input.setCustomValidity(status.textContent);
      input.setAttribute('aria-invalid', 'true');
      return {
        ok: false,
        reason: { code: refusal, message: error.message },
        continuity: { before, after: lifecycle.pose(), execution },
      };
    }
    expectedD = result.patch.attributes.d;
    emphasis = request.variation?.enclosureEmphasis ?? 1;
    refusal = null;
    input.value = String(emphasis);
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    status.textContent = `Обрамление ×${emphasis}. Состояние и движение сохраняются.`;
    return {
      ...result,
      continuity: {
        before,
        after: lifecycle.pose(),
        execution,
        afterExecution: lifecycle.execution(),
      },
    };
  }
  input.addEventListener('input', (event) => {
    const value = input.valueAsNumber;
    events.push({
      trusted: event.isTrusted,
      value,
      result: update({ variation: { enclosureEmphasis: value } }),
    });
  });
  label.append(input);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Авторское обрамление';
  reset.addEventListener('click', () => update({ variation: { enclosureEmphasis: 1 } }));
  const download = document.createElement('button');
  download.type = 'button';
  download.textContent = 'Скачать видимый SVG';
  download.addEventListener('click', (event) => {
    const content = visibleStateEnclosureSvg(
      svg,
      capability.states.map((state) => state.partId),
    );
    const url = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${capability.group}-visible.svg`;
    try {
      document.body.append(anchor);
      downloadEvents.push({ trusted: event.isTrusted, phase: 'activate', file: anchor.download });
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  });
  panel.append(label, reset, download, status);
  section.append(panel);
  status.textContent = 'Авторское обрамление. Состояние и толщина управляются независимо.';
  return {
    update,
    read: () => ({
      capability: variation,
      emphasis,
      refusal,
      defaultIdentity,
      originalD,
      d: target.getAttribute('d'),
      inputValue: input.value,
      events,
      downloadEvents,
      identity:
        currentNodes().length === all.length &&
        currentNodes().every((node, index) => node === all[index]),
      exportSvg: visibleStateEnclosureSvg(
        svg,
        capability.states.map((state) => state.partId),
      ),
      execution: lifecycle.execution(),
    }),
    cleanup: () => {
      disposed = true;
      panel.remove();
    },
  };
}

export function stateAnnulusFixture() {
  return `
import * as stateAnnulusStatus from '@labpics/icons/state-variations/status-circle';
import * as stateAnnulusPlayback from '@labpics/icons/state-variations/playback-circle';
import * as stateAnnulusPlaybackSource from '@labpics/icons/states/playback-circle';
${applyStateEnclosurePatch.toString()}
${visibleStateEnclosureSvg.toString()}
${mountStateAnnulusPresentation.toString()}
const stateAnnulusConsumers = {};
for (const [api, originalApi, group, configuration] of [
  [stateAnnulusStatus, statusCircle, 'status-circle', ${JSON.stringify(GROUPS['status-circle'])}],
  [stateAnnulusPlayback, stateAnnulusPlaybackSource, 'playback-circle', ${JSON.stringify(GROUPS['playback-circle'])}],
]) {
  if (api.render !== originalApi.render || api.renderStateSvg !== originalApi.renderStateSvg ||
      api.compileStateEffect !== originalApi.compileStateEffect || api.stateCapabilities !== originalApi.stateCapabilities ||
      api.exportStateTransition !== originalApi.exportStateTransition)
    throw new Error('Opt-in раздвоил стандартные state функции');
  stateAnnulusConsumers[group] = mountStateConsumer(api, {
    ...configuration, heading: configuration.label + ': общее обрамление',
    presentationKey: 'state-annulus-' + group, enclosureVariation: true,
  });
}
window.__iconsPacked.stateAnnulusConsumers = stateAnnulusConsumers;
window.__iconsPacked.ready = Promise.all([window.__iconsPacked.ready, ...Object.values(stateAnnulusConsumers).map(item => item.ready)]);
const stateAnnulusPreviousCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { for (const item of Object.values(stateAnnulusConsumers)) item.cleanup(); return stateAnnulusPreviousCleanup(); };
`;
}

export function stateAnnulusTypeFixture() {
  return `
import { renderEnclosurePatch as statusEnclosurePatch, enclosureVariationCapabilities as statusEnclosureCapabilities,
  renderStateSvg as variedStatusSvg, compileStateEffect as variedStatusEffect } from '@labpics/icons/state-variations/status-circle';
import { renderEnclosurePatch as playbackEnclosurePatch } from '@labpics/icons/state-variations/playback-circle';
statusEnclosurePatch({ variation: { enclosureEmphasis: 1.2 } });
playbackEnclosurePatch({ variant: 'outline', variation: { enclosureEmphasis: 0.9 } });
variedStatusSvg('confirmation'); variedStatusEffect('dismissal', { duration: 300 });
const stateEnclosureLaw: 'annulus.counter-scale' = statusEnclosureCapabilities().law;
const stateEnclosureDefault: 1 = statusEnclosureCapabilities().defaults.enclosureEmphasis;
void stateEnclosureLaw; void stateEnclosureDefault;
// @ts-expect-error Independent Filled has no admitted shared annulus variation.
statusEnclosurePatch({ variant: 'filled', variation: { enclosureEmphasis: 1.1 } });
// @ts-expect-error This group does not acquire a general weight axis.
statusEnclosurePatch({ variation: { weight: 1.1 } });
// @ts-expect-error State choices remain exact across the opt-in facade.
variedStatusSvg('play');
`;
}

export function assertStateAnnulusObservation(observation, reference, annulus, emphasis) {
  assert.equal(observation.identity, true);
  assert.equal(observation.enclosurePresentation.identity, true);
  assert.equal(observation.enclosurePresentation.defaultIdentity, true);
  assert.equal(observation.enclosurePresentation.emphasis, emphasis);
  assert.equal(observation.enclosurePresentation.d, observation.enclosure.d);
  assert.equal(observation.enclosureCount, 1);
  assert.equal(observation.enclosureOpacity, 1);
  assert.deepEqual(observation.viewBox, [0, 0, 24, 24]);
  assert.deepEqual(
    observation.groups.map((item) => item.id),
    reference.states.map((item) => item.id),
  );
  for (const [index, group] of observation.groups.entries()) {
    const member = reference.states[index];
    const source = annulus.icons[member.icon].outline;
    assert.equal(group.partId, member.partId);
    assert.equal(group.role, 'state');
    assert.deepEqual(
      group.paths.map((part) => part.partId),
      member.contentPartIds,
    );
    assert.ok(group.paths.every((part) => part.role === 'content' && part.fill === 'currentColor'));
    assert.deepEqual(
      group.paths.map(({ d, fillRule }) => ({ d, fillRule })),
      source.paths.slice(0, -1),
    );
    assertAnnulusPaths(
      [
        ...group.paths.map(({ d, fillRule }) => ({ d, fillRule })),
        { d: observation.enclosure.d, fillRule: observation.enclosure.fillRule },
      ],
      source,
      emphasis,
    );
  }
  const capability = observation.enclosurePresentation.capability;
  assert.equal(capability.version, 1);
  assert.equal(capability.group, reference.group);
  assert.equal(capability.variant, 'outline');
  assert.equal(capability.partId, reference.enclosurePartId);
  assert.equal(capability.law, 'annulus.counter-scale');
  assert.deepEqual(capability.defaults, { enclosureEmphasis: 1 });
  assert.deepEqual(capability.targets, {
    svg: 'supported',
    webEffect: 'existing-state-transitions',
    lottie: 'not-exported',
    sfSymbols: 'not-exported',
  });
  assert.equal(capability.domain.kind, 'radial-bernstein');
  assert.equal(capability.domain.parameter, 'enclosureEmphasis');
  assert.equal(capability.domain.evaluated, 'actual-binary64-scale');
  assert.deepEqual(capability.proof.source, reference.proof.source);
  assert.equal(capability.proof.stateSpecSha256, reference.proof.specSha256);
  assert.equal(capability.proof.sharedPartsSha256, reference.proof.sharedPartsSha256);
  for (const key of ['geometrySha256', 'gridSha256'])
    assert.match(capability.proof[key], /^[a-f0-9]{64}$/);
  assert.deepEqual(
    capability.proof.members.map(({ state, icon, author }) => ({ state, icon, author })),
    reference.states.map(({ id, icon, author }) => ({ state: id, icon, author })),
  );
  for (const member of capability.proof.members) {
    assert.equal(
      member.sourceEnclosurePartId,
      annulus.icons[member.icon].outline.declaration.variation.enclosurePartId,
    );
    assert.match(member.geometrySha256, /^[a-f0-9]{64}$/);
  }
}

export async function stateAnnulusBrowserProof(
  page,
  reference,
  annulus,
  reducedMotion,
  records,
  sameOpacity,
) {
  const reduced = reducedMotion === 'reduce';
  for (const [group, expected] of Object.entries(reference.groups)) {
    const call = (method, ...args) =>
      page.evaluate(
        ({ group, method, args }) =>
          window.__iconsPacked.stateAnnulusConsumers[group][method](...args),
        { group, method, args },
      );
    const read = () => call('readState');
    const initial = await read();
    assertStateAnnulusObservation(initial, expected, annulus, 1);
    const section = page.locator(`section[data-state-group="state-annulus-${group}"]`);
    assert.deepEqual(initial.target, {
      width: 48,
      height: 48,
      name: GROUPS[group].buttonLabel,
      type: 'button',
      iconHidden: 'true',
      slotHidden: 'true',
    });
    const host = section.locator(`lab-button[data-state-group="state-annulus-${group}"]`);
    const button = host.getByRole('button', { name: GROUPS[group].buttonLabel, exact: true });
    assert.equal(await button.count(), 1);
    await host.click();
    await button.focus();
    await button.press('Enter');
    await button.press('Space');
    const activated = await read();
    assert.equal(activated.nativeClicks, 3);
    assert.equal(activated.events.length, 3);
    assert.ok(activated.events.every((event) => event.trusted && event.composed && event.native));
    for (const event of activated.events)
      if (!reduced) sameOpacity(event.before, event.after, event.continuity);
    const input = section.getByRole('spinbutton', {
      name: `Толщина общего обрамления: ${group}`,
      exact: true,
    });
    const [first, second] = expected.states;
    await call('changeState', first.id, 0);
    await call('settleState');
    await call('changeState', second.id, 600);
    if (!reduced) {
      await call('pauseState', 180);
      await page.waitForFunction(
        (group) =>
          window.__iconsPacked.stateAnnulusConsumers[group]
            .readState()
            .opacity.filter((item) => item.value > 0.05 && item.value < 0.95).length >= 2,
        group,
      );
    } else await call('settleState');
    const before = await read();
    await input.fill('1.25');
    const changed = await read();
    assertStateAnnulusObservation(changed, expected, annulus, 1.25);
    assert.deepEqual(changed.opacity, before.opacity, 'Geometry event сбросил видимую state смесь');
    assert.deepEqual(
      changed.enclosurePresentation.execution,
      before.enclosurePresentation.execution,
    );
    const event = changed.enclosurePresentation.events.at(-1);
    assert.equal(event.trusted, true);
    assert.equal(event.result.ok, true);
    assert.deepEqual(event.result.continuity.execution, event.result.continuity.afterExecution);
    sameOpacity(
      event.result.continuity.before.opacity,
      event.result.continuity.after.opacity,
      event.result.continuity,
    );
    const interrupted = await call('changeState', first.id, 420);
    if (!reduced) sameOpacity(interrupted.before, interrupted.after, interrupted.continuity);
    if (!reduced) await call('pauseState', 130);
    else await call('settleState');
    const runningPatch = await page.evaluate(
      ({ group, reduced }) => {
        const consumer = window.__iconsPacked.stateAnnulusConsumers[group];
        if (!reduced) consumer.playState();
        return consumer.updateEnclosure({ variation: { enclosureEmphasis: 0.9 } });
      },
      { group, reduced },
    );
    assert.equal(runningPatch.ok, true);
    assert.equal(runningPatch.continuity.execution.playback, reduced ? 'finished' : 'running');
    assert.deepEqual(runningPatch.continuity.execution, runningPatch.continuity.afterExecution);
    sameOpacity(
      runningPatch.continuity.before.opacity,
      runningPatch.continuity.after.opacity,
      runningPatch.continuity,
    );
    assertStateAnnulusObservation(await read(), expected, annulus, 0.9);
    if (!reduced) await call('pauseState', 150);
    const snapshot = await read();
    const download = await downloadedSvg(
      page,
      section.getByRole('button', { name: 'Скачать видимый SVG', exact: true }),
    );
    assert.equal(download, snapshot.enclosurePresentation.exportSvg);
    const refusalBefore = await read();
    for (const [request, code] of [
      [{ variant: 'filled', variation: { enclosureEmphasis: 1 } }, 'VARIANT_UNSUPPORTED'],
      [{ variation: { enclosureEmphasis: 0 } }, 'INVALID_REQUEST'],
      [{ variation: { enclosureEmphasis: 100 } }, 'POSE_UNREPRESENTABLE'],
      [{ variation: { weight: 1.1 } }, 'INVALID_REQUEST'],
    ]) {
      const refused = await call('updateEnclosure', request);
      assert.equal(refused.ok, false);
      assert.equal(refused.reason.code, code);
      const after = await read();
      assert.equal(after.enclosure.d, refusalBefore.enclosure.d);
      assert.deepEqual(after.groups, refusalBefore.groups);
      assert.deepEqual(after.opacity, refusalBefore.opacity);
      assert.equal(after.identity, true);
    }
    const domains = await page.evaluate(
      ({ group, icons }) => {
        const api = window.__iconsPacked.stateAnnulusConsumers[group];
        return {
          group: api.readState().enclosurePresentation.capability.domain.scale,
          members: icons.map((icon) => ({
            icon,
            domain:
              window.__iconsPacked.annulusConsumers[`${icon}/outline`].read().capability.variation
                .domain.scale,
          })),
        };
      },
      { group, icons: expected.states.map((item) => item.icon) },
    );
    assert.equal(
      domains.group.minimum,
      Math.max(...domains.members.map((item) => item.domain.minimum)),
    );
    assert.equal(
      domains.group.maximum,
      Math.min(...domains.members.map((item) => item.domain.maximum)),
    );
    const easier = domains.members.find((item) => item.domain.minimum < domains.group.minimum);
    if (easier) {
      const scale = (easier.domain.minimum + domains.group.minimum) / 2;
      const raw = rawAnnulusReference(annulus.icons[easier.icon].outline.paths, [0, 0, 24, 24]);
      const emphasis = (raw.outerRadius - raw.innerRadius * scale) / raw.referenceThickness;
      const accepted = await page.evaluate(
        ({ icon, emphasis }) =>
          window.__iconsPacked.annulusConsumers[`${icon}/outline`].update({
            enclosureEmphasis: emphasis,
          }),
        { icon: easier.icon, emphasis },
      );
      assert.equal(
        accepted.ok,
        true,
        'Контрпример обязан иметь реально допустимого одиночного соседа',
      );
      const refused = await call('updateEnclosure', { variation: { enclosureEmphasis: emphasis } });
      assert.equal(refused.ok, false);
      assert.equal(refused.reason.code, 'VARIATION_OUTSIDE_DOMAIN');
      assert.equal((await read()).enclosure.d, refusalBefore.enclosure.d);
      await page.evaluate(
        (icon) =>
          window.__iconsPacked.annulusConsumers[`${icon}/outline`].update({ enclosureEmphasis: 1 }),
        easier.icon,
      );
    }
    assert.ok(easier, 'Группа должна показать действующий контрпример ложного общего допуска');
    const final = await call('changeState', second.id, 300);
    if (!reduced) sameOpacity(final.before, final.after, final.continuity);
    const settled = await call('settleState');
    assertStateAnnulusObservation(settled, expected, annulus, 0.9);
    assert.equal(settled.completionStatus, 'finished');
    assert.deepEqual(
      settled.opacity,
      expected.states.map((state) => ({
        partId: state.partId,
        value: state.id === second.id ? 1 : 0,
      })),
    );
    records.push({
      name: `${group}:${reducedMotion}:state-enclosure-continuity`,
      source: expected.proof.source,
      initial: initial.enclosurePresentation.capability,
      target: initial.target,
      activations: activated.events,
      geometryEvent: event,
      interruption: interrupted.continuity,
      laterGeometry: runningPatch.continuity,
      domains,
      memberOnlyRequest: { icon: easier.icon, minimum: easier.domain.minimum },
      identity: settled.identity,
      terminal: settled.opacity,
      exportBytes: Buffer.byteLength(download),
    });
    await call('changeState', first.id, 600);
  }
}
