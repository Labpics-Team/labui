import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const PUBLIC_ICONS_DESIGN_REFERENCE =
  'https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1';

const locationFields = new Map([
  ['fileKey', 'file-key'],
  ['nodeId', 'node-id'],
  ['pageId', 'page-id'],
  ['frameId', 'frame-id'],
  ['rootId', 'node-id'],
  ['rootNodeId', 'node-id'],
]);
const locationKinds = new Set([
  ...locationFields.values(),
  'source-version',
  'private-url',
  'asset-url',
  'source-path',
]);
const metadataFields = new Set(['author', 'figma', 'provenance', 'metadata', 'capture']);
const mapFields = new Map([
  ['frames', 'frame-id'],
  ['nodes', 'node-id'],
  ['pages', 'page-id'],
]);
const pathFields = new Set(['sourceFile', 'master', 'file', 'path']);
const urlFields = new Set([
  'url',
  'sourceUrl',
  'privateUrl',
  'assetUrl',
  'imageUrl',
  'downloadUrl',
]);
const publicNames = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'AssertionError',
  'AbortError',
  'TimeoutError',
  'PublicEvidenceRefusal',
]);
const publicCodes = new Set([
  'ERROR',
  'ERR_ASSERTION',
  'ABORT_ERR',
  'ETIMEDOUT',
  'ENOENT',
  'EACCES',
  'EPIPE',
  'EIO',
  'PUBLIC_EVIDENCE_REFUSED',
  'SOURCE_IDENTITY_REFUSED',
  'CONSUMER_SOURCE_IDENTITY_REFUSED',
  'EVIDENCE_REFUSED',
  'PLATFORM_POLICY_REFUSED',
]);
const sourcePathPattern = /(?:^|[/\\])(?:masters|normalized)[/\\]figma[/\\][^/\\\s"<>]+[/\\]/;
const urlPattern = /https?:[^\s"'<>]+|[/\\]{2}[^\s"'<>]+/gi;

function refuse(code = 'PUBLIC_EVIDENCE_REFUSED') {
  const error = new Error('Публичное evidence содержит неподдержанные или приватные данные');
  error.name = 'PublicEvidenceRefusal';
  error.code = code;
  throw error;
}

function entries(value) {
  if (types.isProxy(value)) refuse();
  const prototype = Object.getPrototypeOf(value);
  const array = Array.isArray(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    refuse();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length) refuse();
  if (array) {
    const length = descriptors.length;
    const keys = Object.keys(descriptors).filter((key) => key !== 'length');
    if (
      !length ||
      !Object.hasOwn(length, 'value') ||
      length.enumerable ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0 ||
      keys.length !== length.value
    )
      refuse();
    return keys.map((key, index) => {
      const descriptor = descriptors[key];
      if (key !== String(index) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
        refuse();
      return [key, descriptor.value];
    });
  }
  return Object.keys(value).map((key) => {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse();
    return [key, descriptor.value];
  });
}

// Та же canonical JSON identity применяется до проекции и к каждому commitment.
function canonicalJSON(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || ancestors.has(value)) refuse();
  ancestors.add(value);
  try {
    const items = entries(value);
    if (Array.isArray(value)) {
      return `[${items.map(([, item]) => canonicalJSON(item, ancestors)).join(',')}]`;
    }
    return `{${items
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJSON(item, ancestors)}`)
      .join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

const canonicalHash = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const commitment = (value) => ({
  kind: 'diagnostic-commitment',
  originalSha256: canonicalHash(value),
});
const locatorCommitment = (value) => `sha256:${canonicalHash(value)}`;

function ownValue(value, key) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

export function sourceIdentitySha256(source) {
  const fileKey = ownValue(source, 'fileKey');
  const version = ownValue(source, 'version');
  if (
    typeof fileKey !== 'string' ||
    !/^[A-Za-z0-9]+$/.test(fileKey) ||
    typeof version !== 'string' ||
    !/^\d+$/.test(version)
  )
    refuse('SOURCE_IDENTITY_REFUSED');
  return canonicalHash({ fileKey, version });
}

export function assertSourceIdentity(source, expectedSha) {
  if (
    typeof expectedSha !== 'string' ||
    !/^[a-f0-9]{64}$/.test(expectedSha) ||
    sourceIdentitySha256(source) !== expectedSha
  )
    refuse('SOURCE_IDENTITY_REFUSED');
  return source;
}

function privateURLKind(value) {
  if (value === PUBLIC_ICONS_DESIGN_REFERENCE) return undefined;
  if (!/^(?:https?:|[/\\]{2})/i.test(value)) return undefined;
  let url;
  try {
    // Только HTTP URL tokens: base разрешает network-path syntax, не filesystem paths.
    url = /^https?:/i.test(value) ? new URL(value) : new URL(value, 'https://public.invalid/');
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (
    /(?:^|\.)figmausercontent\.com$/.test(host) ||
    /(?:^|\.)s3-alpha(?:-sig)?\.figma\.com$/.test(host) ||
    (/(?:^|\.)amazonaws\.com$/.test(host) && /figma|X-Amz-|Signature=/.test(value))
  )
    return 'asset-url';
  if (/(?:^|\.)figma\.com$/.test(host)) return 'private-url';
  return undefined;
}

function privateURLs(value) {
  const result = [];
  for (const match of value.matchAll(urlPattern)) {
    const url = match[0].replace(/[),.;\]}]+$/, '');
    const kind = privateURLKind(url);
    if (kind) result.push({ kind, value: url });
  }
  return result;
}

function isFileIdentity(value) {
  const version = ownValue(value, 'version');
  return (
    Object.hasOwn(value, 'fileKey') ||
    ownValue(value, 'kind') === 'figma' ||
    (Object.hasOwn(value, 'fileName') && typeof version === 'string' && /^\d+$/.test(version))
  );
}

function isPrivateIdentityField(key, value) {
  return (key === 'fileName' || key === 'name') && isFileIdentity(value);
}

function isMetadata(value, context) {
  return (
    context.metadata ||
    isFileIdentity(value) ||
    [...locationFields.keys()].some((key) => Object.hasOwn(value, key)) ||
    [...pathFields].some((key) => {
      const item = ownValue(value, key);
      return typeof item === 'string' && sourcePathPattern.test(item);
    })
  );
}

function childContext(key, metadata, context) {
  return {
    metadata: metadataFields.has(key),
    mapKind: metadata ? mapFields.get(key) : undefined,
    browserFrontier: key === 'browserFrontier',
    diagnostic:
      key === 'browserErrors' ||
      key === 'cleanupErrors' ||
      (context.failure && (key === 'message' || key === 'stack')),
    failure: key === 'failure',
  };
}

function structuralKind(key, item, value, metadata) {
  if (!metadata) return undefined;
  if (locationFields.has(key)) return locationFields.get(key);
  if (key === 'version' && isFileIdentity(value)) return 'source-version';
  if (pathFields.has(key) && typeof item === 'string' && sourcePathPattern.test(item))
    return 'source-path';
  if (urlFields.has(key) && typeof item === 'string' && privateURLKind(item))
    return privateURLKind(item);
  return undefined;
}

function normalizeLocations(privateLocations) {
  if (types.isProxy(privateLocations) || !Array.isArray(privateLocations)) refuse();
  const literals = new Set();
  const locations = entries(privateLocations).map(([, record]) => {
    const kind = ownValue(record, 'kind');
    const value = ownValue(record, 'value');
    if (!locationKinds.has(kind) || typeof value !== 'string' || !value) refuse();
    if (kind !== 'source-version') literals.add(value);
    if (['node-id', 'page-id', 'frame-id'].includes(kind)) {
      literals.add(value.replaceAll(':', '-'));
      literals.add(encodeURIComponent(value));
      literals.add(encodeURIComponent(value).toLowerCase());
    }
    return { kind, value };
  });
  const pattern = [...literals]
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  // Locator matcher строится один раз; значения — escaped literals, без regex grammar.
  return { records: locations, matcher: pattern ? new RegExp(pattern, 'u') : null };
}

export function collectPrivateLocations(value) {
  canonicalJSON(value);
  const found = new Map();
  const add = (kind, item) => {
    if (typeof item !== 'string' || !item) refuse();
    found.set(`${kind}\0${item}`, Object.freeze({ kind, value: item }));
  };
  function visit(item, context = {}) {
    if (typeof item === 'string') {
      for (const url of privateURLs(item)) add(url.kind, url.value);
      if (context.mapKind) add(context.mapKind, item);
      return;
    }
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      for (const [, child] of entries(item)) visit(child, context);
      return;
    }
    const metadata = isMetadata(item, context);
    for (const [key, child] of entries(item)) {
      if (context.mapKind && /^\d+[:\-]\d+$/.test(key)) add(context.mapKind, key);
      const kind = structuralKind(key, child, item, metadata);
      if (kind) add(kind, child);
      else if (isPrivateIdentityField(key, item)) continue;
      else if (context.mapKind && typeof child === 'string') add(context.mapKind, child);
      else visit(child, childContext(key, metadata, context));
    }
  }
  visit(value);
  return Object.freeze([...found.values()]);
}

