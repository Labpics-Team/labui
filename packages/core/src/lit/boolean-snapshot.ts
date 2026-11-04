import type { ReactiveElement } from 'lit';

/** Внутренний формат core: серверный HTML и клиент должны быть одной версии. */
export const booleanSnapshotAttribute = 'data-lab-ssr-b1';

function isPublicBoolean(ctor: typeof ReactiveElement, name: string): boolean {
  if (name === '__proto__' || name === 'prototype' || name === 'constructor') return false;
  const options = ctor.elementProperties.get(name);
  return options?.type === Boolean && options.state !== true;
}

/** Наблюдение существует только между SSR-снимком и первым update. */
export function captureBooleanWrites(
  element: ReactiveElement,
): () => ReadonlyMap<string, unknown> | undefined {
  const ctor = element.constructor as typeof ReactiveElement;
  let writes: Map<string, unknown> | undefined;
  const record = (name: string, value: unknown): void => {
    writes ??= new Map();
    writes.set(name, value);
  };
  const captures: Array<{
    name: string;
    descriptor: PropertyDescriptor;
    restore: () => void;
  }> = [];

  // Проверяем весь набор до установки. Читаем реальные descriptors: standard
  // decorators и noAccessor не проходят через Lit.getPropertyDescriptor.
  for (const name of ctor.elementProperties.keys()) {
    if (typeof name !== 'string' || !isPublicBoolean(ctor, name)) continue;
    const own = Object.getOwnPropertyDescriptor(element, name);
    if ((own && !own.configurable) || (!own && !Object.isExtensible(element))) {
      throw new TypeError(`LabUI SSR: Boolean property ${name} cannot be observed before update.`);
    }
    let descriptor = own;
    for (
      let prototype = Object.getPrototypeOf(element);
      !descriptor && prototype !== null;
      prototype = Object.getPrototypeOf(prototype)
    ) {
      descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    }

    const data = !descriptor || 'value' in descriptor;
    let current: unknown = data ? descriptor?.value : undefined;
    let written = false;
    const get = data ? () => current : descriptor?.get;
    const setter = descriptor?.set;
    const set = data
      ? descriptor?.writable === false
        ? undefined
        : (value: unknown): void => {
            current = value;
            written = true;
            record(name, current);
          }
      : setter
        ? function (this: ReactiveElement, value: unknown): void {
            setter.call(this, value);
            if (this === element) record(name, get?.call(this));
          }
        : undefined;

    captures.push({
      name,
      descriptor: {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get,
        set,
      },
      restore: () => {
        if (own) {
          Object.defineProperty(element, name, data ? { ...own, value: current } : own);
        } else {
          Reflect.deleteProperty(element, name);
          if (data && written) {
            Object.defineProperty(element, name, {
              configurable: true,
              enumerable: true,
              writable: true,
              value: current,
            });
          }
        }
      },
    });
  }

  let installed = 0;
  const restore = (): void => {
    while (installed > 0) captures[--installed]?.restore();
  };
  try {
    for (const capture of captures) {
      Object.defineProperty(element, capture.name, capture.descriptor);
      installed++;
    }
  } catch (error) {
    restore();
    throw error;
  }
  return () => {
    restore();
    return writes;
  };
}

/** Снимок снимается после server willUpdate; undefined остаётся незаданным. */
export function serializeBooleanSnapshot(element: ReactiveElement): string | undefined {
  const ctor = element.constructor as typeof ReactiveElement;
  const entries: Array<[string, boolean]> = [];
  for (const name of ctor.elementProperties.keys()) {
    if (typeof name !== 'string' || !isPublicBoolean(ctor, name)) continue;
    const value: unknown = Reflect.get(element, name);
    if (value === undefined) continue;
    if (typeof value !== 'boolean') {
      throw new TypeError(`LabUI SSR: ${name} must be a Boolean.`);
    }
    entries.push([name, value]);
  }
  return entries.length ? JSON.stringify(entries) : undefined;
}

/** Проверка всего payload предшествует любому присваиванию элементу. */
export function parseBooleanSnapshot(
  ctor: typeof ReactiveElement,
  value: string,
): ReadonlyMap<string, boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError('LabUI SSR: invalid Boolean snapshot JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError('LabUI SSR: Boolean snapshot must be an array.');
  }
  const entries = new Map<string, boolean>();
  for (const entry of parsed) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      typeof entry[1] !== 'boolean' ||
      !isPublicBoolean(ctor, entry[0]) ||
      entries.has(entry[0])
    ) {
      throw new TypeError('LabUI SSR: invalid or duplicate Boolean snapshot property.');
    }
    entries.set(entry[0], entry[1]);
  }
  return entries;
}
