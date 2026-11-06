import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const HASH = /^[a-f0-9]{64}$/;
const PRIVATE_FIELDS = new Set(['fileKey', 'nodeId']);
const hash = (value) => createHash('sha256').update(value).digest('hex');

// JSON.parse owns grammar; decoded object names are checked before its lossy parse.
export function parseIconsJson(bytes) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
  if (Buffer.isBuffer(bytes))
    assert.ok(Buffer.from(text).equals(bytes), 'icons: JSON requires UTF-8');
  const stack = [];
  try {
    for (const [token] of text.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\]:,]|[^\s{}\[\]:,"]+/g)) {
      if (token === '{') stack.push({ object: true, names: new Set(), key: true });
      else if (token === '[') stack.push({ object: false });
      else if (token === '}' || token === ']') stack.pop();
      else if (token === ',' && stack.at(-1)?.object) stack.at(-1).key = true;
      else if (token.startsWith('"') && stack.at(-1)?.object && stack.at(-1).key) {
        const frame = stack.at(-1);
        const name = JSON.parse(token);
        assert.ok(!frame.names.has(name), 'icons: repeated JSON member name');
        frame.names.add(name);
        frame.key = false;
      }
    }
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    throw new Error('icons: invalid JSON');
  }
}

function decodedText(value) {
  let result = value;
  // Decode valid segments, so an ordinary "50%" cannot hide a neighboring escape.
  // Every supported layer is inspected within eight passes; deeper input refuses.
  for (let count = 0; count < 8; count++) {
    const unicode = result.replace(/\\u([a-f0-9]{4})/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
    const decoded = unicode.replace(/(?:%[a-f0-9]{2})+/gi, (segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        throw new Error('icons: ambiguous encoded provenance refused');
      }
    });
    if (decoded === result) return result;
    result = decoded;
  }
  assert.ok(
    !/\\u[a-f0-9]{4}|%[a-f0-9]{2}/i.test(result),
    'icons: provenance encoding depth refused',
  );
  return result;
}

function sourcePinFields(pin) {
  assert.ok(pin && typeof pin === 'object' && !Array.isArray(pin), 'pin: source object');
  assert.ok(
    Object.keys(pin).sort().join(',') === 'figma,repository,schemaVersion,sourceCommit',
    'pin: source fields',
  );
  assert.ok(pin.schemaVersion === 2, 'pin: public schema required');
  assert.ok(pin.repository === 'Labpics-Team/lab-icons', 'pin: source repository');
  assert.ok(/^[a-f0-9]{40}$/.test(pin.sourceCommit), 'pin: immutable source commit');
  assert.ok(
    Object.keys(pin.figma ?? {})
      .sort()
      .join(',') === 'fileKeyLength,fileKeySha256,version',
    'icons: publication identity policy incomplete',
  );
  assert.ok(HASH.test(pin.figma.fileKeySha256), 'icons: publication identity digest invalid');
  assert.ok(
    Number.isSafeInteger(pin.figma.fileKeyLength) && pin.figma.fileKeyLength > 0,
    'icons: publication identity length invalid',
  );
  assert.ok(/^\d+$/.test(pin.figma.version), 'pin: source version');
  return pin;
}

function publicationPolicy() {
  let pin;
  try {
    pin = sourcePinFields(
      parseIconsJson(readFileSync(new URL('./icons-consumer-source.json', import.meta.url))),
    );
  } catch {
    throw new Error('icons: publication policy unavailable or invalid');
  }
  return Object.freeze({ digest: pin.figma.fileKeySha256, length: pin.figma.fileKeyLength });
}

const PUBLICATION_POLICY = publicationPolicy();

function freezeContract(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeContract);
    Object.freeze(value);
  }
  return value;
}
export const PUBLIC_STATE_GROUPS = freezeContract({
  'status-circle': {
    defaultState: 'question',
    enclosurePartId: 'status-enclosure',
    states: ['attention', 'confirmation', 'decrease', 'dismissal', 'increase', 'question'],
    sharedParts: [{ id: 'status-enclosure', role: 'container' }],
    icons: {
      attention: 'alert-circle',
      confirmation: 'checkmark-circle',
      decrease: 'minus-circle',
      dismissal: 'close-circle',
      increase: 'plus-circle',
      question: 'question-circle',
    },
    contentPartIds: {
      attention: ['attention-dot', 'attention-stem'],
      confirmation: ['confirmation-mark'],
      decrease: ['decrease-mark'],
      dismissal: ['dismissal-mark'],
      increase: ['increase-mark'],
      question: ['question-dot', 'question-stem'],
    },
    buttonLabel: 'Сменить знак',
    selectLabel: 'Состояние знака',
    labels: {
      attention: 'Внимание',
      confirmation: 'Подтверждение',
      decrease: 'Уменьшение',
      dismissal: 'Закрытие',
      increase: 'Увеличение',
      question: 'Вопрос',
    },
  },
  'expression-face': {
    defaultState: 'aloof',
    enclosurePartId: 'face-enclosure',
    states: ['aloof', 'sad', 'smile'],
    sharedParts: [
      { id: 'face-left-eye', role: 'content' },
      { id: 'face-right-eye', role: 'content' },
      { id: 'face-enclosure', role: 'container' },
    ],
    icons: { aloof: 'aloof', sad: 'sad', smile: 'smile' },
    contentPartIds: { aloof: ['aloof-mouth'], sad: ['sad-mouth'], smile: ['smile-mouth'] },
    buttonLabel: 'Сменить выражение',
    selectLabel: 'Выражение лица',
    labels: { aloof: 'Спокойствие', sad: 'Грусть', smile: 'Улыбка' },
  },
});
export const PUBLIC_ENTRIES = Object.freeze([
  '@labpics/ui-core/button',
  '@labpics/icons/symbols/reload',
  '@labpics/motion',
  '@labpics/icons/states/status-circle',
  '@labpics/icons/states/expression-face',
]);
export const PUBLIC_SCENARIO =
  'LabUI icon-only buttons, reload Outline/Filled и status-circle при schema2, публичный Lab Motion; размер полного consumer без baseline speedup claim';
