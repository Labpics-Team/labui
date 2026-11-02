import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadedSvg, rawDotOperands } from './icons-authored-dots-consumer.mjs';

const symbols = {
  'alert-circle': {
    label: 'Внимание',
    parts: ['attention-dot', 'attention-stem', 'status-enclosure'],
  },
  'checkmark-circle': {
    label: 'Подтвердить',
    parts: ['confirmation-mark', 'confirmation-enclosure'],
  },
  'close-circle': { label: 'Закрыть', parts: ['dismissal-mark', 'status-enclosure'] },
  'minus-circle': { label: 'Убрать', parts: ['decrease-mark', 'status-enclosure'] },
  'pause-circle': {
    label: 'Пауза',
    parts: ['pause-first-bar', 'pause-second-bar', 'playback-enclosure'],
  },
  'play-circle': { label: 'Воспроизвести', parts: ['play-mark', 'playback-enclosure'] },
  'plus-circle': { label: 'Добавить', parts: ['increase-mark', 'status-enclosure'] },
  'question-circle': {
    label: 'Вопрос',
    parts: ['question-dot', 'question-stem', 'status-enclosure'],
  },
};
export const ANNULUS_ICONS = Object.keys(symbols);
export const ANNULUS_ENTRIES = ANNULUS_ICONS.flatMap((icon) => [
  `@labpics/icons/symbols/${icon}`,
  `@labpics/icons/variations/${icon}`,
]);

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
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

// Oracle читает авторский compound path. Координаты и радиусы не приходят из producer.
export function rawAnnulusReference(paths, viewBox) {
  assert.deepEqual(viewBox, [0, 0, 24, 24]);
  assert.ok(paths.length >= 2);
  assert.ok(paths.slice(0, -1).every((part) => part.fillRule === 'nonzero'));
  assert.equal(paths.at(-1).fillRule, 'evenodd');
  const contours = paths.at(-1).d.split(/(?=M)/).filter(Boolean);
  assert.equal(contours.length, 2);
  const [outer, inner] = contours.map(rawDotOperands);
  const center = [viewBox[0] + viewBox[2] / 2, viewBox[1] + viewBox[3] / 2];
  for (const values of [outer, inner]) {
    assert.equal(values[0], center[0]);
    assert.equal(values[7], center[1]);
    assert.equal(values[12], center[0]);
    assert.equal(values[19], center[1]);
    assert.ok(values[1] < center[1] && values[13] > center[1]);
  }
  const outerRadius = center[1] - outer[1];
  const innerRadius = center[1] - inner[1];
  assert.ok(outerRadius > innerRadius && innerRadius > 0);
  return {
    outerD: contours[0],
    innerD: contours[1],
    center,
    outerRadius,
    innerRadius,
    referenceThickness: outerRadius - innerRadius,
    inner,
  };
}

export function assertAnnulusPaths(paths, reference, emphasis) {
  assert.equal(paths.length, reference.paths.length);
  assert.deepEqual(
    paths.slice(0, -1),
    reference.paths.slice(0, -1),
    'все части content обязаны сохраняться буквально',
  );
  assert.equal(paths.at(-1).fillRule, reference.paths.at(-1).fillRule);
  if (emphasis === 1) {
    assert.deepEqual(paths, reference.paths, 'default обязан сохранить весь master');
    return;
  }
  const raw = rawAnnulusReference(reference.paths, reference.viewBox);
  const contours = paths.at(-1).d.split(/(?=M)/).filter(Boolean);
  assert.equal(contours.length, 2);
  assert.equal(contours[0], raw.outerD, 'outer обязан сохраняться буквально');
  const actual = rawDotOperands(contours[1]);
  const scale = (raw.outerRadius - emphasis * raw.referenceThickness) / raw.innerRadius;
  assert.ok(Number.isFinite(scale) && scale > 0);
  for (const [index, value] of actual.entries()) {
    const axis = index % 2;
    const expected = raw.center[axis] + scale * (raw.inner[index] - raw.center[axis]);
    // Независимая оценка трёх операций materialization; она не берётся из capability.
    const u = Number.EPSILON / 2;
    const displacement = Math.abs(raw.inner[index] - raw.center[axis]);
    const bound =
      u * Math.abs(scale) * displacement +
      u * Math.abs(scale) * (displacement + u * displacement) +
      u *
        (Math.abs(raw.center[axis]) +
          Math.abs(scale) * (displacement + u * displacement) * (1 + u));
    assert.ok(
      Number.isFinite(value) && Math.abs(value - expected) <= 2 * bound,
      `counter operand ${index}: ${value} != ${expected}`,
    );
  }
}

