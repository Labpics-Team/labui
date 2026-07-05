import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
// Liquid Glass — pending-decode re-stamp regression (test plan #1). Class B
// (permanent regression for a fixed Critical) + fault injection (deferred decode).
//
// THE BUG (fixed in the engine, pinned here forever):
//   render() bumps state.gen on every call. A 2nd SAME-geometry render fired
//   while the 1st render's displacement map is still DECODING bumps gen, which
//   the gen-guard then uses to DROP the 1st render's im.onload. Before the fix
//   the same-geometry branch simply `return`ed with nothing re-armed → the lens
//   NEVER landed (frost-only until the next geometry change). The fix added
//   state.pendingMap and re-arms a stamp for the CURRENT gen against the
//   in-flight map in the pending branch.
//
// We reproduce it deterministically with the cache suite's deferred-decode
// window.Image mock + manual flush: attach (decode deferred), fire a 2nd
// update({}) at the SAME geometry BEFORE flushing, THEN flush the decode, and
// assert the lens stamped — backdrop-filter ends with url(#id) AND the filter
// holds a feImage with a real (settled) href.
//
// RED-PROOF: revert the engine's pending-branch re-arm to the old `return`
// (comment out the `else if (state.pendingMap) { ... }` block) and this test
// FAILS (lensStamped === false). Restore it → PASS.
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '../../../../prototypes/liquid-glass/lg-harness.mjs');

let harness = null;
let importError = null;
try {
  harness = await import(`file://${HARNESS}`);
} catch (err) {
  importError = err;
}

test('same-geometry re-render mid-decode still stamps the lens for the latest gen', async () => {
  assert.ok(
    harness !== null,
    `repo harness prototypes/liquid-glass/lg-harness.mjs must exist; import failed: ${
      importError ? importError.message : 'unknown'
    }`,
  );
  assert.equal(
    typeof harness.runPendingDecodeRegression,
    'function',
    `lg-harness.mjs must export async runPendingDecodeRegression(), got ${typeof harness.runPendingDecodeRegression}`,
  );

  const { applicable, lensStamped, detail } = await harness.runPendingDecodeRegression();

  // Chromium-only behaviour. A non-refracting engine never expects a lens, so the
  // regression is vacuously satisfied there — but our gate runs headless Chromium,
  // where it MUST apply and MUST stamp.
  assert.equal(
    applicable,
    true,
    `regression must run on a refracting engine (headless Chromium) — ${detail}`,
  );
  assert.equal(
    lensStamped,
    true,
    `lens must land after a same-geometry re-render mid-decode (pending-branch re-arm) — ${detail}`,
  );
});
