import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { defaultConfig } from '../../../packages/tokens/src/config/default-config.ts';
import { renderGeometry, renderThemeResources } from '../generate-theme.mjs';

const tokens = JSON.parse(
  await readFile(
    new URL('../../../packages/tokens/src/generated/tokens.dtcg.json', import.meta.url),
    'utf8',
  ),
);
const motion = JSON.parse(
  await readFile(
    new URL('../../../packages/tokens/src/generated/motion.dtcg.json', import.meta.url),
    'utf8',
  ),
);

// Это требуемый порт нативной темы, а не перечень из проверяемого генератора.
const roles = {
  LabFillAccentBrush: '--lab-fill-accent',
  LabLabelOnAccentBrush: '--lab-label-on-accent',
  LabLabelSecondaryOnAccentBrush: '--lab-label-static-light-secondary',
  LabLightBrush: '--lab-bg-static-light',
  LabDarkBrush: '--lab-bg-static-dark',
  LabFocusBrush: '--lab-border-focus',
  LabPageBrush: '--lab-bg-primary',
  LabLabelPrimaryBrush: '--lab-label-primary',
  LabSheetTintBrush: '--lab-bg-material-elevated-01',
  LabSheetBlendBrush: '--lab-bg-material-elevated-02',
  LabSheetGhostBrush: '--lab-bg-overlay-ghost',
  LabSheetBorderBrush: '--lab-border-base',
  LabSheetHandleBrush: '--lab-label-tertiary',
  LabSheetNoiseBrush: '--lab-fx-noise',
  LabSheetSolidBrush: '--lab-bg-grouped-secondary',
};

function readyThemes() {
  return Object.fromEntries(
    ['light', 'dark'].map((theme) => [
      theme,
      {
        state: 'ready',
        paints: new Map(
          Object.values(roles).map((role, index) => [
            role,
            {
              rgb: [index, theme === 'light' ? 17 : 34, 255 - index],
              opacity: 1,
            },
          ]),
        ),
      },
    ]),
  );
}

function themeDictionary(xaml, name) {
  const match = xaml.match(
    new RegExp(`<ResourceDictionary x:Key="${name}">([\\s\\S]*?)</ResourceDictionary>`),
  );
  assert.ok(match, `Отсутствует словарь ${name}`);
  return match[1];
}

function geometryFixture() {
  return {
    tokens: structuredClone(tokens),
    motion: structuredClone(motion),
    config: structuredClone(defaultConfig),
  };
}

function emit(fixture = geometryFixture()) {
  return renderGeometry(fixture.tokens, fixture.motion, 'test owners', fixture.config);
}

const metricNames = [
  'height',
  'radius',
  'insetX',
  'insetY',
  'contentSize',
  'fontSize',
  'lineHeight',
  'tracking',
  'descriptionFontSize',
  'descriptionLineHeight',
  'descriptionTracking',
  'descriptionWeight',
  'glowShift',
];

function metrics(source, size) {
  const match = source.match(new RegExp(`LabButtonSize\\.${size} => new\\(([^)]+)\\)`));
  assert.ok(match, `Отсутствует размер ${size}`);
  const values = match[1].split(',').map(Number);
  assert.equal(values.length, metricNames.length);
  assert.ok(values.every(Number.isFinite));
  return Object.fromEntries(metricNames.map((name, index) => [name, values[index]]));
}

function constant(source, name) {
  const match = source.match(new RegExp(`const (?:double|ushort) ${name} = ([^;]+);`));
  assert.ok(match, `Отсутствует константа ${name}`);
  return Number(match[1]);
}

test('тема сохраняет каждый RGB и float alpha отдельно, включая прозрачный ноль', () => {
  for (const opacity of [0, 0.12345678901234568, 0.5, 1]) {
    const input = readyThemes();
    for (const result of Object.values(input)) {
      for (const paint of result.paints.values()) paint.opacity = opacity;
    }
    const xaml = renderThemeResources(input, 'test colors');
    for (const [native, theme] of [
      ['Light', 'light'],
      ['Dark', 'dark'],
    ]) {
      const dictionary = themeDictionary(xaml, native);
      const brushes = [
        ...dictionary.matchAll(
          /<SolidColorBrush x:Key="([^"]+)" Color="#([0-9A-F]+)" Opacity="([^"]+)" \/>/g,
        ),
      ];
      assert.equal(brushes.length, Object.keys(roles).length);
      for (const [key, role] of Object.entries(roles)) {
        const brush = brushes.find((match) => match[1] === key);
        assert.ok(brush, `${native}/${key}`);
        assert.equal(brush[2].length, 6, 'RGB не поглощает alpha и не теряет ведущий ноль');
        assert.deepEqual(
          brush[2].match(/../g).map((channel) => Number.parseInt(channel, 16)),
          input[theme].paints.get(role).rgb,
        );
        assert.equal(Number(brush[3]), opacity, 'alpha не квантуется в восьмибитный канал');
      }
    }
  }
});