export function validateAnnulusReference(reference, figma) {
  assert.equal(reference.fileKey, figma.fileKey);
  assert.equal(reference.version, figma.version);
  assert.deepEqual(Object.keys(reference.icons).sort(), ANNULUS_ICONS);
  assert.match(reference.semanticSha256, /^[a-f0-9]{64}$/);
  for (const icon of ANNULUS_ICONS) {
    const variants = reference.icons[icon];
    assert.deepEqual(Object.keys(variants).sort(), ['filled', 'outline']);
    for (const variant of ['outline', 'filled']) {
      const item = variants[variant];
      assert.equal(
        item.sourceFile,
        `masters/figma/${figma.version}/${variant === 'outline' ? 'Outline' : 'Filled'}/${icon}.svg`,
      );
      assert.equal(item.author.fileKey, figma.fileKey);
      assert.equal(item.author.version, figma.version);
      assert.equal(item.author.kind, 'figma');
      assert.match(item.author.nodeId, /^\d+:\d+$/);
      for (const key of ['nodeSha256', 'masterSha256', 'normalizedSha256', 'pathFingerprintSha256'])
        assert.match(item.author[key], /^[a-f0-9]{64}$/);
      assert.deepEqual(item.viewBox, [0, 0, 24, 24]);
      assert.deepEqual(item.dimensions, [24, 24]);
      assert.equal(
        item.author.pathFingerprintSha256,
        digest(stableJSON(item.paths.map((path, index) => ({ index, ...path })))),
      );
      if (variant === 'filled') {
        assert.equal(item.declaration, null, 'Filled не получает Outline law');
        continue;
      }
      assert.equal(item.declaration.masterSha256, item.author.masterSha256);
      assert.equal(item.declaration.pathFingerprintSha256, item.author.pathFingerprintSha256);
      assert.deepEqual(
        item.declaration.gesture,
        icon === 'checkmark-circle'
          ? { law: 'confirmation.presence', purpose: 'confirmation', partId: 'confirmation-mark' }
          : null,
      );
      assert.deepEqual(item.declaration.variation, {
        law: 'annulus.counter-scale',
        parameter: 'enclosureEmphasis',
        enclosurePartId: symbols[icon].parts.at(-1),
      });
      assert.deepEqual(
        item.declaration.parts,
        symbols[icon].parts.map((id, pathIndex, all) => ({
          pathIndex,
          id,
          role: pathIndex === all.length - 1 ? 'container' : 'content',
        })),
      );
      rawAnnulusReference(item.paths, item.viewBox);
    }
  }
  return reference;
}

export async function annulusReference(iconsRoot, pin, readAuthorMaster) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const semantic = await readFile(join(iconsRoot, 'semantics/author-anatomy.json'));
  const annotations = JSON.parse(semantic);
  assert.deepEqual(annotations.source, pin.figma);
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const icons = {};
  for (const icon of ANNULUS_ICONS) {
    icons[icon] = {};
    for (const variant of ['outline', 'filled']) {
      const record = manifest.icons[icon][variant];
      const bytes = await readFile(join(iconsRoot, record.master));
      assert.equal(bytes.length, record.bytes);
      assert.equal(digest(bytes), record.sha256, 'raw author source отказал до import producer');
      const { viewBox, dimensions, paths } = readAuthorMaster(bytes);
      const fingerprint = digest(stableJSON(paths.map((path, index) => ({ index, ...path }))));
      assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
      icons[icon][variant] = {
        sourceFile: record.master,
        viewBox,
        dimensions,
        paths,
        declaration: annotations.icons[icon]?.[variant] ?? null,
        author: {
          kind: 'figma',
          ...pin.figma,
          nodeId: record.nodeId,
          nodeSha256: record.nodeSha256,
          masterSha256: digest(bytes),
          normalizedSha256: record.normalizedSource.sha256,
          pathFingerprintSha256: fingerprint,
        },
      };
    }
  }
  return validateAnnulusReference(
    { ...pin.figma, semanticSha256: digest(semantic), icons },
    pin.figma,
  );
}

