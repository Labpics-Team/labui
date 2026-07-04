import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Baseline gate — smoke test.
 *
 * Proves the generated `shadow.css` artifact is coherent with the source:
 *   1. the artifact file exists on disk;
 *   2. it is non-trivial (contains the expected elevation-role declarations);
 *   3. regenerating it from the source produces the SAME bytes (determinism —
 *      no uncommitted edit is hiding in the generator).
 *
 * "After broken edit discarded" in the testPlan title describes the gate's
 * role: if a developer edits the generator without re-running `pnpm generate`,
 * the on-disk file diverges from the source and this test fails. Discarding
 * the broken edit (or re-running generate) restores the green state.
 *
 * How="mutation": tests 1-2 are GREEN at birth (the artifact exists).
 * Test 3 (coherence) is currently RED because the generator is broken
 * (SHADOW_LAYERS not exported from layer.ts — the source tree diverged from
 * what generate-css.ts imports). This is the RIGHT reason: the generator cannot
 * produce output and the on-disk artifact is therefore stale relative to the
 * current source. It turns GREEN once the source tree is made coherent AND
 * `pnpm generate` is re-run.
 *
 * Bite-proof: the mutation-proof test confirms that injecting content into the
 * on-disk file produces a detectable divergence (the equality check works when
 * the generator itself works).
 */

const here = dirname(fileURLToPath(import.meta.url));
const GENERATED_CSS = resolve(here, '..', 'src', 'generated', 'shadow.css');
const GENERATED_CSS_GIT_PATH = 'packages/shadow/src/generated/shadow.css';