export const PUBLIC_QUALIFICATION =
  'Три заданных архива и публичный Motion установлены в отдельный consumer. Producer sourceCommit — входное утверждение; публикация и полная оптическая приёмка этим запуском не доказаны.';
const COMMUNITY_ID = '1527814209910933331';
const COMMUNITY_SLUG = 'lab-ui-components-icons-guides-lab-ui-v2-1';
export const PUBLIC_COMMUNITY_URL = `https://www.figma.com/community/file/${COMMUNITY_ID}/${COMMUNITY_SLUG}`;

function contractAssert(condition) {
  if (!condition)
    throw Object.assign(new Error('icons: public contract refused'), {
      code: 'PUBLIC_CONTRACT_REFUSED',
    });
}
const checked = (predicate) => (value) => {
  contractAssert(predicate(value));
  return value;
};
const literal = (...values) => checked((value) => values.includes(value));
const text = (pattern) => checked((value) => typeof value === 'string' && pattern.test(value));
const finite = checked(Number.isFinite);
const integer = checked((value) => Number.isSafeInteger(value) && value >= 0);
const boolean = checked((value) => typeof value === 'boolean');
const digest = text(HASH);
const commit = text(/^[a-f0-9]{40}$/);
const decimal = text(/^\d{1,30}$/);
const version = text(/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)(?:\.\d+)?)?$/);
const runtimeVersion = text(/^v?\d+(?:\.\d+){1,3}$/);
const timestamp = checked(
  (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)),
);
const nullable = (parse) => (value, mode) => (value === null ? null : parse(value, mode));
const array = (parse) => (value, mode) => {
  contractAssert(Array.isArray(value) && value.length <= 16384);
  const keys = Reflect.ownKeys(value);
  contractAssert(
    keys.length === value.length + 1 &&
      Object.keys(value).every((key, index) => key === String(index)),
  );
  return Array.from({ length: value.length }, (_, index) => {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    contractAssert(field?.enumerable && Object.hasOwn(field, 'value'));
    return parse(field.value, mode);
  });
};
function fields(value) {
  contractAssert(value !== null && typeof value === 'object' && !Array.isArray(value));
  contractAssert([Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const descriptors = Object.getOwnPropertyDescriptors(value);
  contractAssert(
    Reflect.ownKeys(descriptors).every(
      (key) =>
        typeof key === 'string' &&
        descriptors[key].enumerable &&
        Object.hasOwn(descriptors[key], 'value'),
    ),
  );
  return Object.entries(value);
}
const object =
  (required, optional = {}) =>
  (value, mode) => {
    const entries = fields(value);
    contractAssert(Object.keys(required).every((key) => Object.hasOwn(value, key)));
    return Object.fromEntries(
      entries.flatMap(([key, child]) => {
        contractAssert(Object.hasOwn(required, key) || Object.hasOwn(optional, key));
        if (child === undefined && Object.hasOwn(optional, key)) return [];
        return [[key, (required[key] ?? optional[key])(child, mode)]];
      }),
    );
  };
const dictionary = (parseKey, parseValue) => (value, mode) =>
  Object.fromEntries(
    fields(value).map(([key, child]) => [parseKey(key, mode), parseValue(child, mode)]),
  );
const union =
  (...parsers) =>
  (value, mode) => {
    for (const parse of parsers) {
      try {
        return parse(value, mode);
      } catch (error) {
        if (error?.code !== 'PUBLIC_CONTRACT_REFUSED') throw error;
      }
    }
    contractAssert(false);
  };

function communityUrl(value, project) {
  contractAssert(typeof value === 'string');
  let url;
  try {
    url = new URL(value);
  } catch {
    contractAssert(false);
  }
  const hostname = url.hostname.replace(/\.$/, '');
  contractAssert(
    url.protocol === 'https:' &&
      ['figma.com', 'www.figma.com'].includes(hostname) &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.search === '' &&
      url.hash === '',
  );
  const match = /^\/community\/file\/(\d{1,30})(?:\/([^/]+))?\/?$/.exec(url.pathname);
  contractAssert(match !== null);
  contractAssert(
    match[2] === undefined || (match[1] === COMMUNITY_ID && match[2] === COMMUNITY_SLUG),
  );
  const canonical =
    match[1] === COMMUNITY_ID && match[2] === COMMUNITY_SLUG
      ? PUBLIC_COMMUNITY_URL
      : `https://www.figma.com/community/file/${match[1]}`;
  if (!project) contractAssert(value === canonical);
  return canonical;
}
const pathData = checked((value) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024 * 1024) return false;
  const tokens = value.match(
    /[MmZzLlHhVvCcSsQqTtAa]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g,
  );
  return (
    tokens?.length > 0 &&
    /^[Mm]/.test(tokens[0]) &&
    value.replace(
      /[MmZzLlHhVvCcSsQqTtAa]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[\s,]/g,
      '',
    ) === '' &&
    tokens.every((token) => /^[a-z]$/i.test(token) || Number.isFinite(Number(token)))
  );
});
const fillRule = literal('nonzero', 'evenodd');
const role = literal('control', 'content', 'container');
const stateId = literal(...Object.values(PUBLIC_STATE_GROUPS).flatMap((group) => group.states));
const groupId = literal(...Object.keys(PUBLIC_STATE_GROUPS));
const variant = literal('outline', 'filled');
const publicIcons = [
  'reload',
  ...Object.values(PUBLIC_STATE_GROUPS).flatMap((group) => Object.values(group.icons)),
];
const partId = union(
  literal(
    'cycle-body',
    ...Object.values(PUBLIC_STATE_GROUPS).flatMap((group) => [
      ...group.states.map((id) => `state-${id}`),
      ...group.sharedParts.map((part) => part.id),
      ...Object.values(group.contentPartIds).flat(),
    ]),
  ),
  text(/^(?:attention|confirmation|decrease|dismissal|increase|question)-content-\d{1,3}$/),
);
const iconId = literal(...publicIcons);
const sourceFile = text(
  new RegExp(`^masters/figma/\\d{1,30}/(?:Outline|Filled)/(?:${publicIcons.join('|')})\\.svg$`),
);
const rawPath = object({ d: pathData, fillRule });
const numbers = array(finite);
const opacity = array(object({ partId, value: finite }));
const matrices = (value, mode) =>
  array((matrix) => {
    contractAssert(Array.isArray(matrix) && matrix.length === 6);
    return numbers(matrix, mode);
  })(value, mode);
