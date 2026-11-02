import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { annulusRenderKey, assertAnnulusPaths } from './icons-annulus-consumer.mjs';
import { downloadedSvg } from './icons-authored-dots-consumer.mjs';
import { rawContentPath } from './icons-content-scale-consumer.mjs';

export const MICROPHONE_ICONS = ['mic', 'mic-circle'];
export const MICROPHONE_ENTRIES = MICROPHONE_ICONS.flatMap((icon) => [
  `@labpics/icons/symbols/${icon}`,
  `@labpics/icons/variations/${icon}`,
]);
export const MICROPHONE_VISUAL_WIDTHS = Object.freeze([0.9, 0.8]);
export function microphoneVisualFile(mode, width) {
  assert.ok(['no-preference', 'reduce'].includes(mode), 'microphone visual: неизвестный режим');
  assert.ok(MICROPHONE_VISUAL_WIDTHS.includes(width), 'microphone visual: ширина вне снимков');
  return `result/${mode}-microphone-width-${width}.png`;
}
export const MICROPHONE_VISUAL_FILES = Object.freeze(
  ['no-preference', 'reduce'].flatMap((mode) =>
    MICROPHONE_VISUAL_WIDTHS.map((width) => microphoneVisualFile(mode, width)),
  ),
);
export const MICROPHONE_COMPARISON_ICONS = Object.freeze([
  'mic-circle',
  'question-circle',
  'play-circle',
]);
export const MICROPHONE_COMPARISON_WIDTHS = Object.freeze([1, 0.8]);
export function microphoneComparisonVisualFile(mode, width) {
  assert.ok(['no-preference', 'reduce'].includes(mode), 'microphone comparison: неизвестный режим');
  assert.ok(
    MICROPHONE_COMPARISON_WIDTHS.includes(width),
    'microphone comparison: ширина вне снимков',
  );
  return `result/${mode}-microphone-adjacent-width-${width}.png`;
}
export const MICROPHONE_COMPARISON_VISUAL_FILES = Object.freeze(
  ['no-preference', 'reduce'].flatMap((mode) =>
    MICROPHONE_COMPARISON_WIDTHS.map((width) => microphoneComparisonVisualFile(mode, width)),
  ),
);
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

/** Снимок связывается с проверенной шириной, а не только с именем файла. */
export function assertMicrophoneVisualEvidence(visuals, records) {
  for (const mode of ['no-preference', 'reduce'])
    for (const width of MICROPHONE_VISUAL_WIDTHS) {
      const file = microphoneVisualFile(mode, width);
      const matches = visuals.filter((visual) => visual.path === file);
      assert.equal(matches.length, 1, `microphone visual: отсутствует или повторён ${file}`);
      const observations = records.filter(
        (record) => record.name === `${mode}:microphone-width-${width}:optical`,
      );
      assert.equal(
        observations.length,
        1,
        `microphone visual: отсутствует или повторён receipt ${file}`,
      );
      const observed = observations[0];
      assert.equal(observed.result, 'PASS');
      assert.equal(observed.file, file);
      assert.equal(observed.bodyWidth, width);
      assert.equal(
        observed.pngSha256,
        digest(matches[0].bytes),
        `microphone visual: PNG не совпал с receipt ${file}`,
      );
      assert.deepEqual(
        observed.variants,
        MICROPHONE_ICONS.flatMap((icon) =>
          ['outline', 'filled'].map((variant) => `${icon}/${variant}`),
        ),
      );
      assert.deepEqual(observed.sizes, [16, 24, 48]);
      assert.equal(observed.samples, 12);
    }
}

/** Receipt подтверждает состав сравнения; оптическую оценку даёт просмотр PNG. */
export function assertMicrophoneComparisonEvidence(visuals, records) {
  for (const mode of ['no-preference', 'reduce'])
    for (const width of MICROPHONE_COMPARISON_WIDTHS) {
      const file = microphoneComparisonVisualFile(mode, width);
      const matches = visuals.filter((visual) => visual.path === file);
      assert.equal(matches.length, 1, `microphone comparison: отсутствует или повторён ${file}`);
      const observations = records.filter(
        (record) => record.name === `${mode}:microphone-adjacent-width-${width}:capture`,
      );
      assert.equal(
        observations.length,
        1,
        `microphone comparison: отсутствует или повторён receipt ${file}`,
      );
      const observed = observations[0];
      assert.equal(observed.result, 'PASS');
      assert.equal(observed.file, file);
      assert.equal(observed.bodyWidth, width);
      assert.equal(
        observed.pngSha256,
        digest(matches[0].bytes),
        `microphone comparison: PNG не совпал с receipt ${file}`,
      );
      assert.deepEqual(observed.icons, MICROPHONE_COMPARISON_ICONS);
      assert.deepEqual(observed.variants, ['outline', 'filled']);
      assert.deepEqual(observed.sizes, [16, 24, 48]);
      assert.equal(observed.groups, 6);
      assert.equal(observed.samples, 18);
    }
}