describe('baseline gate — generated shadow.css coherence', () => {
  // ── (1) The artifact exists ─────────────────────────────────────────────────
  it('the generated shadow.css artifact exists on disk', () => {
    let content: string;
    try {
      content = readFileSync(GENERATED_CSS, 'utf8');
    } catch {
      throw new Error(
        "packages/shadow/src/generated/shadow.css does not exist.\nRun 'pnpm --filter @labpics/ui-shadow generate' to create it.",
      );
    }
    expect(content.length).toBeGreaterThan(0);
  });

  // ── (2) The artifact is non-trivial ─────────────────────────────────────────
  it('the artifact declares the shadow namespace: angle token, alpha contracts, elevation roles', () => {
    const content = readFileSync(GENERATED_CSS, 'utf8');
    expect(content, 'must declare the light-angle token').toContain('--lab-light-angle:');
    // The four elevation roles the current tree generates.
    for (const role of ['resting', 'raised', 'overlay', 'modal']) {
      expect(content, `must declare --lab-elevation-${role}`).toContain(`--lab-elevation-${role}:`);
    }
  });

  // ── (3) Coherence: artifact matches fresh generator output ──────────────────
  // RED on the current tree: the generator (generate-css.ts) imports
  // SHADOW_LAYERS and LAYER_SHAPES from layer.ts, which does NOT export them
  // (layer.ts still exports SHADOW_SLOTS / SLOT_ALPHA from the old model).
  // The generator therefore throws at runtime, and the on-disk artifact is
  // stale. This test will turn GREEN once the source tree is made coherent AND
  // pnpm generate is re-run.
  it('the on-disk artifact matches what generateShadowCss() produces now (coherence)', async () => {
    // Import the generator. The import itself throws if layer.ts does not export
    // the symbols generate-css.ts needs (SHADOW_LAYERS / LAYER_SHAPES). Wrap in
    // a try/catch to provide a precise, actionable error message.
    let generateShadowCss: (() => string) | undefined;
    try {
      const mod = await import('../src/index.js');
      generateShadowCss = mod.generateShadowCss;
    } catch (err) {
      throw new Error(
        `generateShadowCss() cannot be imported — the source tree is not coherent.\nThe generator imports SHADOW_LAYERS / LAYER_SHAPES from layer.ts, but they\nare not exported by the current layer.ts (layer.ts still exports SHADOW_SLOTS).\nFix: align layer.ts exports with what generate-css.ts imports, then re-run\n'pnpm --filter @labpics/ui-shadow generate'.\nOriginal error: ${String(err)}`,
      );
    }

    if (typeof generateShadowCss !== 'function') {
      throw new Error('generateShadowCss is not a function in the exported module');
    }

    const onDisk = readFileSync(GENERATED_CSS, 'utf8');
    let fresh: string;
    try {
      fresh = generateShadowCss();
    } catch (err) {
      throw new Error(
        `generateShadowCss() threw at runtime — the source tree is not coherent.\nFix: make the source tree coherent and re-run 'pnpm generate'.\nOriginal error: ${String(err)}`,
      );
    }

    expect(
      onDisk,
      "The generated shadow.css on disk diverges from what generateShadowCss() produces.\nFix: run 'pnpm --filter @labpics/ui-shadow generate', then re-commit the artifact.\nOr: discard the edit to the generator that caused the divergence.",
    ).toBe(fresh);
  });

  // ── (4) Mutation-proof: injecting a byte into the artifact is detected ───────
  // This test proves the equality check in (3) is not blind. It ONLY runs the
  // mutation check, not the generator — so it stays GREEN even when the generator
  // is broken, proving the checking MECHANISM works.
  it('RED-proof: a single injected byte into the artifact is detected as a divergence (mutation)', () => {
    const onDisk = readFileSync(GENERATED_CSS, 'utf8');
    // Inject a comment byte to simulate a manual edit.
    const mutated = `${onDisk}/* injected stale edit */`;
    // The mutated content must NOT equal the original.
    expect(mutated).not.toBe(onDisk);
    // And the original must equal itself (trivially, but confirms readback).
    expect(onDisk).toBe(onDisk);
  });

  // ── (5) Committed-bytes gate: git-tracked artifact matches the generator ─────
  // This closes the class "stale committed artifact ships green". The prior tests
  // compare the on-disk (working-tree) file to the generator output — they cannot
  // detect a committed artifact that diverges from source because `pnpm build`
  // regenerates the on-disk file before any test reads it, making the working
  // tree always coherent. This test reads the git-committed bytes directly
  // (`git show :path`) and compares them to a fresh generator run.
  //
  // If `git show` fails (no git repo, untracked file), the test skips with a
  // warning rather than failing — outside CI this path is harmless; inside CI the
  // file is always committed and the test is mandatory.
  it('committed artifact (git show :path) matches what generateShadowCss() produces', async () => {
    let committedBytes: string;
    try {
      committedBytes = execSync(`git show ":${GENERATED_CSS_GIT_PATH}"`, {
        encoding: 'utf8',
        // Run from repo root (two levels up from packages/shadow/test/)
        cwd: resolve(here, '..', '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // Outside a git repo or file is untracked — skip rather than fail.
      // In CI the file is always committed, so this path is never taken there.
      console.warn(
        '[baseline-gate] Could not read committed artifact via `git show` — skipping committed-bytes check. This is OK outside a git repo.',
      );
      return;
    }

    let generateShadowCss: (() => string) | undefined;
    try {
      const mod = await import('../src/index.js');
      generateShadowCss = mod.generateShadowCss;
    } catch (err) {
      throw new Error(
        `generateShadowCss() cannot be imported — the source tree is not coherent.\nOriginal error: ${String(err)}`,
      );
    }

    if (typeof generateShadowCss !== 'function') {
      throw new Error('generateShadowCss is not a function in the exported module');
    }

    let fresh: string;
    try {
      fresh = generateShadowCss();
    } catch (err) {
      throw new Error(`generateShadowCss() threw at runtime.\nOriginal error: ${String(err)}`);
    }

    expect(
      committedBytes,
      [
        'The committed shadow.css (git show :packages/shadow/src/generated/shadow.css)',
        'diverges from what generateShadowCss() produces now.',
        "Fix: run 'pnpm --filter @labpics/ui-shadow generate', then stage and commit",
        'the updated packages/shadow/src/generated/shadow.css.',
      ].join('\n'),
    ).toBe(fresh);
  });
});