const sourceIdentity = object({ fileKeySha256: digest, version: decimal });
const author = object(
  { kind: literal('figma'), fileKeySha256: digest, version: decimal, nodeIdSha256: digest },
  {
    nodeSha256: digest,
    masterSha256: digest,
    normalizedSha256: digest,
    pathFingerprintSha256: digest,
  },
);
const anatomy = object({
  version: literal(1),
  annotationSha256: digest,
  masterSha256: digest,
  pathFingerprintSha256: digest,
});
const gesture = object({
  id: literal('reload.cycle'),
  kind: literal('cycle'),
  meaning: literal(
    'Один оборот команды обновления по часовой стрелке; промежуточную позу можно развернуть или продолжить.',
  ),
  partIds: array(partId),
  progress: literal('normalized-0-to-1'),
  tracks: array(
    object({
      partId,
      kind: literal('rotate'),
      anchor: numbers,
      from: finite,
      to: finite,
      unit: literal('degrees'),
      interpolation: literal('linear'),
    }),
  ),
});
const authorVariant = object({
  sourceFile,
  author,
  anatomy,
  viewBox: numbers,
  paths: array(rawPath),
  parts: array(object({ id: partId, role, zIndex: integer, d: pathData, fillRule })),
  gesture,
});
const authorReference = object({
  fileName: literal('🧪Lab UI (v2.1)', 'Lab UI v2.1'),
  fileKeySha256: digest,
  version: decimal,
  icons: object({ reload: object({ outline: authorVariant, filled: authorVariant }) }),
});
const stateProof = object(
  {
    law: literal('enclosure.replace'),
    source: sourceIdentity,
    enclosureSha256: digest,
    specSha256: digest,
  },
  { sharedPartsSha256: digest },
);
const stateReference = object(
  {
    group: groupId,
    variant: literal('outline'),
    defaultState: stateId,
    enclosurePartId: partId,
    enclosure: rawPath,
    states: array(
      object({
        id: stateId,
        icon: iconId,
        partId,
        contentPartIds: array(partId),
        sourceFile,
        viewBox: numbers,
        dimensions: numbers,
        paths: array(rawPath),
        author,
      }),
    ),
    proof: stateProof,
  },
  {
    sharedPartIds: array(partId),
    sharedParts: array(object({ id: partId, role, d: pathData, fillRule })),
  },
);
const packageIdentity = object({
  name: literal('@labpics/icons', '@labpics/ui-core', '@labpics/ui-shadow'),
  version,
  archiveSha256: digest,
  archiveBytes: integer,
  sourceCommit: commit,
});
const subject = object(
  {
    schemaVersion: literal(1, 2, 3),
    packages: object({
      icons: packageIdentity,
      uiCore: packageIdentity,
      uiShadow: packageIdentity,
    }),
    authorReference,
  },
  {
    stateReference,
    stateReferences: object({ 'status-circle': stateReference, 'expression-face': stateReference }),
  },
);
const pin = object({
  schemaVersion: literal(2),
  repository: literal('Labpics-Team/lab-icons'),
  sourceCommit: commit,
  figma: object({ fileKeySha256: digest, fileKeyLength: integer, version: decimal }),
});
const motionOptions = object({
  duration: finite,
  easing: literal('linear'),
  fill: literal('both'),
});
const rotation = object({
  version: literal(1),
  icon: literal('reload'),
  variant,
  gesture: literal('reload.cycle'),
  from: finite,
  to: finite,
  options: motionOptions,
  viewport: object({ overflow: literal('visible') }),
  unchangedPartIds: array(partId),
  targets: array(
    object({
      partId,
      rotation: object({ from: finite, to: finite, unit: literal('degrees') }),
      style: object({
        transformBox: literal('view-box'),
        transformOrigin: text(/^[+-]?\d+(?:\.\d+)?% [+-]?\d+(?:\.\d+)?%$/),
      }),
      keyframes: array(
        object({
          offset: finite,
          transform: text(/^rotate\([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?deg\)$/i),
        }),
      ),
    }),
  ),
});
const stateEffect = object({
  contract: literal('labpics.symbol-state-effect/1'),
  version: literal(1),
  kind: literal('enclosure-replacement'),
  group: groupId,
  variant: literal('outline'),
  targetState: stateId,
  stages: array(
    object({ partId, property: literal('opacity'), to: finite, at: finite, duration: finite }),
  ),
  unchangedPartIds: array(partId),
  options: motionOptions,
});
const stateCapabilities = object(
  {
    group: groupId,
    variant: variant,
    defaultState: stateId,
    transition: literal('enclosure-replacement'),
    morph: literal('unavailable'),
    enclosurePartId: partId,
    states: array(
      object({ id: stateId, partId, icon: iconId, contentPartIds: array(partId), author }),
    ),
    formats: object({ static: array(literal('svg')), transition: array(literal('web-effect')) }),
    proof: stateProof,
  },
  { sharedPartIds: array(partId) },
);
const playback = literal('idle', 'running', 'paused', 'finished', 'stopped');
const cssOpacity = union(
  finite,
  checked(
    (value) =>
      typeof value === 'string' &&
      (value === '' ||
        (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) &&
          Number.isFinite(Number(value)))),
  ),
);
const nativeFrame = object(
  {},
  {
    offset: nullable(finite),
    computedOffset: finite,
    opacity: cssOpacity,
    easing: literal(
      'linear',
      'ease',
      'ease-in',
      'ease-out',
      'ease-in-out',
      'step-start',
      'step-end',
    ),
    composite: literal('auto', 'replace', 'add', 'accumulate'),
  },
);
const nativeAnimation = object(
  {},
  {
    partId: nullable(partId),
    sampledAt: finite,
    currentTime: nullable(finite),
    startTime: nullable(finite),
    playState: literal('idle', 'running', 'paused', 'finished'),
    pending: boolean,
    firstKeyframe: nullable(nativeFrame),
    lastKeyframe: nullable(nativeFrame),
  },
);
const poseWitness = object(
  {},
  {
    sampledAt: finite,
    timelineTime: nullable(finite),
    playback: nullable(playback),
    previousPlayback: nullable(playback),
    readStartedAt: finite,
    readCompletedAt: finite,
    opacity,
    partTimes: array(object({ partId, readStartedAt: finite, readCompletedAt: finite })),
    inlineOpacity: array(object({ partId, value: cssOpacity })),
    animations: array(nativeAnimation),
  },
);
const continuity = object({ before: poseWitness, admitted: poseWitness, after: poseWitness });
const eventWitness = object(
  { eventIndex: integer },
  {
    trusted: boolean,
    composed: boolean,
    native: boolean,
    before: opacity,
    after: opacity,
    effect: stateEffect,
    continuity,
  },
);
const stateContinuity = object(
  { differences: array(object({ partId, before: finite, after: finite }, { delta: finite })) },
  { witness: nullable(union(continuity, eventWitness, object({ at: finite }))) },
);
const change = object({
  effect: stateEffect,
  before: opacity,
  after: opacity,
  generation: integer,
  continuity,
});
const disposal = object({
  connected: boolean,
  completionStatus: literal('finished', 'stopped'),
  playback,
});
const stateEvent = object({
  trusted: boolean,
  composed: boolean,
  native: boolean,
  before: opacity,
  after: opacity,
  effect: stateEffect,
  continuity,
});
const cycleEvent = object({
  trusted: boolean,
  composed: boolean,
  native: boolean,
  initialize: boolean,
  before: matrices,
  after: matrices,
  effect: rotation,
});
const target = object({
  width: finite,
  height: finite,
  name: literal(
    'Обновить',
    ...Object.values(PUBLIC_STATE_GROUPS).map((group) => group.buttonLabel),
  ),
  type: literal('button'),
  iconHidden: literal('true'),
  slotHidden: literal('true'),
});
const pointer = object({
  point: object({ x: finite, y: finite }),
  coverage: object({
    width: finite,
    height: finite,
    left: finite,
    top: finite,
    right: finite,
    bottom: finite,
    point: object({ x: finite, y: finite }),
    pointHit: boolean,
  }),
  events: array(
    object({
      type: literal('pointerdown', 'pointerup', 'click'),
      trusted: boolean,
      target: boolean,
      button: integer,
      x: finite,
      y: finite,
    }),
  ),
});
const provenance = object({ kind: literal('source'), file: sourceFile, author, anatomy });
const API_REFUSALS = Object.freeze({
  GESTURE_UNSUPPORTED: 'Жест не поддерживается.',
  VARIANT_UNSUPPORTED: 'Вариант не поддерживается.',
  INVALID_REQUEST: 'Запрос не соответствует контракту.',
  STATE_UNSUPPORTED: 'Состояние не поддерживается.',
  FORMAT_UNSUPPORTED: 'Формат не поддерживается.',
});
const refusal = (value, mode) => {
  const parsed = object({
    ok: literal(false),
    reason: object(
      { code: literal(...Object.keys(API_REFUSALS)) },
      { message: literal(...Object.values(API_REFUSALS)) },
    ),
  })(value, mode);
  contractAssert(
    parsed.reason.message === undefined ||
      parsed.reason.message === API_REFUSALS[parsed.reason.code],
  );
  return parsed;
};
export function publicApiRefusal(value) {
  const raw = object({
    ok: literal(false),
    reason: object({
      code: literal(...Object.keys(API_REFUSALS)),
      message: checked((item) => typeof item === 'string'),
    }),
  })(value, false);
  const code = raw.reason.code;
  return { ok: false, reason: { code, message: API_REFUSALS[code] } };
}
const stateRefusals = object({
  filled: refusal,
  nullRequest: refusal,
  unknown: refusal,
  exports: array(refusal),
  web: object({ ok: literal(true), effect: stateEffect }),
});
const observedPath = object({ d: pathData, fillRule, fill: literal('currentColor'), partId, role });
const cssTransform = checked((value) => {
  if (value === 'none') return true;
  if (typeof value !== 'string') return false;
  const match = /^(matrix|matrix3d)\(([^()]+)\)$/.exec(value);
  const channels = match?.[2].split(',').map((channel) => channel.trim());
  return (
    channels?.length === (match[1] === 'matrix' ? 6 : 16) &&
    channels.every(
      (channel) =>
        /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(channel) &&
        Number.isFinite(Number(channel)),
    )
  );
});
const sharedPart = object({
  d: pathData,
  fillRule,
  fill: literal('currentColor'),
  partId,
  role,
  count: integer,
  opacity: finite,
  transform: cssTransform,
  inStateGroup: boolean,
  ancestorsUnchanged: boolean,
  identity: boolean,
});
const authorObservation = object(
  { name: literal('author-observation') },
  {
    author,
    proof: object({ source: sourceIdentity, specSha256: digest }),
    paths: array(rawPath),
    link: communityUrl,
    masterSha256: digest,
    opacity: finite,
  },
);
const cycleName = (suffix) => text(new RegExp(`^(?:outline|filled):${suffix}$`));
const stateName = (suffix) => text(new RegExp(`^(?:status-circle|expression-face):${suffix}$`));
const reduction = '(?:no-preference|reduce)';
const publicRecord = union(
  authorObservation,
  object({
    name: cycleName('forward-complete'),
    terminal: matrices,
    completionStatuses: array(literal('finished', 'stopped')),
  }),
  object({
    name: cycleName('interrupt-reverse'),
    effect: rotation,
    before: matrices,
    after: matrices,
    terminal: matrices,
  }),
  object({ name: cycleName('reduced-motion'), effect: rotation }),
  object(
    {
      name: cycleName(`${reduction}:real-button`),
      target,
      events: array(cycleEvent),
      provenance,
      refusal: object({ axis: literal('AUTHOR_PARITY_REQUIRED'), motion: refusal }),
    },
    { pointerControl: pointer },
  ),
  object({ name: stateName(`${reduction}:trusted-activation`), events: array(stateEvent) }),
  object({
    name: stateName(
      `(?:attention|confirmation|decrease|dismissal|increase|question|aloof|sad|smile):${reduction}`,
    ),
    source: author,
    effect: stateEffect,
    terminal: opacity,
    identity: boolean,
    sharedParts: array(sharedPart),
  }),
  object({
    name: stateName('paused-reverse-newer-state'),
    paused: opacity,
    reverse: change,
    newer: change,
    mixture: opacity,
    latest: change,
  }),
  object({
    name: text(new RegExp(`^expression-face:${reduction}:author-size-samples$`)),
    samples: array(
      object({
        state: stateId,
        size: finite,
        width: finite,
        height: finite,
        viewBox: numbers,
        paths: array(observedPath),
      }),
    ),
  }),
  object({ name: stateName(`${reduction}:public-refusals`), refusal: stateRefusals }),
  object({
    name: stateName(`${reduction}:dispose`),
    connected: boolean,
    completionStatus: literal('finished', 'stopped'),
    playback,
  }),
);
const diagnosticCodes = [
  'ENOENT',
  'EACCES',
  'EPERM',
  'ETIMEDOUT',
  'ERR_ASSERTION',
  'CONSUMER_FAILED',
  'PUBLIC_CONTRACT_REFUSED',
  'MEASUREMENT_SOURCE_MISMATCH',
  'MEASUREMENT_LOCKFILE_MISMATCH',
  'MEASUREMENT_MISSING',
  'MEASUREMENT_BYTES_CHANGED',
];
const phases = literal('subject', 'archive snapshots', 'install', 'build', 'browser');
const diagnosticMessage = checked(
  (value) =>
    typeof value === 'string' &&
    [
      ...diagnosticCodes.map((code) => `icons: ${code}`),
      ...Object.values(PUBLIC_REFUSALS),
    ].includes(value),
);
const diagnostic = object(
  {},
  {
    code: literal(...diagnosticCodes),
    message: diagnosticMessage,
    comparison: literal('strictEqual', 'deepStrictEqual', 'match', 'fail', '=='),
    stateContinuity,
    stateContinuityRefused: boolean,
  },
);
const failure = object(
  { phase: phases },
  {
    code: literal(...diagnosticCodes),
    message: diagnosticMessage,
    comparison: literal('strictEqual', 'deepStrictEqual', 'match', 'fail', '=='),
    browserErrors: array(diagnostic),
    stateContinuity,
    stateContinuityRefused: boolean,
  },
);
const runner = object(
  {},
  {
    node: runtimeVersion,
    platform: literal('linux', 'win32', 'darwin'),
    architecture: literal('x64', 'arm64', 'ia32'),
    runId: decimal,
    runAttempt: decimal,
    environment: literal('self-hosted', 'github-hosted'),
    nameSha256: digest,
    os: literal('Linux', 'Windows', 'macOS'),
    browser: runtimeVersion,
  },
);
const harness = object({ commit, sourceSha256: digest, dirty: boolean, diffSha256: digest });
const archive = object({
  key: literal('icons', 'uiCore', 'uiShadow'),
  inputNameSha256: digest,
  archiveSha256: digest,
  archiveBytes: integer,
  integrity: text(/^sha512-[A-Za-z0-9+/]{86}==$/),
  snapshot: literal('archives/icons.tgz', 'archives/uiCore.tgz', 'archives/uiShadow.tgz'),
});
const installed = object({
  name: literal('@labpics/icons', '@labpics/ui-core', '@labpics/ui-shadow', '@labpics/motion'),
  version,
  manifestSha256: digest,
  lockIntegrity: nullable(text(/^sha(?:1-[A-Za-z0-9+/]{27}=|512-[A-Za-z0-9+/]{86}==)$/)),
  lockResolvedSha256: nullable(digest),
});
const bundle = object({
  fileSha256: digest,
  sha256: digest,
  raw: integer,
  gzip: integer,
  brotli: integer,
});
const consumer = object({
  fixtureSha256: digest,
  htmlSha256: digest,
  publicEntries: dictionary(literal(...PUBLIC_ENTRIES), digest),
  moduleGraph: array(digest),
  bundles: array(bundle),
  scenario: literal(PUBLIC_SCENARIO),
});
const receipt = object(
  { schemaVersion: literal(1), outcome: literal('passed', 'failed'), records: array(publicRecord) },
  {
    started: timestamp,
    completed: timestamp,
    subject,
    subjectSha256: digest,
    harness,
    runner,
    archives: array(archive),
    lockfileSha256: digest,
    installed: array(installed),
    consumer,
    qualification: literal(PUBLIC_QUALIFICATION),
    failure,
    cleanupErrors: array(diagnostic),
  },
);
const sourceMaterial = object(
  {
    file: union(
      literal(
        'package.json',
        'packages/core/package.json',
        'packages/shadow/package.json',
        'semantics/figma-baseline.json',
        'semantics/author-anatomy.json',
        'semantics/author-state-groups.json',
        'scripts/measure-platform-artifacts.mjs',
        'scripts/check-package-size.js',
        'scripts/check-consumer-size.js',
        'release/contract.json',
        'release/package-size-ratchet.json',
        'release/consumer-size-ratchet.json',
        'pnpm-lock.yaml',
      ),
      sourceFile,
    ),
    sha256: digest,
    bytes: integer,
  },
  { repository: literal('Labpics-Team/lab-icons', 'Labpics-Team/labui') },
);
const measurementDescriptor = object(
  {
    file: literal('platform-measurement.json'),
    sourceSha: commit,
    sha256: digest,
    bytes: integer,
    program: sourceMaterial,
    lockfileSha256: digest,
    artifactFiles: array(digest),
  },
  {
    artifactCount: integer,
    consumerCount: integer,
    policyViolations: integer,
    rawSha256: digest,
    rawBytes: integer,
  },
);
const sourceReceipt = object(
  {
    schemaVersion: literal(1),
    pin,
    uiCommit: commit,
    subjectSha256: digest,
    files: array(sourceMaterial),
  },
  { measurement: measurementDescriptor },
);
const methodPackage = text(/^fflate@\d+\.\d+\.\d+ gzipSync level=9 mtime=0 after pnpm build$/);
const methodConsumer = text(
  /^esbuild@\d+\.\d+\.\d+ bundle\+minify\+treeshake es2022 browser; fflate@\d+\.\d+\.\d+ gzipSync level=9 mtime=0$/,
);
const artifactMeasurement = object(
  { bytes: integer, gzipBytes: integer, brotliBytes: integer },
  { sha256: digest, modules: array(digest) },
);
const measuredArtifact = object(
  { bytes: integer, gzipBytes: integer, brotliBytes: integer, sha256: digest },
  { modules: array(digest) },
);
const processVersion = text(/^\d+(?:\.\d+)*(?:-(?:node\.\d+|[a-f0-9]{7,40}))?(?:\+quic)?$/);
const quicVersion = union(processVersion, literal(''));
const zlibVersion = union(processVersion, text(/^\d+(?:\.\d+)*-motley-[a-f0-9]{7,40}$/));
// Node 26: https://github.com/nodejs/node/blob/v26.13.0/src/node_metadata.cc
const processVersions = object(
  {},
  Object.fromEntries(
    [
      'node',
      'acorn',
      'ada',
      'amaro',
      'ares',
      'brotli',
      'cjs_module_lexer',
      'cldr',
      'icu',
      'llhttp',
      'libffi',
      'lief',
      'merve',
      'modules',
      'napi',
      'nbytes',
      'ncrypto',
      'nghttp2',
      'nghttp3',
      'ngtcp2',
      'openssl',
      'simdjson',
      'simdutf',
      'sqlite',
      'undici',
      'unicode',
      'uv',
      'uvwasi',
      'v8',
      'zlib',
      'zstd',
    ]
      .map((key) => [
        key,
        key === 'zlib'
          ? zlibVersion
          : key === 'nghttp3' || key === 'ngtcp2'
            ? quicVersion
            : processVersion,
      ])
      .concat([['tz', text(/^\d{4}[a-z]$/)]]),
  ),
);
const policyViolation = union(
  object({
    code: literal('ARTIFACT_BUDGET', 'CONSUMER_BUDGET'),
    subjectSha256: digest,
    maxBytes: integer,
    maxGzipBytes: integer,
    measuredBytes: integer,
    measuredGzipBytes: integer,
    sourceMessageSha256: digest,
  }),
  object({
    code: literal('MODULE_DRIFT'),
    subjectSha256: digest,
    expectedModules: array(digest),
    actualModules: array(digest),
    sourceMessageSha256: digest,
  }),
  object({
    code: literal('FORBIDDEN_MARKER'),
    subjectSha256: digest,
    markerSha256: digest,
    sourceMessageSha256: digest,
  }),
  object({
    code: literal('ARTIFACT_MISSING', 'SCENARIO_MISSING'),
    subjectSha256: digest,
    sourceMessageSha256: digest,
  }),
  object({
    code: literal('IDENTICAL_BYTES_REQUIRED'),
    subjectSha256: digest,
    expectedArtifactSha256: digest,
    sourceMessageSha256: digest,
  }),
);
const measurement = object(
  {
    representation: literal('public-identities/1'),
    sourceSha: commit,
    capturedAt: timestamp,
    lockfileSha256: digest,
    environment: object(
      { node: runtimeVersion },
      {
        versions: processVersions,
        versionsSha256: digest,
        platform: literal('linux', 'win32', 'darwin'),
        arch: literal('x64', 'arm64', 'ia32'),
        cpuSha256: digest,
        cpuCount: integer,
        totalMemory: integer,
      },
    ),
    packageMeasurement: methodPackage,
    consumerMeasurement: methodConsumer,
    artifacts: dictionary(digest, measuredArtifact),
    consumers: dictionary(digest, artifactMeasurement),
    candidatePolicies: object({
      package: object(
        {
          measurement: methodPackage,
          artifacts: dictionary(
            digest,
            object(
              {
                baselineBytes: integer,
                baselineGzipBytes: integer,
                maxBytes: integer,
                maxGzipBytes: integer,
                allowedModules: array(digest),
                forbiddenNeedles: array(digest),
              },
              { identicalTo: digest },
            ),
          ),
        },
        { version: literal(1) },
      ),
      consumer: object(
        {
          measurement: methodConsumer,
          scenarios: dictionary(
            digest,
            object({
              entrySha256: digest,
              baselineBytes: integer,
              baselineGzipBytes: integer,
              maxBytes: integer,
              maxGzipBytes: integer,
            }),
          ),
        },
        { version: literal(1) },
      ),
    }),
    policyViolations: array(policyViolation),
  },
  {
    brotliMeasurement: literal(
      'node:zlib brotliCompressSync quality=11; environment.versions.brotli',
    ),
  },
);
const publishedFile = literal(
  'inputs/subject.json',
  'inputs/source-receipt.json',
  'inputs/platform-measurement.json',
  'result/receipt.json',
  'result/failure.json',
  'result/package-lock.json',
  'result/dependency-tree.json',
  'result/module-graph.json',
  'result/bundle-sizes.json',
  'result/reduce.png',
  'result/no-preference.png',
  'result/reduce-failure.png',
  'result/no-preference-failure.png',
);
const summary = object(
  {
    schemaVersion: literal(1),
    outcome: literal('passed', 'failed'),
    source: sourceReceipt,
    observations: integer,
    failure: nullable(object({ phase: phases }, { stateContinuity })),
    files: array(object({ path: publishedFile, sha256: digest, bytes: integer })),
    diagnosticDirectorySha256: digest,
  },
  {
    harness,
    runner,
    archives: array(archive),
    readbackFailure: object({ code: literal('EVIDENCE_REFUSED'), file: publishedFile }),
  },
);
const codecs = Object.freeze({
  pin,
  'author-reference': authorReference,
  'state-reference': stateReference,
  subject,
  author,
  provenance,
  continuity: stateContinuity,
  diagnostic,
  receipt,
  'source-receipt': sourceReceipt,
  measurement,
  summary,
  'author-observation': authorObservation,
  'community-reference': object({ link: communityUrl }),
  'reference-binding': object({ reference: stateReference, source: sourceIdentity }),
  record: publicRecord,
  'api-refusal': refusal,
  'state-effect': stateEffect,
  'state-capabilities': stateCapabilities,
  'state-change': change,
  'state-disposal': disposal,
  rotation,
  'file-list': array(object({ path: publishedFile, sha256: digest, bytes: integer })),
});
function contractValue(value, kind, project) {
  contractAssert(typeof kind === 'string' && Object.hasOwn(codecs, kind));
  return codecs[kind](value, project);
}

