import assert from 'node:assert/strict';

export const CONTENT_CASES = Object.freeze([
  Object.freeze({
    name: 'Content-Long-Stretch',
    theme: 'Light',
    material: 'Solid',
    scenario: 'long',
    alignment: 'Stretch',
  }),
  Object.freeze({
    name: 'Content-Long-Top',
    theme: 'Light',
    material: 'Solid',
    scenario: 'long',
    alignment: 'Top',
  }),
  Object.freeze({
    name: 'Content-List',
    theme: 'Light',
    material: 'Solid',
    scenario: 'list',
    alignment: 'Stretch',
  }),
]);
const SAMPLE_FIELDS = [
  'scenario',
  'contentType',
  'alignment',
  'heightIsAuto',
  'itemCount',
  'rowHeight',
  'lastMeasure',
  'unboundedWidth',
  'unboundedHeight',
  'contentLoaded',
  'actualHeight',
  'desiredHeight',
  'outer',
  'inner',
  'realizedItems',
  'lastRow',
  'observedAtUnixMs',
];
const SCROLL_FIELDS = [
  'extentHeight',
  'viewportHeight',
  'scrollableHeight',
  'verticalOffset',
  'sizesContentToTemplatedParent',
];
const CHANGE_FIELDS = [
  'targetOffset',
  'accepted',
  'settled',
  'finalEvents',
  'beforeOffset',
  'afterOffset',
];
const REPLACEMENT_FIELDS = [
  'presentersDiffer',
  'sameContent',
  'previousPresenterLoaded',
  'previousSizesContentToTemplatedParent',
  'currentSizesContentToTemplatedParent',
];
const PHASES = [
  'initial-layout',
  'initial-scroll',
  'template',
  'replacement-layout',
  'replacement-scroll',
];
const near = (actual, expected) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= 0.01,
    'sheet content: размер или offset',
  );
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, fields) => {
  assert.ok(object(value), 'sheet content: объект');
  assert.deepEqual(Object.keys(value).sort(), [...fields].sort(), 'sheet content: поля');
};
const dimension = (value) =>
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1e6, 'sheet content: конечный размер');
const instant = (value, start, end) =>
  assert.ok(
    Number.isSafeInteger(value) && value >= start && value <= end,
    'sheet content: время native readback',
  );

function scroll(value, finitePolicy) {
  keys(value, SCROLL_FIELDS);
  for (const field of SCROLL_FIELDS.slice(0, 4)) dimension(value[field]);
  assert.ok(value.viewportHeight > 0);
  near(value.scrollableHeight, Math.max(0, value.extentHeight - value.viewportHeight));
  assert.ok(value.verticalOffset <= value.scrollableHeight + 0.01);
  assert.equal(value.sizesContentToTemplatedParent, finitePolicy);
}

function sample(value, entry, start, end, qualified = false) {
  keys(value, qualified ? [...SAMPLE_FIELDS, 'qualification'] : SAMPLE_FIELDS);
  const isList = entry.scenario === 'list';
  assert.equal(value.scenario, entry.scenario);
  assert.equal(value.contentType, isList ? 'ListView' : 'StackPanel');
  assert.equal(value.alignment, entry.alignment);
  assert.equal(value.heightIsAuto, true, 'sheet content: потребителю назначен Height');
  assert.equal(value.itemCount, isList ? 1000 : 30);
  assert.equal(value.rowHeight, isList ? null : 100);
  keys(value.lastMeasure, ['width', 'height']);
  near(value.lastMeasure.width, 343);
  near(value.lastMeasure.height, 358);
  for (const field of ['unboundedWidth', 'unboundedHeight']) assert.equal(value[field], false);
  assert.equal(value.contentLoaded, true);
  dimension(value.actualHeight);
  dimension(value.desiredHeight);
  instant(value.observedAtUnixMs, start, end);
  scroll(value.outer, true);
  near(value.outer.viewportHeight, 358);
  if (isList) {
    near(value.outer.extentHeight, 358);
    near(value.outer.verticalOffset, 0);
    scroll(value.inner, false);
    assert.ok(
      value.inner.viewportHeight <= 358.01 && value.inner.extentHeight > value.inner.viewportHeight,
    );
    assert.ok(
      Number.isInteger(value.realizedItems) &&
        value.realizedItems > 0 &&
        value.realizedItems < 1000,
      'sheet content: ListView не сохранил частичную реализацию',
    );
  } else {
    near(value.outer.extentHeight, 3000);
    assert.equal(value.inner, null);
    assert.equal(value.realizedItems, null);
  }
  keys(value.lastRow, ['realized', 'bounds']);
  assert.equal(typeof value.lastRow.realized, 'boolean');
  if (!isList) assert.equal(value.lastRow.realized, true);
  if (value.lastRow.realized) {
    keys(value.lastRow.bounds, ['x', 'y', 'width', 'height']);
    for (const field of ['x', 'y'])
      assert.ok(
        Number.isFinite(value.lastRow.bounds[field]) &&
          Math.abs(value.lastRow.bounds[field]) <= 1e6,
      );
    for (const field of ['width', 'height']) {
      dimension(value.lastRow.bounds[field]);
      assert.ok(value.lastRow.bounds[field] > 0);
    }
    if (!isList) near(value.lastRow.bounds.height, 100);
  } else assert.equal(value.lastRow.bounds, null);
}