function containsPrivate(value, locations) {
  return (
    privateURLs(value).length > 0 ||
    sourcePathPattern.test(value) ||
    locations.matcher?.test(value) === true
  );
}

// Один публичный контракт применяется к stdout и ко всем JSON-артефактам.
function browserFrontierValue(frontier, publicForm) {
  const requireValue = (condition) => {
    if (!condition) refuse();
  };
  const keys = (value, required, optional = []) => {
    requireValue(value && typeof value === 'object' && !Array.isArray(value));
    const names = entries(value).map(([key]) => key);
    requireValue(required.every((key) => names.includes(key)));
    requireValue(names.every((key) => [...required, ...optional].includes(key)));
  };
  const label = (value, member = false) => {
    if (member && value === null) return;
    requireValue(typeof value === 'string' && value.length <= (member ? 96 : 64));
    requireValue(
      (member ? /^[a-z][a-z0-9-]*(?:\/(?:outline|filled))?$/ : /^[a-z][a-z0-9-]*$/).test(value),
    );
  };
  const count = (value, nullable = false) => {
    requireValue((nullable && value === null) || (Number.isSafeInteger(value) && value >= 0));
  };
  const stageFields = ['mode', 'stage', 'member', 'elapsedMs', 'completedRecords'];
  const stage = (value, fields) => {
    keys(value, fields);
    requireValue([null, 'no-preference', 'reduce'].includes(value.mode));
    label(value.stage);
    label(value.member, true);
    count(value.elapsedMs);
    count(value.completedRecords);
    return Object.fromEntries(entries(value));
  };
  const recordField = publicForm ? 'lastCompletedRecordSha256' : 'lastCompletedRecord';
  const fields = [
    ...stageFields,
    'stageElapsedMs',
    'stageCompletedRecords',
    recordField,
    'lastCompletedAtMs',
    'sinceLastCompletedMs',
    'completedStages',
  ];
  const copy = (value, nested = false) => {
    keys(value, fields, nested ? [] : ['modes']);
    stage(
      value,
      entries(value).map(([key]) => key),
    );
    for (const field of ['stageElapsedMs', 'stageCompletedRecords', 'sinceLastCompletedMs'])
      count(value[field]);
    count(value.lastCompletedAtMs, true);
    const record = value[recordField];
    requireValue(
      record === null ||
        (typeof record === 'string' && (!publicForm || /^[a-f0-9]{64}$/.test(record))),
    );
    requireValue(Array.isArray(value.completedStages));
    const result = Object.fromEntries(
      fields
        .filter((field) => ![recordField, 'completedStages'].includes(field))
        .map((field) => [field, value[field]]),
    );
    result.lastCompletedRecordSha256 =
      record === null || publicForm ? record : createHash('sha256').update(record).digest('hex');
    result.completedStages = entries(value.completedStages).map(([, item]) =>
      stage(item, stageFields),
    );
    if (Object.hasOwn(value, 'modes')) {
      keys(value.modes, ['no-preference', 'reduce']);
      result.modes = Object.fromEntries(
        entries(value.modes).map(([mode, entry]) => {
          const projected = copy(entry, true);
          requireValue(projected.mode === mode);
          return [mode, projected];
        }),
      );
    }
    return result;
  };
  return copy(frontier);
}

