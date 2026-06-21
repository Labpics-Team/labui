---
id: contract-pin-test
epic: colors-contract-pin
title: "Pin the consumed --lab-* contract surface and prove the three-language rule in code"
user_story: "As a labui component author, I want CI to fail the moment a --lab-* role I depend on disappears or is renamed in the colour contract, so that a silent upstream contract drift can never reach a visual scope and break components at runtime."
enabler_for: ""
status: completed
priority: 1
depends_on: []
refine_after: []
parallel_group: foundation
agent_profile:
  category: deep
  skills: [craft-qa, craft-arch, next-frontend]
---

# Pin the consumed --lab-* contract surface + prove the three-language rule

## User Story
As a labui component author, I want CI to fail the moment a `--lab-*` role I depend on disappears or is renamed in the colour contract, so that a silent upstream contract drift can never reach a visual scope and break components at runtime.

## Purpose
Build the regression net that catches contract drift. Two complementary tests:
1. A **contract-pin** test that enumerates every `--lab-*` name labui ACTUALLY consumes (grep `var(--lab-`, `litVar('--lab-`, `cssVar('--lab-` across `packages/*` and `apps/*`), classifies each into one of the three buckets (colour-contract role / dimension role / locally-provided-or-gap token), and asserts every COLOUR-CONTRACT role is present in BOTH `colors-stub/roles.json` and `contract.css`. It MUST fail on any consumed name it cannot classify (= an undocumented token = silent drift).
2. A **three-language** unit test against `core/src/css.ts` that proves a forbidden-primitive reference is rejected and a semantic-role reference is accepted (locks `SEMANTIC_ROLE_PREFIXES` / `DIMENSION_PREFIXES` / `FORBIDDEN_PRIMITIVE_PREFIXES` as enforced behaviour, not just documentation).

This closes the CLASS "consumer depends on a contract name that silently changed/vanished upstream" — not a single missing role.

## Tasks
| Task | Status | Agent | Depends On |
|------|--------|-------|------------|
| `tasks/enumerate-and-classify-consumed-roles.md` | done | deep | — |
| `tasks/contract-pin-snapshot-test.md` | done | deep | enumerate-and-classify-consumed-roles |
| `tasks/css-three-language-unit-test.md` | done | deep | — |

## Exit Criteria
These ARE the user story's acceptance criteria — phrased Given/When/Then.
- [x] Given the consumed colour contract, When CI runs the contract test, Then a snapshot test asserts every `--lab-*` COLOUR role labui depends on is present in `colors-stub/roles.json` AND `contract.css`, and fails loudly (naming the role) if a role disappears. — `consumed-contract.test.ts` "every consumed colour role is present in roles.json" + "...declared in contract.css (all scopes)"; RED-proof via fabricated absent role.
- [x] Given a consumed `--lab-*` name that is neither a known colour role nor a known dimension prefix nor a documented locally-provided/gap token, When the contract test runs, Then it FAILS naming the unclassified token (no silent drift). — "classifies every consumed name into exactly one bucket (zero unclassified)" reports first-seen file:line.
- [x] Given the css.ts three-language rule (`SEMANTIC_ROLE_PREFIXES`, `DIMENSION_PREFIXES`, `FORBIDDEN_PRIMITIVE_PREFIXES`), When a unit test runs, Then it proves a component reference to a forbidden primitive colour token is rejected and a semantic-role reference is accepted. — `packages/core/test/css-three-language.test.ts` 10/10.
- [x] Given the gate, When `pnpm -r typecheck && pnpm -r test` run, Then both pass clean (new tests included). — verified this session.