export function assertMicrophoneComparisonObservation(observation, reference, peers, bodyWidth) {
  assert.equal(observation.bodyWidth, bodyWidth);
  assert.deepEqual(
    observation.rows.map(({ variant, size }) => `${variant}/${size}`),
    ['outline', 'filled'].flatMap((variant) => [16, 24, 48].map((size) => `${variant}/${size}`)),
  );
  assert.equal(observation.samples.length, 18);
  for (const [rowIndex, row] of observation.rows.entries()) {
    const samples = observation.samples.slice(rowIndex * 3, rowIndex * 3 + 3);
    assert.deepEqual(
      samples.map(({ icon }) => icon),
      MICROPHONE_COMPARISON_ICONS,
    );
    assert.equal(
      row.caption,
      `${row.variant === 'outline' ? 'Контурные' : 'Залитые'}, ${row.size} px`,
    );
    for (const [index, sample] of samples.entries()) {
      assert.equal(sample.variant, row.variant);
      assert.equal(sample.size, row.size);
      assert.equal(sample.width, row.size);
      assert.equal(sample.height, row.size);
      assert.ok(sample.target.width >= 44 && sample.target.height >= 44);
      assert.equal(sample.tag, 'lab-button');
      assert.equal(sample.slot, 'icon');
      assert.equal(sample.hidden, 'true');
      assert.equal(sample.focusable, 'false');
      assert.equal(sample.domIdentity, true);
      assert.ok(sample.label.length > 0);
      const raw =
        sample.icon === 'mic-circle'
          ? reference.icons[sample.icon][sample.variant]
          : peers.icons[sample.icon][sample.variant];
      assert.deepEqual(sample.author, raw.author);
      assert.deepEqual(sample.viewBox, raw.viewBox);
      if (sample.icon === 'mic-circle') assertMicrophonePaths(sample.paths, raw, bodyWidth);
      else {
        assert.equal(sample.staticIdentity, true);
        assertAnnulusPaths(sample.paths, raw, 1);
      }
      if (index > 0) {
        const prior = samples[index - 1];
        assert.ok(
          sample.target.x >= prior.target.x + prior.target.width,
          'кнопки должны стоять рядом без переноса или перекрытия',
        );
        assert.equal(
          sample.target.y + sample.target.height / 2,
          prior.target.y + prior.target.height / 2,
          'единая опора соседних кнопок',
        );
        assert.equal(sample.target.width, prior.target.width);
        assert.equal(sample.target.height, prior.target.height);
      }
    }
  }
}

// Только oracle разбирает raw master. Браузер получает готовую публичную модель.
export function rawMicrophoneParts(reference) {
  return reference.declaration.parts.map(({ pathIndex, contourIndices, id, role }) => ({
    id,
    role,
    d: contourIndices
      ? contourIndices
          .map((index) => reference.paths[pathIndex].d.split(/(?=M)/).filter(Boolean)[index])
          .join('')
      : reference.paths[pathIndex].d,
    fillRule: reference.declaration.composition ? null : reference.paths[pathIndex].fillRule,
  }));
}

export function validateMicrophoneReference(reference, figma) {
  assert.equal(reference?.fileKey, figma.fileKey);
  assert.equal(reference.version, figma.version);
  assert.match(reference.semanticSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(reference.icons).sort(), MICROPHONE_ICONS);
  for (const icon of MICROPHONE_ICONS) {
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
        digest(stableJSON(item.paths.map((path, index) => ({ index, ...path })))),
      );
      const declaration = item.declaration;
      assert.equal(declaration.masterSha256, item.author.masterSha256);
      assert.equal(declaration.pathFingerprintSha256, item.author.pathFingerprintSha256);
      assert.equal(declaration.gesture, null);
      assert.deepEqual(declaration.variation, {
        law: 'capsule.width',
        parameter: 'bodyWidth',
        bodyPartId: 'microphone-body',
      });
      if (icon === 'mic-circle' && variant === 'filled') {
        assert.deepEqual(declaration.composition, { kind: 'compound', fillRule: 'evenodd' });
        assert.equal(item.paths.length, 1);
        assert.equal(item.paths[0].fillRule, 'evenodd');
        assert.equal(item.paths[0].d.split(/(?=M)/).filter(Boolean).length, 3);
        assert.deepEqual(declaration.parts, [
          { pathIndex: 0, contourIndices: [0], id: 'microphone-enclosure', role: 'container' },
          { pathIndex: 0, contourIndices: [1], id: 'microphone-support', role: 'counter' },
          { pathIndex: 0, contourIndices: [2], id: 'microphone-body', role: 'counter' },
        ]);
      } else {
        assert.equal(declaration.composition, undefined);
        const ids = [
          'microphone-support',
          'microphone-body',
          ...(icon === 'mic-circle' ? ['microphone-enclosure'] : []),
        ];
        assert.equal(item.paths.length, ids.length);
        assert.deepEqual(
          declaration.parts,
          ids.map((id, pathIndex) => ({
            pathIndex,
            id,
            role: id === 'microphone-enclosure' ? 'container' : 'content',
          })),
        );
      }
      for (const part of rawMicrophoneParts(item)) assert.ok(rawContentPath(part.d).length > 0);
    }
  }
  return reference;
}