/** Ожидание строится из raw master; consumer не импортирует compiler или packet. */
export function assertAnnulusObservation(observation, reference, icon, variant, emphasis = 1) {
  const expected = reference.icons[icon][variant];
  assert.equal(observation.icon, icon);
  assert.equal(observation.variant, variant);
  assert.deepEqual(observation.viewBox, expected.viewBox);
  assert.deepEqual(observation.author, expected.author);
  assert.equal(
    observation.sourceDefaultIdentity,
    true,
    'source и variation entry не разделяют exact default',
  );
  assert.equal(
    observation.sourceOnlyDefaultIdentity,
    true,
    'source-only обязан сохранить exact default',
  );
  assert.deepEqual(
    observation.samples.map(({ size }) => size),
    [16, 24, 48],
  );
  for (const sample of observation.samples) {
    assert.equal(sample.width, sample.size);
    assert.equal(sample.height, sample.size);
    assert.deepEqual(sample.paths, observation.paths);
  }
  const paths = observation.paths.map(({ d, fillRule }) => ({ d, fillRule }));
  if (variant === 'filled') {
    assert.equal(emphasis, 1);
    assert.equal(Object.hasOwn(observation.capability, 'variation'), false);
    assert.deepEqual(paths, expected.paths);
  } else {
    assert.equal(
      observation.explicitDefaultIdentity,
      true,
      'параметр 1 обязан вернуть exact default',
    );
    assert.deepEqual(
      observation.paths.map(({ partId }) => partId),
      expected.declaration.parts.map(({ id }) => id),
    );
    assert.deepEqual(
      observation.roles,
      expected.declaration.parts.map(({ id, role }, zIndex) => ({ id, role, zIndex })),
    );
    assert.equal(
      observation.contentIdentity,
      true,
      'вариативность не должна пересобирать неизменённый content',
    );
    assertAnnulusPaths(paths, expected, emphasis);
    const capability = observation.capability.variation;
    assert.equal(capability.version, 1);
    assert.equal(capability.law, 'annulus.counter-scale');
    assert.deepEqual(capability.defaults, { enclosureEmphasis: 1 });
    assert.equal(capability.domain.kind, 'radial-bernstein');
    assert.equal(capability.domain.parameter, 'enclosureEmphasis');
    assert.equal(capability.domain.evaluated, 'actual-binary64-scale');
    assert.deepEqual(capability.targets, {
      svg: 'supported',
      webEffect: 'not-declared',
      lottie: 'not-exported',
      sfSymbols: 'not-exported',
    });
  }
  if (emphasis === 1) {
    assert.equal(observation.defaultIdentity, true);
    assert.equal(observation.provenance.kind, 'source');
  } else {
    assert.equal(observation.defaultIdentity, false);
    assert.equal(observation.provenance.kind, 'authored-variation');
    assert.equal(observation.provenance.variation.version, 1);
    assert.equal(observation.provenance.variation.law, 'annulus.counter-scale');
    assert.match(observation.provenance.variation.geometrySha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(observation.provenance.variation.parameters, { enclosureEmphasis: emphasis });
  }
}

function mountAnnulusConsumer(api, sourceApi, icon, label, variant, parent) {
  const original = sourceApi.glyph({ variant });
  const sourceDefaultIdentity = api.glyph({ variant }) === original;
  const sourceOnlyDefaultIdentity = api.glyph({ variant, modelMode: 'source-only' }) === original;
  const explicitDefaultIdentity =
    variant === 'outline'
      ? api.glyph({ variant, variation: { enclosureEmphasis: 1 } }) === original
      : null;
  const capability = api.glyphCapabilities(variant);
  const figure = document.createElement('figure');
  figure.className = 'annulus-sample';
  figure.dataset.annulus = `${icon}/${variant}`;
  const caption = document.createElement('figcaption');
  caption.textContent = `${label}, ${variant === 'outline' ? 'контурное' : 'заливка'}`;
  const samples = document.createElement('div');
  samples.className = 'size-sample-row';
  const cells = [16, 24, 48].map((size) => {
    const cell = document.createElement('span');
    samples.append(cell);
    return { cell, size };
  });
  const status = document.createElement('output');
  status.id = `annulus-status-${icon}-${variant}`;
  status.setAttribute('aria-live', 'polite');
  const events = [];
  let model = original;
  let emphasis = 1;
  let refusal = null;
  let input;
  function update(variation) {
    let generated;
    try {
      generated = api.glyph({ variant, variation });
    } catch (error) {
      refusal = error.code;
      status.textContent = `${error.code}: это изменение обрамления недоступно.`;
      input?.setCustomValidity(status.textContent);
      input?.setAttribute('aria-invalid', 'true');
      return { ok: false, code: error.code };
    }
    model = generated;
    emphasis = variation?.enclosureEmphasis ?? 1;
    refusal = null;
    input?.setCustomValidity('');
    input?.removeAttribute('aria-invalid');
    if (input) input.value = String(emphasis);
    for (const { cell, size } of cells) {
      cell.innerHTML = renderGlyphSvg(model, { instanceId: `annulus-${icon}-${variant}-${size}` });
      const svg = cell.querySelector('svg');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      cell.append(`${size} px`);
    }
    status.textContent =
      variant === 'outline'
        ? `Обрамление ×${emphasis}. Наружный контур и знак сохраняются.`
        : 'Точное авторское начертание. Изменение обрамления не поддерживается.';
    return { ok: true };
  }
  figure.append(caption, samples);
  if (capability.variation?.law === 'annulus.counter-scale') {
    const label = document.createElement('label');
    label.className = 'annulus-parameter';
    label.textContent = 'Толщина обрамления';
    input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.min = '0';
    input.value = '1';
    input.setAttribute('aria-label', `Толщина обрамления: ${caption.textContent}`);
    input.setAttribute('aria-describedby', status.id);
    input.addEventListener('input', (event) => {
      const value = input.valueAsNumber;
      const result = update({ enclosureEmphasis: value });
      events.push({ trusted: event.isTrusted, value, result });
    });
    label.append(input);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Авторское обрамление';
    reset.addEventListener('click', () => update({ enclosureEmphasis: 1 }));
    figure.append(label, reset);
  }
  const download = document.createElement('button');
  download.type = 'button';
  download.textContent = 'Скачать SVG';
  download.addEventListener('click', () => {
    const text = cells[1].cell.querySelector('svg').outerHTML;
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${icon}-${variant}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  });
  figure.append(status, download);
  parent.append(figure);
  update(undefined);
  const paths = (svg) =>
    [...svg.querySelectorAll('path')].map((path) => ({
      partId: path.dataset.part,
      d: path.getAttribute('d'),
      fillRule: path.getAttribute('fill-rule') ?? 'nonzero',
    }));
  function read() {
    return {
      icon,
      variant,
      emphasis,
      refusal,
      events,
      provenance: model.provenance,
      author: model.provenance.author,
      capability,
      sourceDefaultIdentity,
      sourceOnlyDefaultIdentity,
      explicitDefaultIdentity,
      defaultIdentity: model === original,
      contentIdentity: model.parts
        .slice(0, -1)
        .every((part, index) => part === original.parts[index]),
      roles: model.parts.map(({ id, role, zIndex }) => ({ id, role, zIndex })),
      viewBox: [...model.viewBox],
      paths: paths(cells[1].cell.querySelector('svg')),
      samples: cells.map(({ cell, size }) => {
        const svg = cell.querySelector('svg');
        return {
          size,
          width: Number(svg.getAttribute('width')),
          height: Number(svg.getAttribute('height')),
          paths: paths(svg),
          svg: svg.outerHTML,
        };
      }),
      exportSvg: cells[1].cell.querySelector('svg').outerHTML,
    };
  }
  const attempt = (query) => {
    try {
      api.glyph(query);
      return 'accepted';
    } catch (error) {
      return error.code;
    }
  };
  return {
    read,
    update,
    refuse: () => ({
      zero: attempt({ variant, variation: { enclosureEmphasis: 0 } }),
      nan: attempt({ variant, variation: { enclosureEmphasis: Number.NaN } }),
      unknown: attempt({ variant, variation: { dotScale: 1 } }),
      domain: attempt({
        variant,
        variation: { enclosureEmphasis: Number.MIN_VALUE },
      }),
      collapse: attempt({ variant, variation: { enclosureEmphasis: 100 } }),
      sourceOnly: attempt({
        variant,
        modelMode: 'source-only',
        variation: { enclosureEmphasis: 1.2 },
      }),
      filledDefault: attempt({ variant: 'filled', variation: { enclosureEmphasis: 1 } }),
      filledEmpty: attempt({ variant: 'filled', variation: {} }),
      motion: compileSymbolEffect(model, capability, 'annulus.pulse', { duration: 300 }),
    }),
    cleanup: () => figure.remove(),
    disposal: () => ({ connected: figure.isConnected }),
  };
}

export function annulusFixture() {
  return `
${ANNULUS_ICONS.map((icon, index) => `import * as annulus${index} from '@labpics/icons/variations/${icon}';\nimport * as annulusSource${index} from '@labpics/icons/symbols/${icon}';`).join('\n')}
${mountAnnulusConsumer.toString()}
const annulusSection = document.createElement('section'); annulusSection.className = 'authored-annulus';
annulusSection.setAttribute('aria-labelledby', 'annulus-heading');
const annulusHeading = document.createElement('h2'); annulusHeading.id = 'annulus-heading'; annulusHeading.textContent = 'Обрамление';
const annulusRow = document.createElement('div'); annulusRow.className = 'annulus-row';
annulusSection.append(annulusHeading, annulusRow); document.body.append(annulusSection);
const annulusConsumers = {};
for (const [api, sourceApi, icon, label] of [${ANNULUS_ICONS.map((icon, index) => `[annulus${index}, annulusSource${index}, ${JSON.stringify(icon)}, ${JSON.stringify(symbols[icon].label)}]`).join(',')}])
  for (const variant of ['outline', 'filled']) annulusConsumers[icon + '/' + variant] = mountAnnulusConsumer(api, sourceApi, icon, label, variant, annulusRow);
window.__iconsPacked.annulusConsumers = annulusConsumers;
const annulusPreviousCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { for (const item of Object.values(annulusConsumers)) item.cleanup(); annulusSection.remove(); return annulusPreviousCleanup(); };
`;
}

export function annulusTypeFixture() {
  return `${ANNULUS_ICONS.filter((icon) => !['plus-circle', 'minus-circle'].includes(icon))
    .map(
      (icon, index) =>
        `import { glyph as otherAnnulus${index} } from '@labpics/icons/variations/${icon}';\nimport { glyph as otherSourceAnnulus${index} } from '@labpics/icons/symbols/${icon}';\notherAnnulus${index}({ variant: 'outline', variation: { enclosureEmphasis: 1.2 } });\notherAnnulus${index}({ variant: 'filled' });\notherSourceAnnulus${index}({ variant: 'outline', modelMode: 'source-only' });`,
    )
    .join('\n')}
import { glyph as plusAnnulus, glyphCapabilities as plusAnnulusCapabilities } from '@labpics/icons/variations/plus-circle';
import { glyph as minusAnnulus } from '@labpics/icons/variations/minus-circle';
import { glyph as sourcePlusAnnulus } from '@labpics/icons/symbols/plus-circle';
import { glyph as sourceMinusAnnulus } from '@labpics/icons/symbols/minus-circle';

plusAnnulus({ variant: 'outline', variation: { enclosureEmphasis: 1.2 } });
minusAnnulus({ variation: { enclosureEmphasis: 0.8 } });
plusAnnulus({ variant: 'filled' });
sourcePlusAnnulus({ variant: 'outline', modelMode: 'source-only' });
sourceMinusAnnulus({ variant: 'filled' });
const annulusLaw: 'annulus.counter-scale' = plusAnnulusCapabilities().variation.law;
const annulusDefault: 1 = plusAnnulusCapabilities('outline').variation.defaults.enclosureEmphasis;
void annulusLaw; void annulusDefault;

// @ts-expect-error Filled имеет собственный master и не поддерживает Outline law.
plusAnnulus({ variant: 'filled', variation: { enclosureEmphasis: 1.2 } });
// @ts-expect-error Обычный symbol не подключает variation runtime.
sourcePlusAnnulus({ variation: { enclosureEmphasis: 1.2 } });
// @ts-expect-error Потребитель не передаёт скрытые координаты контрформы.
minusAnnulus({ variation: { center: [12, 12] } });
// @ts-expect-error Filled capabilities не обещают вариативность.
plusAnnulusCapabilities('filled').variation;
`;
}

export async function annulusBrowserProof(page, reference, reducedMotion, records) {
  for (const icon of ANNULUS_ICONS)
    for (const variant of ['outline', 'filled']) {
      const id = `${icon}/${variant}`;
      const read = () =>
        page.evaluate((id) => window.__iconsPacked.annulusConsumers[id].read(), id);
      const figure = page.locator(`figure[data-annulus="${id}"]`);
      const initial = await read();
      assertAnnulusObservation(initial, reference, icon, variant);
      if (variant === 'filled') {
        assert.equal(await figure.getByRole('spinbutton').count(), 0);
        const refused = await page.evaluate(
          (id) => window.__iconsPacked.annulusConsumers[id].refuse(),
          id,
        );
        for (const [key, code] of Object.entries(refused))
          if (key !== 'motion') assert.equal(code, 'AUTHOR_VARIATION_UNSUPPORTED');
        assert.equal(refused.motion.ok, false);
        assert.equal(
          refused.motion.reason.code,
          initial.capability.motion?.state === 'gesture-ready'
            ? 'GESTURE_UNSUPPORTED'
            : 'SEMANTIC_MOTION_UNAVAILABLE',
        );
        records.push({
          name: `${id}:${reducedMotion}:annulus-source`,
          paths: initial.paths,
          author: initial.author,
          refused,
        });
        continue;
      }
      const input = figure.getByRole('spinbutton', { name: /Толщина обрамления/ });
      await input.fill('1.2');
      const varied = await read();
      assertAnnulusObservation(varied, reference, icon, variant, 1.2);
      assert.equal(varied.events.length, 1);
      assert.equal(varied.events[0].trusted, true, 'числовой ввод не получил native input');
      assert.equal(varied.events[0].result.ok, true);
      const exported = await downloadedSvg(
        page,
        figure.getByRole('button', { name: 'Скачать SVG', exact: true }),
      );
      assert.equal(exported, varied.exportSvg, 'загрузка SVG должна сохранять текущую форму');
      await input.fill(String(Number.MIN_VALUE));
      const rejected = await read();
      assert.equal(rejected.refusal, 'VARIATION_OUTSIDE_DOMAIN');
      assert.deepEqual(rejected.paths, varied.paths, 'отказ не заменяет последнюю принятую форму');
      assert.equal(await input.getAttribute('aria-invalid'), 'true');
      assert.equal(
        await downloadedSvg(page, figure.getByRole('button', { name: 'Скачать SVG', exact: true })),
        exported,
        'после отказа экспорт обязан сохранить последнюю принятую форму',
      );
      const refused = await page.evaluate(
        (id) => window.__iconsPacked.annulusConsumers[id].refuse(),
        id,
      );
      assert.deepEqual(
        Object.fromEntries(Object.entries(refused).filter(([key]) => key !== 'motion')),
        {
          zero: 'INVALID_VARIATION',
          nan: 'INVALID_VARIATION',
          unknown: 'INVALID_VARIATION',
          domain: 'VARIATION_OUTSIDE_DOMAIN',
          collapse: 'VARIATION_UNREPRESENTABLE',
          sourceOnly: 'AUTHOR_PARITY_REQUIRED',
          filledDefault: 'AUTHOR_VARIATION_UNSUPPORTED',
          filledEmpty: 'AUTHOR_VARIATION_UNSUPPORTED',
        },
      );
      assert.equal(refused.motion.ok, false);
      assert.equal(refused.motion.reason.code, 'SEMANTIC_MOTION_UNAVAILABLE');
      await input.fill('0.8');
      const thinner = await read();
      assertAnnulusObservation(thinner, reference, icon, variant, 0.8);
      assert.equal(await input.getAttribute('aria-invalid'), null);
      await figure.getByRole('button', { name: 'Авторское обрамление', exact: true }).click();
      const restored = await read();
      assertAnnulusObservation(restored, reference, icon, variant);
      await input.fill('1.2');
      records.push({
        name: `${id}:${reducedMotion}:annulus-variation`,
        initial: initial.paths,
        varied: varied.paths,
        thinner: thinner.paths,
        restored: restored.paths,
        author: varied.author,
        exported,
        refused,
      });
    }
}
