// Декларация LabUI одна для сборки и runtime; численный выбор выполняет Core.
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
  { sourcePaint, backdrop, alphas, viewingContext, reportCriterion, names },
  allocate,
) {
  const results = new Map();
  const shared = new Map();
  for (const [index, alpha] of alphas.entries()) {
    const name = `bg-tone-${index + 2}`;
    if (names && !names.has(name)) continue;
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
    results.set(name, result);
  }
  return results;
}

/** Один inline-вход заменяет одну роль, сохраняя остальные авторские связи. */
export function withRoleOverrides(model, selected, overrides = []) {
  if (!Array.isArray(overrides)) throw new Error('overrides: ожидается массив');
  if (!overrides.length) return { model, selected };
  const sources = { ...model.sources };
  const paints = new Map(selected.paints);
  const composites = new Map(selected.composites);
  const aliases = new Map(selected.aliases);
  const seen = new Set();
  for (const { name, source: rgb, opacity } of overrides) {
    if (seen.has(name) || (!paints.has(name) && !composites.has(name) && !aliases.has(name))) {
      throw new Error(`overrides: неизвестная или повторная роль ${name}`);
    }
    const value = paintValue(rgb, opacity);
    seen.add(name);
    let source = `inline-role/${name}`;
    while (Object.hasOwn(sources, source)) source = `_${source}`;
    sources[source] = value.rgb;
    paints.set(name, { source, opacity: value.opacity });
    composites.delete(name);
    aliases.delete(name);
  }
  return {
    model: { ...model, sources },
    selected: { ...selected, paints, composites, aliases },
  };
}