export async function microphoneReference(iconsRoot, pin, readAuthorMaster) {
  const manifest = JSON.parse(await readFile(join(iconsRoot, 'semantics/figma-baseline.json')));
  const semantic = await readFile(join(iconsRoot, 'semantics/author-anatomy.json'));
  const annotations = JSON.parse(semantic);
  assert.deepEqual(annotations.source, pin.figma);
  assert.equal(manifest.source.fileKey, pin.figma.fileKey);
  assert.equal(manifest.source.version, pin.figma.version);
  const icons = {};
  for (const icon of MICROPHONE_ICONS) {
    icons[icon] = {};
    for (const variant of ['outline', 'filled']) {
      const record = manifest.icons[icon][variant];
      const bytes = await readFile(join(iconsRoot, record.master));
      assert.equal(bytes.length, record.bytes);
      assert.equal(
        digest(bytes),
        record.sha256,
        'raw microphone master отказал до import producer',
      );
      const { viewBox, dimensions, paths } = readAuthorMaster(bytes);
      const fingerprint = digest(stableJSON(paths.map((path, index) => ({ index, ...path }))));
      assert.equal(fingerprint, record.normalizedSource.pathFingerprintSha256);
      icons[icon][variant] = {
        sourceFile: record.master,
        viewBox,
        dimensions,
        paths,
        declaration: annotations.icons[icon][variant],
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
  return validateMicrophoneReference(
    { ...pin.figma, semanticSha256: digest(semantic), icons },
    pin.figma,
  );
}

/** Исходные контуры, постоянная высота и одинаковое сужение наружного/внутреннего span. */
export function assertMicrophonePaths(actual, reference, bodyWidth) {
  assert.equal(actual.length, reference.paths.length, 'paint composition изменена');
  if (bodyWidth === 1) {
    assert.deepEqual(actual, reference.paths, 'default сохраняет весь авторский master буквально');
    return;
  }
  const sourceParts = rawMicrophoneParts(reference);
  if (reference.declaration.composition)
    assert.equal(
      actual[0].d.split(/(?=M)/).filter(Boolean).length,
      sourceParts.length,
      'лишний или потерянный negative contour',
    );
  const actualParts = rawMicrophoneParts({ ...reference, paths: actual });
  const sourceBody = sourceParts.find((part) => part.id === 'microphone-body');
  for (const [index, part] of actualParts.entries()) {
    assert.equal(part.fillRule, sourceParts[index].fillRule);
    if (part.id !== 'microphone-body') {
      assert.deepEqual(part, sourceParts[index], 'стойка и обрамление сохраняются буквально');
      continue;
    }
    const sourceContours = sourceBody.d.split(/(?=M)/).filter(Boolean).map(rawContentPath);
    const outputContours = part.d.split(/(?=M)/).filter(Boolean).map(rawContentPath);
    assert.equal(outputContours.length, sourceContours.length, 'counter/closure изменены');
    const bounds = (contour) => {
      const xs = contour.flatMap((segment) => segment.points.map((point) => point[0]));
      return [Math.min(...xs), Math.max(...xs)];
    };
    const [left, right] = bounds(sourceContours[0]);
    const narrowing = (right - left) * (1 - bodyWidth);
    for (const [contourIndex, output] of outputContours.entries()) {
      const source = sourceContours[contourIndex];
      assert.deepEqual(
        output.map((segment) => [segment.command, segment.points.length]),
        source.map((segment) => [segment.command, segment.points.length]),
        'кривые и sequence контуров сохраняются',
      );
      const [low, high] = bounds(source);
      const center = (low + high) / 2;
      const span = high - low - narrowing;
      assert.ok(span > 0);
      for (const [segmentIndex, segment] of output.entries())
        for (const [pointIndex, point] of segment.points.entries()) {
          const original = source[segmentIndex].points[pointIndex];
          assert.equal(point[1], original[1], 'высота и вертикальные controls сохраняются');
          const expected = center + ((original[0] - center) * span) / (high - low);
          assert.ok(
            Math.abs(point[0] - expected) <= 16 * Number.EPSILON * Math.max(1, Math.abs(expected)),
            'bodyWidth должен менять горизонтальную форму',
          );
        }
    }
  }
  for (const [index, path] of actual.entries())
    assert.equal(path.fillRule, reference.paths[index].fillRule);
}

/** Публичный glyph владеет геометрией; Lab UI владеет выбором и native activation. */
export function mountMicrophoneConsumer(apis, sources, peers) {
  const section = document.createElement('section');
  section.className = 'microphone-set';
  const heading = document.createElement('h2');
  heading.textContent = 'Микрофон';
  section.append(heading);
  const entries = apis.flatMap((api, index) =>
    ['outline', 'filled'].map((variant) => ({
      api,
      sourceApi: sources[index],
      variant,
      label: `${index === 0 ? 'Микрофон' : 'Микрофон в круге'}, ${variant === 'outline' ? 'контурный' : 'залитый'}`,
    })),
  );
  const bindings = [];
  const comparisonBindings = [];
  const comparisonRows = [];
  const comparisonActivations = [];
  const activations = [];
  const events = [];
  let selectedIndex = 0;
  let bodyWidth = 1;
  let refusal = null;
  let disposed = false;
  function createBinding(entry, index, size, instanceId) {
    const original = entry.api.glyph({ variant: entry.variant });
    const button = document.createElement('lab-button');
    button.setAttribute('size', 'l');
    button.setAttribute('icon', '');
    button.setAttribute('type', 'neutral');
    button.setAttribute('aria-label', entry.label);
    button.setAttribute('title', entry.label);
    button.innerHTML = renderGlyphSvg(original, { instanceId });
    const svg = button.querySelector('svg');
    svg.setAttribute('slot', 'icon');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.style.width = `${size}px`;
    svg.style.height = `${size}px`;
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const nodes = [...svg.querySelectorAll('path')];
    const compound = original.composition.kind === 'compound';
    if (nodes.length !== (compound ? 1 : original.parts.length))
      throw new Error('Потеряна paint composition');
    const paths = (model) => (compound ? [model.d] : model.parts.map((part) => part.d));
    const all = [svg, ...svg.querySelectorAll('*')];
    const attributes = (node) =>
      [...node.attributes]
        .filter((attribute) => !(attribute.name === 'd' && nodes.includes(node)))
        .map(({ name, value }) => [name, value]);
    const presentation = all.map(attributes);
    return {
      ...entry,
      index,
      size,
      button,
      svg,
      nodes,
      paths,
      all,
      attributes,
      presentation,
      original,
      model: original,
    };
  }
  for (const size of [16, 24, 48]) {
    const row = document.createElement('div');
    row.className = 'microphone-row';
    row.setAttribute('aria-label', `${size} px`);
    for (const [index, entry] of entries.entries()) {
      const binding = createBinding(entry, index, size, `microphone-${index}-${size}`);
      const { button } = binding;
      bindings.push(binding);
      button.addEventListener('click', (event) => {
        activations.push({
          index,
          size,
          trusted: event.isTrusted,
          composed: event.composed,
          native: event.composedPath().includes(button.shadowRoot.querySelector('button')),
        });
        selectedIndex = index;
        download.textContent = `Скачать SVG: ${entry.label}`;
      });
      row.append(button);
    }
    const caption = document.createElement('span');
    caption.textContent = `${size} px`;
    row.append(caption);
    section.append(row);
  }
  const comparison = document.createElement('div');
  comparison.className = 'microphone-comparison';
  const comparisonHeading = document.createElement('h3');
  comparisonHeading.id = 'microphone-comparison-heading';
  comparison.setAttribute('aria-labelledby', comparisonHeading.id);
  comparison.append(comparisonHeading);
  for (const variant of ['outline', 'filled']) {
    const variantLabel = variant === 'outline' ? 'контурный' : 'залитый';
    const compareEntries = [
      { ...entries[variant === 'outline' ? 2 : 3], varying: true },
      { api: peers[0], label: `Справка, ${variantLabel}`, variant, varying: false },
      { api: peers[1], label: `Воспроизвести, ${variantLabel}`, variant, varying: false },
    ];
    for (const size of [16, 24, 48]) {
      const row = document.createElement('div');
      row.className = 'microphone-row microphone-comparison-row';
      const caption = `${variant === 'outline' ? 'Контурные' : 'Залитые'}, ${size} px`;
      row.setAttribute('aria-label', caption);
      comparisonRows.push({ variant, size, caption });
      for (const [index, entry] of compareEntries.entries()) {
        const binding = createBinding(
          entry,
          variant === 'outline' ? 2 : 3,
          size,
          `microphone-adjacent-${variant}-${size}-${index}`,
        );
        comparisonBindings.push(binding);
        binding.button.addEventListener('click', (event) => {
          comparisonActivations.push({
            icon: binding.model.icon,
            variant,
            size,
            trusted: event.isTrusted,
            composed: event.composed,
            native: event
              .composedPath()
              .includes(binding.button.shadowRoot.querySelector('button')),
          });
          if (entry.varying) {
            selectedIndex = binding.index;
            download.textContent = `Скачать SVG: ${entry.label}`;
          }
        });
        row.append(binding.button);
      }
      const label = document.createElement('span');
      label.textContent = caption;
      row.append(label);
      comparison.append(row);
    }
  }
  section.append(comparison);
  const controls = document.createElement('div');
  controls.className = 'microphone-controls';
  const label = document.createElement('label');
  label.textContent = 'Ширина корпуса';
  const input = document.createElement('input');
  input.type = 'number';
  input.step = 'any';
  input.min = String(
    Math.max(
      ...entries.map(
        (entry) => entry.api.glyphCapabilities(entry.variant).variation.domain.minimum,
      ),
    ),
  );
  input.max = '1';
  input.value = '1';
  input.setAttribute('aria-label', 'Ширина корпуса');
  const status = document.createElement('output');
  status.id = 'microphone-status';
  status.setAttribute('aria-live', 'polite');
  input.setAttribute('aria-describedby', status.id);
  label.append(input);
  function requireActive() {
    if (disposed) throw new Error('Consumer освобождён');
  }
  function assertBinding(binding, model) {
    const current = [binding.svg, ...binding.svg.querySelectorAll('*')];
    if (
      annulusRenderKey(model) !== annulusRenderKey(binding.original) ||
      current.length !== binding.all.length ||
      current.some(
        (node, index) =>
          node !== binding.all[index] ||
          JSON.stringify(binding.attributes(node)) !== JSON.stringify(binding.presentation[index]),
      ) ||
      binding.nodes.some(
        (node, index) => node.getAttribute('d') !== binding.paths(binding.model)[index],
      )
    )
      throw Object.assign(new Error('Потеряна correspondence'), {
        code: 'RENDER_CORRESPONDENCE_MISMATCH',
      });
  }
  function update(next) {
    requireActive();
    let models;
    try {
      models = entries.map((entry) =>
        entry.api.glyph({ variant: entry.variant, variation: { bodyWidth: next } }),
      );
      for (const binding of bindings) assertBinding(binding, models[binding.index]);
      for (const binding of comparisonBindings)
        assertBinding(binding, binding.varying ? models[binding.index] : binding.original);
    } catch (error) {
      refusal = error.code ?? 'RENDER_CORRESPONDENCE_MISMATCH';
      status.textContent =
        refusal === 'INVALID_VARIATION'
          ? 'Введите положительное число. Сохранена предыдущая форма.'
          : `Допустимая ширина от ${input.min} до 1. Сохранена предыдущая форма.`;
      input.setCustomValidity(status.textContent);
      input.setAttribute('aria-invalid', 'true');
      return { ok: false, code: refusal };
    }
    for (const binding of [
      ...bindings,
      ...comparisonBindings.filter((binding) => binding.varying),
    ]) {
      const model = models[binding.index];
      for (const [index, d] of binding.paths(model).entries())
        if (binding.nodes[index].getAttribute('d') !== d) binding.nodes[index].setAttribute('d', d);
      binding.model = model;
    }
    bodyWidth = next;
    refusal = null;
    input.value = String(next);
    input.setCustomValidity('');
    input.removeAttribute('aria-invalid');
    status.textContent = `Ширина корпуса ×${bodyWidth}`;
    comparisonHeading.textContent = `Рядом с другими символами: корпус ×${bodyWidth}`;
    return { ok: true };
  }
  input.addEventListener('input', (event) =>
    events.push({ trusted: event.isTrusted, result: update(input.valueAsNumber) }),
  );
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Авторская форма';
  reset.addEventListener('click', () => update(1));
  function exportSvg() {
    requireActive();
    const binding = bindings.find((item) => item.index === selectedIndex && item.size === 24);
    assertBinding(binding, binding.model);
    return renderGlyphSvg(binding.model, { instanceId: `microphone-export-${selectedIndex}` });
  }
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'microphone-download';
  download.textContent = `Скачать SVG: ${entries[selectedIndex].label}`;
  download.addEventListener('click', () => {
    const text = exportSvg();
    const entry = entries[selectedIndex];
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    let link;
    try {
      link = document.createElement('a');
      link.href = url;
      link.download = `${entry.api.glyph().icon}-${entry.variant}.svg`;
      document.body.append(link);
      link.click();
    } finally {
      link?.remove();
      URL.revokeObjectURL(url);
    }
  });
  controls.append(label, reset, download, status);
  section.append(controls);
  document.body.append(section);
  update(1);
  const read = () => {
    requireActive();
    return {
      bodyWidth,
      refusal,
      events,
      activations,
      selectedIndex,
      models: bindings
        .filter((item) => item.size === 24)
        .map(({ api, sourceApi, variant, model, original }) => ({
          icon: model.icon,
          variant,
          provenance: model.provenance,
          composition: model.composition,
          parts: model.parts.map(({ id, role, zIndex, d, fillRule }) => ({
            id,
            role,
            zIndex,
            d,
            fillRule,
          })),
          capability: api.glyphCapabilities(variant),
          defaultIdentity: model === original,
          sourceOnlyIdentity: api.glyph({ variant, modelMode: 'source-only' }) === original,
          explicitDefaultIdentity: api.glyph({ variant, variation: { bodyWidth: 1 } }) === original,
          staticIdentity: sourceApi.glyph({ variant }) === original,
        })),
      samples: bindings.map(({ index, size, button, svg, nodes }) => ({
        index,
        size,
        width: svg.getBoundingClientRect().width,
        height: svg.getBoundingClientRect().height,
        label: button.getAttribute('aria-label'),
        target: button.shadowRoot.querySelector('button').getBoundingClientRect().toJSON(),
        domIdentity: nodes.every((node, index) => node === svg.querySelectorAll('path')[index]),
        paths: [...svg.querySelectorAll('path')].map((node) => ({
          d: node.getAttribute('d'),
          fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
        })),
      })),
      comparison: {
        bodyWidth,
        rows: comparisonRows,
        activations: comparisonActivations,
        samples: comparisonBindings.map(
          ({ api, variant, size, button, svg, model, original, all, attributes, presentation }) => {
            const current = [svg, ...svg.querySelectorAll('*')];
            return {
              icon: model.icon,
              variant,
              size,
              author: model.provenance.author,
              viewBox: svg.getAttribute('viewBox').split(/\s+/).map(Number),
              staticIdentity: api.glyph({ variant }) === original,
              tag: button.localName,
              slot: svg.getAttribute('slot'),
              hidden: svg.getAttribute('aria-hidden'),
              focusable: svg.getAttribute('focusable'),
              width: svg.getBoundingClientRect().width,
              height: svg.getBoundingClientRect().height,
              label: button.getAttribute('aria-label'),
              target: button.shadowRoot.querySelector('button').getBoundingClientRect().toJSON(),
              domIdentity:
                current.length === all.length &&
                all.every(
                  (node, index) =>
                    node === current[index] &&
                    JSON.stringify(attributes(node)) === JSON.stringify(presentation[index]),
                ),
              paths: [...svg.querySelectorAll('path')].map((node) => ({
                d: node.getAttribute('d'),
                fillRule: node.getAttribute('fill-rule') ?? 'nonzero',
              })),
            };
          },
        ),
      },
    };
  };
  return {
    read,
    update,
    exportSvg,
    attempt: (index, request) => {
      requireActive();
      try {
        entries[index].api.glyph({ variant: entries[index].variant, ...request });
        return 'accepted';
      } catch (error) {
        return error.code;
      }
    },
    motion: (index) => {
      requireActive();
      const binding = bindings.find((item) => item.index === index && item.size === 24);
      return compileSymbolEffect(
        binding.model,
        binding.api.glyphCapabilities(binding.variant),
        `${binding.model.icon}.presence`,
        { duration: 300 },
      );
    },
    cleanup: () => {
      if (!disposed) {
        disposed = true;
        section.remove();
      }
    },
  };
}

export function microphoneFixture() {
  return `
${MICROPHONE_ICONS.map((icon, index) => `import * as microphone${index} from '@labpics/icons/variations/${icon}';\nimport * as microphoneSource${index} from '@labpics/icons/symbols/${icon}';`).join('\n')}
import * as microphoneQuestionSource from '@labpics/icons/symbols/question-circle';
import * as microphonePlaybackSource from '@labpics/icons/symbols/play-circle';
${mountMicrophoneConsumer.toString()}
const microphoneConsumer = mountMicrophoneConsumer([microphone0, microphone1], [microphoneSource0, microphoneSource1], [microphoneQuestionSource, microphonePlaybackSource]);
window.__iconsPacked.microphoneConsumer = microphoneConsumer;
const microphoneCleanup = window.__iconsPacked.cleanup;
window.__iconsPacked.cleanup = () => { microphoneConsumer.cleanup(); return microphoneCleanup(); };
`;
}

export function microphoneTypeFixture() {
  return `
import { glyph as microphoneGlyph, glyphCapabilities as microphoneCapabilities } from '@labpics/icons/variations/mic';
import { glyph as microphoneCircleGlyph } from '@labpics/icons/variations/mic-circle';
microphoneGlyph({variant:'outline',variation:{bodyWidth:.9}});
microphoneGlyph({variant:'filled',variation:{bodyWidth:.8}});
microphoneCircleGlyph({variant:'filled',variation:{bodyWidth:.8}});
const microphoneLaw: 'capsule.width' = microphoneCapabilities('filled').variation.law;
// @ts-expect-error Ширина корпуса не является общей осью веса.
microphoneGlyph({variation:{weight:1}});
// @ts-expect-error Внутренняя геометрия остаётся у производителя.
microphoneCircleGlyph({variation:{center:[12,12]}});
`;
}

export async function microphoneBrowserProof(page, reference, reducedMotion, records, out) {
  const read = () => page.evaluate(() => window.__iconsPacked.microphoneConsumer.read());
  const call = (method, ...args) =>
    page.evaluate(({ method, args }) => window.__iconsPacked.microphoneConsumer[method](...args), {
      method,
      args,
    });
  const section = page.locator('section.microphone-set');
  const check = async (width) => {
    const observation = await read();
    assert.equal(observation.bodyWidth, width);
    assert.equal(observation.refusal, null);
    assert.deepEqual(
      observation.models.map(({ icon, variant }) => `${icon}/${variant}`),
      MICROPHONE_ICONS.flatMap((icon) =>
        ['outline', 'filled'].map((variant) => `${icon}/${variant}`),
      ),
    );
    for (const model of observation.models) {
      const raw = reference.icons[model.icon][model.variant];
      assert.equal(model.sourceOnlyIdentity, true);
      assert.equal(model.explicitDefaultIdentity, true);
      assert.equal(model.staticIdentity, true);
      assert.deepEqual(model.provenance.author, raw.author);
      assert.equal(model.capability.variation.law, 'capsule.width');
      assert.deepEqual(model.capability.variation.defaults, { bodyWidth: 1 });
      assert.equal(model.capability.variation.domain.minimum, 0.8);
      assert.equal(model.capability.variation.domain.maximum, 1);
      assert.deepEqual(model.capability.variation.targets, {
        svg: 'supported',
        webEffect: 'not-exported',
        lottie: 'not-exported',
        sfSymbols: 'not-exported',
      });
      assert.deepEqual(
        model.parts.map(({ id, role, zIndex }) => ({ id, role, zIndex })),
        rawMicrophoneParts(raw).map(({ id, role }, zIndex) => ({ id, role, zIndex })),
      );
      if (width !== 1) {
        assert.equal(model.provenance.kind, 'authored-variation');
        assert.deepEqual(model.provenance.variation.parameters, { bodyWidth: width });
      }
    }
    for (const sample of observation.samples) {
      const model = observation.models[sample.index];
      assert.equal(sample.domIdentity, true);
      assert.equal(sample.width, sample.size);
      assert.equal(sample.height, sample.size);
      assert.ok(sample.target.width >= 44 && sample.target.height >= 44);
      assert.ok(sample.label.length > 0);
      assertMicrophonePaths(sample.paths, reference.icons[model.icon][model.variant], width);
    }
    return observation;
  };
  const capture = async (width, observation) => {
    const file = microphoneVisualFile(reducedMotion, width);
    const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
    let png;
    try {
      png = await section.screenshot({ path: join(out, file.slice('result/'.length)) });
    } finally {
      await page.evaluate(([x, y]) => window.scrollTo(x, y), scroll);
    }
    await check(width);
    records.push({
      name: `${reducedMotion}:microphone-width-${width}:optical`,
      result: 'PASS',
      file,
      bodyWidth: observation.bodyWidth,
      pngSha256: digest(png),
      variants: observation.models.map(({ icon, variant }) => `${icon}/${variant}`),
      sizes: [...new Set(observation.samples.map(({ size }) => size))],
      samples: observation.samples.length,
    });
  };
  await check(1);
  const field = section.getByRole('spinbutton', { name: 'Ширина корпуса', exact: true });
  await field.fill('0.9');
  const middle = await check(0.9);
  assert.ok(middle.events.some((event) => event.trusted && event.result.ok));
  await capture(0.9, middle);
  await field.fill('0.8');
  const minimum = await check(0.8);
  await capture(0.8, minimum);
  const prior = minimum.samples.map((sample) => sample.paths);
  for (const [value, code] of [
    [0.79, 'VARIATION_OUTSIDE_DOMAIN'],
    [1.01, 'VARIATION_OUTSIDE_DOMAIN'],
    [0, 'INVALID_VARIATION'],
  ]) {
    await field.fill(String(value));
    const refused = await read();
    assert.equal(refused.refusal, code);
    assert.equal(refused.bodyWidth, 0.8);
    assert.deepEqual(
      refused.samples.map((sample) => sample.paths),
      prior,
    );
    assert.equal(await field.getAttribute('aria-invalid'), 'true');
  }
  await field.fill('0.8');
  await check(0.8);
  for (let index = 0; index < 4; index++) {
    assert.equal(
      await call('attempt', index, { modelMode: 'source-only', variation: { bodyWidth: 0.9 } }),
      'AUTHOR_PARITY_REQUIRED',
    );
    assert.equal(await call('attempt', index, { variation: { weight: 1 } }), 'INVALID_VARIATION');
    assert.equal(
      await call('attempt', index, { variation: { bodyWidth: '0.9' } }),
      'INVALID_VARIATION',
    );
    const motion = await call('motion', index);
    assert.equal(motion.ok, false);
    assert.equal(motion.reason.code, 'SEMANTIC_MOTION_UNAVAILABLE');
  }
  const host = section.locator('.microphone-row').nth(1).locator('lab-button').nth(3);
  assert.equal(
    await host.getByRole('button', { name: 'Микрофон в круге, залитый', exact: true }).count(),
    1,
  );
  const beforeSelection = await read();
  await host.click();
  const selected = await read();
  assert.equal(selected.selectedIndex, 3);
  assert.equal(selected.activations.length, beforeSelection.activations.length + 1);
  assert.deepEqual(selected.activations.at(-1), {
    index: 3,
    size: 24,
    trusted: true,
    composed: true,
    native: true,
  });
  const native = host.getByRole('button', { name: 'Микрофон в круге, залитый', exact: true });
  for (const key of ['Enter', 'Space']) {
    const before = await read();
    await native.press(key);
    const after = await read();
    assert.equal(after.activations.length, before.activations.length + 1);
    assert.deepEqual(after.activations.at(-1), {
      index: 3,
      size: 24,
      trusted: true,
      composed: true,
      native: true,
    });
  }
  for (let index = 0; index < 4; index++) {
    await section.locator('.microphone-row').nth(1).locator('lab-button').nth(index).click();
    assert.equal((await read()).selectedIndex, index);
    const exported = await downloadedSvg(page, section.locator('button.microphone-download'));
    assert.equal(exported, await call('exportSvg'));
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
    const model = minimum.models[index];
    assertMicrophonePaths(exportedPaths, reference.icons[model.icon][model.variant], 0.8);
  }
  await section.getByRole('button', { name: 'Авторская форма', exact: true }).click();
  const reset = await check(1);
  assert.ok(reset.models.every((model) => model.defaultIdentity));
  assert.equal(await field.getAttribute('aria-invalid'), null);
  records.push({
    name: `${reducedMotion}:microphone-width-four-authored-variants-native-selection-export-reset`,
    result: 'PASS',
    observations: minimum,
    activation: selected.activations.at(-1),
  });
}

/** Соседство проверяется на реальных Lab UI кнопках и независимых raw masters. */
export async function microphoneComparisonBrowserProof(
  page,
  reference,
  peers,
  reducedMotion,
  records,
  out,
) {
  const read = () => page.evaluate(() => window.__iconsPacked.microphoneConsumer.read().comparison);
  const section = page.locator('section.microphone-set');
  const comparison = section.locator('.microphone-comparison');
  const field = section.getByRole('spinbutton', { name: 'Ширина корпуса', exact: true });
  const check = async (width) => {
    const observation = await read();
    assertMicrophoneComparisonObservation(observation, reference, peers, width);
    return observation;
  };
  for (const width of MICROPHONE_COMPARISON_WIDTHS) {
    await field.fill(String(width));
    const observation = await check(width);
    const file = microphoneComparisonVisualFile(reducedMotion, width);
    const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
    let png;
    try {
      png = await comparison.screenshot({ path: join(out, file.slice('result/'.length)) });
    } finally {
      await page.evaluate(([x, y]) => window.scrollTo(x, y), scroll);
    }
    await check(width);
    records.push({
      name: `${reducedMotion}:microphone-adjacent-width-${width}:capture`,
      result: 'PASS',
      file,
      bodyWidth: width,
      pngSha256: digest(png),
      icons: [...MICROPHONE_COMPARISON_ICONS],
      variants: [...new Set(observation.rows.map(({ variant }) => variant))],
      sizes: [...new Set(observation.rows.map(({ size }) => size))],
      groups: observation.rows.length,
      samples: observation.samples.length,
    });
  }
  for (const [rowIndex, variant] of [
    [1, 'outline'],
    [4, 'filled'],
  ]) {
    const row = comparison.locator('.microphone-comparison-row').nth(rowIndex);
    for (const [index, icon] of MICROPHONE_COMPARISON_ICONS.entries()) {
      const host = row.locator('lab-button').nth(index);
      const sample = (await read()).samples[rowIndex * 3 + index];
      const native = host.getByRole('button', { name: sample.label, exact: true });
      assert.equal(await native.count(), 1);
      for (const action of ['pointer', 'Enter', 'Space']) {
        const before = await read();
        if (action === 'pointer') await host.click();
        else await native.press(action);
        const after = await check(0.8);
        assert.equal(after.activations.length, before.activations.length + 1);
        assert.deepEqual(after.activations.at(-1), {
          icon,
          variant,
          size: 24,
          trusted: true,
          composed: true,
          native: true,
        });
      }
    }
  }
  await section.getByRole('button', { name: 'Авторская форма', exact: true }).click();
  await check(1);
  records.push({
    name: `${reducedMotion}:microphone-adjacent-authored-variants-native-activation-reset`,
    result: 'PASS',
  });
}