// Opaque runtime names, paths and source snippets belong to the raw measurement.
// Their only public representation is a content identity; numeric facts stay exact.
const opaqueText = checked((value) => typeof value === 'string' && value.length <= 1024 * 1024);
const rawMetric = object(
  { bytes: integer, gzipBytes: integer, brotliBytes: integer },
  { sha256: digest, modules: array(opaqueText) },
);
const rawArtifact = object(
  { bytes: integer, gzipBytes: integer, brotliBytes: integer, sha256: digest },
  { modules: array(opaqueText) },
);
const rawLimits = object({
  baselineBytes: integer,
  baselineGzipBytes: integer,
  maxBytes: integer,
  maxGzipBytes: integer,
});
const rawMeasurement = object(
  {
    sourceSha: commit,
    capturedAt: timestamp,
    lockfileSha256: digest,
    environment: object(
      { node: runtimeVersion },
      {
        versions: processVersions,
        platform: literal('linux', 'win32', 'darwin'),
        arch: literal('x64', 'arm64', 'ia32'),
        cpu: opaqueText,
        cpuCount: integer,
        totalMemory: integer,
      },
    ),
    packageMeasurement: methodPackage,
    consumerMeasurement: methodConsumer,
    artifacts: dictionary(opaqueText, rawArtifact),
    consumers: dictionary(opaqueText, rawMetric),
    candidatePolicies: object({
      package: object(
        {
          measurement: methodPackage,
          artifacts: dictionary(
            opaqueText,
            object(
              {
                baselineBytes: integer,
                baselineGzipBytes: integer,
                maxBytes: integer,
                maxGzipBytes: integer,
                allowedModules: array(opaqueText),
                forbiddenNeedles: array(opaqueText),
              },
              { identicalTo: opaqueText },
            ),
          ),
        },
        { version: literal(1) },
      ),
      consumer: object(
        {
          measurement: methodConsumer,
          scenarios: dictionary(
            opaqueText,
            object({
              entry: opaqueText,
              baselineBytes: integer,
              baselineGzipBytes: integer,
              maxBytes: integer,
              maxGzipBytes: integer,
            }),
          ),
        },
        { version: literal(1) },
      ),
    }),
    policyViolations: array(opaqueText),
  },
  {
    brotliMeasurement: literal(
      'node:zlib brotliCompressSync quality=11; environment.versions.brotli',
    ),
  },
);

