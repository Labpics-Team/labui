---
id: engine-gaps-record
epic: colors-contract-pin
title: "Record every unmet lab-colors engine capability as an external blocker with its labui call site"
user_story: "As the labui maintainer planning the later published-engine swap-out, I want a single authoritative document of every colour-engine capability the contract does NOT yet expose — each tied to the exact labui call site and the role it would consume — so that when lab-colors delivers, the swap is a checklist, not an archaeology dig, and no provisional value is mistaken for a final one."
enabler_for: ""
status: ready
priority: 3
depends_on: []
refine_after: []
parallel_group: foundation
agent_profile:
  category: writing
  skills: [write-docs, craft-arch]
---

# Record unmet engine capabilities as external blockers (docs/external-deps/lab-colors.md)

## User Story
As the labui maintainer planning the later published-engine swap-out, I want a single authoritative document of every colour-engine capability the contract does NOT yet expose — each tied to the exact labui call site and the role it would consume — so that when lab-colors delivers, the swap is a checklist, not an archaeology dig, and no provisional value is mistaken for a final one.

## Purpose
Create `docs/external-deps/lab-colors.md` recording each engine capability the `--lab-*` contract does NOT yet expose as an EXTERNAL DEPENDENCY / blocker, with: the exact labui call site (file:line), the role name it would consume, the provisional value labui ships today, and the lab-colors-v1 chapter that owns delivery. This is the richer, call-site-anchored companion to the existing `INTEGRATION.md` table — it MUST cross-link and not contradict it. No change is made to the lab-colors repo.

The gap inventory (grounded this session) covers at minimum: published `@labpics/colors` CSS+JS entry; frozen decorative-floor / separator / shadow-ramp magnitudes; `--lab-surface-shadow-tint`; the `--lab-shadow-alpha-*` JND alphas; and IC (inclusive/contrast) theme calibration. Each entry maps to a `local-or-gap` token from CH-01's allowlist — keeping the doc and the classifier in sync.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/inventory-gap-call-sites.md` | ready | writing | — |
| `tasks/write-external-deps-doc.md` | ready | writing | inventory-gap-call-sites |

## Exit Criteria
- [ ] Given engine capabilities the contract does NOT yet expose, When the scope completes, Then `docs/external-deps/lab-colors.md` lists each unmet need (published `@labpics/colors` CSS+JS entry; frozen decorative floor/separator/shadow-ramp magnitudes; `--lab-surface-shadow-tint`; `--lab-shadow-alpha-*` JND alphas; IC theme calibration) as an EXTERNAL blocker with the consuming labui call site (file:line) and the role name — and NO change is made to the lab-colors repo.
- [ ] Given the existing INTEGRATION.md, When the doc is written, Then it cross-links INTEGRATION.md and the lab-colors-v1 chapter names (native-and-release / runtime-engine / surface-jnd-contracts) without contradicting them.
- [ ] Given CH-01's `local-or-gap` allowlist, When the doc is reviewed, Then every gap token in the allowlist appears in the doc (and vice-versa) — the two are consistent.
