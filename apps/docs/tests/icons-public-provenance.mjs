import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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
  let result = value.replace(/\\u([a-f0-9]{4})/gi, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );
  for (let count = 0; count < 2; count++) {
    try {
      result = decodeURIComponent(result);
    } catch {
      break;
    }
  }
  return result;
}

export function assertPublicProvenance(value, privateIdentities = new Set()) {
  const inspect = (item) => {
    if (typeof item === 'string') {
      const decoded = decodedText(item);
      assert.ok(
        !/(?:https?:\/\/)?(?:www\.)?figma\.com\/(?:file|design|proto|board)\//i.test(decoded),
        'icons: private Figma URL refused',
      );
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

// Verification retains source bytes in memory; only this explicit projection leaves it.
export function projectPublicProvenance(value) {
  const identities = new Set();
  const collect = (item) => {
    if (Array.isArray(item)) item.forEach(collect);
    else if (item && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
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
  return assertPublicProvenance(project(value), identities);
}

export function assertSourceIdentity(source, expected) {
  assert.ok(
    typeof source?.fileKey === 'string' && /^[A-Za-z0-9]+$/.test(source.fileKey),
    'icons: malformed source identity',
  );
  assert.ok(HASH.test(expected?.fileKeySha256), 'icons: missing public source identity');
  assert.ok(
    hash(source.fileKey) === expected.fileKeySha256,
    'icons: source identity differs from pin',
  );
  assert.ok(source.version === expected.version, 'icons: source version differs from pin');
}

const ERROR_CODES = new Set(['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ERR_ASSERTION']);
const OPERATORS = new Set(['strictEqual', 'deepStrictEqual', 'match', 'fail', '==']);

// Arbitrary error messages/stacks may contain raw API values or captured child output.
export function publicFailure(error) {
  const code = ERROR_CODES.has(error?.code) ? error.code : 'CONSUMER_FAILED';
  const result = { code, message: `icons: ${code}` };
  if (OPERATORS.has(error?.operator)) result.comparison = error.operator;
  if (error?.stateContinuity) {
    try {
      result.stateContinuity = projectPublicProvenance(error.stateContinuity);
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