export function validateMeasurementShape(value) {
  if (value?.representation !== undefined) return assertPublicProvenance(value, 'measurement');
  rawMeasurement(value, false);
  return value;
}
function publicPolicyViolation(value, report) {
  const separator = value.indexOf(': ');
  contractAssert(separator > 0);
  const subject = value.slice(0, separator);
  const reason = value.slice(separator + 2);
  const identity = { subjectSha256: hash(subject), sourceMessageSha256: hash(value) };
  const budget =
    /^(consumer )?budget (\d+) B \/ (\d+) B gzip; measured (\d+) B \/ (\d+) B gzip$/.exec(reason);
  if (budget) {
    const limits = budget[1]
      ? report.candidatePolicies.consumer.scenarios[subject]
      : report.candidatePolicies.package.artifacts[subject];
    const measured = budget[1] ? report.consumers[subject] : report.artifacts[subject];
    contractAssert(
      limits &&
        measured &&
        [limits.maxBytes, limits.maxGzipBytes, measured.bytes, measured.gzipBytes].every(
          (number, index) => number === Number(budget[index + 2]),
        ),
    );
    return {
      code: budget[1] ? 'CONSUMER_BUDGET' : 'ARTIFACT_BUDGET',
      ...identity,
      maxBytes: limits.maxBytes,
      maxGzipBytes: limits.maxGzipBytes,
      measuredBytes: measured.bytes,
      measuredGzipBytes: measured.gzipBytes,
    };
  }
  const limits = report.candidatePolicies.package.artifacts[subject];
  const measured = report.artifacts[subject];
  if (
    limits &&
    measured &&
    reason ===
      `module inclusion drift; expected [${limits.allowedModules.join(', ')}], actual [${(measured.modules ?? []).join(', ')}]`
  )
    return {
      code: 'MODULE_DRIFT',
      ...identity,
      expectedModules: limits.allowedModules.map(hash),
      actualModules: (measured.modules ?? []).map(hash),
    };
  if (limits && reason.startsWith('forbidden marker ')) {
    const marker = reason.slice('forbidden marker '.length);
    contractAssert(limits.forbiddenNeedles.includes(marker));
    return { code: 'FORBIDDEN_MARKER', ...identity, markerSha256: hash(marker) };
  }
  if (reason === 'previous artifact отсутствует в release contract')
    return { code: 'ARTIFACT_MISSING', ...identity };
  if (reason === 'previous consumer scenario отсутствует в measurement')
    return { code: 'SCENARIO_MISSING', ...identity };
  if (
    limits?.identicalTo &&
    reason === `identicalTo ${limits.identicalTo} обязан быть byte-identical`
  )
    return {
      code: 'IDENTICAL_BYTES_REQUIRED',
      ...identity,
      expectedArtifactSha256: hash(limits.identicalTo),
    };
  contractAssert(false);
}
export function projectPlatformMeasurement(value) {
  const raw = rawMeasurement(value, false);
  const metrics = (items) =>
    Object.fromEntries(
      Object.entries(items).map(([name, item]) => [
        hash(name),
        { ...item, ...(item.modules ? { modules: item.modules.map(hash) } : {}) },
      ]),
    );
  const environment = { ...raw.environment };
  if (environment.cpu !== undefined) {
    environment.cpuSha256 = hash(environment.cpu);
    Reflect.deleteProperty(environment, 'cpu');
  }
  if (environment.versions !== undefined)
    environment.versionsSha256 = hash(JSON.stringify(environment.versions));
  const result = {
    ...raw,
    representation: 'public-identities/1',
    environment,
    artifacts: metrics(raw.artifacts),
    consumers: metrics(raw.consumers),
    candidatePolicies: {
      package: {
        ...raw.candidatePolicies.package,
        artifacts: Object.fromEntries(
          Object.entries(raw.candidatePolicies.package.artifacts).map(([name, item]) => [
            hash(name),
            {
              ...item,
              allowedModules: item.allowedModules.map(hash),
              forbiddenNeedles: item.forbiddenNeedles.map(hash),
              ...(item.identicalTo ? { identicalTo: hash(item.identicalTo) } : {}),
            },
          ]),
        ),
      },
      consumer: {
        ...raw.candidatePolicies.consumer,
        scenarios: Object.fromEntries(
          Object.entries(raw.candidatePolicies.consumer.scenarios).map(([name, item]) => {
            const { entry, ...limits } = item;
            rawLimits(limits, false);
            return [hash(name), { ...limits, entrySha256: hash(entry) }];
          }),
        ),
      },
    },
    policyViolations: raw.policyViolations.map((item) => publicPolicyViolation(item, raw)),
  };
  return assertPublicProvenance(result, 'measurement');
}