function change(value) {
  keys(value, CHANGE_FIELDS);
  assert.equal(value.accepted, true, 'sheet content: ChangeView отказал');
  assert.equal(value.settled, true, 'sheet content: ChangeView не завершился');
  assert.ok(
    Number.isInteger(value.finalEvents) && value.finalEvents >= 0 && value.finalEvents <= 1024,
  );
  for (const field of ['targetOffset', 'beforeOffset', 'afterOffset']) dimension(value[field]);
}

function reached(value, entry) {
  const scroller = entry.scenario === 'list' ? value.inner : value.outer;
  assert.ok(scroller.verticalOffset > 0, 'sheet content: положительный offset отсутствует');
  if (entry.scenario !== 'list') {
    const bounds = value.lastRow.bounds;
    assert.ok(
      bounds.y >= -0.01 && bounds.y + bounds.height <= scroller.viewportHeight + 0.01,
      'sheet content: последняя строка не достигнута',
    );
  }
  return scroller;
}

export function validateContentWitness(value, expected) {
  let phase = 'content-layout';
  try {
    const entry = CONTENT_CASES.find(({ name }) => name === expected.name);
    assert.ok(
      entry && entry.scenario === expected.scenario && entry.alignment === expected.alignment,
    );
    keys(value, [
      'pid',
      'windowHandle',
      'observedAtUnixMs',
      'theme',
      'rasterizationScale',
      'viewport',
      'body',
      'handle',
      'layoutReady',
      'imageLoaded',
      'rendererReady',
      'requestedMaterial',
      'requestedState',
      'geometryScale',
      'contentViewport',
      'contentWitness',
      'effectiveMaterial',
      'materialReason',
      'error',
      ...(Object.hasOwn(value, 'windowGeometry') ? ['windowGeometry'] : []),
    ]);
    assert.equal(value.requestedState, 'Half');
    assert.equal(value.geometryScale, 1);
    assert.ok(
      value.materialReason === null ||
        ['Requested', 'TransparencyDisabled', 'EffectsUnsupported', 'EffectsNotFast'].includes(
          value.materialReason,
        ),
    );
    for (const field of ['viewport', 'body', 'handle', 'contentViewport'])
      keys(value[field], ['x', 'y', 'width', 'height']);
    for (const [field, expectedValue] of Object.entries({ x: 16, y: 438, width: 343, height: 358 }))
      near(value.contentViewport[field], expectedValue);
    const witness = value.contentWitness;
    sample(witness, entry, expected.startedAtUnixMs, value.observedAtUnixMs, true);
    const qualification = witness.qualification;
    keys(qualification, ['schema', 'status', 'phase', 'failure', 'reset', 'replacement', 'cycles']);
    assert.equal(qualification.schema, 'sheet-content-v1');
    assert.equal(qualification.status, 'complete');
    assert.equal(qualification.failure, null);
    assert.equal(qualification.phase, 'replacement-scroll');
    assert.ok(Array.isArray(qualification.cycles) && qualification.cycles.length === 2);
    let previousTime = expected.startedAtUnixMs;
    for (const [index, cycle] of qualification.cycles.entries()) {
      phase = 'content-layout';
      keys(cycle, ['template', 'before', 'changeView', 'after']);
      assert.equal(cycle.template, index === 0 ? 'initial' : 'replaced');
      sample(cycle.before, entry, previousTime, value.observedAtUnixMs);
      sample(cycle.after, entry, cycle.before.observedAtUnixMs, value.observedAtUnixMs);
      previousTime = cycle.after.observedAtUnixMs;
      phase = 'content-scroll';
      change(cycle.changeView);
      const before = entry.scenario === 'list' ? cycle.before.inner : cycle.before.outer;
      const after = reached(cycle.after, entry);
      near(before.verticalOffset, 0);
      near(cycle.changeView.beforeOffset, before.verticalOffset);
      near(cycle.changeView.targetOffset, before.scrollableHeight);
      near(cycle.changeView.afterOffset, after.verticalOffset);
      near(cycle.changeView.afterOffset, cycle.changeView.targetOffset);
    }
    phase = 'content-template';
    keys(qualification.replacement, REPLACEMENT_FIELDS);
    for (const field of REPLACEMENT_FIELDS)
      assert.equal(qualification.replacement[field], field !== 'previousPresenterLoaded');
    change(qualification.reset);
    near(qualification.reset.targetOffset, 0);
    near(qualification.reset.afterOffset, 0);
    const first = qualification.cycles[0].changeView;
    near(qualification.reset.beforeOffset, first.afterOffset);
    phase = 'content-scroll';
    instant(witness.observedAtUnixMs, previousTime, value.observedAtUnixMs);
    reached(witness, entry);
  } catch (error) {
    error.sheetPhase = phase;
    throw error;
  }
  return value;
}

