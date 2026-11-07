const revisionLimit = (1n << 64n) - 1n;

/** Загрузчик использует единственную инициализацию WASM, принадлежащую пакету Colors. */
export async function loadColors({ signal, wasmUrl } = {}) {
  signal?.throwIfAborted();
  const [owner, v1, v3] = await Promise.all([
    import('@labpics/colors'),
    import('@labpics/colors/program-wire/abi-v1.js'),
    import('@labpics/colors/program-wire/abi-v3.js'),
  ]);
  signal?.throwIfAborted();
  if (wasmUrl !== undefined) {
    const response = await fetch(wasmUrl, { signal });
    if (!response.ok) throw new Error(`WASM: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    signal?.throwIfAborted();
    await owner.default({ module_or_path: bytes });
  } else {
    await owner.default();
  }
  signal?.throwIfAborted();
  return { owner, abi: { ...v1, ...v3 } };
}

export function observationKey(observation) {
  if (observation.kind === 'unknown') return `unknown:${observation.reason}`;
  const surface = observation.surface;
  if (
    observation.kind !== 'observed' ||
    !surface ||
    surface.length !== 3 ||
    ![...surface].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
  ) {
    throw new Error('наблюдение должно содержать один явный sRGB8 backdrop');
  }
  return `observed:${[...surface].join(',')}`;
}

export function nextRevision(attachment) {
  if (attachment.revision === revisionLimit) throw new Error('revision исчерпана');
  return ++attachment.revision;
}