export function publicBrowserFrontier(frontier, privateLocations = []) {
  const bytes = canonicalJSON(frontier);
  if (Buffer.byteLength(bytes) > 4 * 1024 * 1024) refuse();
  if (!frontier || typeof frontier !== 'object' || Array.isArray(frontier)) refuse();
  const publicForm = !Object.hasOwn(frontier, 'lastCompletedRecord');
  const result = browserFrontierValue(frontier, publicForm);
  assertPublicEvidence(result, { privateLocations });
  return result;
}

export function projectPublicEvidence(
  value,
  { privateLocations = collectPrivateLocations(value) } = {},
) {
  const originalSha256 = canonicalHash(value);
  const locations = normalizeLocations(privateLocations);
  function project(item, context = {}) {
    if (context.browserFrontier) return publicBrowserFrontier(item, locations.records);
    if (context.diagnostic && !Array.isArray(item)) return commitment(item);
    if (typeof item === 'string') {
      if (context.mapKind && containsPrivate(item, locations)) return locatorCommitment(item);
      if (containsPrivate(item, locations)) refuse();
      return item;
    }
    if (!item || typeof item !== 'object') return item;
    if (Array.isArray(item)) return entries(item).map(([, child]) => project(child, context));
    const metadata = isMetadata(item, context);
    let changedLocation = false;
    const output = [];
    for (const [key, child] of entries(item)) {
      let publicKey = key;
      if (containsPrivate(key, locations)) {
        if (!context.mapKind) refuse();
        publicKey = locatorCommitment(key);
        changedLocation = true;
      }
      const kind = structuralKind(key, child, item, metadata);
      if (kind || isPrivateIdentityField(key, item)) {
        changedLocation = true;
        continue;
      }
      output.push([
        publicKey,
        project(
          child,
          context.mapKind && typeof child === 'string'
            ? { mapKind: context.mapKind }
            : childContext(key, metadata, context),
        ),
      ]);
    }
    if (new Set(output.map(([key]) => key)).size !== output.length) refuse();
    const result = Object.fromEntries(output);
    if (metadata || changedLocation || context.mapKind) result.originalSha256 = canonicalHash(item);
    if (Object.hasOwn(item, 'fileKey') && Object.hasOwn(item, 'version'))
      result.sourceIdentitySha256 = sourceIdentitySha256(item);
    return result;
  }
  const projection = {
    projectionVersion: 1,
    publicDesignReference: PUBLIC_ICONS_DESIGN_REFERENCE,
    originalSha256,
    evidence: project(value),
  };
  assertPublicEvidence(projection, { privateLocations: locations.records });
  return projection;
}

