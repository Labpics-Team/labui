import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { decodeSheetEvidence, sheetFailureLog, validateObservation } from './sheet.mjs';

const SOURCE = 'a'.repeat(40);
const sample = {
  index: 11,
  inputs: 8,
  combine: 'Add',
  source: 'repeat',
  named: false,
  blur: true,
  mask: true,
  hresult: -2147024809,
  cleanupHresult: null,
};

const CASE_FIELDS = [
  'Inputs',
  'Add',
  'Source',
  'Named',
  'Blur',
  'Mask',
  'Balanced',
  'LevelStart',
  'Body',
];
// Полные сигнатуры заданы независимо; положение строки — диагностический index.
const EXPECTED_CASES = [
  [2, false, 'shared', false, true, true, false, 0, false],
  [3, false, 'shared', false, true, true, false, 0, false],
  [3, false, 'repeat', false, true, true, false, 0, false],
  [3, false, 'distinct', false, true, true, false, 0, false],
  [3, false, 'shared', true, true, true, false, 0, false],
  [3, false, 'distinct', true, true, true, false, 0, false],
  [2, true, 'shared', false, true, true, false, 0, false],
  [3, true, 'shared', false, true, true, false, 0, false],
  [8, true, 'shared', false, true, true, false, 0, false],
  [8, true, 'distinct', false, true, true, false, 0, false],
  [3, true, 'repeat', false, true, true, false, 0, false],
  [8, true, 'repeat', false, true, true, false, 0, false],
  [8, false, 'repeat', false, true, true, false, 0, false],
  [8, true, 'shared', true, false, true, false, 0, false],
  [8, true, 'repeat', false, true, false, false, 0, false],
  [8, true, 'repeat', false, true, true, true, 0, false],
  [1, false, 'repeat', false, true, false, false, 7, false],
  [1, false, 'repeat', false, true, false, false, 0, true],
  [2, true, 'repeat', false, true, true, false, 6, false],
  [8, true, 'repeat', false, false, false, false, 0, false],
];

// Только лексический разбор текста; Native API и построение графов не исполняются.
function tokens(source) {
  if (Array.isArray(source)) return source;
  return (
    source.match(
      /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|\$?"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?[fFdD]?|\?\?=|\?\?|=>|>=|<=|==|!=|&&|\|\||\+\+|--|\+=|-=|[^\s]/g,
    ) ?? []
  ).filter((token) => !token.startsWith('//') && !token.startsWith('/*'));
}

function tokenIndex(source, snippet) {
  const actual = tokens(source);
  const expected = tokens(snippet);
  return actual.findIndex((_, index) =>
    expected.every((token, offset) => actual[index + offset] === token),
  );
}

function includesSource(source, snippet, message) {
  assert.ok(tokenIndex(source, snippet) >= 0, `Sheet: ${message}`);
}

function enclosed(source, anchor, open = '{', close = '}', message = anchor) {
  const actual = tokens(source);
  const start = tokenIndex(actual, anchor);
  assert.ok(start >= 0, `Sheet: source section missing: ${message}`);
  const beginning = actual.indexOf(open, start + tokens(anchor).length);
  assert.ok(beginning >= 0, `Sheet: source delimiter missing: ${message}`);
  let depth = 1;
  let end = beginning + 1;
  for (; end < actual.length && depth; end++) {
    if (actual[end] === open) depth++;
    if (actual[end] === close) depth--;
  }
  assert.equal(depth, 0, `Sheet: source section unclosed: ${message}`);
  return actual.slice(beginning + 1, end - 1);
}

function argumentsOf(source) {
  const result = [];
  let argument = [];
  let depth = 0;
  for (const token of tokens(source)) {
    if (token === ',' && depth === 0) {
      if (argument.length) result.push(argument);
      argument = [];
    } else {
      argument.push(token);
      if (['(', '[', '{'].includes(token)) depth++;
      if ([')', ']', '}'].includes(token)) depth--;
    }
  }
  if (argument.length) result.push(argument);
  return result;
}