const known = (value, allowed) => (allowed.includes(value) ? value : null);
const finite = (value) => (Number.isFinite(value) && Math.abs(value) <= 1e6 ? value : null);
const boolean = (value) => (typeof value === 'boolean' ? value : null);
const time = (value) => (Number.isSafeInteger(value) && value > 0 ? value : null);
const boundedObject = (value, fields, read) =>
  object(value)
    ? Object.fromEntries(fields.map((field) => [field, read(value[field], field)]))
    : null;
const bounds = (value) => boundedObject(value, ['x', 'y', 'width', 'height'], finite);
const scrollReadback = (value) =>
  boundedObject(value, SCROLL_FIELDS, (fieldValue, field) =>
    field === 'sizesContentToTemplatedParent' ? boolean(fieldValue) : finite(fieldValue),
  );
const changeReadback = (value) =>
  boundedObject(value, CHANGE_FIELDS, (fieldValue, field) =>
    ['accepted', 'settled'].includes(field)
      ? boolean(fieldValue)
      : field === 'finalEvents'
        ? Number.isInteger(fieldValue) && fieldValue >= 0 && fieldValue <= 1024
          ? fieldValue
          : null
        : finite(fieldValue),
  );

function sampleReadback(value) {
  if (!object(value)) return null;
  return {
    scenario: known(value.scenario, ['long', 'short', 'list']),
    contentType: known(value.contentType, ['StackPanel', 'ListView']),
    alignment: known(value.alignment, ['Stretch', 'Top']),
    heightIsAuto: boolean(value.heightIsAuto),
    itemCount:
      Number.isInteger(value.itemCount) && value.itemCount >= 0 && value.itemCount <= 1000
        ? value.itemCount
        : null,
    rowHeight: finite(value.rowHeight),
    lastMeasure: boundedObject(value.lastMeasure, ['width', 'height'], finite),
    unboundedWidth: boolean(value.unboundedWidth),
    unboundedHeight: boolean(value.unboundedHeight),
    contentLoaded: boolean(value.contentLoaded),
    actualHeight: finite(value.actualHeight),
    desiredHeight: finite(value.desiredHeight),
    outer: scrollReadback(value.outer),
    inner: scrollReadback(value.inner),
    realizedItems:
      Number.isInteger(value.realizedItems) &&
      value.realizedItems >= 0 &&
      value.realizedItems <= 1000
        ? value.realizedItems
        : null,
    lastRow: object(value.lastRow)
      ? { realized: boolean(value.lastRow.realized), bounds: bounds(value.lastRow.bounds) }
      : null,
    observedAtUnixMs: time(value.observedAtUnixMs),
  };
}

// Диагностика сохраняет ограниченный native readback, исключая текст ошибок и произвольные поля.
export function contentReadback(value) {
  const readback = sampleReadback(value);
  if (readback === null) return null;
  const qualification = value.qualification;
  readback.qualification = object(qualification)
    ? {
        schema: known(qualification.schema, ['sheet-content-v1']),
        status: known(qualification.status, ['pending', 'complete', 'failed']),
        phase: known(qualification.phase, PHASES),
        failure: object(qualification.failure)
          ? {
              phase: known(qualification.failure.phase, PHASES),
              code: known(qualification.failure.code, [
                'cancelled',
                'layout-timeout',
                'native-call',
              ]),
              type: known(qualification.failure.type, [
                'COMException',
                'InvalidOperationException',
                'ArgumentException',
                'TimeoutException',
                'OperationCanceledException',
                'TaskCanceledException',
              ]),
              hresult:
                Number.isInteger(qualification.failure.hresult) &&
                qualification.failure.hresult >= -2147483648 &&
                qualification.failure.hresult <= 2147483647
                  ? qualification.failure.hresult
                  : null,
            }
          : null,
        reset: changeReadback(qualification.reset),
        replacement: boundedObject(qualification.replacement, REPLACEMENT_FIELDS, boolean),
        cycles: Array.isArray(qualification.cycles)
          ? qualification.cycles.slice(0, 2).map((cycle) => ({
              template: known(cycle?.template, ['initial', 'replaced']),
              before: sampleReadback(cycle?.before),
              changeView: changeReadback(cycle?.changeView),
              after: sampleReadback(cycle?.after),
            }))
          : null,
      }
    : null;
  return readback;
}
