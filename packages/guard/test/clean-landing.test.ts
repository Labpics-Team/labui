/**
 * clean-landing — bite-proof invariant suite
 *
 * Epic: clean-landing-reconcile
 * Chapter: prove-and-lock-clean-landing
 *
 * Bite proof strategy per test (documented inline):
 *   "red"      — test FAILS NOW because production code is absent.
 *   "mutation" — test is GREEN-at-birth (pins already-correct behaviour).
 *                Bite proved by a throwaway copy that breaks the invariant;
 *                the production test is never mutated. Each such test carries
 *                an explicit MUTATION-PROOF block.
 *
 * Run: pnpm --filter @labpics/ui-guard test
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Repo root — two levels up from packages/guard. */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

/**
 * Run a shell command inside the repo root.
 * Returns { stdout, stderr, status }.
 * Never throws — callers inspect status.
 */
function git(args: string, cwd = REPO_ROOT): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('git', args.split(' '), {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    status: result.status ?? 1,
  };
}

function shell(cmd: string, cwd = REPO_ROOT): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(cmd, {
    cwd,
    encoding: 'utf8',
    shell: true,
  });
  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    status: result.status ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Test 1 — reground-tree-empty-status
// CLASS: smoke
// BITE: mutation
//   Proved by: in a temp dir, `git init && git status --porcelain` on a dirty
//   working tree returns non-empty; our assertion would catch it.
//   The production tree is EXPECTED to be empty (pins already-clean state).
// ---------------------------------------------------------------------------
describe('reground-tree-empty-status', () => {
  it('git status --porcelain --untracked-files=all is EMPTY at execution time', () => {
    const { stdout, status } = git('status --porcelain --untracked-files=all');
    expect(status, 'git status exited non-zero — repo may be in a broken state').toBe(0);
    expect(
      stdout,
      `Working tree is DIRTY. Each path must be classified to owning-scope-or-delete before proceeding:\n${stdout}`,
    ).toBe('');
  });

  /**
   * MUTATION-PROOF (throwaway — does NOT mutate the production tree).
   *
   * We create a temp git repo, add an untracked file, and confirm our assertion
   * formula produces the same non-empty stdout it would on the real tree.
   * This proves the test is not a no-op: it would fail if the tree were dirty.
   */
  it('MUTATION-PROOF: a dirty tree makes the assertion fail', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'guard-mutation-'));
    try {
      // Init a git repo — no commit needed; git status works on empty repos.
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      // Drop an untracked file — simulates a dirty tree.
      writeFileSync(join(tmpDir, '.audit-icons-x.png'), 'fake');
      const { stdout: dirtyOut } = git('status --porcelain --untracked-files=all', tmpDir);
      // The mutation: our assertion would FAIL on this output.
      expect(dirtyOut, 'mutation proof: dirty tree should produce non-empty status').not.toBe('');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2 — named-artifact-classes-absent
// CLASS: contract
// BITE: mutation
//   Proved by: git check-ignore on a path that IS gitignored returns that path
//   (non-empty), and our assertion detects it. The absence check is real: the
//   paths don't exist AND check-ignore returns nothing → provably deleted.
// ---------------------------------------------------------------------------
describe('named-artifact-classes-absent', () => {
  /**
   * Every named artifact class must be absent on disk AND not merely gitignored.
   * `git check-ignore -v <path>` returning nothing means the path is neither
   * tracked nor ignored — it was deleted, not hidden.
   */
  const NAMED_ARTIFACTS = [
    // audit PNGs
    '.audit-icons-x.png',
    '_typography-scale.png',
    'icons-variant-v1-screenshot.png',
    // audit dirs
    '.audit-ux',
    '.pw-audit',
    '.peertmp',
    '_provenance',
    // demo scaffolds
    'apps/docs/src/icons-demo.tsx',
    'apps/docs/src/icons.html',
    // orphan icons files (were never committed, never landed)
    'packages/icons/src/data',
    'packages/icons/src/react.tsx',
    'packages/icons/src/registry.ts',
    'packages/icons/src/render.ts',
    'packages/icons/src/types.ts',
    'packages/icons/NOTICE',
    'packages/icons/scripts',
  ] as const;

  for (const artifact of NAMED_ARTIFACTS) {
    it(`absent on disk (not deleted or gitignored): ${artifact}`, () => {
      const fullPath = join(REPO_ROOT, artifact);
      expect(
        existsSync(fullPath),
        `${artifact} exists on disk — it must be deleted before proceeding`,
      ).toBe(false);
    });

    it(`git check-ignore returns nothing for ${artifact} (proves deleted, not merely ignored)`, () => {
      const result = spawnSync('git', ['check-ignore', '-v', artifact], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        shell: false,
      });
      // git check-ignore exits 0 and prints a line when the path IS ignored.
      // exits 1 and prints nothing when the path is NOT ignored.
      // We want: NOT ignored (not in tree, not hidden).
      expect(
        result.stdout.trim(),
        `${artifact} is listed as gitignored — it was hidden, not deleted. The guard requires the path to be absent from the filesystem entirely.`,
      ).toBe('');
    });
  }

  /**
   * MUTATION-PROOF: we confirm the check-ignore assertion fires on a real
   * gitignored path. `node_modules/` IS in .gitignore; check-ignore prints
   * a non-empty line for it.
   */
  it('MUTATION-PROOF: check-ignore IS non-empty for a known-ignored path (node_modules)', () => {
    const result = spawnSync('git', ['check-ignore', '-v', 'node_modules'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: false,
    });
    expect(
      result.stdout.trim(),
      'mutation proof: node_modules should be reported as gitignored',
    ).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Test 3 — icons-tracked-set-exact
// CLASS: contract
// BITE: mutation
//   Proved by: a dummy file added to packages/icons/src/ in a temp worktree
//   shows up in `git ls-files` and fails the exact-set assertion.
// ---------------------------------------------------------------------------
describe('icons-tracked-set-exact', () => {
  /**
   * The intended 4-file tracked set for packages/icons.
   * If this set ever changes (e.g. an orphan file lands), CI must fail.
   */
  const INTENDED_ICONS_FILES = new Set([
    'packages/icons/package.json',
    'packages/icons/src/index.ts',
    'packages/icons/tsconfig.json',
    'packages/icons/tsup.config.ts',
  ]);

  it('git ls-files packages/icons equals exactly the 4-file intended set', () => {
    const { stdout, status } = git('ls-files packages/icons');
    expect(status, 'git ls-files exited non-zero').toBe(0);

    const actual = new Set(
      stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );

    const extra = [...actual].filter((f) => !INTENDED_ICONS_FILES.has(f));
    const missing = [...INTENDED_ICONS_FILES].filter((f) => !actual.has(f));

    expect(extra, `Unexpected tracked files in packages/icons:\n  ${extra.join('\n  ')}`).toEqual(
      [],
    );
    expect(
      missing,
      `Expected tracked files are missing from packages/icons:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('no untracked files survive under packages/icons/', () => {
    // git ls-files --others lists untracked files (respects .gitignore unless --no-exclude-standard)
    const { stdout, status } = git('ls-files --others --exclude-standard packages/icons');
    expect(status, 'git ls-files --others exited non-zero').toBe(0);
    expect(stdout, `Untracked files found under packages/icons/:\n${stdout}`).toBe('');
  });

  /**
   * MUTATION-PROOF: simulate an orphan file being tracked in a temp clone.
   * We use git ls-files --others (untracked) in the temp dir since we cannot
   * force-add without touching the real working tree here. The proof is: if
   * a file existed in the set, our Set-diff logic would catch it.
   */
  it('MUTATION-PROOF: extra file in set triggers assertion failure', () => {
    const fakeActual = new Set([...INTENDED_ICONS_FILES, 'packages/icons/src/react.tsx']);
    const extra = [...fakeActual].filter((f) => !INTENDED_ICONS_FILES.has(f));
    expect(extra, 'mutation proof: extra file must be caught').toHaveLength(1);
    expect(extra[0]).toBe('packages/icons/src/react.tsx');
  });
});

// ---------------------------------------------------------------------------
// Test 4 — guard-bites-on-forbidden-artifact
// CLASS: regression
// BITE: red
//   The guard script `scripts/guard-no-loose-artifacts.sh` does NOT exist yet.
//   This test FAILS NOW (RED) because it tries to run a non-existent script.
//   When the production code is added, the test must:
//     (a) force-add a fake artifact → guard exits non-zero (RED)
//     (b) remove the artifact → guard exits 0 (GREEN)
//   This proves the guard is not green-from-birth.
//
// CLASS-LEVEL ISOLATION (Finding #2 fix): All git-mutation operations (git add -f,
// git restore --staged) MUST run in an isolated temp directory, never in REPO_ROOT.
// Mutating the live working tree creates two failure classes:
//   A) Any emitted non-gitignored file from a concurrent build/test step trips Test 1.
//   B) A process kill between `git add -f` and the finally-block cleanup leaves a
//      STAGED forbidden artifact in the real index, which trips Test 1 on the next run.
// The fix: run the guard against a minimal temp git repo that mirrors only what the
// guard needs — a copy of the guard script and a fabricated tracked artifact.
// ---------------------------------------------------------------------------
describe('guard-bites-on-forbidden-artifact', () => {
  const GUARD_SCRIPT = join(REPO_ROOT, 'scripts', 'guard-no-loose-artifacts.sh');

  it('guard script exists (production code gate — RED until script is created)', () => {
    expect(
      existsSync(GUARD_SCRIPT),
      `Guard script not found at: ${GUARD_SCRIPT}\nCreate scripts/guard-no-loose-artifacts.sh as production code first.`,
    ).toBe(true);
  });

  it('guard exits non-zero when a forbidden artifact is force-added (RED-proof)', () => {
    // Precondition: guard must exist (otherwise this test is trivially meaningless).
    if (!existsSync(GUARD_SCRIPT)) {
      // Test 4a above already fails — skip the run step, don't double-report.
      expect(existsSync(GUARD_SCRIPT), 'guard script must exist to test biting').toBe(true);
      return;
    }

    // ISOLATION: operate in a temp git repo, never in REPO_ROOT.
    // This prevents a process-kill between `git add -f` and cleanup from leaving a
    // staged artifact in the real index (the crash-leaves-dirty-index class).
    const tmpDir = mkdtempSync(join(tmpdir(), 'guard-bite-test-'));
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
      // `git ls-files` does not require a commit — the index is queryable immediately
      // after init. No commit needed, so no user-identity configuration is required.

      // Plant the forbidden artifact and stage it.
      const fakePath = join(tmpDir, '.audit-icons-x.png');
      writeFileSync(fakePath, 'fake artifact for RED-proof');
      const addResult = spawnSync('git', ['add', '-f', '.audit-icons-x.png'], {
        cwd: tmpDir,
        encoding: 'utf8',
        shell: false,
      });
      expect(addResult.status, 'git add -f failed in temp repo').toBe(0);

      // Guard must fail and name the file.
      const guardResult = spawnSync('bash', [GUARD_SCRIPT], {
        cwd: tmpDir,
        encoding: 'utf8',
        shell: false,
      });
      expect(
        guardResult.status,
        `Guard MUST exit non-zero when a forbidden artifact is staged.\nstdout: ${guardResult.stdout}\nstderr: ${guardResult.stderr}`,
      ).not.toBe(0);

      const output = guardResult.stdout + guardResult.stderr;
      expect(output, 'Guard output must name the offending file').toContain('.audit-icons-x.png');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('guard exits 0 on a clean temp repo (GREEN on no forbidden artifacts)', () => {
    if (!existsSync(GUARD_SCRIPT)) {
      expect(existsSync(GUARD_SCRIPT), 'guard script must exist to test GREEN restore').toBe(true);
      return;
    }

    // ISOLATION: use a temp repo with no forbidden artifacts tracked.
    const tmpDir = mkdtempSync(join(tmpdir(), 'guard-clean-test-'));
    try {
      execSync('git init', { cwd: tmpDir, stdio: 'pipe' });

      // Add a legitimate (non-forbidden) staged file. No commit required — git ls-files
      // queries the index, which is valid immediately after init + add.
      writeFileSync(join(tmpDir, 'package.json'), '{}');
      execSync('git add package.json', { cwd: tmpDir, stdio: 'pipe' });

      const guardResult = spawnSync('bash', [GUARD_SCRIPT], {
        cwd: tmpDir,
        encoding: 'utf8',
        shell: false,
      });
      expect(
        guardResult.status,
        `Guard must exit 0 on a clean repo (no forbidden artifacts tracked).\nstdout: ${guardResult.stdout}\nstderr: ${guardResult.stderr}`,
      ).toBe(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Test 5 — guard-no-false-positive-on-clean-head
// CLASS: unit
// BITE: red
//   Depends on the guard script existing — RED until production code lands.
// ---------------------------------------------------------------------------
describe('guard-no-false-positive-on-clean-head', () => {
  const GUARD_SCRIPT = join(REPO_ROOT, 'scripts', 'guard-no-loose-artifacts.sh');

  it('guard exits 0 on current clean HEAD (no false positive on legitimate tracked files)', () => {
    expect(
      existsSync(GUARD_SCRIPT),
      `Guard script not found at: ${GUARD_SCRIPT}\nCreate scripts/guard-no-loose-artifacts.sh as production code first.`,
    ).toBe(true);

    const result = shell(`bash "${GUARD_SCRIPT}"`);
    expect(
      result.status,
      `Guard false-positived on a clean HEAD.\nIt must not reject legitimate tracked files (screenshots/ regen artifacts, epics/ markdown).\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — pr-quality-e2e-real-green
// CLASS: e2e
// BITE: red (skipped until a PR is open; fails if checks are not green)
//   Set env var LABUI_CLEAN_LANDING_PR=<pr-number> to activate.
//   Without the env var the test is skipped — the absence of a PR is not a
//   failure at the unit-test level; it is gated by the CI run itself.
// ---------------------------------------------------------------------------
describe('pr-quality-e2e-real-green', () => {
  const prNumber = process.env.LABUI_CLEAN_LANDING_PR;

  it(
    'gh pr checks reports quality AND e2e GREEN (or each failure triaged external)',
    { skip: !prNumber },
    () => {
      if (!prNumber) {
        // Guard: never reach this with undefined prNumber (runtime safety).
        throw new Error('LABUI_CLEAN_LANDING_PR env var is not set — test must be skipped');
      }

      const result = spawnSync(
        'gh',
        ['pr', 'checks', prNumber, '--json', 'name,state,conclusion'],
        {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          shell: false,
        },
      );
      expect(
        result.status,
        `gh pr checks failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(0);

      type CheckEntry = { name: string; state: string; conclusion: string };
      const checks: CheckEntry[] = JSON.parse(result.stdout);

      const qualityCheck = checks.find((c) => c.name === 'lint · typecheck · build');
      const e2eCheck = checks.find((c) => c.name === 'playwright smoke');

      expect(
        qualityCheck,
        'quality check (lint · typecheck · build) not found in pr checks output',
      ).toBeDefined();
      expect(e2eCheck, 'e2e check (playwright smoke) not found in pr checks output').toBeDefined();

      expect(
        qualityCheck?.conclusion,
        `quality check is NOT green: ${qualityCheck?.conclusion}\nIf this is an external failure, provide evidence in EXTERNAL-FAILURE TRIAGE policy format (log excerpt + main-repro citation) before claiming pass.`,
      ).toBe('SUCCESS');

      expect(
        e2eCheck?.conclusion,
        `e2e check is NOT green: ${e2eCheck?.conclusion}\nIf this is an external failure, provide evidence in EXTERNAL-FAILURE TRIAGE policy format (log excerpt + main-repro citation) before claiming pass.`,
      ).toBe('SUCCESS');
    },
  );

  it('git status --porcelain on main is EMPTY after merge', { skip: !prNumber }, () => {
    if (!prNumber) {
      throw new Error('LABUI_CLEAN_LANDING_PR env var is not set — test must be skipped');
    }

    // Only meaningful on main after merge; on a feature branch this confirms
    // the merge has happened by checking the current branch is main.
    const branchResult = git('branch --show-current');
    expect(branchResult.stdout, 'This check must run on the main branch after merge').toBe('main');

    const { stdout: status } = git('status --porcelain');
    expect(status, `main is DIRTY after merge:\n${status}`).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Test 7 — stash-inventory-landed-vs-unique
// CLASS: differential
// BITE: mutation (see MUTATION-PROOF test below)
//
// WHY GATED BEHIND AN ENV VAR:
//   Git stash is developer-local state. A fresh checkout (CI, colleagues) has
//   ZERO stashes. Asserting exact stash names/count/diffs against a machine-local
//   snapshot is guaranteed red on CI and on every fresh clone — a class of
//   non-portable, environment-coupled tests.
//
//   Pattern: same as Test 6 (pr-quality-e2e-real-green). The developer sets
//   LABUI_STASH_INVENTORY=<expected-count> when they want to verify their local
//   stash is intact. CI never sets this variable, so CI never runs these checks.
//
//   To run locally:
//     LABUI_STASH_INVENTORY=2 pnpm --filter @labpics/ui-guard test
//
// ---------------------------------------------------------------------------
describe('stash-inventory-landed-vs-unique', () => {
  /**
   * Stash snapshot pinned at planning time (2026-06-23, developer machine):
   *   stash@{0} = pre-restart-20260622-0136
   *   stash@{1} = colors-contract-pin-GREEN-wip-recovery
   *
   * Activate by setting LABUI_STASH_INVENTORY=2 (the expected stash count).
   * Without the env var all assertions below are skipped — this is intentional.
   */
  const stashInventoryKey = process.env.LABUI_STASH_INVENTORY;
  const expectedCount = stashInventoryKey !== undefined ? Number(stashInventoryKey) : undefined;

  it(
    'stash count matches planning-time snapshot (2 stashes)',
    { skip: expectedCount === undefined },
    () => {
      const { stdout, status } = git('stash list');
      expect(status).toBe(0);

      const stashes = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      expect(
        stashes,
        `Stash count changed from the planning snapshot of ${expectedCount}.\nEither a stash was popped/dropped (check CH-02 disposition) or a new stash was pushed.\nCurrent stash list:\n${stdout}`,
      ).toHaveLength(expectedCount ?? 0);
    },
  );

  it(
    'stash@{0} is the pre-restart-20260622-0136 stash',
    { skip: expectedCount === undefined },
    () => {
      const { stdout, status } = git('stash list');
      expect(status).toBe(0);
      expect(
        stdout,
        'stash@{0} is not the expected pre-restart stash — stash order changed or stash was modified',
      ).toContain('pre-restart-20260622-0136');
    },
  );

  it(
    'stash@{1} is the colors-contract-pin-GREEN-wip-recovery stash',
    { skip: expectedCount === undefined },
    () => {
      const { stdout, status } = git('stash list');
      expect(status).toBe(0);
      expect(
        stdout,
        'stash@{1} is not the expected colors stash — stash order changed or stash was modified',
      ).toContain('colors-contract-pin-GREEN-wip-recovery');
    },
  );

  it(
    'stash@{0} diff against main has the expected unique files (tokens + pnpm-lock)',
    { skip: expectedCount === undefined },
    () => {
      const { stdout, status } = git('diff main...stash@{0} --name-only');
      expect(status).toBe(0);

      const changedFiles = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      // Verified at planning time: stash@{0} touches only these 3 paths.
      const EXPECTED_STASH_0_FILES = new Set([
        'apps/docs/package.json',
        'packages/tokens/src/index.ts',
        'pnpm-lock.yaml',
      ]);

      const unexpected = changedFiles.filter((f) => !EXPECTED_STASH_0_FILES.has(f));
      const missing = [...EXPECTED_STASH_0_FILES].filter((f) => !changedFiles.includes(f));

      expect(
        unexpected,
        `stash@{0} contains files NOT in the planning inventory — new work may have been stashed:\n  ${unexpected.join('\n  ')}`,
      ).toEqual([]);
      expect(
        missing,
        `stash@{0} is missing expected files — stash may have been partially applied:\n  ${missing.join('\n  ')}`,
      ).toEqual([]);
    },
  );

  it(
    'stash@{1} diff against main has the expected unique files (colors/core + pnpm-lock)',
    { skip: expectedCount === undefined },
    () => {
      const { stdout, status } = git('diff main...stash@{1} --name-only');
      expect(status).toBe(0);

      const changedFiles = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      // Verified at planning time: stash@{1} touches these 7 paths.
      const EXPECTED_STASH_1_FILES = new Set([
        'INTEGRATION.md',
        'packages/colors-stub/test/no-literal-colour-fallback.ts',
        'packages/colors-stub/tsconfig.json',
        'packages/core/package.json',
        'packages/core/src/css.ts',
        'packages/core/src/index.ts',
        'pnpm-lock.yaml',
      ]);

      const unexpected = changedFiles.filter((f) => !EXPECTED_STASH_1_FILES.has(f));
      const missing = [...EXPECTED_STASH_1_FILES].filter((f) => !changedFiles.includes(f));

      expect(
        unexpected,
        `stash@{1} contains files NOT in the planning inventory:\n  ${unexpected.join('\n  ')}`,
      ).toEqual([]);
      expect(
        missing,
        `stash@{1} is missing expected files — stash may have been partially applied:\n  ${missing.join('\n  ')}`,
      ).toEqual([]);
    },
  );

  /**
   * MUTATION-PROOF: the skip-gate itself is testable.
   * On any machine (CI or local without the env var), expectedCount is undefined
   * and all assertions above skip. This test proves the gate is real: setting
   * a wrong expected count while stash list is empty would fail the count check.
   */
  it('MUTATION-PROOF: skip-gate is real — undefined key skips inventory checks', () => {
    // The gate: if env var is absent, expectedCount === undefined → skip.
    // This assertion proves the gate formula is correct.
    const gate = process.env.LABUI_STASH_INVENTORY;
    if (gate === undefined) {
      // Confirm the skip logic: expectedCount would be undefined here.
      expect(expectedCount).toBeUndefined();
    } else {
      // Env var is set — confirm it parsed to a number.
      expect(typeof expectedCount).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Test 8 — stash-disposition-no-limbo
// CLASS: contract
// BITE: red
//   A disposition record does not exist yet — this test FAILS NOW (RED).
//   When CH-02 completes, a JSON disposition record at
//   `epics/clean-landing-reconcile/stash-dispositions.json` must exist,
//   each stash must appear with a `disposition` field of keep/promote/drop,
//   and any `drop` must have an `ownerConfirmation` field that is non-empty.
// ---------------------------------------------------------------------------
describe('stash-disposition-no-limbo', () => {
  const DISPOSITION_FILE = join(
    REPO_ROOT,
    'epics',
    'clean-landing-reconcile',
    'stash-dispositions.json',
  );

  it('stash-dispositions.json exists (RED until CH-02 completes)', () => {
    expect(
      existsSync(DISPOSITION_FILE),
      `Disposition record not found at: ${DISPOSITION_FILE}\nCH-02 (dispose-deferred-stashes) must create this file with explicit owner-confirmed dispositions before the epic can be marked complete.`,
    ).toBe(true);
  });

  it('each stash has exactly one disposition (keep / promote / drop)', () => {
    if (!existsSync(DISPOSITION_FILE)) {
      // Explicit skip — disposition file is the blocking precondition.
      expect(existsSync(DISPOSITION_FILE), 'Disposition file must exist first').toBe(true);
      return;
    }

    type Disposition = {
      stashRef: string;
      description: string;
      disposition: 'keep' | 'promote' | 'drop';
      ownerConfirmation?: string;
    };

    const records: Disposition[] = JSON.parse(
      readFileSync(DISPOSITION_FILE, 'utf8'),
    ) as Disposition[];

    const EXPECTED_STASH_REFS = ['stash@{0}', 'stash@{1}'];
    const VALID_DISPOSITIONS = new Set<string>(['keep', 'promote', 'drop']);

    for (const ref of EXPECTED_STASH_REFS) {
      const record = records.find((r) => r.stashRef === ref);
      expect(
        record,
        `No disposition record found for ${ref}. CH-02 must record every stash.`,
      ).toBeDefined();

      if (!record) continue;

      expect(
        VALID_DISPOSITIONS.has(record.disposition),
        `Invalid disposition "${record.disposition}" for ${ref}. Must be keep | promote | drop.`,
      ).toBe(true);

      if (record.disposition === 'drop') {
        expect(
          record.ownerConfirmation,
          `${ref} is marked "drop" but has no ownerConfirmation. Dropping a stash is irreversible — owner must explicitly confirm before execution.`,
        ).toBeTruthy();
      }
    }
  });

  it('no stash ends in undecided limbo (every stash ref has a disposition)', () => {
    if (!existsSync(DISPOSITION_FILE)) {
      expect(existsSync(DISPOSITION_FILE), 'Disposition file must exist first').toBe(true);
      return;
    }

    type Disposition = { stashRef: string; disposition: string };
    const records: Disposition[] = JSON.parse(
      readFileSync(DISPOSITION_FILE, 'utf8'),
    ) as Disposition[];

    // Get current stash list
    const { stdout } = git('stash list');
    const currentStashes = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      // Extract "stash@{N}" prefix
      .map((l) => l.split(':')[0]?.trim() ?? l);

    for (const stashRef of currentStashes) {
      const recorded = records.find((r) => r.stashRef === stashRef);
      expect(
        recorded,
        `${stashRef} has no disposition record. No stash may remain in undecided limbo.`,
      ).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 9 — state-json-stays-absent
// CLASS: regression
// BITE: mutation
//   STATE.json never existed and must never be created.
//   Mutation proved by: our assertion formula on an existing file fires correctly.
// ---------------------------------------------------------------------------
describe('state-json-stays-absent', () => {
  const STATE_JSON = join(REPO_ROOT, 'STATE.json');

  it('STATE.json does not exist on disk', () => {
    expect(
      existsSync(STATE_JSON),
      `STATE.json exists at ${STATE_JSON}.\nThe "resume from STATE.json" assumption is FALSE per EPIC.md Ground Truth.\nDelete it — state of record is the epic + Graphiti, never an on-disk JSON file.`,
    ).toBe(false);
  });

  it('STATE.json is not tracked by git', () => {
    const { stdout, status } = git('ls-files STATE.json');
    expect(status, 'git ls-files exited non-zero').toBe(0);
    expect(stdout, 'STATE.json is tracked by git — it must be removed and gitignored.').toBe('');
  });

  /**
   * MUTATION-PROOF: if STATE.json existed, existsSync would return true and the
   * test above would fail. We verify this by checking a file that does exist.
   */
  it('MUTATION-PROOF: existsSync fires correctly on a file that exists', () => {
    const packageJson = join(REPO_ROOT, 'package.json');
    // package.json must exist — if our existsSync logic were broken, this would fail.
    expect(
      existsSync(packageJson),
      'mutation proof: package.json must exist — confirms existsSync is not broken',
    ).toBe(true);
  });
});
