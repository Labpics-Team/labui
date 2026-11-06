export function declaration({ transparent = false } = {}) {
  const selected = {
    paints: new Map([
      ['bg-tone-1', { source: 'paper', opacity: transparent ? 0 : 1 }],
      ['label-primary', { source: 'ink', opacity: 1 }],
      ['locked', { source: 'identity', opacity: 0.5 }],
    ]),
    composites: new Map([
      ['bg-tone-2', { source: 'ink', opacity: 0.1 }],
      ['bg-tone-3', { source: 'ink', opacity: 0.2 }],
    ]),
    aliases: new Map([['label', 'label-primary']]),
    computed: new Map(),
    constraints: [
      { foreground: 'label-primary', background: 'bg-tone-1', criterion: 'text', hard: true },
    ],
    pending: [],
    background: 'paper',
    tone: { source: 'ink', alpha: [0.1, 0.2] },
  };
  return {
    sources: { paper: [255, 255, 255], ink: [128, 128, 128], identity: [10, 20, 30] },
    themes: { light: selected, dark: selected },
    observation: { adaptingLuminance: 64, backgroundRatio: 0.2, surround: 'average' },
    policy: { contrast: 'authored-normal', assignment: 'preserve-authored' },
  };
}

/** Записывает только декларацию; это не double численного resolver. */
export function recorderAbi() {
  const instances = [];
  class Builder {
    constructor() {
      this.rows = [];
      instances.push(this);
    }
    finish() {
      return new Uint8Array([1]);
    }
  }
  const methods = [
    'surfaceInputPort',
    'inputSurface',
    'source',
    'fixedTarget',
    'computedTarget',
    'solidPaint',
    'opacityInput',
    'opacityPaint',
    'sourceOverOccurrence',
    'occurrenceSurface',
    'presentationRoot',
    'presentationTarget',
    'wcag22VisibleUnary',
    'assignment',
    'output',
  ];
  for (const name of methods)
    Builder.prototype[name] = function (...args) {
      this.rows.push([name, ...args]);
      return this;
    };
  return {
    instances,
    ProgramWireBuilderV1: Builder,
    ProgramWireBuilderV3: Builder,
    SURROUND_AVERAGE_V1: 1,
    SURROUND_DIM_V1: 2,
    SURROUND_DARK_V1: 3,
    WCAG22_SC143_TEXT_DEFAULT_V1: 1,
    WCAG22_SC1411_UI_COMPONENT_OR_STATE_V1: 2,
  };
}

export function unboundPresentations(rows) {
  const occurrences = new Map(
    rows.filter(([kind]) => kind === 'sourceOverOccurrence').map(([, id, paint]) => [id, paint]),
  );
  const outputs = new Set(rows.filter(([kind]) => kind === 'output').map(([, , paint]) => paint));
  return rows
    .filter(([kind]) => kind === 'presentationTarget')
    .filter(([, , occurrence]) => !outputs.has(occurrences.get(occurrence)));
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
