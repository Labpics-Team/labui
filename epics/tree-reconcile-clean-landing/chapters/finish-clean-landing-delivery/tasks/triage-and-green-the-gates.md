---
id: triage-and-green-the-gates
chapter: finish-clean-landing-delivery
epic: tree-reconcile-clean-landing
title: "Drive PR #51 quality+e2e real-green; triage the sca Trivy flake per EXTERNAL-FAILURE policy"
status: ready
priority: 1
depends_on:
  - reground-and-correct-state-json
blocks:
  - verify-merge-and-prove-clean-main
agent_profile:
  category: deep
  skills: [dive-github, verification-receive]
started: null
completed: null
refine_after: []
---

# Drive PR #51 quality+e2e real-green; triage the sca Trivy flake

## What
PR #51 already has `quality` (lint·typecheck·build) and `e2e` (playwright smoke) GREEN. The live RED is `sca` (supply-chain·secrets·misconfig). Confirm and close out:
1. `gh pr checks 51` → record current state of all four checks.
2. **Confirm quality + e2e GREEN.** If either has gone red since planning, apply EXTERNAL-FAILURE TRIAGE: reproduce on `main` (checkout main, run the same CI step), cite the log excerpt + main-repro. If not reproducible on main, it is a real branch failure → fix on the branch until genuinely green. Never widen tolerance after the fact (CREED #9).
3. **Triage `sca`.** Inspect the failing run log (latest run for #51). PREDICT: the failure is a Trivy DB-registry flake (fails ~1.4s in, before any `Total:`/`CVE-` output — see EPIC Notes / run 27993414302), NOT a HIGH/CRITICAL finding. CHECK: re-run the `sca` job (`gh run rerun <id> --job <sca>` or push-trigger).
   - If it greens → flake confirmed; record evidence.
   - If it stays red WITH a real HIGH/CRITICAL finding in the log → that is NOT external. It is a genuine fix this guard-epic must not mask (CREED #7). FLAG it; the fix belongs to whoever owns the offending dependency/config — do not silently suppress or `.trivyignore` it without grounding the CVE.
4. Record the triage verdict (flake vs real) with cited log evidence for the merge gate.

## Must NOT Do
- Do NOT mark green by relaxing the guard, loosening Trivy severity, or blanket-adding `.trivyignore` entries without grounding each CVE.
- Do NOT use `--no-verify` / `--force` (⛔ #3).
- Do NOT accept a CodeRabbit green as a review — it can be a rate-limit pass-through (verified in the next task via `gh api`).

## Verification
- [ ] `gh pr checks 51`: `quality` GREEN, `e2e` GREEN — captured (or each red triaged external with main-repro).
- [ ] `sca` verdict recorded: GREEN after re-run (flake), OR red-with-real-finding FLAGGED with the CVE/finding cited.
- [ ] No tolerance widened post-hoc; predictions vs outcomes recorded.

## References
- `.github/workflows/ci.yml` (on the branch) — jobs `quality`, `e2e`, `sca`.
- EPIC Notes — sca flake signature + the c77dcf2 SHA-rot fix already applied.
- MEMORY: `golangci-lint-version-must-match-ci.md` — local-vs-CI version skew gives false green; trust the CI run, not local.
