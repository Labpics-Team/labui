import assert from 'node:assert/strict';

export const POLICY_SCHEMA = 'sheet-policy-v1';
export const POLICY_CASES = Object.freeze([
  Object.freeze({
    name: 'Content-Selector-Retirement',
    theme: 'Light',
    material: 'Solid',
    scenario: 'selector-retirement',
    alignment: 'Stretch',
    state: 'Half',
  }),
  Object.freeze({
    name: 'Content-Flex-Recovery',
    theme: 'Light',
    material: 'Solid',
    scenario: 'flex-recovery',
    alignment: 'Stretch',
    state: 'Flex',
  }),
]);

const SELECTOR_PHASES = [
  'initial-a',
  'content-b',
  'sheet-template',
  'content-a',
  'retired-viewport-template',
];
const FLEX_PHASES = ['empty', 'recovered'];
const PHASES = [...SELECTOR_PHASES, ...FLEX_PHASES];
const WITNESS_FIELDS = ['schema', 'scenario', 'status', 'phase', 'failure', 'steps'];
const STEP_FIELDS = [
  'phase',
  'contentIsNull',
  'contentIsUiElement',
  'bodyHeight',
  'viewport',
  'root',
  'selector',
  'replacement',
];
const SIZE_FIELDS = ['width', 'height'];
const BOUNDS_FIELDS = ['x', 'y', ...SIZE_FIELDS];
const ROOT_FIELDS = [
  'kind',
  'loaded',
  'heightIsAuto',
  'lastMeasure',
  'unboundedWidth',
  'unboundedHeight',
  'actual',
  'desired',
  'layoutSlot',
];
const VIEWPORT_DIMENSIONS = [
  'actualWidth',
  'actualHeight',
  'viewportWidth',
  'viewportHeight',
  'extentWidth',
  'extentHeight',
  'scrollableWidth',
  'scrollableHeight',
];
const VIEWPORT_FIELDS = [
  'loaded',
  'visibility',
  ...VIEWPORT_DIMENSIONS,
  'sizesContentToTemplatedParent',
];
const COUNTERS = [
  'calls',
  'ownerCalls',
  'otherCalls',
  'itemACalls',
  'itemBCalls',
  'otherItemCalls',
  'singleArgumentCalls',
];
const SELECTOR_FIELDS = [...COUNTERS, 'sameSelector', 'rootMatchesContent', 'generatedRootChanged'];
const REPLACEMENT_FIELDS = [
  'sheetTemplatesDiffer',
  'viewportsDiffer',
  'contentPresentersDiffer',
  'scrollPresentersDiffer',
  'retiredViewportLoaded',
  'retiredContentPresenterLoaded',
  'retiredContentCleared',
  'retiredContentTemplateCleared',
  'retiredTemplateChanged',
  'retiredScrollPresentersDiffer',
  'activeContentPreserved',
  'retiredSizesContentToTemplatedParent',
];
const FAILURE_FIELDS = ['phase', 'code', 'type', 'hresult'];
const FAILURE_CODES = ['native-call', 'layout-timeout', 'cancelled'];
const FAILURE_TYPES = [
  'COMException',
  'InvalidOperationException',
  'ArgumentException',
  'TimeoutException',
  'OperationCanceledException',
  'TaskCanceledException',
];
const LIMIT = 1e6;
const EPSILON = 0.01;
const record = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const finiteDimension = (value) => Number.isFinite(value) && value >= 0 && value <= LIMIT;
const finiteCoordinate = (value) => Number.isFinite(value) && Math.abs(value) <= LIMIT;
const counter = (value) => Number.isInteger(value) && value >= 0 && value <= 1024;
const close = (actual, expected) =>
  Number.isFinite(actual) && Math.abs(actual - expected) <= EPSILON;

