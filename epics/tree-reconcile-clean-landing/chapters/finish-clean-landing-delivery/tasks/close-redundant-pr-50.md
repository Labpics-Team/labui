---
id: close-redundant-pr-50
chapter: finish-clean-landing-delivery
epic: tree-reconcile-clean-landing
title: "Close PR #50 as superseded by #51 (strict superset)"
status: ready
priority: 2
depends_on: []
blocks:
  - verify-merge-and-prove-clean-main
agent_profile:
  category: quick
  skills: [dive-github]
started: null
completed: null
refine_after: []
---

# Close PR #50 as superseded by #51

## What
PR #50 (`feat/clean-landing-guard-and-refactor`) and PR #51 (`ship/tree-reconcile-state-clean-landing`) are the same body of work; #51 has exactly one extra commit (c77dcf2, the format + Trivy-SHA gate fix) and is a strict superset. Landing both risks a double-merge / conflict race.
1. Re-confirm the superset relation: `git log origin/feat/clean-landing-guard-and-refactor..origin/ship/tree-reconcile-state-clean-landing` → expect exactly `c77dcf2`. And the reverse `..` → expect EMPTY (nothing on #50 missing from #51).
2. If confirmed, close PR #50 with a comment: "Superseded by #51, which is a strict superset (+c77dcf2 closes the format + Trivy-SHA gate-failure classes). Closing to avoid a double-landing race."
3. Do NOT delete the branch unless the owner/repo policy auto-prunes; closing the PR is sufficient.

## Must NOT Do
- Do NOT close #50 if the reverse-range check shows commits on #50 that are NOT on #51 (then they are divergent — FLAG instead of closing).
- Do NOT merge #50.

## Verification
- [ ] Forward range = exactly `c77dcf2`; reverse range EMPTY — captured.
- [ ] #50 closed with the superseded comment linking #51 (or FLAGGED if divergent).

## References
- EPIC Notes — "PR #51 ⊇ PR #50".
