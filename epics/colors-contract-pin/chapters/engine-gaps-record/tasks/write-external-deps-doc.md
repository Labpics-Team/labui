---
id: write-external-deps-doc
chapter: engine-gaps-record
epic: colors-contract-pin
title: "Write docs/external-deps/lab-colors.md from the call-site inventory"
status: ready
priority: 1
depends_on:
  - inventory-gap-call-sites
blocks: []
agent_profile:
  category: writing
  skills: [write-docs]
started: null
completed: null
refine_after: []
---

# Write docs/external-deps/lab-colors.md

## What
Create `docs/external-deps/lab-colors.md` (new `docs/external-deps/` directory). Diátaxis: this is REFERENCE — a precise, scannable table, not a tutorial. For each capability from the inventory, one row/section with:
- **Capability** — one-line name of the unmet engine feature.
- **Consuming call site** — `file:line` (or "no current consumer — anticipated").
- **Role consumed** — the `--lab-*` name labui reads (or "n/a — package entry").
- **Provisional value today** — what labui ships now, and the file that holds it (flagged clearly as PROVISIONAL / NOT FINAL).
- **Owner** — the lab-colors-v1 chapter (`native-and-release` / `runtime-engine` / `surface-jnd-contracts`).
- **Swap-in note** — why delivery is a no-op for consumers (same names; value-only change).

Open with a short header restating the law: labui consumes lab-colors EXCLUSIVELY via `--lab-*`; lab-colors is EXTERNAL and MUST NOT be built/branched/modified here; these are blockers ON lab-colors, tracked from the consumer side. Cross-link `INTEGRATION.md` and `docs/core-CONTRACT.md` §0 law 2. State that the published-engine swap is the LATER `colors-publish-swapout` scope.

## Must NOT Do
- Do NOT change the lab-colors repo, or file issues into it from here — this is the labui-side record.
- Do NOT contradict INTEGRATION.md; if a number/owner differs, reconcile and note it (INTEGRATION.md is the existing source for the 3 filed requests).
- Do NOT present any provisional value as final, and do NOT fake a value — quote the live file.
- Do NOT duplicate the whole INTEGRATION.md table verbatim; this doc is call-site-anchored and richer (decorative floor / separator / shadow-ramp magnitudes + IC calibration are NEW here).

## Verification
- [ ] `docs/external-deps/lab-colors.md` exists and lists all 5 capability classes named in the chapter exit criteria.
- [ ] Every gap token in CH-01's `local-or-gap` allowlist is represented (consistency check passes).
- [ ] Every `file:line` cited resolves to a real consumer (spot-check 3).
- [ ] Cross-links to INTEGRATION.md and core-CONTRACT.md are present and correct.
- [ ] `pnpm lint` / `format:check` unaffected (markdown only); no lab-colors repo change.

## References
- The inventory note from `inventory-gap-call-sites`.
- `INTEGRATION.md`, `docs/core-CONTRACT.md`.
- write-docs skill (Diátaxis reference style); MEMORY `colors-labui-state`, `labui-token-values-ground-in-figma`, `daniil-separators-barely-perceptible`.