// Приёмка относится к исходному JSON. Диагностический readback не заменяет её.
export function validatePolicyWitness(value, expected) {
  let phase = 'content-layout';
  let reason = 'объект';
  const require = (condition, message) => {
    reason = message;
    assert.ok(condition, message);
  };
  const keys = (candidate, fields) => {
    require(record(candidate), 'объект');
    const actual = Reflect.ownKeys(candidate);
    require(actual.length === fields.length &&
      actual.every((field) => fields.includes(field)), 'поля');
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, field);
      require(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'JSON-поле');
    }
  };
  const size = (candidate) => {
    keys(candidate, SIZE_FIELDS);
    for (const field of SIZE_FIELDS)
      require(finiteDimension(candidate[field]) && candidate[field] > 0, 'размер корня');
  };
  const viewport = (candidate, empty) => {
    keys(candidate, VIEWPORT_FIELDS);
    require(typeof candidate.loaded === 'boolean', 'loaded viewport');
    require(candidate.visibility === (empty ? 'collapsed' : 'visible'), 'visibility viewport');
    // LabSheet.ConfigureContentViewport владеет этим флагом и для Half, и для Flex.
    require(candidate.sizesContentToTemplatedParent === true, 'конечная политика viewport');
    for (const field of VIEWPORT_DIMENSIONS)
      require((empty && candidate[field] === null) ||
        finiteDimension(candidate[field]), 'размер viewport');
    if (empty) return;
    require(candidate.loaded === true, 'loaded viewport');
    for (const field of ['actualWidth', 'actualHeight', 'viewportWidth', 'viewportHeight'])
      require(candidate[field] > 0, 'реализованный viewport');
    require(candidate.viewportWidth <= candidate.actualWidth + EPSILON &&
      candidate.viewportHeight <= candidate.actualHeight + EPSILON, 'границы viewport');
    require(close(
      candidate.scrollableWidth,
      Math.max(0, candidate.extentWidth - candidate.viewportWidth),
    ) &&
      close(
        candidate.scrollableHeight,
        Math.max(0, candidate.extentHeight - candidate.viewportHeight),
      ), 'extent viewport');
  };
  const root = (candidate, kind, activeViewport) => {
    keys(candidate, ROOT_FIELDS);
    require(candidate.kind === kind, 'тип корня');
    require(candidate.loaded === true &&
      candidate.heightIsAuto === true, 'естественный native корень');
    require(candidate.unboundedWidth === false &&
      candidate.unboundedHeight === false, 'конечное измерение');
    for (const field of ['lastMeasure', 'actual', 'desired']) size(candidate[field]);
    keys(candidate.layoutSlot, BOUNDS_FIELDS);
    for (const field of ['x', 'y'])
      require(finiteCoordinate(candidate.layoutSlot[field]), 'координата native slot');
    for (const field of SIZE_FIELDS)
      require(finiteDimension(candidate.layoutSlot[field]) &&
        candidate.layoutSlot[field] > 0, 'размер native slot');
    require(close(candidate.actual.width, candidate.layoutSlot.width) &&
      close(candidate.actual.height, candidate.layoutSlot.height), 'Stretch native slot');
    require(candidate.lastMeasure.width <=
      activeViewport.actualWidth + EPSILON, 'ширина измерения');
    require(candidate.layoutSlot.x >= -EPSILON &&
      candidate.layoutSlot.y >= -EPSILON &&
      candidate.layoutSlot.x + candidate.layoutSlot.width <= activeViewport.extentWidth + EPSILON &&
      candidate.layoutSlot.y + candidate.layoutSlot.height <=
        activeViewport.extentHeight + EPSILON, 'корень в extent');
  };
  const selector = (candidate, previous, index) => {
    keys(candidate, SELECTOR_FIELDS);
    for (const field of COUNTERS) require(counter(candidate[field]), 'счётчик selector');
    require(candidate.calls > 0 &&
      candidate.calls === candidate.ownerCalls + candidate.otherCalls &&
      candidate.calls ===
        candidate.itemACalls +
          candidate.itemBCalls +
          candidate.otherItemCalls, 'сумма вызовов selector');
    require(candidate.ownerCalls === candidate.calls &&
      candidate.otherCalls === 0 &&
      candidate.otherItemCalls === 0 &&
      candidate.singleArgumentCalls === 0, 'владелец и вход selector');
    require(candidate.sameSelector === true &&
      candidate.rootMatchesContent === true, 'тождество selector и содержимого');
    require(candidate.generatedRootChanged ===
      (index === 0 ? null : index !== 4), 'смена native корня');
    if (previous) {
      for (const field of COUNTERS)
        require(candidate[field] >= previous[field], 'монотонность selector');
      if (index === 1 || index === 2)
        require(candidate.itemBCalls > previous.itemBCalls, 'выбор B');
      if (index === 3) require(candidate.itemACalls > previous.itemACalls, 'повторный выбор A');
    } else require(candidate.itemACalls > 0 && candidate.itemBCalls === 0, 'начальный выбор A');
  };
  const replacement = (candidate, mutated) => {
    keys(candidate, REPLACEMENT_FIELDS);
    for (const field of REPLACEMENT_FIELDS) {
      const expectedValue =
        field === 'retiredViewportLoaded' || field === 'retiredContentPresenterLoaded'
          ? false
          : field === 'retiredTemplateChanged' || field === 'retiredScrollPresentersDiffer'
            ? mutated
            : field === 'retiredSizesContentToTemplatedParent'
              ? !mutated
              : true;
      require(candidate[field] === expectedValue, 'изоляция отставного шаблона');
    }
  };
  try {
    require(record(expected), 'случай');
    const entry = POLICY_CASES.find(({ name }) => name === expected.name);
    require(entry &&
      Object.entries(entry).every(([field, item]) => expected[field] === item), 'случай');
    keys(value, WITNESS_FIELDS);
    require(value.schema === POLICY_SCHEMA &&
      value.scenario === entry.scenario, 'schema и сценарий');
    const phases = entry.scenario === 'selector-retirement' ? SELECTOR_PHASES : FLEX_PHASES;
    if (SELECTOR_PHASES.slice(2).includes(value.phase)) phase = 'content-template';
    require(value.status === 'complete' && value.failure === null, 'завершённая native проба');
    require(value.phase === phases.at(-1), 'финальная фаза');
    require(Array.isArray(value.steps) &&
      value.steps.length === phases.length, 'полная последовательность');
    require(Object.getPrototypeOf(value.steps) === Array.prototype, 'JSON-массив');
    require(Reflect.ownKeys(value.steps).length === phases.length + 1, 'JSON-массив');
    let previousSelector = null;
    let previousBodyHeight = null;
    for (let index = 0; index < phases.length; index++) {
      phase =
        entry.scenario === 'selector-retirement' && index >= 2
          ? 'content-template'
          : 'content-layout';
      const descriptor = Object.getOwnPropertyDescriptor(value.steps, String(index));
      require(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'JSON-шаг');
      const step = descriptor.value;
      keys(step, STEP_FIELDS);
      require(step.phase === phases[index], 'порядок фаз');
      require(finiteDimension(step.bodyHeight) && step.bodyHeight > 0, 'высота body');
      const empty = entry.scenario === 'flex-recovery' && index === 0;
      require(step.contentIsNull === empty &&
        step.contentIsUiElement ===
          (entry.scenario === 'flex-recovery' && !empty), 'вид содержимого');
      viewport(step.viewport, empty);
      if (empty) {
        require(close(step.bodyHeight, 40), 'пустой Flex');
        require(step.root === null &&
          step.selector === null &&
          step.replacement === null, 'пустое содержимое');
        continue;
      }
      // SheetMetrics: 24 drag + 24 gap + 16 inset. Outer validator проверяет clamp и положение body.
      require(close(step.bodyHeight, 64 + step.viewport.actualHeight), 'анатомия body');
      const kind = entry.scenario === 'flex-recovery' ? 'auto' : ['a', 'b', 'b', 'a', 'a'][index];
      root(step.root, kind, step.viewport);
      if (entry.scenario === 'flex-recovery') {
        require(step.selector === null && step.replacement === null, 'UIElement без selector');
        require(step.root.desired.height + EPSILON >=
          step.viewport.actualHeight, 'Flex сохраняет естественную высоту');
      } else {
        selector(step.selector, previousSelector, index);
        previousSelector = step.selector;
        if (previousBodyHeight !== null)
          require(close(step.bodyHeight, previousBodyHeight), 'стабильная геометрия Half');
        previousBodyHeight = step.bodyHeight;
        if (index < 2) require(step.replacement === null, 'шаблон ещё не заменён');
        else replacement(step.replacement, index === 4);
      }
    }
  } catch {
    const error = new assert.AssertionError({
      message: `sheet policy: ${reason}`,
      actual: false,
      expected: true,
      operator: 'strictEqual',
    });
    error.sheetPhase = phase;
    throw error;
  }
  return value;
}

