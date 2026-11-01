// Единственный численный владелец — установленный @labpics/colors.
// Все краски и конечные композиции темы читаются из одного готового снимка.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prepareEngineConfig } from './prepare-config.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const cssName = (name) => `--lab-${name}`;
const cssPaint = ({ rgb, opacity }) =>
  `rgb(${rgb.join(' ')}${opacity === 1 ? '' : ` / ${opacity}`})`;
const notReady = (state, reason, diagnostics) => ({
  state,
  reason,
  vars: null,
  paints: null,
  diagnostics,
});

function context(model, abi) {
  return [
    model.observation.adaptingLuminance,
    model.observation.backgroundRatio,
    { average: abi.SURROUND_AVERAGE_V1, dim: abi.SURROUND_DIM_V1, dark: abi.SURROUND_DARK_V1 }[
      model.observation.surround
    ],
  ];
}

/** Добавляет фоновые композиции в тот же Program, который решает остальные роли. */
export function addBackgroundTones(
  builder,
  { sourcePaint, backdrop, alphas, viewingContext, reportCriterion },
  allocate,
) {
  const results = new Map();
  const shared = new Map();
  for (const [index, alpha] of alphas.entries()) {
    let result = shared.get(alpha);
    if (!result) {
      const opacity = allocate();
      const paint = allocate();
      const occurrence = allocate();
      const root = allocate();
      builder
        .opacityInput(opacity, alpha)
        .opacityPaint(paint, sourcePaint, opacity)
        .sourceOverOccurrence(occurrence, paint, backdrop, ...viewingContext)
        .presentationRoot(root, occurrence)
        .presentationTarget(root, occurrence)
        .wcag22VisibleUnary(false, allocate(), occurrence, reportCriterion);
      result = { root, occurrence, paint };
      shared.set(alpha, result);
    }
    results.set(`bg-tone-${index + 2}`, result);
  }
  return results;
}

export function compileTheme(abi, model, selected) {
  const builder = new abi.ProgramWireBuilderV1().surfaceInputPort(1).inputSurface(2, 1);
  let serial = 10;
  const allocate = () => serial++;
  const targets = new Map();
  const sharedPaints = new Map();
  const sharedAlpha = new Map();
  const roles = new Map();
  const paintFor = ({ source, opacity }) => {
    let solid = targets.get(source);
    if (solid === undefined) {
      const target = allocate();
      solid = allocate();
      const rgb = model.sources[source];
      if (!rgb) throw new Error(`неизвестный источник ${source}`);
      // Ordinary сохраняет авторский RGB. Подвижные цели относятся к отдельному IC-контракту.
      const input = allocate();
      builder.source(input, rgb).fixedTarget(target, input);
      builder.solidPaint(solid, target);
      targets.set(source, solid);
    }
    const key = `${source}/${opacity}`;
    let paint = sharedPaints.get(key);
    if (paint === undefined) {
      paint = solid;
      if (opacity !== 1) {
        let alpha = sharedAlpha.get(opacity);
        if (alpha === undefined) {
          alpha = allocate();
          builder.opacityInput(alpha, opacity);
          sharedAlpha.set(opacity, alpha);
        }
        paint = allocate();
        builder.opacityPaint(paint, solid, alpha);
      }
      sharedPaints.set(key, paint);
    }
    return paint;
  };
  for (const [name, paint] of selected.paints) roles.set(name, paintFor(paint));
  const resolveAlias = (name) => {
    let target = name;
    while (selected.aliases.has(target)) target = selected.aliases.get(target);
    return target;
  };
  const rolePaint = (name) => {
    const id = roles.get(resolveAlias(name));
    if (id === undefined) throw new Error(`роль ${name} не является исходной Paint`);
    return id;
  };
  const basePaint = rolePaint('bg-tone-1');
  const baseOccurrence = allocate();
  builder.sourceOverOccurrence(baseOccurrence, basePaint, 2, ...context(model, abi));
  const baseSurface = allocate();
  builder.occurrenceSurface(baseSurface, baseOccurrence);
  // Terminal occurrence имеет собственный контекст и больше не используется как подложка.
  const occurrences = new Map();
  const over = (paint, surface = baseSurface) => {
    const key = `${paint}/${surface}`;
    let occurrence = occurrences.get(key);
    if (occurrence === undefined) {
      occurrence = allocate();
      builder.sourceOverOccurrence(occurrence, paint, surface, ...context(model, abi));
      occurrences.set(key, occurrence);
    }
    return occurrence;
  };
  const backgrounds = new Map([[basePaint, baseOccurrence]]);
  const surfaces = new Map([[baseOccurrence, baseSurface]]);
  const surfaceFor = (occurrence) => {
    let surface = surfaces.get(occurrence);
    if (surface === undefined) {
      surface = allocate();
      builder.occurrenceSurface(surface, occurrence);
      surfaces.set(occurrence, surface);
    }
    return surface;
  };
  const composites = addBackgroundTones(
    builder,
    {
      sourcePaint: paintFor({ source: selected.tone.source, opacity: 1 }),
      backdrop: baseSurface,
      alphas: selected.tone.alpha,
      viewingContext: context(model, abi),
      reportCriterion: abi.WCAG22_SC143_TEXT_DEFAULT_V1,
    },
    allocate,
  );
  const backdropOccurrence = (name) => {
    const composite = composites.get(resolveAlias(name));
    const paint = composite ? composite.paint : rolePaint(name);
    let occurrence = backgrounds.get(paint);
    if (occurrence === undefined) {
      occurrence = allocate();
      builder.sourceOverOccurrence(occurrence, paint, baseSurface, ...context(model, abi));
      backgrounds.set(paint, occurrence);
    }
    return occurrence;
  };
  const presentations = new Map();
  const presentationFor = (occurrence) => {
    let root = presentations.get(occurrence);
    if (root === undefined) {
      root = allocate();
      builder.presentationRoot(root, occurrence).presentationTarget(root, occurrence);
      presentations.set(occurrence, root);
    }
    return root;
  };
  // Каждая исходная краска имеет наблюдение; report-only не обещает WCAG-прохождения.
  for (const paint of sharedPaints.values()) {
    const occurrence = over(paint);
    presentationFor(occurrence);
    builder.wcag22VisibleUnary(false, allocate(), occurrence, abi.WCAG22_SC143_TEXT_DEFAULT_V1);
  }
  for (const requirement of selected.constraints) {
    const surface = surfaceFor(backdropOccurrence(requirement.background));
    const foreground = over(rolePaint(requirement.foreground), surface);
    presentationFor(foreground);
    builder.wcag22VisibleUnary(
      model.policy.contrast === 'strict',
      allocate(),
      foreground,
      requirement.criterion === 'text'
        ? abi.WCAG22_SC143_TEXT_DEFAULT_V1
        : abi.WCAG22_SC1411_UI_COMPONENT_OR_STATE_V1,
    );
  }
  const slots = new Map();
  const outputFor = new Map();
  for (const [name, paint] of roles) {
    let slot = outputFor.get(paint);
    if (slot === undefined) {
      slot = allocate();
      builder.output(slot, paint);
      outputFor.set(paint, slot);
      slots.set(slot, []);
    }
    slots.get(slot).push(name);
  }
  return {
    wire: builder.finish(),
    slots,
    composites,
    roleCount: roles.size,
    counts: {
      targets: targets.size,
      paints: sharedPaints.size,
      outputs: slots.size,
      occurrences:
        occurrences.size +
        backgrounds.size +
        new Set([...composites.values()].map(({ occurrence }) => occurrence)).size,
      presentations:
        presentations.size + new Set([...composites.values()].map(({ root }) => root)).size,
      applicationConstraints: selected.constraints.length,
    },
  };
}

