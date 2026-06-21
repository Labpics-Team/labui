---
id: colors-contract-pin
title: "Pin & assert the consumed --lab-* contract; CI no-hardcoded-colour guard; record engine gaps"
status: active
priority: 1
created: 2026-06-21
goal: "Make the --lab-* colour-consumption boundary a CI-enforced contract: a snapshot pins every consumed role, a guard fails on any literal colour, and every unmet engine capability is recorded as an external blocker — with zero changes to the external lab-colors repo."
success_criteria:
  - "A contract-pin test enumerates every --lab-* COLOUR role labui consumes and asserts each exists in colors-stub roles.json + contract.css; a dropped/renamed role fails CI loudly."
  - "A no-hardcoded-colour guard scans all .css/.tsx/.ts under packages/* and fails on any literal hex/rgb/hsl/named/system colour outside the allowlisted contract file, naming file:line."
  - "A css.ts three-language unit test proves a forbidden primitive reference is rejected and a semantic-role reference is accepted."
  - "docs/external-deps/lab-colors.md lists each unmet engine capability as an EXTERNAL blocker with the exact labui call site and the role name it would consume — with NO change to the lab-colors repo."
  - "pnpm -r typecheck && pnpm -r build && pnpm -r test all pass clean; pnpm test:e2e passes locally before push."
depends_on: []
---

# Pin & assert the consumed --lab-* contract surface

## Goal
Make the `--lab-*` colour-consumption boundary a CI-enforced contract: pin every consumed role with a snapshot test, fail the build on any literal colour, and record every unmet colour-engine capability as an external blocker — without touching the external lab-colors repo.

## Context (grounded — see Notes for evidence)
labui consumes `@labpics/colors` EXCLUSIVELY through the `--lab-*` CSS custom-property contract. `@labpics/colors` is EXTERNAL (another session owns the `lab-colors-v1` epic) and is NOT YET on npm; labui currently vendors the contract as the workspace stub `packages/colors-stub` (published under the real name `@labpics/colors@0.0.0-stub.0`, exporting `./contract.css` + `./roles.json`). Placeholder colour values are snapshotted from the Figma Semantic DTCG export — values are NOT computed in labui and MUST NOT be faked here.

This epic is the FOUNDATION that every visual scope depends on. It does NOT swap in the published engine (that is the later `colors-publish-swapout` scope, blocked on external delivery).

### The three consumption buckets (the key architectural distinction this epic pins)
A consumed `--lab-*` name falls into exactly one bucket; the contract-pin test must classify every name into one and fail on any it cannot place (= silent drift):
1. **COLOUR-CONTRACT roles** — owned by `@labpics/colors`, mirrored in `packages/colors-stub/roles.json` (151 roles, 7 groups) + `contract.css`. Example: `--lab-label-primary`, `--lab-fill-brand-primary`, `--lab-border-base`. THIS is the surface to pin against the stub.
2. **DIMENSION roles** — owned by `@labpics/ui-tokens`, generated locally (NOT lab-colors). Prefixes in `core/src/css.ts` `DIMENSION_PREFIXES`: `--lab-space/radius/z/font/line-height/stroke/focus-ring-*`.
3. **Locally-provided / engine-gap tokens** — declared inside labui today (`packages/shadow/src/generated/shadow.css`, `packages/core/src/materials.css`): `--lab-shadow-*`, `--lab-surface-shadow-tint`, `--lab-shadow-color`, `--lab-light-angle`, `--lab-mat-*`, `--lab-ambient-*`, `--lab-glass-*`, `--lab-elevation-*`. These are PROVISIONAL — they SHOULD eventually be resolved by the external engine. THESE are the external blockers recorded in CH-03.

## Success Criteria
- [ ] CH-01 — contract-pin snapshot + css.ts three-language unit test
- [ ] CH-02 — strengthened no-hardcoded-colour CI guard
- [ ] CH-03 — docs/external-deps/lab-colors.md engine-gap record

## Chapters
| Chapter | Status | Priority |
|---------|--------|----------|
| `chapters/contract-pin-test/` | ready | 1 |
| `chapters/no-hardcoded-colour-guard/` | ready | 2 |
| `chapters/engine-gaps-record/` | ready | 3 |

Chapters are independently valuable and may run in `parallel_group: foundation` (no file overlap: CH-01 edits `packages/colors-stub/test/` + `packages/core/test/`; CH-02 edits `packages/colors-stub/test/no-literal-colour-fallback*` + optionally `ci.yml`; CH-03 creates `docs/external-deps/lab-colors.md`). The shared exit gate (`pnpm -r test` + e2e) is run once after all three land.

## Backlog
Deferred owner requests live in the sibling `BACKLOG.md`. Drain `[OPEN]` items each grounding/NextWork cycle, priority-first, anchored to the verbatim quote, before declaring the epic complete. (None filed at creation.)

## Notes — grounding evidence (verified 2026-06-21, this session)
- Branch is `main`. RULE-3: every builder MUST branch before committing; PR-only into main; CI green before push.
- `core/src/css.ts` exports `SEMANTIC_ROLE_PREFIXES`, `DIMENSION_PREFIXES`, `FORBIDDEN_PRIMITIVE_PREFIXES` (brief said `FORBIDDEN_PRIMITIVES` — actual name is `FORBIDDEN_PRIMITIVE_PREFIXES`; use the real one). `cssVar`/`litVar` are the only token-reference helpers.
- An existing guard ALREADY exists: `packages/colors-stub/test/no-literal-colour-fallback.ts` + `.test.ts`. It ONLY catches a literal colour used as a `var()`/`litVar()` FALLBACK (`var(--lab-role, #fff)`). It does NOT catch a free-standing literal colour (`color: #fff;`). CH-02 STRENGTHENS this — it does not start from zero.
- `roles.json`: groups Backgrounds(23) Labels(36) Fills(33) Border(26) FX(15) Misc(3) Component(15) = 151; `aliases: []`. `contract.test.ts` already asserts every role is declared in light/dark/media scopes and pins per-group counts.
- Consumed surface: 284 distinct `--lab-*` names across packages+apps; 151 are colour-contract roles; the rest are dimension or locally-provided/gap tokens (bucket 3 above).
- Engine gaps live in `packages/shadow/src/generated/shadow.css` (provisional `--lab-shadow-alpha-* = 0.01/0.02/0.04/0.12`, anchor `--lab-shadow-color: #101012`) and `packages/core/src/materials.css`. INTEGRATION.md already records 3 open requests; CH-03's `docs/external-deps/lab-colors.md` is the richer, call-site-anchored record (do not contradict INTEGRATION.md; cross-link it).
- CI `quality` job runs `pnpm test` → `pnpm -r --if-present test`, which reaches `packages/colors-stub` (vitest) and `packages/core`. New vitest tests placed in those packages run in CI automatically — no ci.yml edit strictly required for the tests; a dedicated node script (CH-02) may optionally be wired as an explicit `quality` step for a louder failure.
- MUST NOT (all chapters): touch the lab-colors repo; fake any colour value or use a wrong type; introduce a resolver/WASM/`semantic.rs` copy into labui.
- Gate per `labui-two-test-layers-e2e-gate`: grep consumers repo-wide AND run `pnpm test:e2e` locally before push (unit `pnpm test` does NOT catch consumer-integration).
