---
id: recommend-and-escalate-disposition
chapter: dispose-deferred-stashes
epic: clean-landing-reconcile
title: "Recommend a disposition per stash; escalate any drop to the owner before executing"
status: ready
priority: 1
depends_on:
  - inventory-and-diff-stashes
blocks: []
agent_profile:
  category: deep
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Recommend a disposition per stash; escalate any drop to the owner before executing

## What
Using the inventory from the prior task, decide each stash's fate:

1. For each stash, classify into exactly one disposition with a one-line rationale grounded in the inventory:
   - **keep** — unique/unlanded work, not ready to plan now → leave stashed, record why + a re-visit pointer.
   - **promote** — unique/unlanded work that should become real → register it as its own epic (e.g. resurrect `epics/figma-parity-harness/` from stash@{0} onto a branch via `git stash apply` on a feature branch, NOT main) and hand off. Reversible → may proceed autonomously.
   - **drop** — fully superseded/landed, nothing unique → `git stash drop`. **IRREVERSIBLE** once gc-expired → STOP, escalate to owner in plain language first.
2. **Escalation for any `drop`** (CLAUDE.md ⛔ #6 / CREED #6): present to the owner as a designer-friendly business question — e.g. "Stash X holds saved work that already shipped in PRs #41/#44/#45/#47; nothing in it is unique. Throw it away, or keep it just in case?" Provide your recommendation first (CLAUDE.md: lead, don't offload judgment). Do NOT ask architecture questions. Do NOT drop without an explicit yes.
3. Execute only the confirmed dispositions. `git stash list` must then reflect the decisions (kept stashes remain; promoted ones applied-to-branch then optionally dropped-with-confirmation; dropped ones gone).
4. Record each stash's final fate + evidence to Graphiti. The chapter is complete only when NO stash is in undecided limbo.

## Must NOT Do
- Do NOT `git stash drop` without explicit owner confirmation (irreversible).
- Do NOT `git stash apply`/`pop` onto `main` — promotion goes onto a feature branch.
- Do NOT dirty `main`'s tree — the CH-01 invariant must still hold at chapter end.
- Do NOT silently absorb stash content into this epic's PR.

## Verification
- [ ] Each stash has exactly one recorded disposition + rationale tied to inventory evidence.
- [ ] Any `drop` shows owner confirmation captured BEFORE execution.
- [ ] `git stash list` reflects the executed decisions; `git status --porcelain` on main still EMPTY.
- [ ] Graphiti episode per stash with final fate + evidence.

## References
- `./inventory-and-diff-stashes.md` — the inventory this decision rests on.
- `../../../EPIC.md` — Notes: stash disposition needs the owner; keep/promote reversible, drop not.