/** Поднять Program-owner с конкретными входами, не захватывая состояние темы. */
export async function createLabuiEngine({ config } = {}) {
  const input = config ?? JSON.parse(await readFile(join(here, 'labui.config.json'), 'utf8'));
  const model = prepareEngineConfig(input);
  const fingerprint = digest(JSON.stringify(input));
  const pkgDir = dirname(require.resolve('@labpics/colors'));
  const [owner, abi, wasm, packageJson, buildJson] = await Promise.all([
    import('@labpics/colors'),
    import('@labpics/colors/program-wire/abi-v1.js'),
    readFile(join(pkgDir, 'pkg', 'labcolors_bg.wasm')),
    readFile(join(pkgDir, 'package.json'), 'utf8'),
    readFile(join(pkgDir, 'build-metadata.json'), 'utf8'),
  ]);
  await owner.default({ module_or_path: wasm });
  const metadata = {
    version: JSON.parse(packageJson).version,
    sourceSha: JSON.parse(buildJson).sourceSha,
    wasmSha256: digest(wasm),
  };
  return {
    fingerprint,
    metadata,
    resolve(theme) {
      const selected = model.themes[theme];
      if (!selected) throw new Error(`неизвестная тема ${theme}`);
      const diagnostics = {
        fingerprint,
        ...metadata,
        programs: [],
        constraints: selected.constraints,
        pending: [...selected.pending],
      };
      if (selected.pending.length)
        return notReady('blocked', selected.pending.join('; '), diagnostics);
      const { wire, slots, composites, roleCount } = compileTheme(abi, model, selected);
      const runtime = owner.compileProgramWire(wire, 1);
      let snapshot;
      try {
        snapshot = runtime.updateObserved(
          1n,
          new Uint32Array([1]),
          Uint8Array.from(model.sources[selected.background]),
          1,
        );
        diagnostics.programs.push({
          kind: 'theme',
          wireSha256: digest(wire),
          state: snapshot.state,
        });
        if (snapshot.state !== 'ready')
          return notReady(snapshot.state, snapshot.reason, diagnostics);
        diagnostics.programs[0].outputCount = snapshot.outputCount();
        const values = new Map();
        for (let i = 0; i < snapshot.outputCount(); i++) {
          const names = slots.get(snapshot.outputSlot(i));
          if (names === undefined) throw new Error('Colors вернул неизвестный output slot');
          const value = { rgb: [...snapshot.outputRgb(i)], opacity: snapshot.outputOpacity(i) };
          for (const name of names) values.set(name, value);
        }
        if (values.size !== roleCount) throw new Error('Colors вернул неполный набор Paint');
        for (const [name, { root }] of composites) {
          values.set(name, { rgb: [...snapshot.presentationCompositeRgb(root, 1)], opacity: 1 });
        }
        const paints = new Map();
        const vars = new Map();
        for (const [name, value] of values) {
          paints.set(cssName(name), value);
          vars.set(cssName(name), cssPaint(value));
        }
        for (const [name, target] of selected.aliases) {
          let valueName = target;
          while (selected.aliases.has(valueName)) valueName = selected.aliases.get(valueName);
          paints.set(cssName(name), values.get(valueName));
          vars.set(cssName(name), `var(${cssName(target)})`);
        }
        return { state: 'ready', vars, paints, diagnostics };
      } finally {
        snapshot?.free();
        runtime.free();
      }
    },
  };
}
