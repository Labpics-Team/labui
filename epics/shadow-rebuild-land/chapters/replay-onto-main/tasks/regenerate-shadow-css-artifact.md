---
id: regenerate-shadow-css-artifact
chapter: replay-onto-main
epic: shadow-rebuild-land
title: "Regenerate shadow.css from config and confirm no hand-authored drift"
status: done
priority: 2
depends_on:
  - cut-landing-branch-and-replay
blocks: []
agent_profile:
  category: quick
  skills: [craft-frontend]
started: null
completed: null
refine_after: []
---

# Regenerate shadow.css from config and confirm no hand-authored drift

## What
Run `pnpm install` (if needed) then `pnpm --filter @labpics/shadow generate`. Confirm `packages/shadow/src/generated/shadow.css` (and the dist copy via build) match what the replayed config + domain produce. The config is the SSOT — the committed CSS must equal the regenerated CSS.

## Must NOT Do
- Do NOT hand-edit the generated CSS to make it match; if it differs, the difference is a real config/domain bug to investigate.
- Do NOT commit a generated CSS that diverges from `pnpm generate` output.

## Verification
- [ ] After `pnpm --filter @labpics/shadow generate`, `git diff -- packages/shadow/src/generated/shadow.css` is empty (committed output already matches the generator).
- [ ] `pnpm --filter @labpics/shadow build` succeeds and copies artifacts.

## References
- `packages/shadow/scripts/build-shadow.ts` — generate entrypoint.
- `packages/shadow/src/generate-css.ts` — CSS emitter.
- `packages/shadow/scripts/copy-artifacts.ts` — dist copy.
