---
id: tree-reconcile-clean-landing
title: "Reconcile the working tree to the clean-landing invariant; finish & merge PR #51 real-green; correct the STATE.json assumption"
status: active
priority: 1
created: 2026-06-23
goal: "Land the already-built clean-landing reconciliation behind a real-green PR so `git status --porcelain` on main is EMPTY, the loose-artifact guard is CI-enforced, the STATE.json resume assumption is recorded FALSE, and the two deferred stashes are dispositioned by the owner."
success_criteria:
  - "PR #51 (head `ship/tree-reconcile-state-clean-landing`) merges to main with `gh pr checks 51` reporting `lint · typecheck · build` (the `quality` gate) and `playwright smoke` (the `e2e` gate) BOTH real GREEN — each non-green check triaged per the EXTERNAL-FAILURE policy with a cited main-repro, never by relaxing the bar."
  - "After merge, `git status --porcelain` on main is EMPTY — no `?? .audit-icons-*.png`, `?? .audit-ux/`, `.pw-audit/`, `.peertmp/`, `_provenance/`, `_typography-*.png`, no `?? apps/docs/src/icons*-demo.*` / `icons*.html`, no `?? icons-variant-v1-screenshot.png`, and no orphan `packages/icons/src/{data,react.tsx,registry.ts,render.ts,types.ts}` / `packages/icons/{NOTICE,scripts}` left loose."
  - "The STATE.json resume assumption is recorded FALSE in the state of record (this EPIC + Graphiti); `ls STATE.json` returns nothing; no STATE.json is created or referenced by any tooling."
  - "A loose-artifact guard (CI step + `scripts/guard-no-loose-artifacts.sh` + RED-proving `packages/guard/test/clean-landing.test.ts`) is merged and BITES — it fails when a forbidden loose artifact reappears."
  - "Both deferred stashes (`stash@{0}` pre-restart-20260622-0136, `stash@{1}` colors-contract-pin-GREEN-wip-recovery) are dispositioned (keep / promote-to-PR / drop) — any DROP gated on explicit owner confirmation, recorded in `stash-dispositions.json` + Graphiti."
  - "Redundant PR #50 (`feat/clean-landing-guard-and-refactor`) is closed as superseded by #51 (which is its strict superset: +commit c77dcf2)."
depends_on: []
---

# Reconcile the working tree to the clean-landing invariant

## Goal
One sentence: drive the already-implemented clean-landing reconciliation to a real-green merge so main lands clean, the guard is enforced, the STATE.json assumption is corrected, and the two stashes are owner-dispositioned.

## GROUND TRUTH (verified 2026-06-23 — the brief's premise is stale)
The brief asserts a dirty tree (7 modified + 25 untracked, loose audit PNGs, icons scaffolds). **That state does not exist now.** Verified directly:
- `git status --porcelain` on main → **EMPTY** ("nothing to commit, working tree clean").
- None of the named loose artifacts exist: `.audit-icons-*.png`, `.audit-ux/`, `.pw-audit/`, `.peertmp/`, `_provenance/`, `_typography-*.png`, `icons-variant-v1-screenshot.png`, `apps/docs/src/icons*-demo.*`, `icons*.html` — all `No such file or directory`.
- `packages/icons` tracks exactly 4 files (`package.json`, `src/index.ts`, `tsconfig.json`, `tsup.config.ts`); no orphan `src/{data,react.tsx,registry.ts,render.ts,types.ts}`, `NOTICE`, or `scripts/`.
- `.gitignore` already excludes `dist/`, `node_modules/`, `*.log`, `test-results/`, `screenshots/` and the scratch packages — which is why the tree is clean.

**A prior session already did this scope.** The substantive reconciliation lives on branch `ship/tree-reconcile-state-clean-landing` behind **draft PR #51** ("feat(guard): prove clean-landing invariant and lock it under CI"), which already contains: the epic `clean-landing-reconcile/**`, `scripts/guard-no-loose-artifacts.sh`, `.gitignore` hardening, `packages/guard/test/clean-landing.test.ts` (747 lines, RED-proving), `stash-dispositions.json`, and the CI `sca` gate. **This EPIC is therefore a DELIVERY plan, not a rebuild** — the work to do is finishing and merging that PR, not re-authoring it.

### STATE.json correction (exit-criterion, recorded here as the state of record)
The mission's "resume from STATE.json" assumption is **FALSE**: `ls STATE.json` → nothing in this repo. This scope neither reads nor fabricates a STATE.json. The state of record is **this EPIC + Graphiti**, never an on-disk resume file. The unrelated on-disk epic `epics/colors-contract-pin/` is the narrower colour-contract scope and is **explicitly NOT this plan**.