export function compileTheme(abi, model, selected) {
  const usedSources = new Set([...selected.paints.values()].map(({ source }) => source));
  usedSources.add(selected.tone.source);
  const Builder = [...usedSources].some((source) => selected.computed.has(source))
    ? abi.ProgramWireBuilderV3
    : abi.ProgramWireBuilderV1;
  const builder = new Builder().surfaceInputPort(1).inputSurface(2, 1);
  let serial = 10;
  const allocate = () => serial++;
  const targets = new Map();
  const sharedPaints = new Map();
  const sharedAlpha = new Map();
  const roles = new Map();
  const assignmentTargets = [];
  const paintFor = ({ source, opacity }) => {
    let solid = targets.get(source);
    if (solid === undefined) {
      const target = allocate();
      solid = allocate();
      const rgb = model.sources[source];
      if (!rgb) throw new Error(`неизвестный источник ${source}`);
      const computed = selected.computed.get(source);
      if (computed) {
        builder.computedTarget(target, computed.domain, rgb, computed.maxDelta);
        assignmentTargets.push(target);
      } else {
        const input = allocate();
        builder.source(input, rgb).fixedTarget(target, input);
      }
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
  const occurrencePaints = new Map();
  const over = (paint, surface = baseSurface) => {
    const key = `${paint}/${surface}`;
    let occurrence = occurrences.get(key);
    if (occurrence === undefined) {
      occurrence = allocate();
      builder.sourceOverOccurrence(occurrence, paint, surface, ...context(model, abi));
      occurrences.set(key, occurrence);
      occurrencePaints.set(occurrence, paint);
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
      names: selected.composites,
    },
    allocate,
  );
  if (assignmentTargets.length) builder.assignment(assignmentTargets);
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
      requirement.hard === true || model.policy.contrast === 'strict',
      allocate(),
      foreground,
      requirement.criterion === 'text'
        ? abi.WCAG22_SC143_TEXT_DEFAULT_V1
        : abi.WCAG22_SC1411_UI_COMPONENT_OR_STATE_V1,
    );
  }
  const slots = new Map();
  const outputFor = new Map();
  const slotFor = (paint) => {
    let slot = outputFor.get(paint);
    if (slot === undefined) {
      slot = allocate();
      builder.output(slot, paint);
      outputFor.set(paint, slot);
      slots.set(slot, []);
    }
    return slot;
  };
  for (const [name, paint] of roles) slots.get(slotFor(paint)).push(name);
  const presentationBindings = new Map();
  for (const [occurrence, root] of presentations) {
    const paint = occurrencePaints.get(occurrence);
    if (paint === undefined) throw new Error('presentation не связана с исходной краской');
    presentationBindings.set(root, { slot: slotFor(paint), root, occurrence });
  }
  for (const { root, occurrence, paint } of composites.values()) {
    presentationBindings.set(root, { slot: slotFor(paint), root, occurrence });
  }
  const bindings = {
    emissions: [...slots.keys()].map((slot) => ({ slot, sinkOutput: slot })),
    presentations: [...presentationBindings.values()],
  };
  return {
    wire: builder.finish(),
    slots,
    composites,
    bindings,
    roleCount: roles.size,
    counts: {
      targets: targets.size,
      paints: new Set([
        ...targets.values(),
        ...sharedPaints.values(),
        ...[...composites.values()].map(({ paint }) => paint),
      ]).size,
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

const cssName = (name) => {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(name)) {
    throw new Error('недопустимое имя CSS-роли');
  }
  return `--lab-${name}`;
};

const cssPaint = ({ rgb, opacity }) =>
  `rgb(${rgb.join(' ')}${opacity === 1 ? '' : ` / ${opacity}`})`;

function paintValue(source, opacity) {
  if (
    !source ||
    source.length !== 3 ||
    ![...source].every((value) => Number.isInteger(value) && value >= 0 && value <= 255) ||
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1
  ) {
    throw new Error('Colors вернул недопустимую source-plus-opacity проекцию');
  }
  return { rgb: [...source], opacity };
}

/** Только перенос готовых значений Core и authored aliases; композиция здесь не вычисляется. */
export function projectTheme(program, selected, points, presentationComposites, scenario = 1) {
  const { slots, composites, roleCount } = program;
  const values = new Map();
  const seenSlots = new Set();
  for (const { slot, source, opacity } of points) {
    const names = slots.get(slot);
    if (names === undefined || seenSlots.has(slot)) {
      throw new Error('Colors вернул неизвестный или повторный output slot');
    }
    seenSlots.add(slot);
    const value = paintValue(source, opacity);
    for (const name of names) values.set(name, value);
  }
  if (seenSlots.size !== slots.size || values.size !== roleCount) {
    throw new Error('Colors вернул неполный набор Paint');
  }
  const roots = new Map();
  for (const point of presentationComposites) {
    if (point.scenario !== scenario) continue;
    if (roots.has(point.root)) throw new Error('Colors вернул повторную конечную композицию');
    roots.set(point.root, paintValue(point.source, 1));
  }
  for (const [name, { root }] of composites) {
    const value = roots.get(root);
    if (value === undefined) throw new Error('Colors не выдал конечную композицию тона');
    values.set(name, value);
  }
  const paints = new Map();
  const vars = new Map();
  for (const [name, value] of values) {
    paints.set(cssName(name), value);
    vars.set(cssName(name), cssPaint(value));
  }
  for (const [name, target] of selected.aliases) {
    let valueName = target;
    const visited = new Set([name]);
    while (selected.aliases.has(valueName)) {
      if (visited.has(valueName)) throw new Error('цикл authored aliases');
      visited.add(valueName);
      valueName = selected.aliases.get(valueName);
    }
    const value = values.get(valueName);
    if (value === undefined) throw new Error('alias не связан с конечной CSS-ролью');
    paints.set(cssName(name), value);
    vars.set(cssName(name), `var(${cssName(target)})`);
  }
  return { vars, paints };
}

/** Полный принадлежащий runtime CSS-scope, включая aliases и composite-роли. */
export function themePropertyNames(selected) {
  return [
    ...new Set([
      ...selected.paints.keys(),
      ...selected.composites.keys(),
      ...selected.aliases.keys(),
    ]),
  ].map(cssName);
}