// Для PNG это только locator guard; структурную проверку изображения ведёт его владелец.
export function assertPublicEvidence(value, { privateLocations = [] } = {}) {
  if (types.isProxy(value)) refuse();
  const locations = normalizeLocations(privateLocations);
  function scan(item, context = {}) {
    if (context.browserFrontier) browserFrontierValue(item, true);
    if (typeof item === 'string') {
      if (containsPrivate(item, locations)) refuse();
      return;
    }
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      for (const [, child] of entries(item)) scan(child, context);
      return;
    }
    const metadata = isMetadata(item, context);
    for (const [key, child] of entries(item)) {
      if (
        key === 'lastCompletedRecord' ||
        containsPrivate(key, locations) ||
        structuralKind(key, child, item, metadata) ||
        isPrivateIdentityField(key, item)
      )
        refuse();
      scan(child, childContext(key, metadata, context));
    }
  }
  if (value instanceof Uint8Array) {
    // UTF-16 text chunks и обычный UTF-8 log проверяются без изменения bytes.
    for (const encoding of ['utf8', 'utf16le']) {
      const text = Buffer.from(value).toString(encoding);
      scan(text);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        continue;
      }
      scan(parsed);
    }
  } else {
    canonicalJSON(value);
    scan(value);
    if (typeof value === 'string') {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        return value;
      }
      scan(parsed);
    }
  }
  return value;
}

export function publicError(error, { privateLocations = [] } = {}) {
  normalizeLocations(privateLocations);
  let name = ownValue(error, 'name');
  if (name === undefined && error && typeof error === 'object' && !types.isProxy(error)) {
    try {
      const prototype = Object.getPrototypeOf(error);
      for (const type of [Error, TypeError, RangeError, SyntaxError])
        if (prototype === type.prototype) name = ownValue(type.prototype, 'name');
    } catch {
      // Недоверенный Proxy не получает возможность превратить diagnostic в raw error.
    }
  }
  const code = ownValue(error, 'code');
  const diagnostics = {};
  for (const key of ['name', 'code', 'message', 'stack']) {
    const value = ownValue(error, key);
    if (typeof value === 'string') diagnostics[key] = value;
  }
  if (typeof error === 'string') diagnostics.thrown = error;
  return {
    name: publicNames.has(name) ? name : 'Error',
    code: publicCodes.has(code) ? code : 'ERROR',
    diagnosticSha256: canonicalHash(diagnostics),
  };
}