function assertNoPinnedIdentity(text) {
  const { length, digest } = PUBLICATION_POLICY;
  // The pinned ASCII identity can be copied inside a longer word or object key.
  for (const [token] of text.matchAll(/[a-z0-9]+/gi)) {
    let previous;
    for (let index = 0; index + length <= token.length; index++) {
      const candidate = token.slice(index, index + length);
      if (candidate !== previous)
        assert.ok(hash(candidate) !== digest, 'icons: copied pinned private identity refused');
      previous = candidate;
    }
  }
}

function inspectProvenance(value, privateIdentities = new Set()) {
  const inspect = (item) => {
    if (typeof item === 'string') {
      const decoded = decodedText(item);
      assertNoPinnedIdentity(decoded);
      for (const identity of privateIdentities)
        assert.ok(!decoded.includes(identity), 'icons: copied private provenance refused');
    } else if (Array.isArray(item)) item.forEach(inspect);
    else if (item && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        assert.ok(!PRIVATE_FIELDS.has(key), 'icons: raw private provenance refused');
        inspect(key);
        inspect(child);
      }
    }
  };
  inspect(value);
  return value;
}

export function assertPublicProvenance(value, kind) {
  contractValue(value, kind, false);
  return inspectProvenance(value);
}

export function validateSourcePin(pin) {
  assertPublicProvenance(pin, 'pin');
  return sourcePinFields(pin);
}

