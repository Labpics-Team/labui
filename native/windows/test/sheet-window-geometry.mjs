import assert from 'node:assert/strict';

const STAGES = ['afterResize', 'afterActivation', 'observed'];
const COMPLETE_FIELDS = [
  'status',
  'client',
  'frame',
  'workArea',
  'outerBounds',
  'presenter',
  'visible',
  'extendsContentIntoTitleBar',
];
const PRESENTERS = ['Overlapped', 'CompactOverlay', 'FullScreen'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const coordinate = (value) => Number.isSafeInteger(value) && Math.abs(value) <= 1e7;
const hresult = (value) => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
const type = (value) => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(value);
const field = (value, name) => {
  if (!object(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const keys = (value, names) => {
  assert.ok(object(value), 'sheet window: объект');
  const actual = Reflect.ownKeys(value);
  assert.ok(
    actual.length === names.length &&
      actual.every((name) => typeof name === 'string' && names.includes(name)) &&
      names.every((name) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        return descriptor?.enumerable && Object.hasOwn(descriptor, 'value');
      }),
    'sheet window: поля JSON',
  );
};

function bounds(value, position = true) {
  keys(value, position ? ['x', 'y', 'width', 'height'] : ['width', 'height']);
  for (const name of position ? ['x', 'y', 'width', 'height'] : ['width', 'height'])
    assert.ok(coordinate(value[name]), 'sheet window: конечные координаты');
  assert.ok(value.width >= 0 && value.height >= 0, 'sheet window: неотрицательный размер');
}

export function validateWindowGeometry(value) {
  keys(value, STAGES);
  for (const name of STAGES) {
    const sample = value[name];
    if (sample === null) continue;
    if (field(sample, 'status') === 'failed') {
      keys(sample, ['status', 'type', 'hresult']);
      assert.ok(type(sample.type) && hresult(sample.hresult), 'sheet window: ограниченный отказ');
      continue;
    }
    keys(sample, COMPLETE_FIELDS);
    assert.ok(sample.status === 'complete', 'sheet window: status');
    bounds(sample.client, false);
    for (const part of ['frame', 'workArea', 'outerBounds']) bounds(sample[part]);
    assert.ok(PRESENTERS.includes(sample.presenter), 'sheet window: presenter');
    assert.ok(
      typeof sample.visible === 'boolean' && typeof sample.extendsContentIntoTitleBar === 'boolean',
      'sheet window: признаки окна',
    );
  }
  return value;
}

export function windowGeometryReadback(value) {
  const fields = (entry, names) =>
    object(entry)
      ? Object.fromEntries(
          names.map((name) => {
            const value = field(entry, name);
            return [name, coordinate(value) ? value : null];
          }),
        )
      : null;
  const sample = (entry) => {
    if (!object(entry)) return null;
    const status = field(entry, 'status');
    if (status === 'failed') {
      const errorType = field(entry, 'type');
      const errorHresult = field(entry, 'hresult');
      return {
        status: 'failed',
        type: type(errorType) ? errorType : null,
        hresult: hresult(errorHresult) ? errorHresult : null,
      };
    }
    const presenter = field(entry, 'presenter');
    const visible = field(entry, 'visible');
    const extendsContentIntoTitleBar = field(entry, 'extendsContentIntoTitleBar');
    return {
      status: status === 'complete' ? status : null,
      client: fields(field(entry, 'client'), ['width', 'height']),
      frame: fields(field(entry, 'frame'), ['x', 'y', 'width', 'height']),
      workArea: fields(field(entry, 'workArea'), ['x', 'y', 'width', 'height']),
      outerBounds: fields(field(entry, 'outerBounds'), ['x', 'y', 'width', 'height']),
      presenter: PRESENTERS.includes(presenter) ? presenter : null,
      visible: typeof visible === 'boolean' ? visible : null,
      extendsContentIntoTitleBar:
        typeof extendsContentIntoTitleBar === 'boolean' ? extendsContentIntoTitleBar : null,
    };
  };
  return object(value)
    ? Object.fromEntries(STAGES.map((name) => [name, sample(field(value, name))]))
    : null;
}
