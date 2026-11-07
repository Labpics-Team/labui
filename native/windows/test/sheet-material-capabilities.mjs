import assert from 'node:assert/strict';

const FIELDS = ['advancedEffectsEnabled', 'areEffectsSupported', 'areEffectsFast'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const boolean = (value) => value === null || typeof value === 'boolean';

export function validateMaterialCapabilities(value) {
  if (value === null) return value;
  assert.ok(object(value), 'sheet capabilities: объект');
  const actual = Reflect.ownKeys(value);
  assert.ok(
    actual.length === FIELDS.length &&
      actual.every((name) => typeof name === 'string' && FIELDS.includes(name)),
    'sheet capabilities: поля JSON',
  );
  for (const name of FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    assert.ok(
      descriptor?.enumerable && Object.hasOwn(descriptor, 'value'),
      'sheet capabilities: поле JSON',
    );
    assert.ok(boolean(descriptor.value), 'sheet capabilities: boolean/null');
  }
  return value;
}

export function materialCapabilitiesReadback(value) {
  if (!object(value)) return null;
  return Object.fromEntries(
    FIELDS.map((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      const fact = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
      return [name, boolean(fact) ? fact : null];
    }),
  );
}
