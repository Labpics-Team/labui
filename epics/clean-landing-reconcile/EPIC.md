---
id: clean-landing-reconcile
title: "Reconcile the working tree against the clean-landing invariant"
status: active
priority: 1
created: 2026-06-23
goal: "Prove and permanently lock a clean git status on main so every later scope starts from an honest substrate."
success_criteria:
  - "`git status --porcelain` on main is EMPTY after the owning PR merges (no loose audit PNGs, no demo scaffolds, no orphan icons files, no dangling modifications)."
  - "A PR from a feature branch reports BOTH `quality` and `e2e` checks as real GREEN, triaged per the EXTERNAL-FAILURE TRIAGE policy."
  - "The 'resume from STATE.json' assumption is recorded as FALSE in this epic and in Graphiti; no scope reads or fabricates STATE.json."
  - "The two stashes (pre-restart-20260622-0136, colors-contract-pin-GREEN-wip-recovery) each have an explicit, owner-confirmed disposition — kept-with-rationale, promoted-to-an-epic, or dropped — so no deferred work is silently lost."
  - "A regression guard exists that fails CI if a known loose-artifact class (audit PNGs, audit dirs, demo scaffolds) is ever committed again."
depends_on: []
---

# Reconcile the working tree against the clean-landing invariant

## Goal
Prove and permanently lock a clean `git status` on main so every later scope starts from an honest substrate.

## Ground Truth (verified 2026-06-23 MSK — read before executing)
The mission brief describes a dirty tree (7 modified + 25 untracked, loose audit PNGs, demo scaffolds). **That state no longer exists on disk.** Verified:

- `git status --porcelain --untracked-files=all` on `main` is **EMPTY** — tree already clean.
- `ls STATE.json` → no such file. The "resume from STATE.json" assumption is **FALSE**. This epic neither reads nor fabricates a STATE.json; the state of record is this epic + Graphiti.
- The dirty state was **stashed, not lost**:
  - `stash@{0}` = `pre-restart-20260622-0136` — figma-parity-harness work (`packages/parity/*`, `apps/docs/tests/parity/*`, `epics/figma-parity-harness/*`, `packages/tokens/src/index.ts`, `pnpm-lock.yaml`; 54 files).
  - `stash@{1}` = `colors-contract-pin-GREEN-wip-recovery` — colors-stub/core test work (`epics/colors-contract-pin/*`; 29 files).
- **None** of the named loose artifacts exist anywhere (disk or stash): `.audit-icons-*.png`, `.audit-ux/`, `.pw-audit/`, `.peertmp/`, `_provenance/`, `_typography-*.png`, `icons*-demo.*`, `icons*.html`, `icons-variant-v1-screenshot.png`. `git check-ignore` returned nothing → they are not merely gitignored; they were deleted.
- **None** of the named icons exit-criteria files exist anywhere: `packages/icons/src/{data/,react.tsx,registry.ts,render.ts,types.ts}`, `packages/icons/{NOTICE,scripts/}`. `git ls-files packages/icons` = exactly 4 files (`package.json`, `src/index.ts`, `tsconfig.json`, `tsup.config.ts`), all clean.
- `epics/colors-contract-pin/` is **tracked + committed** (PRs #41/#44/#45/#47) — the unrelated narrower epic, explicitly NOT this plan, and correctly NOT a loose artifact.

**Class of problem closed:** *substrate dishonesty / stale-baseline drift* — later scopes building on an assumed-clean tree that is actually carrying orphan artifacts or silently-lost deferred work. The destructive cleanup the brief anticipated is **already done**; what remains is to (a) PROVE the invariant under CI, (b) make the two stashes' fate an explicit decision instead of an indefinite limbo, and (c) install a guard so the class cannot silently recur.

## Scope decision (honest correction, per IMPLEMENTER'S CREED #1 GROUND-don't-guess)
The brief's exit-criteria are written against a tree state that no longer exists. Rather than fabricate work to "delete" files that are already gone, this epic **satisfies each exit-criterion by verification** (prove the absence) and adds the two pieces of *real* remaining risk: stash disposition and a regression guard. Every original exit-criterion below is mapped to a concrete check. If the executor, on grounding, finds the tree dirty again (e.g. a stash was popped), CH-01 reverts to its full classify-or-delete form — the gates handle that branch.

## Chapters
| Chapter | Status | Priority |
|---------|--------|----------|
| `chapters/prove-and-lock-clean-landing/` | ready | 1 |
| `chapters/dispose-deferred-stashes/` | ready | 2 |

## Backlog
Deferred owner requests live in the sibling `BACKLOG.md`. **Drain contract:** every executor working this epic MUST — each grounding/NextWork cycle AND on resume — drain `[OPEN]` items from `BACKLOG.md` (priority-first, outranking discovered work), promote each into a chapter/task anchored to its sacred Verbatim quote, resolve it with 0 questions (source or derive-to-root), and mark it `[DONE]` + PR on delivery. A non-empty backlog means the epic is NOT complete.

## Notes
- **Blast radius:** repo-wide on disk, but the *committed diff* is tiny — at most a CI guard file + a `.gitignore` hardening + this epic's own tracked markdown. No product code, no UI, no other-team zones touched. Stay on this surface (CREED #5).
- **Stash disposition needs the owner** (CREED #6 / CLAUDE.md money·irreversible): dropping a stash is irreversible once gc-expired. CH-02 must STOP for owner confirmation before any `git stash drop`. Keeping or promoting is reversible and may proceed autonomously.
- **EXTERNAL-FAILURE TRIAGE policy** (referenced by exit-criteria): a red `quality`/`e2e` check counts as "real GREEN-equivalent" ONLY if every failure is proven external/pre-existing (infra flake, network, a failure reproducible on `main` before this branch). Each such triage must cite evidence (log excerpt + the `main` repro). Otherwise the check must be actually green. No widening the tolerance after the fact (CREED #9).
- Owner is a designer, not a developer — escalate disposition as a plain business question ("keep this saved work / build it next / throw it away?"), never an architecture question.