// Verification retains source bytes in memory; only this explicit projection leaves it.
export function projectPublicProvenance(value, kind) {
  const identities = new Set();
  const collect = (item) => {
    if (Array.isArray(item)) array(collect)(item);
    else if (item && typeof item === 'object') {
      for (const [key, child] of fields(item)) {
        if (PRIVATE_FIELDS.has(key)) {
          assert.ok(
            typeof child === 'string' && child.length > 0,
            'icons: malformed private provenance',
          );
          assert.ok(
            (key === 'fileKey' ? /^[A-Za-z0-9]+$/ : /^\d+:\d+$/).test(child),
            'icons: malformed private provenance identity',
          );
          identities.add(child);
        }
        collect(child);
      }
    }
  };
  collect(value);
  const project = (item) => {
    if (Array.isArray(item)) return item.map(project);
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(
      Object.entries(item).map(([key, child]) => {
        if (PRIVATE_FIELDS.has(key)) {
          assert.ok(
            !Object.hasOwn(item, `${key}Sha256`),
            'icons: conflicting provenance projection',
          );
          return [`${key}Sha256`, hash(child)];
        }
        return [key, project(child)];
      }),
    );
  };
  return inspectProvenance(contractValue(project(value), kind, true), identities);
}

export function assertSourceIdentity(source, expected) {
  assert.ok(
    typeof source?.fileKey === 'string' && /^[A-Za-z0-9]+$/.test(source.fileKey),
    'icons: malformed source identity',
  );
  assert.ok(HASH.test(expected?.fileKeySha256), 'icons: missing public source identity');
  assert.ok(
    source.fileKey.length === expected.fileKeyLength,
    'icons: source identity length differs from pin',
  );
  assert.ok(
    hash(source.fileKey) === expected.fileKeySha256,
    'icons: source identity differs from pin',
  );
  assert.ok(source.version === expected.version, 'icons: source version differs from pin');
}