### CI gate name mapping (exit-criteria say `quality`/`e2e`; real job display-names differ)
- `quality` exit-gate  →  CI job `quality`, display **"lint · typecheck · build"** — currently **PASS** on #51.
- `e2e` exit-gate       →  CI job `e2e`, display **"playwright smoke"** — currently **PASS** on #51.
- (`sca`, display "supply-chain · secrets · misconfig" — currently RED on #51; NOT named by the exit-criteria, but must be triaged: see Notes.)

## Class of problem closed
**Substrate dishonesty / silent drift at the foundation.** Not "delete these specific files" (input-level) but the CLASS: *any* loose, unowned artifact landing on main, and *any* false resume-anchor in the state of record. Closed by a CI-enforced guard (the invariant cannot regress without a red gate) + a corrected, single source of truth for state. A one-time `rm` would be a patch; the guard is the root-cause fix.

## Success Criteria
- [ ] CH-01 — finish & merge PR #51 real-green; prove clean main; correct STATE.json; close redundant #50
- [ ] CH-02 — disposition the two deferred stashes (owner-gated on any DROP)

## Chapters
| Chapter | Status | Priority |
|---------|--------|----------|
| `chapters/finish-clean-landing-delivery/` | ready | 1 |
| `chapters/reconcile-deferred-stashes/` | ready | 2 |

## Backlog
Deferred owner requests live in the sibling `BACKLOG.md`. **Drain contract:** every executor working this epic MUST — each grounding/NextWork cycle AND on resume — drain `[OPEN]` items from `BACKLOG.md` (priority-first, outranking discovered work), promote each into a chapter/task anchored to its sacred Verbatim quote, resolve it with 0 questions (source or derive-to-root), and mark it `[DONE]` + PR on delivery. A non-empty backlog means the epic is NOT complete.

## Notes
- **Blast radius:** repo-wide on disk, but the *committed diff* is tiny and already authored on #51 — CI guard step + `scripts/guard-no-loose-artifacts.sh` + `.gitignore` hardening + `packages/guard/**` test + the reconcile epic's markdown. A handful of `src/index.ts` dead-export removals + a `lab-element.ts` lift are already in the branch (from PR #50, folded in). No product UI redesign, no other-team zones. Stay on this surface (CREED #5).
- **EXTERNAL-FAILURE TRIAGE policy:** a red `quality`/`e2e` check is "real-green-equivalent" ONLY if every failure is proven external/pre-existing — reproduced on `main` with a cited log excerpt + main-repro. Otherwise the check must be actually green. No widening tolerance after the fact (CREED #9).
- **The current `sca` RED on #51 is the live triage item.** Evidence (run 27993414302): Trivy fails ~1.4s in, before any scan output, right after setup/DB fetch — `Process completed with exit code 1` with no `Total:`/`CVE-`/finding lines. Signature of a Trivy DB-registry flake (TOOMANYREQUESTS / transient), NOT a HIGH/CRITICAL finding in repo contents. Required action: re-run the job; if it greens, it was flake; if it stays red with a *real* finding, that finding is a genuine fix (not external) and must be closed. The SHA-rot that previously zeroed this gate is already fixed (commit c77dcf2 repinned trivy-action to the real v0.31.0 SHA). `sca` is not a named exit-gate, but a guard epic must not merge with its own security gate silently broken (CREED #7 — don't mask pre-existing).
- **CodeRabbit "pass" can be a rate-limit pass-through, not a review** (MEMORY: coderabbit-credits-exhausted). Require an isolated PASS verified via `gh api .../reviews`, not a bare green check (⛔ #4 — no theater).
- **Stash disposition needs the owner** (⛔ #6 / money·irreversible): a `git stash drop` is irreversible once gc-expired. CH-02 STOPS for owner confirmation before any drop; keep/promote is reversible and may proceed autonomously. Escalate as a plain business question ("keep this saved work / build it next / throw it away?"), never an architecture question — owner is a designer.
- **PR #51 ⊇ PR #50:** `git log origin/feat/clean-landing-guard-and-refactor..origin/ship/tree-reconcile-state-clean-landing` = exactly one commit (c77dcf2). #51 is a strict superset; #50 must be closed as superseded, not merged in parallel (avoids a double-landing race).
- **This is NOT an implementation task for the planner.** Execution (driving CI green, merging, stash disposition) belongs to a builder + verifier (dive-git / dive-github / verification-receive). Planner hands this off for confirmation.