function literal(argument) {
  assert.equal(argument.length, 1, 'Sheet: expected a literal source argument');
  const [value] = argument;
  if (value === 'true' || value === 'false') return value === 'true';
  if (/^\d+$/.test(value)) return Number(value);
  assert.match(
    value,
    /^["'][A-Za-z_][A-Za-z_0-9]*["']$/,
    'Sheet: expected a closed string literal',
  );
  return value.slice(1, -1);
}

function caseSignatures(producer) {
  includesSource(
    producer,
    `private readonly record struct Case(int Inputs, bool Add, string Source,
    bool Named = false, bool Blur = true, bool Mask = true, bool Balanced = false,
    int LevelStart = 0, bool Body = false);`,
    'case fields and defaults changed',
  );
  includesSource(producer, 'internal const int Limit = 20;', 'producer case limit changed');
  const table = enclosed(producer, 'private static readonly Case[] cases =', '[', ']');
  const signatures = argumentsOf(table).map((entry) => {
    assert.equal(entry[0], 'new', 'Sheet: expected a Case constructor');
    const values = [undefined, undefined, undefined, false, true, true, false, 0, false];
    const assigned = new Set();
    let position = 0;
    for (const argument of argumentsOf(enclosed(entry, 'new', '(', ')'))) {
      const named = argument[1] === ':';
      const index = named ? CASE_FIELDS.indexOf(argument[0]) : position++;
      assert.ok(
        index >= 0 && index < CASE_FIELDS.length && !assigned.has(index),
        'Sheet: duplicate or unknown Case argument',
      );
      assigned.add(index);
      values[index] = literal(named ? argument.slice(2) : argument);
    }
    assert.ok(
      [0, 1, 2].every((index) => assigned.has(index)),
      'Sheet: required Case argument missing',
    );
    return values;
  });
  assert.deepEqual(
    signatures,
    EXPECTED_CASES,
    'Sheet: twenty complete ordered case signatures changed',
  );
  for (const [first, second, differences] of [
    [0, 1, ['Inputs']],
    [6, 7, ['Inputs']],
    [7, 8, ['Inputs']],
    [10, 11, ['Inputs']],
    [0, 6, ['Add']],
    [1, 7, ['Add']],
    [11, 12, ['Add']],
    [1, 2, ['Source']],
    [2, 3, ['Source']],
    [7, 10, ['Source']],
    [8, 9, ['Source']],
    [8, 11, ['Source']],
    [1, 4, ['Named']],
    [3, 5, ['Named']],
    [11, 14, ['Mask']],
    [11, 15, ['Balanced']],
    [16, 17, ['LevelStart', 'Body']],
  ]) {
    assert.deepEqual(
      CASE_FIELDS.filter((_, index) => signatures[first][index] !== signatures[second][index]),
      differences,
      `Sheet: controlled case pair ${first}/${second} changed`,
    );
  }
  return signatures;
}

function assertSigmaSource(sample, profile) {
  const levels = argumentsOf(
    enclosed(profile, 'private static readonly float[] levels =', '[', ']'),
  ).map((expression) => {
    assert.ok(
      expression.length === 1 || (expression.length === 3 && expression[1] === '/'),
      'Sheet: unexpected level expression',
    );
    const number = (value) => {
      assert.match(value, /^\d+(?:\.\d+)?[fF]?$/, 'Sheet: expected a finite level literal');
      return Number(value.replace(/[fF]$/, ''));
    };
    return Math.fround(
      number(expression[0]) / (expression.length === 3 ? number(expression[2]) : 1),
    );
  });
  assert.deepEqual(
    levels,
    [0, 1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1],
    'Sheet: eight actual progressive levels changed',
  );
  includesSource(
    profile,
    'internal static ReadOnlySpan<float> Levels => levels;',
    'actual levels accessor changed',
  );
  includesSource(
    sample,
    `if (spec.Inputs == 1 || spec.LevelStart > 0) {
    sigmas = spec.Body ? [(float)bodySigma] : Enumerable.Range(spec.LevelStart, spec.Inputs)
      .Select(level => (float)(SheetBlurProfile.Levels[level] * ghostSigma)).ToArray();
    sample["sigmas"] = sigmas;
    if (!spec.Body) sample["levelStart"] = spec.LevelStart;
  }`,
    'selected ghost/body sigma formula changed',
  );
  includesSource(
    sample,
    `Source = branch, BlurAmount = sigmas is null
    ? (float)(SheetBlurProfile.Levels[input] * ghostSigma) : sigmas[input],
    BorderMode = EffectBorderMode.Hard,`,
    'actual Gaussian ghost sigma formula changed',
  );
  // Двоичные дроби и эти произведения точны в float; expected не получен из producer.
  for (const [ghost, body, expectedGhost, expectedBody, expectedPair] of [
    [12, 64, [0, 0.1875, 0.375, 0.75, 1.5, 3, 6, 12], [64], [6, 12]],
    [20, 48, [0, 0.3125, 0.625, 1.25, 2.5, 5, 10, 20], [48], [10, 20]],
  ]) {
    assert.deepEqual(
      levels.map((level) => Math.fround(level * ghost)),
      expectedGhost,
    );
    assert.deepEqual([Math.fround(body)], expectedBody);
    assert.deepEqual(
      levels.slice(6).map((level) => Math.fround(level * ghost)),
      expectedPair,
    );
  }
}

function assertGraphSource(producer, profile) {
  includesSource(
    producer,
    `=> SheetFactorySampling.PreservePrimary(() => compositor.CreateEffectFactory(graph), primary => {
    primary.Data[DataKey] = cases.Select((spec, index) =>
      Sample(compositor, spec, index, ghostSigma, bodySigma)).ToArray();
  });`,
    'ordered cases are disconnected from the primary factory failure',
  );
  const sample = enclosed(producer, 'private static Dictionary<string, object?> Sample(');
  includesSource(
    sample,
    `var sample = new Dictionary<string, object?> {
    ["index"] = index, ["inputs"] = spec.Inputs,
    ["combine"] = spec.Inputs == 1 ? "Gaussian" :
      spec.Balanced ? "BalancedAdd" : spec.Add ? "Add" : "Arithmetic",
    ["source"] = spec.Source, ["named"] = spec.Named,
    ["blur"] = spec.Blur, ["mask"] = spec.Mask,
    ["stage"] = "build", ["hresult"] = 0, ["cleanupHresult"] = null,
  };`,
    'case fields are disconnected from the diagnostic row',
  );
  includesSource(
    sample,
    'var outcome = SheetFactorySampling.Capture(register => {',
    'actual graph must use the production owner',
  );
  const own = enclosed(sample, 'T Own<T>(T effect) where T : IGraphicsEffect, IDisposable');
  assert.deepEqual(
    own,
    tokens(`var position = register(effect);
    if (spec.Named) effect.Name = $"probe{position}";
    return effect;`),
    'Sheet: registration must precede ordinal naming',
  );
  includesSource(
    sample,
    `var shared = new CompositionEffectSourceParameter("backdrop");`,
    'shared source missing',
  );
  includesSource(
    sample,
    `IGraphicsEffectSource? sum = null;
    List<IGraphicsEffectSource>? balanced = spec.Balanced ? [] : null;
    var add = spec.Add && !spec.Balanced ? Own(new CompositeEffect { Mode = CanvasComposite.Add }) : null;`,
    'actual flat Add combiner changed',
  );
  assertSigmaSource(sample, profile);
  const branches = enclosed(sample, 'for (var input = 0; input < spec.Inputs; input++)');
  assert.deepEqual(
    branches,
    tokens(`IGraphicsEffectSource branch = spec.Source switch {
      "shared" => shared,
      "repeat" => new CompositionEffectSourceParameter("backdrop"),
      _ => new CompositionEffectSourceParameter($"backdrop{input}"),
    };
    if (spec.Blur && (input > 0 || sigmas is not null)) branch = Own(new GaussianBlurEffect {
      Source = branch, BlurAmount = sigmas is null
        ? (float)(SheetBlurProfile.Levels[input] * ghostSigma) : sigmas[input],
      BorderMode = EffectBorderMode.Hard,
    });
    if (spec.Mask) branch = Own(new AlphaMaskEffect {
      Source = branch, AlphaMask = new CompositionEffectSourceParameter($"mask{spec.LevelStart + input}"),
    });
    if (balanced is not null) balanced.Add(branch);
    else if (add is not null) add.Sources.Add(branch);
    else sum = sum is null ? branch : Own(new ArithmeticCompositeEffect {
      Source1 = sum, Source2 = branch, MultiplyAmount = 0,
      Source1Amount = 1, Source2Amount = 1, Offset = 0, ClampOutput = false,
    });`),
    'Sheet: actual source/mask branches or unclamped Arithmetic 0/1/1/0 changed',
  );
  const balanced = enclosed(sample, '} if (balanced is not null)');
  assert.deepEqual(
    balanced,
    tokens(`while (balanced.Count > 1) {
    List<IGraphicsEffectSource> next = [];
    for (var input = 0; input < balanced.Count; input += 2) {
      var pair = Own(new CompositeEffect { Mode = CanvasComposite.Add });
      pair.Sources.Add(balanced[input]);
      pair.Sources.Add(balanced[input + 1]);
      next.Add(pair);
    }
    balanced = next;
  }
  sum = balanced[0];`),
    'Sheet: actual binary balanced Add construction changed',
  );
  includesSource(
    sample,
    `var graph = (IGraphicsEffect)(add ?? sum!);
    return graph;
  }, input => compositor.CreateEffectFactory(input));
  sample["stage"] = outcome.Stage == SheetFactoryStage.Build ? "build" : "factory";
  sample["hresult"] = outcome.HResult;
  sample["cleanupHresult"] = outcome.CleanupHResult;
  return sample;`,
    'built graph/factory/outcome source binding changed',
  );
  includesSource(
    producer,
    '=> RecordPair(primary, SigmaDataKey, compositor, progressive, progressive, dynamicProperties);',
    'static/dynamic pair must borrow the same actual progressive',
  );
  includesSource(
    producer,
    '=> RecordPair(primary, BranchesDataKey, compositor, first, second);',
    'branch pair order changed',
  );
  const pair = enclosed(producer, 'private static void RecordPair(');
  includesSource(
    pair,
    `var firstResult = SampleFactory(compositor, first);
    var secondResult = SampleFactory(compositor, second, secondProperties);
    primary.Data[dataKey] = new Dictionary<string, object?>[] {
      new() { ["hresult"] = firstResult.HResult, ["cleanupHresult"] = firstResult.CleanupHResult },
      new() { ["hresult"] = secondResult.HResult, ["cleanupHresult"] = secondResult.CleanupHResult },
    };`,
    'borrowed pair results must retain first/static then second/dynamic order',
  );
  const borrowed = enclosed(
    producer,
    'private static (int? HResult, int? CleanupHResult) SampleFactory(',
  );
  assert.deepEqual(
    borrowed,
    tokens(`var outcome = SheetFactorySampling.Capture(_ => graph,
    input => dynamicProperties is null ? compositor.CreateEffectFactory(input)
      : compositor.CreateEffectFactory(input, dynamicProperties));
    return (outcome.HResult, outcome.CleanupHResult);`),
    'Sheet: borrowed actual graph must pass through without registration or graph cleanup',
  );
}

function assertSamplingSource(sampling) {
  const capture = enclosed(sampling, 'internal static SheetFactoryOutcome Capture<T>(');
  includesSource(
    capture,
    `List<IDisposable> owned = [];
    IDisposable? factory = null;
    var stage = SheetFactoryStage.Build;
    var hresult = 0;
    int? cleanupHresult = null;`,
    'production owner initial state changed',
  );
  assert.deepEqual(
    enclosed(capture, 'int Register(IDisposable resource)'),
    tokens(`
    ArgumentNullException.ThrowIfNull(resource);
    owned.Add(resource);
    return owned.Count;`),
    'Sheet: production registration and ordinal changed',
  );
  assert.deepEqual(
    enclosed(capture, 'try'),
    tokens(`var input = build(Register);
    stage = SheetFactoryStage.Factory;
    factory = create(input) ?? throw new InvalidOperationException("Factory не вернула ресурс.");`),
    'Sheet: registered build must precede factory of the same graph',
  );
  includesSource(
    capture,
    'catch (Exception error) { hresult = error.HResult; } finally {',
    'partial build/factory failure must enter owned cleanup',
  );
  const cleanup = enclosed(capture, 'finally');
  assert.deepEqual(
    enclosed(cleanup, 'void Dispose(IDisposable resource)'),
    tokens(`
    try { resource.Dispose(); }
    catch (Exception error) { cleanupHresult ??= error.HResult; }`),
    'Sheet: cleanup must continue while retaining its first separate HRESULT',
  );
  includesSource(
    cleanup,
    `if (factory is not null) Dispose(factory);
    for (var index = owned.Count - 1; index >= 0; index--) Dispose(owned[index]);`,
    'factory-first and reverse-owned cleanup missing',
  );
  includesSource(
    capture,
    'return new(stage, hresult, cleanupHresult);',
    'primary and cleanup outcomes must stay separate',
  );
  const primary = enclosed(sampling, 'internal static T PreservePrimary<T>(');
  assert.deepEqual(
    primary,
    tokens(`try { return create(); }
    catch (Exception primary) {
      try { diagnose(primary); }
      catch { }
      throw;
    }`),
    'Sheet: diagnostic failure must preserve the original factory exception',
  );
  assert.ok(
    !tokens(sampling).some((token) =>
      [
        'Compositor',
        'IGraphicsEffect',
        'CanvasComposite',
        'CompositionEffectFactory',
        'CompositionEffectSourceParameter',
        'GaussianBlurEffect',
      ].includes(token),
    ),
    'Sheet: production sampling helper must remain System-only',
  );
}

// Source-only: настоящий producer, owner и оба настоящих wire-проектора.
function assertSheetSourceProjection(producer, projector, codec, sampling, profile) {
  const signatures = caseSignatures(producer);
  assertGraphSource(producer, profile);
  assertSamplingSource(sampling);
  const csharp = argumentsOf(enclosed(projector, '["source"] = Known', '(', ')'))
    .slice(1)
    .map(literal);
  const javascriptArguments = argumentsOf(enclosed(codec, 'source: known', '(', ')'));
  assert.equal(javascriptArguments.length, 2, 'Sheet: actual JS source projector missing');
  const javascript = argumentsOf(javascriptArguments[1].slice(1, -1)).map(literal);
  assert.deepEqual(
    [...csharp].sort(),
    ['distinct', 'repeat', 'shared'],
    'Sheet: C# source vocabulary changed',
  );
  assert.deepEqual([...javascript].sort(), [...csharp].sort(), 'Sheet: source vocabularies differ');
  for (const signature of signatures)
    assert.ok(csharp.includes(signature[2]), 'Sheet: current source scheme is lost in projection');
  includesSource(
    projector,
    'allowed.Contains(text, StringComparer.Ordinal)',
    'C# source projection must remain ordinal',
  );
  includesSource(
    codec,
    'const known = (value, values) => (values.includes(value) ? value : null);',
    'JS source projection must remain ordinal',
  );
}

function topologySources() {
  return Promise.all([
    readFile(new URL('../Rendering/SheetSourceTopologyProbe.cs', import.meta.url), 'utf8'),
    readFile(new URL('../../../examples/windows/SheetSourceTopology.cs', import.meta.url), 'utf8'),
    readFile(new URL('./sheet.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../Rendering/SheetFactorySampling.cs', import.meta.url), 'utf8'),
    readFile(new URL('../Rendering/SheetBlurProfile.cs', import.meta.url), 'utf8'),
  ]);
}

function sourceCounterexample(source, original, replacement) {
  const actual = tokens(source);
  const start = tokenIndex(actual, original);
  assert.ok(start >= 0, 'Sheet: source counterexample anchor missing');
  return [
    ...actual.slice(0, start),
    ...tokens(replacement),
    ...actual.slice(start + tokens(original).length),
  ].join(' ');
}

test('actual Sheet graph, owner and twenty ordered cases survive both real wire projectors', async () => {
  assertSheetSourceProjection(...(await topologySources()));
});

test('source gate accepts harmless C# spacing and comments', async () => {
  const files = await topologySources();
  for (const index of [0, 1, 3, 4])
    files[index] =
      `// Healthy formatting control\n${tokens(files[index]).join(' \n\t')}\n/* End */`;
  assertSheetSourceProjection(...files);
});

test('source gate rejects a non-Add operator in the actual flat combiner', async () => {
  const files = await topologySources();
  files[0] = sourceCounterexample(files[0], 'CanvasComposite.Add', 'CanvasComposite.SourceOver');
  assert.throws(() => assertSheetSourceProjection(...files), /actual flat Add combiner changed/);
});

test('source gate rejects a constant sigma in the actual Gaussian branch', async () => {
  const files = await topologySources();
  files[0] = sourceCounterexample(
    files[0],
    '(float)(SheetBlurProfile.Levels[input] * ghostSigma)',
    '3f',
  );
  assert.throws(
    () => assertSheetSourceProjection(...files),
    /actual Gaussian ghost sigma formula changed/,
  );
});

test('source gate rejects removal of owned reverse cleanup', async () => {
  const files = await topologySources();
  files[3] = sourceCounterexample(
    files[3],
    'for (var index = owned.Count - 1; index >= 0; index--) Dispose(owned[index]);',
    '',
  );
  assert.throws(
    () => assertSheetSourceProjection(...files),
    /factory-first and reverse-owned cleanup missing/,
  );
});

function readback(topology) {
  const observation = {
    pid: 42,
    windowHandle: '17',
    observedAtUnixMs: 150,
    theme: 'Light',
    requestedMaterial: 'Blur',
    rendererReady: false,
    error: {
      origin: 'unhandled',
      type: 'ArgumentException',
      hresult: -2147024809,
      site: 'Compositor.CreateEffectFactory',
      topology,
    },
  };
  const line = sheetFailureLog({
    sourceSha: SOURCE,
    name: 'Light-Blur',
    phase: 'render',
    pid: 42,
    observation,
    error: new Error('PRIVATE_STAGE_NOT_FOR_LOG'),
    cleanupError: null,
    stderrBytes: 0,
  });
  assert.doesNotMatch(line, /PRIVATE_STAGE_NOT_FOR_LOG/);
  assert.throws(() => decodeSheetEvidence(line, SOURCE));
  assert.throws(
    () =>
      validateObservation(observation, {
        pid: 42,
        startedAtUnixMs: 100,
        observedUntilUnixMs: 200,
        theme: 'Light',
        material: 'Blur',
      }),
    (failure) => failure.sheetPhase === 'render',
  );
  return JSON.parse(line.slice('LABUI_SHEET_FAILURE_JSON '.length)).observation.error.topology;
}

test('topology stage distinguishes build and factory for the same failure HRESULT', () => {
  const rows = ['build', 'factory'].map((stage) => ({ ...sample, stage }));
  assert.deepEqual(readback(rows), rows);
});

test('topology stage preserves legacy rows without inventing a known operation', () => {
  assert.deepEqual(readback([sample]), [sample]);
  assert.deepEqual(readback([{ ...sample, stage: null }]), [{ ...sample, stage: null }]);
});

test('topology stage accepts only the two closed operation names', () => {
  for (const stage of ['Factory', 'render', 'PRIVATE_STAGE_NOT_FOR_LOG', 42, {}, ['factory']])
    assert.deepEqual(readback([{ ...sample, stage }]), [{ ...sample, stage: null }]);
});

test('balanced Add preserves raw factory success or failure without clearing the primary failure', () => {
  for (const hresult of [0, -2147024809]) {
    const balanced = { ...sample, index: 15, combine: 'BalancedAdd', stage: 'factory', hresult };
    assert.deepEqual(readback([sample, balanced]), [sample, balanced]);
  }
});

test('topology accepts all twenty cases and rejects an oversized diagnostic without truncation', () => {
  const rows = Array.from({ length: 16 }, (_, index) => ({
    ...sample,
    index,
    combine: index === 15 ? 'BalancedAdd' : 'Add',
    mask: index !== 14,
    stage: 'factory',
  }));
  rows.push(
    {
      ...sample,
      index: 16,
      inputs: 1,
      combine: 'Gaussian',
      mask: false,
      stage: 'factory',
      levelStart: 7,
      sigmas: [12],
    },
    {
      ...sample,
      index: 17,
      inputs: 1,
      combine: 'Gaussian',
      mask: false,
      stage: 'factory',
      sigmas: [64],
    },
    { ...sample, index: 18, inputs: 2, stage: 'factory', levelStart: 6, sigmas: [6, 12] },
    { ...sample, index: 19, blur: false, mask: false, stage: 'factory' },
  );
  assert.deepEqual(readback(rows), rows);
  assert.equal(readback([...rows, sample]), null);
});

test('balanced Add retains closed combine names and the index boundary', () => {
  const balanced = { ...sample, index: 15, combine: 'BalancedAdd', stage: 'factory' };
  for (const combine of [
    'balancedAdd',
    'BinaryAdd',
    'PRIVATE_STAGE_NOT_FOR_LOG',
    42,
    {},
    ['BalancedAdd'],
  ])
    assert.deepEqual(readback([{ ...balanced, combine }]), [{ ...balanced, combine: null }]);
  for (const index of [-1, 20, 1.5, '15'])
    assert.deepEqual(readback([{ ...balanced, index }]), [{ ...balanced, index: null }]);
});

test('actual sigma diagnostics preserve only single Gaussian and the selected Add pair', () => {
  for (const hresult of [0, -2147024809]) {
    const rows = [
      {
        ...sample,
        index: 16,
        inputs: 1,
        combine: 'Gaussian',
        mask: false,
        stage: 'factory',
        levelStart: 7,
        sigmas: [12],
        hresult,
      },
      {
        ...sample,
        index: 17,
        inputs: 1,
        combine: 'Gaussian',
        mask: false,
        stage: 'factory',
        sigmas: [64],
        hresult,
      },
      {
        ...sample,
        index: 18,
        inputs: 2,
        stage: 'factory',
        levelStart: 6,
        sigmas: [6, 12],
        hresult,
      },
      { ...sample, index: 19, blur: false, stage: 'factory', hresult },
    ];
    assert.deepEqual(readback(rows), rows);
  }
});

test('sigma diagnostics reject unknown, nonfinite and oversized values while retaining the failure', () => {
  const gaussian = {
    ...sample,
    index: 16,
    inputs: 1,
    combine: 'Gaussian',
    mask: false,
    levelStart: 7,
    sigmas: [12],
  };
  for (const sigmas of [
    null,
    [],
    [1, 2, 3],
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [1e308],
    ['12'],
    [{}],
    new Array(1),
    'PRIVATE_STAGE_NOT_FOR_LOG',
  ])
    assert.deepEqual(readback([{ ...gaussian, sigmas }]), [{ ...gaussian, sigmas: null }]);
  for (const levelStart of [-1, 8, 1.5, '7', {}, null])
    assert.deepEqual(readback([{ ...gaussian, levelStart }]), [{ ...gaussian, levelStart: null }]);
  for (const combine of ['gaussian', 'GaussianBlur', 'PRIVATE_STAGE_NOT_FOR_LOG'])
    assert.deepEqual(readback([{ ...gaussian, combine }]), [{ ...gaussian, combine: null }]);
});
