---
id: escalate-and-execute-disposition
chapter: reconcile-deferred-stashes
epic: tree-reconcile-clean-landing
title: "Execute keep/promote autonomously; STOP for owner confirmation before any DROP"
status: ready
priority: 1
depends_on:
  - inventory-and-classify-stashes
blocks: []
agent_profile:
  category: deep
  skills: [dive-git]
started: null
completed: null
refine_after: []
---

# Execute keep/promote autonomously; STOP for owner confirmation before any DROP

## What
Act on the classifications from `stash-dispositions.json`:
1. **keep** — leave the stash; record the deferral reason. No action beyond the record.
2. **promote** — land the wanted content via its OWNING scope's PR (e.g. colors-contract-pin), not main directly, not this epic's PR. Reference the stash in that PR.
3. **drop** — **STOP. Escalate to the owner** as a plain business question, e.g.: "Есть две сохранённые незавершённые правки в git stash. По проверке их содержимое уже в main / больше не нужно. Удалить их насовсем, оставить, или доделать отдельно?" Only after explicit owner confirmation: `git stash drop stash@{N}`. Drop is irreversible once gc-expired (⛔ #6) — never autonomous.
4. After all actions: `git stash list` reflects the decisions; write a Graphiti episode (group `daniel-agent-local`) with the per-stash outcome + evidence + date MSK.

## Must NOT Do
- Do NOT drop ANY stash without explicit owner confirmation (⛔ #6 — irreversible).
- Do NOT ask the owner an architecture/technical question — frame disposition as a business choice (owner is a designer).
- Do NOT fold promoted content into this epic's clean-landing PR.

## Verification
- [ ] keep/promote executed and recorded; promoted content lands via its owning-scope PR (link captured).
- [ ] Any drop preceded by a captured owner confirmation; otherwise the stash is retained.
- [ ] `git stash list` matches `stash-dispositions.json`; Graphiti episode written.

## References
- `../inventory-and-classify-stashes.md` — the classifications this task executes.
- EPIC Notes — owner-gated drop rule + business-question framing.