test('неготовая, отсутствующая или не Map тема не подменяется другой темой', () => {
  for (const theme of ['light', 'dark']) {
    for (const invalid of [
      undefined,
      { state: 'pending', paints: new Map() },
      { state: 'ready', paints: {} },
    ]) {
      const input = readyThemes();
      input[theme] = invalid;
      assert.throws(() => renderThemeResources(input, 'test'), new RegExp(theme));
    }
  }
});

test('потеря любой обязательной роли явно останавливает проекцию', () => {
  for (const theme of ['light', 'dark']) {
    for (const role of Object.values(roles)) {
      const input = readyThemes();
      input[theme].paints.delete(role);
      assert.throws(() => renderThemeResources(input, 'test'), new RegExp(role));
    }
  }
});

test('невалидные каналы и alpha отвергаются без clamp или fallback', () => {
  for (const rgb of [
    null,
    [],
    [0, 1],
    [0, 1, 2, 3],
    [-1, 0, 0],
    [256, 0, 0],
    [0.5, 0, 0],
    ['1', 0, 0],
    [Number.NaN, 0, 0],
    [Number.POSITIVE_INFINITY, 0, 0],
  ]) {
    const input = readyThemes();
    input.light.paints.get('--lab-fill-accent').rgb = rgb;
    assert.throws(() => renderThemeResources(input, 'test'), /--lab-fill-accent/);
  }
  for (const opacity of [
    undefined,
    null,
    '0.5',
    -0.01,
    1.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    const input = readyThemes();
    input.dark.paints.get('--lab-fill-accent').opacity = opacity;
    assert.throws(() => renderThemeResources(input, 'test'), /opacity/);
  }
});

test('три позиции RGB обязаны содержать три канала, разреженный массив непригоден', () => {
  for (const rgb of [new Array(3), Object.assign(new Array(3), { 0: 0, 2: 255 })]) {
    const input = readyThemes();
    input.light.paints.get('--lab-fill-accent').rgb = rgb;
    assert.throws(() => renderThemeResources(input, 'test'), /--lab-fill-accent/);
  }
});

test('внутренняя тень сохраняет отдельную alpha светлой и тёмной темы', () => {
  const xaml = renderThemeResources(readyThemes(), 'test');
  assert.match(
    themeDictionary(xaml, 'Light'),
    /<x:Double x:Key="LabButtonShadowOpacity">0\.12<\/x:Double>/,
  );
  assert.match(
    themeDictionary(xaml, 'Dark'),
    /<x:Double x:Key="LabButtonShadowOpacity">0\.2<\/x:Double>/,
  );
  const changed = renderThemeResources(readyThemes(), 'test', { alpha: { light: 0, dark: 0.375 } });
  assert.match(themeDictionary(changed, 'Light'), />0<\/x:Double>/);
  assert.match(themeDictionary(changed, 'Dark'), />0\.375<\/x:Double>/);
});

test('геометрия сохраняет принятую размерную и типографическую анатомию Button', () => {
  const source = emit();
  const small = metrics(source, 'Small');
  const medium = metrics(source, 'Medium');
  const large = metrics(source, 'Large');
  assert.deepEqual([small.height, medium.height, large.height], [36, 48, 56]);
  assert.deepEqual(
    [small.insetX, small.insetY, medium.insetX, medium.insetY, large.insetX, large.insetY],
    [12, 8, 12, 12, 16, 16],
  );
  assert.deepEqual([small.radius, medium.radius, large.radius], [9999, 16, 16]);
  assert.deepEqual(
    [small.fontSize, small.lineHeight, medium.fontSize, medium.lineHeight],
    [14, 12, 16, 24],
  );
  assert.deepEqual(
    [
      small.descriptionFontSize,
      small.descriptionLineHeight,
      small.descriptionTracking,
      small.descriptionWeight,
    ],
    [14, 12, 0, 500],
  );
  assert.deepEqual(
    [
      medium.descriptionFontSize,
      medium.descriptionLineHeight,
      medium.descriptionTracking,
      medium.descriptionWeight,
    ],
    [16, 24, -0.015625, 400],
  );
  assert.deepEqual([small.glowShift, medium.glowShift, large.glowShift], [-1, 0, 3]);
  assert.equal(constant(source, 'SmoothResponse'), 350);
  assert.equal(constant(source, 'SmoothBounce'), 0);
});

test('смена семантической ссылки меняет только её потребителей', () => {
  const fixture = geometryFixture();
  fixture.config.spacing.aliases['button-inset'] = '5';
  fixture.config.radii.aliases.button = 'l';
  fixture.config.opacity.aliases['button-sheen'] = '45';
  const source = emit(fixture);
  const small = metrics(source, 'Small');
  const medium = metrics(source, 'Medium');
  const large = metrics(source, 'Large');
  assert.deepEqual(
    [small.insetX, small.insetY, medium.insetX, medium.insetY, large.insetX, large.insetY],
    [20, 8, 20, 20, 16, 16],
  );
  assert.deepEqual([small.radius, medium.radius, large.radius], [9999, 12, 12]);
  assert.equal(constant(source, 'SheenOpacity'), 0.45);
  assert.equal(constant(source, 'SheenHoverOpacity'), 0.32);
});

test('размеры Sheet следуют изменению владельца, сохраняя независимую геометрию', () => {
  const reference = emit();
  for (const [name, expected, mutate] of [
    [
      'SheetRadius',
      12,
      (fixture) => {
        fixture.config.radii.aliases.sheet = 'l';
      },
    ],
    [
      'SheetDragArea',
      28,
      (fixture) => {
        fixture.tokens.size['sheet-drag-area'].$value.value = 28;
      },
    ],
  ]) {
    const fixture = geometryFixture();
    mutate(fixture);
    const source = emit(fixture);
    assert.equal(constant(source, name), expected);
    assert.equal(
      source.replace(`${name} = ${expected};`, `${name} = ${constant(reference, name)};`),
      reference,
    );
  }
});

test('новые значения DTCG передаются в DIP, line height вычисляется по font size, tracking остаётся em', () => {
  const fixture = geometryFixture();
  fixture.tokens.size['button-h-m'].$value.value = 52;
  fixture.tokens['font-size']['button-label'].$value.value = 18;
  fixture.tokens['line-height']['button-label'].$value = 1.25;
  fixture.tokens['letter-spacing']['button-label'].$value = -0.025;
  fixture.motion.motion.spring.smooth.$extensions['com.labpics.motion'].duration.value = 0.42;
  const source = emit(fixture);
  const medium = metrics(source, 'Medium');
  assert.deepEqual(
    [medium.height, medium.fontSize, medium.lineHeight, medium.tracking],
    [52, 18, 22.5, -0.025],
  );
  assert.equal(metrics(source, 'Small').fontSize, 14);
  assert.equal(medium.descriptionFontSize, 16);
  assert.equal(constant(source, 'SmoothResponse'), 420);
});

test('повреждённый размер, неизвестная единица и отсутствующий alias не дают геометрию', () => {
  for (const mutate of [
    (fixture) => {
      fixture.tokens.size['button-h-m'].$value.unit = 'rem';
    },
    (fixture) => {
      fixture.tokens.size['button-h-m'].$value.value = Number.NaN;
    },
    (fixture) => {
      fixture.tokens.size['button-h-m'].$value.value = -1;
    },
    (fixture) => {
      fixture.tokens.size['button-h-m'].$type = 'string';
    },
    (fixture) => {
      Reflect.deleteProperty(fixture.tokens.size, 'button-h-m');
    },
    (fixture) => {
      fixture.config.spacing.aliases['button-inset'] = 'missing';
    },
  ]) {
    const fixture = geometryFixture();
    mutate(fixture);
    assert.throws(() => emit(fixture));
  }
});

test('неподдержанная модель smooth-пружины не подменяется временной кривой', () => {
  for (const patch of [
    { type: 'tween' },
    { model: 'unknown' },
    { duration: { value: 350, unit: 'ms' } },
    { duration: { value: Number.NaN, unit: 's' } },
    { duration: { value: -1, unit: 's' } },
    { bounce: -0.1 },
    { bounce: 1.1 },
    { bounce: Number.POSITIVE_INFINITY },
  ]) {
    const fixture = geometryFixture();
    Object.assign(fixture.motion.motion.spring.smooth.$extensions['com.labpics.motion'], patch);
    assert.throws(() => emit(fixture));
  }
});

test('пружина остаётся допустимым входом LabMotion: response > 0, bounce < 1', () => {
  // ScalarMotion native принимает только эти открытые границы, в отличие от alpha.
  for (const patch of [
    { duration: { value: 0, unit: 's' } },
    { duration: { value: '0.35', unit: 's' } },
    { duration: { value: 1e-300, unit: 's' } },
    { duration: { value: 1e300, unit: 's' } },
    { bounce: 1 },
    { bounce: 0.9999999999 },
  ]) {
    const fixture = geometryFixture();
    Object.assign(fixture.motion.motion.spring.smooth.$extensions['com.labpics.motion'], patch);
    assert.throws(() => emit(fixture));
  }
  const valid = geometryFixture();
  Object.assign(valid.motion.motion.spring.smooth.$extensions['com.labpics.motion'], {
    duration: { value: 0.001, unit: 's' },
    bounce: 0.999,
  });
  const source = emit(valid);
  assert.equal(constant(source, 'SmoothResponse'), 1);
  assert.equal(constant(source, 'SmoothBounce'), 0.999);
});
