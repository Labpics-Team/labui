import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Liquid Glass — pure-math + displacement-encoding unit tests (Node, NO DOM).
//
// Test plan items #1 (Pure math) and #2 (Displacement-encoding invariants).
// Class: unit + property. Runs in BARE Node via the built-in `node:test` runner —
// zero browser, zero DOM shims (P1: pyramid base for a deterministic algorithm).
//
// THE CONTRACT UNDER TEST (ch01-t1 must create it):
//   prototypes/liquid-glass/lg-math.js — a sibling pure module that exports the
//   engine's real `clamp01`, `smoothstep`, `sdRoundRect` AND the encoding
//   constants (B_CHANNEL=128, A_CHANNEL=255, MAX_PULL, encode/decode helpers),
//   imported BACK into liquid-glass.js so the browser bundle stays byte-identical.
//   The test imports the REAL symbols so a constant change (e.g. MAX_PULL) is
//   caught — it does NOT re-declare the formulas with its own numbers.
//
// RED until lg-math.js exists and exports the contract. The failure is a real
// assertion about MISSING exported behaviour, surfaced with a clear message —
// never a bare uncaught module-not-found.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MATH_MODULE = resolve(HERE, '../../../../prototypes/liquid-glass/lg-math.js');

// Load the pure module once. If ch01-t1 has not extracted it yet, `mod` is null
// and every test below fails on an explicit "module/export missing" assertion —
// asserting the absent CONTRACT, not crashing on an import typo.
let mod = null;
let importError = null;
try {
  mod = await import(`file://${MATH_MODULE}`);
} catch (err) {
  importError = err;
}

/** Assert the pure module loaded and exposes `name`; return that export. */
function need(name, kind) {
  assert.ok(
    mod !== null,
    `pure module prototypes/liquid-glass/lg-math.js must exist and import in bare Node (ch01-t1 extraction); import failed: ${importError ? importError.message : 'unknown'}`,
  );
  const v = mod[name];
  assert.ok(
    kind === 'function' ? typeof v === 'function' : v !== undefined,
    `lg-math.js must export ${kind} \`${name}\` (the engine's real symbol), got ${typeof v}`,
  );
  return v;
}

// ── A. Pure math ────────────────────────────────────────────────────────────

test('clamp01 floors below 0, ceils above 1, is identity in [0,1]', () => {
  const clamp01 = need('clamp01', 'function');
  assert.equal(clamp01(-0.3), 0, 'clamps below 0 to 0');
  assert.equal(clamp01(0), 0);
  assert.equal(clamp01(0.5), 0.5, 'identity inside the range');
  assert.equal(clamp01(1), 1);
  assert.equal(clamp01(1.7), 1, 'clamps above 1 to 1');
});

test('smoothstep matches x*x*(3-2x) closed form and the 0/0.5/1 anchors', () => {
  const smoothstep = need('smoothstep', 'function');
  const closed = (x) => x * x * (3 - 2 * x);
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(0.5), 0.5, 'symmetric midpoint');
  // Closed-form agreement on a sampled grid — property, not a single example.
  for (let i = 0; i <= 20; i++) {
    const x = i / 20;
    assert.ok(
      Math.abs(smoothstep(x) - closed(x)) < 1e-12,
      `smoothstep(${x}) must equal the closed form ${closed(x)}`,
    );
  }
});

test('smoothstep is monotonically increasing on [0,1]', () => {
  const smoothstep = need('smoothstep', 'function');
  let prev = Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= 50; i++) {
    const v = smoothstep(i / 50);
    assert.ok(v >= prev, `smoothstep must not decrease at x=${i / 50}`);
    prev = v;
  }
});

test('sdRoundRect: <0 deep inside, ~0 on the rim, >0 outside a 200x120 r=28 box', () => {
  const sdRoundRect = need('sdRoundRect', 'function');
  const w = 200;
  const h = 120;
  const r = 28;
  // Centre is deep inside → distinctly negative.
  assert.ok(sdRoundRect(w / 2, h / 2, w, h, r) < 0, 'centre is inside (sd < 0)');
  // A point ON the left rim (x=0, mid height) → ~0 within a small tolerance.
  assert.ok(
    Math.abs(sdRoundRect(0, h / 2, w, h, r)) < 1e-6,
    'mid-left edge sits on the rim (sd ~ 0)',
  );
  // A point well outside the box → distinctly positive.
  assert.ok(sdRoundRect(-30, h / 2, w, h, r) > 0, 'a point left of the box is outside (sd > 0)');
});

