// LabUI владеет красками, прозрачностью и связями ролей. Colors получает
// только источники, Paint и ограничения; ни темы, ни имена компонентов.

const LEVELS = ['primary', 'secondary', 'tertiary', 'quaternary'];
const FAMILIES = ['brand', 'danger', 'warning', 'success', 'info'];
const GLOW_FAMILIES = ['neutral', 'brand', 'danger', 'warning'];

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: ожидается объект`);
  }
  return value;
}

function opacity(value, path) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path}: ожидается число в [0, 1]`);
  }
  return value;
}

function sourceRgb(value, path) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${path}: ожидается #RRGGBB`);
  }
  // Это разбор записи sRGB8, не преобразование цветового пространства.
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

/** Проверить авторские входы и развернуть связи CSS без вычисления цветов. */
export function prepareEngineConfig(parsed, contrast = 'normal') {
  if (!['normal', 'more'].includes(contrast))
    throw new Error(`contrast: неизвестное значение ${contrast}`);
  const config = record(parsed, 'config');
  if (config.schemaVersion !== 1) throw new Error('config.schemaVersion: поддержана версия 1');
  const authored = record(config.authored, 'authored');
  const materials = record(authored.materials, 'authored.materials');
  const materialNames = ['light', 'dark'].map((theme) =>
    Object.keys(record(materials[theme], `authored.materials.${theme}`)).sort(),
  );
  if (
    materialNames[0].length !== materialNames[1].length ||
    materialNames[0].some((name, index) => name !== materialNames[1][index])
  )
    throw new Error('authored.materials: темы должны объявлять одинаковый набор материалов');
  const sources = Object.fromEntries(
    Object.entries(record(authored.sources, 'authored.sources')).map(([name, value]) => [
      name,
      sourceRgb(value, `authored.sources.${name}`),
    ]),
  );
  let assignment;
  let labelAlpha = authored.labelAlpha;
  let staticLabelAlpha = authored.labelAlpha;
  if (contrast === 'more') {
    const more = record(record(config.contrast, 'contrast').more, 'contrast.more');
    labelAlpha = {
      ...record(authored.labelAlpha, 'authored.labelAlpha'),
      ...record(more.labelAlpha, 'contrast.more.labelAlpha'),
    };
    staticLabelAlpha = {
      ...record(authored.labelAlpha, 'authored.labelAlpha'),
      ...record(more.staticLabelAlpha, 'contrast.more.staticLabelAlpha'),
    };
    for (const [name, value] of Object.entries(record(more.sources, 'contrast.more.sources'))) {
      const fillSource = FAMILIES.some((family) =>
        ['light', 'dark'].some((theme) => name === `${family}-fill-${theme}`),
      );
      if (!Object.hasOwn(sources, name) && !fillSource)
        throw new Error(`contrast.more.sources.${name}: неизвестный источник`);
      sources[name] = sourceRgb(value, `contrast.more.sources.${name}`);
    }
    assignment = record(more.assignment, 'contrast.more.assignment');
    if (
      !Number.isFinite(assignment.maxDelta) ||
      assignment.maxDelta < 0 ||
      !Number.isFinite(assignment.maxDelta * assignment.maxDelta)
    )
      throw new Error(
        'contrast.more.assignment.maxDelta: ожидается конечная неотрицательная граница',
      );
  }
  const source = (name) => {
    if (!Object.hasOwn(sources, name)) throw new Error(`неизвестный авторский источник ${name}`);
    return name;
  };
  const sharedAlpha = (table, level, path) =>
    opacity(record(table, path)[level], `${path}.${level}`);
  const observation = record(config.observation, 'observation');
  if (
    !Number.isFinite(observation.adaptingLuminance) ||
    observation.adaptingLuminance <= 0 ||
    !Number.isFinite(observation.backgroundRatio) ||
    observation.backgroundRatio <= 0 ||
    observation.backgroundRatio > 1 ||
    !['average', 'dim', 'dark'].includes(observation.surround)
  )
    throw new Error('observation: недопустимый контекст наблюдения');
  const policy = record(config.policy, 'policy');
  if (!['unresolved', 'authored-normal', 'strict'].includes(policy.contrast)) {
    throw new Error(`policy.contrast: неизвестное значение ${policy.contrast}`);
  }
  if (policy.assignment !== 'preserve-authored') {
    throw new Error('policy.assignment: требуется явная политика сохранения авторских опор');
  }

  const themes = {};
  for (const theme of ['light', 'dark']) {
    const selected = record(record(config.themes, 'themes')[theme], `themes.${theme}`);
    const paints = new Map();
    const composites = new Map();
    const aliases = new Map();
    const constraints = [];
    const computed = new Map();
    const pending = [];
    const add = (name, selectedSource, alpha = 1) => {
      if (paints.has(name) || composites.has(name) || aliases.has(name))
        throw new Error(`роль ${name} объявлена дважды`);
      paints.set(name, { source: source(selectedSource), opacity: opacity(alpha, name) });
    };
    const alias = (name, target) => {
      if (paints.has(name) || composites.has(name) || aliases.has(name))
        throw new Error(`роль ${name} объявлена дважды`);
      aliases.set(name, target);
    };
    const floor = (foreground, background, criterion, hard = false) => {
      constraints.push({ foreground, background, criterion, ...(hard ? { hard } : {}) });
    };
    const labelFamily = (prefix, primary, muted = primary) => {
      for (const level of LEVELS)
        add(
          `${prefix}-${level}`,
          level === 'primary' ? primary : muted,
          sharedAlpha(labelAlpha, level, 'labelAlpha'),
        );
    };
    const fillFamily = (prefix, paintSource, table, path) => {
      for (const level of LEVELS)
        add(`${prefix}-${level}`, paintSource, sharedAlpha(table, level, path));
    };
    const borderFamily = (prefix, strong, muted, table, path) => {
      add(`${prefix}-strong`, strong);
      for (const level of ['base', 'soft'])
        add(`${prefix}-${level}`, muted, sharedAlpha(table, level, path));
    };

    add(
      'bg-tone-1',
      selected.background,
      selected.backgroundOpacity === undefined ? 1 : selected.backgroundOpacity,
    );
    const tone = record(selected.tone, `themes.${theme}.tone`);
    source(tone.source);
    if (!Array.isArray(tone.alpha) || tone.alpha.length !== 2)
      throw new Error(`themes.${theme}.tone.alpha: нужны две ступени`);
    for (const [index, value] of tone.alpha.entries()) {
      composites.set(`bg-tone-${index + 2}`, {
        source: tone.source,
        opacity: opacity(value, `themes.${theme}.tone.alpha.${index}`),
      });
    }
    const topology = theme === 'light' ? [1, 2, 1, 2, 1, 2] : [1, 2, 3, 1, 2, 3];
    for (const [index, name] of [
      'primary',
      'secondary',
      'tertiary',
      'grouped-primary',
      'grouped-secondary',
      'grouped-tertiary',
    ].entries()) {
      alias(`bg-${name}`, `bg-tone-${topology[index]}`);
    }
    add('bg-inverted', theme === 'light' ? 'shade' : selected.primary);
    add('bg-static-light', 'white');
    add('bg-static-dark', 'shade');
    for (const level of ['base', 'ghost', 'soft', 'strong'])
      add(
        `bg-overlay-${level}`,
        authored.overlay.sources[theme],
        sharedAlpha(authored.overlay.alpha, level, 'authored.overlay.alpha'),
      );
    for (const [name, material] of Object.entries(
      record(authored.materials[theme], `authored.materials.${theme}`),
    )) {
      add(`bg-material-${name}-01`, material.tint, material.alpha);
      add(`bg-material-${name}-02`, material.base);
    }

    labelFamily('label', selected.primary, selected.muted);
    labelFamily('label-inverted', selected.invertedPrimary, selected.invertedMuted);
    for (const [side, paintSource] of Object.entries(authored.static.sources)) {
      for (const level of LEVELS)
        add(
          `label-static-${side}-${level}`,
          paintSource,
          sharedAlpha(staticLabelAlpha, level, 'staticLabelAlpha'),
        );
    }
    fillFamily('fill', 'mid', authored.fillAlpha[theme], `authored.fillAlpha.${theme}`);
    borderFamily(
      'border',
      selected.primary,
      'mid',
      authored.borderAlpha[theme],
      `authored.borderAlpha.${theme}`,
    );
    add('fill-none', 'mid', 0);
    add('border-none', 'mid', 0);
    add('border-inverted', selected.invertedPrimary);
    for (const side of ['light', 'dark']) {
      fillFamily(
        `fill-static-${side}`,
        'mid',
        authored.fillAlpha[side],
        `authored.fillAlpha.${side}`,
      );
      borderFamily(
        `border-static-${side}`,
        authored.static.sources[side],
        'mid',
        authored.borderAlpha[side],
        `authored.borderAlpha.${side}`,
      );
    }
    for (const family of FAMILIES) {
      const paintSource = `${family}-${theme}`;
      labelFamily(`label-${family}`, paintSource);
      fillFamily(`fill-${family}`, paintSource, authored.colorFillAlpha, 'authored.colorFillAlpha');
      borderFamily(
        `border-${family}`,
        paintSource,
        paintSource,
        authored.colorBorderAlpha,
        'authored.colorBorderAlpha',
      );
    }
    for (const family of ['', ...FAMILIES.map((name) => `${name}-`)]) {
      floor(`label-${family}primary`, 'bg-tone-1', 'text');
      floor(`label-${family}secondary`, 'bg-tone-1', 'text');
      floor(`label-${family}tertiary`, 'bg-tone-1', 'ui');
      floor(`border-${family}strong`, 'bg-tone-1', 'ui');
    }

    add('fill-neutral', `fill-neutral-${theme}`);
    alias('label-on-neutral', 'label-primary');
    floor('label-on-neutral', 'fill-neutral', 'text');
    for (const family of [...FAMILIES, 'static-dark', 'static-light']) {
      add(
        `badge-fill-${family}`,
        family.startsWith('static-')
          ? authored.static.sources[family.slice('static-'.length)]
          : `${family}-${theme}`,
      );
      alias(
        `badge-label-on-${family}`,
        family === 'static-light' ? 'label-static-dark-primary' : 'label-static-light-primary',
      );
      floor(`badge-label-on-${family}`, `badge-fill-${family}`, 'text');
    }
    alias('fill-accent-tinted', 'fill-brand-primary');
    alias('fill-danger-tinted', 'fill-danger-primary');
    alias('label-accent', 'label-brand-primary');
    alias('label-danger', 'label-danger-primary');
    alias('label-on-accent', 'label-static-light-primary');
    alias('label-on-danger', 'label-static-light-primary');
    alias('border-accent', 'border-brand-strong');
    alias('border-danger', 'border-danger-strong');
    alias('border-focus', 'fx-focus-ring-brand');
    alias('badge-label-default', 'label-static-light-primary');
    alias('badge-label-contrast', 'label-static-dark-primary');
    if (theme === 'light') add('control-bg', 'white');
    else alias('control-bg', 'fill-primary');
    for (const { alias: name, target } of config.aliases) alias(name, target);

    add('fx-glow-inverted', selected.invertedMuted);
    // Белый источник и общая alpha базы сохраняют действующий смысл светлого блика.
    add('fx-skeleton-highlight', 'white', authored.fillAlpha[theme].quaternary);
    for (const family of GLOW_FAMILIES) {
      add(
        `fx-glow-${family}`,
        family === 'neutral' ? 'white' : `${family}-${theme}`,
        opacity(authored.glowAlpha, 'authored.glowAlpha'),
      );
    }
    if (contrast === 'more') {
      // Текст на canvas/tinted и белая подпись на fill задают разные связи.
      // More-опоры принадлежат LabUI. Core сохраняет допустимую заливку либо
      // назначает её в общей задаче; normal читает только authored sources.
      for (const family of FAMILIES) {
        const labelSource = `${family}-${theme}`;
        const fillSource = `${family}-fill-${theme}`;
        sources[fillSource] ??= [...sources[labelSource]];
        paints.set(`badge-fill-${family}`, { source: fillSource, opacity: 1 });
        computed.set(fillSource, {
          domain: { kind: 'box', lower: [0, 0, 0], upper: [255, 255, 255] },
          maxDelta: assignment.maxDelta,
        });
        for (const level of [1, 2, 3]) {
          const background = `bg-tone-${level}`;
          for (const label of ['primary', 'secondary', 'tertiary'])
            floor(`label-${family}-${label}`, background, 'text', true);
          floor(`border-${family}-strong`, background, 'ui', true);
        }
        floor(`label-${family}-primary`, `fill-${family}-primary`, 'text', true);
        floor(`badge-label-on-${family}`, `badge-fill-${family}`, 'text', true);
        floor('label-static-light-secondary', `badge-fill-${family}`, 'text', true);
      }
      // Декоративный border-base в ordinary недостаточен как единственный
      // признак пустого control. IC использует уже существующий primary.
      paints.set('border-base', { source: selected.primary, opacity: 1 });
      for (const level of [1, 2, 3]) {
        const background = `bg-tone-${level}`;
        floor('label-secondary', background, 'text', true);
        floor('label-tertiary', background, 'text', true);
        floor('label-accent', background, 'text', true);
        floor('border-focus', background, 'ui', true);
        floor('border-base', background, 'ui', true);
      }
      floor('label-on-accent', 'fill-accent', 'text', true);
      floor('label-static-light-secondary', 'fill-accent', 'text', true);
    }
    if (policy.contrast === 'unresolved')
      pending.push('contrast: не выбрана normal/strict политика');
    for (const name of aliases.keys()) {
      const seen = new Set([name]);
      let target = aliases.get(name);
      while (aliases.has(target)) {
        if (seen.has(target)) throw new Error(`цикл aliases у ${name}`);
        seen.add(target);
        target = aliases.get(target);
      }
      if (!paints.has(target) && !composites.has(target))
        throw new Error(`alias ${name}: неизвестная роль ${target}`);
    }
    themes[theme] = {
      paints,
      composites,
      aliases,
      constraints,
      computed,
      pending,
      background: source(selected.background),
      tone: { source: tone.source, alpha: [...tone.alpha] },
    };
  }
  return { sources, themes, observation: { ...observation }, policy: { ...policy } };
}