const ERROR_CODES = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ETIMEDOUT',
  'ERR_ASSERTION',
  'PUBLIC_CONTRACT_REFUSED',
]);
const OPERATORS = new Set(['strictEqual', 'deepStrictEqual', 'match', 'fail', '==']);
const PUBLIC_REFUSALS = Object.freeze({
  MEASUREMENT_SOURCE_MISMATCH: 'measurement относится к другому source SHA',
  MEASUREMENT_LOCKFILE_MISMATCH: 'measurement lockfile не совпал',
  MEASUREMENT_MISSING: 'measurement отсутствует',
  MEASUREMENT_BYTES_CHANGED: 'measurement bytes изменились',
});

// The check supplies a closed reason; raw input and assertion diffs never become text.
export function assertPublicCheck(condition, reason) {
  assert.ok(
    typeof condition === 'boolean' &&
      typeof reason === 'string' &&
      Object.hasOwn(PUBLIC_REFUSALS, reason),
    'icons: invalid public check',
  );
  if (!condition) throw Object.assign(new Error(PUBLIC_REFUSALS[reason]), { code: reason });
}

// Arbitrary error messages/stacks may contain raw API values or captured child output.
export function publicFailure(error) {
  const publicReason =
    typeof error?.code === 'string' && Object.hasOwn(PUBLIC_REFUSALS, error.code);
  const code = publicReason || ERROR_CODES.has(error?.code) ? error.code : 'CONSUMER_FAILED';
  const result = { code, message: publicReason ? PUBLIC_REFUSALS[code] : `icons: ${code}` };
  if (OPERATORS.has(error?.operator)) result.comparison = error.operator;
  if (error?.stateContinuity) {
    try {
      result.stateContinuity = projectPublicProvenance(error.stateContinuity, 'continuity');
    } catch {
      result.stateContinuityRefused = true;
    }
  }
  return result;
}

export function publicDiagnosticError(error) {
  const failure = publicFailure(error);
  return Object.assign(new Error(failure.message), failure);
}