test('sdRoundRect is 4-way mirror symmetric (the encoding relies on it)', () => {
  const sdRoundRect = need('sdRoundRect', 'function');
  const w = 200;
  const h = 120;
  const r = 28;
  for (const [px, py] of [
    [40, 30],
    [12, 50],
    [90, 18],
    [5, 5],
  ]) {
    const base = sdRoundRect(px, py, w, h, r);
    assert.ok(
      Math.abs(sdRoundRect(w - px, py, w, h, r) - base) < 1e-9,
      `horizontal mirror at (${px},${py}) must match`,
    );
    assert.ok(
      Math.abs(sdRoundRect(px, h - py, w, h, r) - base) < 1e-9,
      `vertical mirror at (${px},${py}) must match`,
    );
    assert.ok(
      Math.abs(sdRoundRect(w - px, h - py, w, h, r) - base) < 1e-9,
      `diagonal mirror at (${px},${py}) must match`,
    );
  }
});

// ── B. Displacement-encoding invariants ───────────────────────────────────────
// The engine encodes a float displacement field into RGBA: B is the constant
// neutral channel, A the constant alpha, and R/G map [-maxAbs,maxAbs]→[0,1] via
// norm = 1/(2*maxAbs); the byte is `value*norm*255 + 127.5`. These tests pin the
// REAL constants and the encode arithmetic so a drift is caught without a canvas.

test('encoding constants: B channel == 128, A channel == 255, MAX_PULL == 0.15', () => {
  const B = need('B_CHANNEL', 'value');
  const A = need('A_CHANNEL', 'value');
  const MAX_PULL = need('MAX_PULL', 'value');
  assert.equal(B, 128, 'neutral blue channel is 128 (the 0xff800000 fill)');
  assert.equal(A, 255, 'alpha channel is fully opaque (255)');
  assert.equal(MAX_PULL, 0.15, 'the lens magnification constant is 0.15');
});

test('interior (neutral) pixel encodes R~128 and G~128 (0*norm255 + 127.5)', () => {
  const encodeChannel = need('encodeChannel', 'function');
  const maxAbs = 0.0312; // any representative non-zero band extreme
  // A neutral interior pixel has displacement 0 → rounds to 128 (127.5 clamped up).
  const r = encodeChannel(0, maxAbs);
  const g = encodeChannel(0, maxAbs);
  assert.ok(Math.abs(r - 128) <= 1, `interior R must be ~128, got ${r}`);
  assert.ok(Math.abs(g - 128) <= 1, `interior G must be ~128, got ${g}`);
});

test('rim pixel round-trips: decode(encode(dx)) ~= dx within half an LSB', () => {
  const encodeChannel = need('encodeChannel', 'function');
  const decodeChannel = need('decodeChannel', 'function');
  const maxAbs = 0.0312;
  const lsb = (2 * maxAbs) / 255; // one least-significant displacement step
  for (const dx of [maxAbs, -maxAbs, maxAbs / 2, -maxAbs / 3, 0]) {
    const byte = encodeChannel(dx, maxAbs);
    assert.ok(byte >= 0 && byte <= 255, `encoded byte must be in [0,255], got ${byte}`);
    const back = decodeChannel(byte, maxAbs);
    assert.ok(
      Math.abs(back - dx) <= lsb / 2 + 1e-9,
      `decode(encode(${dx})) must round-trip within half an LSB (got ${back}, lsb/2=${lsb / 2})`,
    );
  }
});

test('maxAbs >= every encoded displacement (no clipping of the band)', () => {
  const encodeChannel = need('encodeChannel', 'function');
  const maxAbs = 0.0312;
  // The extreme displacement (+/-maxAbs) maps to the channel extremes [0,255]
  // WITHOUT clipping: +maxAbs → 255, -maxAbs → 0 (both inclusive, no overflow).
  assert.equal(encodeChannel(maxAbs, maxAbs), 255, '+maxAbs encodes to the channel max 255');
  assert.equal(encodeChannel(-maxAbs, maxAbs), 0, '-maxAbs encodes to the channel min 0');
});
