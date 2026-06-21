---
id: contract-pin-snapshot-test
chapter: contract-pin-test
epic: colors-contract-pin
title: "Vitest contract-pin test: every consumed colour role present in roles.json + contract.css; zero unclassified"
status: ready
priority: 1
depends_on:
  - enumerate-and-classify-consumed-roles
blocks: []
agent_profile:
  category: deep
  skills: [craft-qa]
started: null
completed: null
refine_after: []
---

# Vitest contract-pin test

## What
Add `packages/colors-stub/test/consumed-contract.test.ts` using the module from the prior task. It MUST assert, with RED-first discipline (write a failing assertion, prove it fails for the right reason, then make it pass):

1. **Every consumed colour-contract role exists in `roles.json`.** For each name where `classify(name) === 'colour-contract'` is FALSE only because it is absent — i.e. enumerate consumed names, take those that LOOK like semantic roles (match a `SEMANTIC_ROLE_PREFIXES` prefix) but are NOT in `roles.json` — the set must be empty. Failure message lists each missing role and the prefix it matched.
2. **Every consumed colour-contract role is also DECLARED in `contract.css`** in every theme scope (reuse the `declares()` + `scopeBody()` logic already proven in `contract.test.ts`, or import/share it). This binds the consumer set to the actual CSS, not just the manifest.
3. **Zero unclassified consumed names.** `byBucket().unclassified` must be `[]`; failure names each unclassified token and the file:line it was first seen, instructing the author to either (a) add it to the colour contract upstream, (b) confirm it as a dimension token, or (c) document it in `docs/external-deps/lab-colors.md` and add it to the local-or-gap allowlist.
4. **Detection proof (anti-blindness):** a synthetic check feeding a fabricated consumed name proves the "missing role fails" path actually fires (so a green run means "pinned", never "blind"). Do this WITHOUT mutating the live tree — pass a synthetic name list into a pure inner function.

## Must NOT Do
- Do NOT assert colour VALUES (those are placeholder constants owned by the resolver — out of scope, and `contract.test.ts` already guards value shape).
- Do NOT duplicate the per-group count assertions already in `contract.test.ts` — this test pins the CONSUMER→contract direction; `contract.test.ts` pins the contract's internal shape. Keep them complementary, cross-reference in a comment.
- Do NOT touch lab-colors, `roles.json`, or `contract.css` to make the test pass — if a consumed role is genuinely missing from the contract, that is a real finding: STOP and report it as a CH-03 external blocker.

## Verification
- [ ] `pnpm --filter @labpics/colors test` runs the new spec and it PASSES on the current tree.
- [ ] Temporarily renaming one role in a LOCAL COPY (not committed) demonstrates the test fails naming that role — capture as evidence, then revert. (RED-proof per testing-standard.)
- [ ] The unclassified-set assertion is `[]` on the live tree.
- [ ] `pnpm -r test` stays green overall.

## References
- `packages/colors-stub/test/consumed-contract.ts` — enumerator/classifier from prior task.
- `packages/colors-stub/test/contract.test.ts` — reuse `scopeBody()` / `declares()`; keep complementary.
- testing-standard (MEMORY) — RED must fail first; close the CLASS, not the patch.
