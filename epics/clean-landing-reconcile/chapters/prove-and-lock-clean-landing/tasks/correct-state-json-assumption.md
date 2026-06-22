---
id: correct-state-json-assumption
chapter: prove-and-lock-clean-landing
epic: clean-landing-reconcile
title: "Record the STATE.json resume assumption as FALSE in the state of record"
status: ready
priority: 1
depends_on: []
blocks:
  - green-pr-and-prove-clean-main
agent_profile:
  category: quick
  skills: []
started: null
completed: null
refine_after: []
---

# Record the STATE.json resume assumption as FALSE in the state of record

## What
The mission assumed it could "resume from STATE.json". That file does not exist. Correct the record so no future executor fabricates one:

1. Confirm `ls STATE.json` returns nothing (already verified 2026-06-23; re-confirm at execution time).
2. Ensure the FALSE-assumption correction is stated in `epics/clean-landing-reconcile/EPIC.md` (it is — Ground Truth + success_criteria). No code change needed.
3. Write one Graphiti episode (group `daniel-agent-local`): "STATE.json resume anchor is FALSE for labui; state of record = this epic + Graphiti, never an on-disk resume file." Include the `ls` evidence and date MSK.

## Must NOT Do
- Do NOT create a STATE.json to "satisfy" the assumption.
- Do NOT add a STATE.json reference to any tooling.

## Verification
- [ ] `ls STATE.json` re-run, returns nothing — captured.
- [ ] EPIC.md asserts the assumption is FALSE (already present; confirm not regressed).
- [ ] Graphiti episode written and confirmed queued.

## References
- `../../../EPIC.md` — success_criteria item on STATE.json.