const known = (value, allowed) => (allowed.includes(value) ? value : null);
const boolean = (value) => (typeof value === 'boolean' ? value : null);
const dimension = (value) => (finiteDimension(value) ? value : null);
const coordinate = (value) => (finiteCoordinate(value) ? value : null);
const count = (value) => (counter(value) ? value : null);
const own = (value, field) => {
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const boundedObject = (value, fields, read) =>
  record(value)
    ? Object.fromEntries(fields.map((field) => [field, read(own(value, field), field)]))
    : null;
const sizeReadback = (value) => boundedObject(value, SIZE_FIELDS, dimension);
const rootReadback = (value) =>
  boundedObject(value, ROOT_FIELDS, (item, field) => {
    if (field === 'kind') return known(item, ['a', 'b', 'auto']);
    if (field === 'lastMeasure' || field === 'actual' || field === 'desired')
      return sizeReadback(item);
    if (field === 'layoutSlot')
      return boundedObject(item, BOUNDS_FIELDS, (number, key) =>
        key === 'x' || key === 'y' ? coordinate(number) : dimension(number),
      );
    return boolean(item);
  });
const stepReadback = (value) =>
  boundedObject(value, STEP_FIELDS, (item, field) => {
    if (field === 'phase') return known(item, PHASES);
    if (field === 'bodyHeight') return dimension(item);
    if (field === 'viewport')
      return boundedObject(item, VIEWPORT_FIELDS, (observed, key) =>
        key === 'visibility'
          ? known(observed, ['visible', 'collapsed'])
          : key === 'loaded' || key === 'sizesContentToTemplatedParent'
            ? boolean(observed)
            : dimension(observed),
      );
    if (field === 'root') return rootReadback(item);
    if (field === 'selector')
      return boundedObject(item, SELECTOR_FIELDS, (observed, key) =>
        COUNTERS.includes(key) ? count(observed) : boolean(observed),
      );
    if (field === 'replacement') return boundedObject(item, REPLACEMENT_FIELDS, boolean);
    return boolean(item);
  });

// Сохраняется только закрытый и ограниченный readback, включая неудачные и частичные наблюдения.
export function policyReadback(value) {
  return boundedObject(value, WITNESS_FIELDS, (item, field) => {
    if (field === 'schema') return known(item, [POLICY_SCHEMA]);
    if (field === 'scenario') return known(item, ['selector-retirement', 'flex-recovery']);
    if (field === 'status') return known(item, ['pending', 'complete', 'failed']);
    if (field === 'phase') return known(item, PHASES);
    if (field === 'failure')
      return boundedObject(item, FAILURE_FIELDS, (observed, key) =>
        key === 'phase'
          ? known(observed, PHASES)
          : key === 'code'
            ? known(observed, FAILURE_CODES)
            : key === 'type'
              ? known(observed, FAILURE_TYPES)
              : Number.isInteger(observed) && observed >= -2147483648 && observed <= 2147483647
                ? observed
                : null,
      );
    return Array.isArray(item)
      ? Array.from({ length: Math.min(item.length, 5) }, (_, index) =>
          stepReadback(own(item, String(index))),
        )
      : null;
  });
}
