---
id: motion-engine-foundation
title: "@labpics/ui-motion: dependency-free spring/tween engine + declarative animate API + prefers-reduced-motion contract"
status: active
priority: 1
created: 2026-06-22
goal: "Turn @labpics/ui-motion from a 1-line placeholder into a dependency-free spring/tween solver and declarative animate API that honours prefers-reduced-motion, with deterministic CSS-safe output proven by unit + property + e2e tests."
success_criteria:
  - "@labpics/ui-motion builds to dist that exports a dependency-free spring/tween solver and a declarative `animate` API; package.json `dependencies` is empty (verified by reading built dist + package.json)."
  - "Under `prefers-reduced-motion: reduce` every animation collapses to an instant/near-instant transition — unit asserts the duration/spring is short-circuited; e2e (emulated media feature) asserts no animated motion."
  - "Spring physics are deterministic and idempotent for identical inputs; a property test fuzzes mass/stiffness/damping bounds without ever producing NaN/Infinity (CSS-safe output)."
  - "`pnpm -r typecheck` + `pnpm -r build` + `pnpm -r test` + `pnpm test:e2e` all pass; ui-motion bundle size is measured and recorded."
depends_on: []
---

# @labpics/ui-motion — motion engine foundation

## Goal
Build a dependency-free spring/tween solver and declarative `animate` API inside `@labpics/ui-motion`, wired to honour `prefers-reduced-motion`, proven deterministic and CSS-safe by unit + property + e2e tests, with bundle size recorded.

## Context (grounded — see Notes for verified evidence)
`@labpics/ui-motion` (real npm name) is today a 1-line placeholder: `src/index.ts` exports only `PACKAGE_NAME`. The brief referenced staged RED stubs (`spring/tween/animate/reduced-motion/errors.ts`, `core/src/lit/motion-controller.ts`) — **they do NOT exist in the working tree** (working tree clean on `main`, verified `git status`). This epic creates them from scratch under TDD (RED first, per RULE-4). Design intent in Graphiti (2026-06-13): "LabUI requires its own motion system without dependencies, competing with Framer Motion and Anime.js." WASM/Rust was floated but this scope is explicitly **TypeScript, zero runtime deps** — that is the decided direction; do NOT introduce WASM/Rust here.

The CLASS of problem closed: **uncontrolled, dependency-coupled, accessibility-blind motion.** Today any animation a component needs would pull in Framer Motion / Anime.js (a runtime dep + bundle cost) OR be hand-rolled per-component with ad-hoc easing, no reduced-motion handling, and a real risk of emitting `NaN`/`Infinity` into a CSS value (which silently breaks the style). One owned, tested solver closes the whole class: every component animates through one deterministic, dependency-free, reduced-motion-aware seam.

## Architecture (SOLID / Clean / DDD — layers + dependency direction)
Strict inward dependency flow; the pure physics core knows nothing about the DOM, time, or the platform.

- **Layer 1 — Domain / pure solver (`spring.ts`, `tween.ts`).** Pure functions: given physics params + a time `t` (seconds), return position/velocity. No DOM, no `requestAnimationFrame`, no `window`. Deterministic and side-effect-free. This is the DDD domain core — the invariants (no NaN/Infinity, idempotent for identical inputs) live here. (SRP: solves physics, nothing else. OCP: new easing curves extend without editing the spring solver.)
- **Layer 2 — Reduced-motion policy (`reduced-motion.ts`).** A single function that reads the platform preference (`matchMedia('(prefers-reduced-motion: reduce)')`) behind a tiny injectable seam, returning a boolean + the collapse policy. This is the ONLY place that knows the preference exists (SRP); the animate layer asks it, the solver never does. Injectable so unit tests force both states without a real browser (DIP).
- **Layer 3 — Declarative API / orchestration (`animate.ts`).** The public `animate(target, keyframes, options)` entry. Composes the solver (L1) + the reduced-motion policy (L2) + a driver. Depends on L1 and L2 by abstraction, not the reverse (DIP). When the policy says "reduce", it short-circuits to an instant/near-instant transition WITHOUT touching the solver loop.
- **Layer 4 — Platform driver (the rAF/clock seam, inside `animate.ts` or a small `driver.ts`).** The only place `requestAnimationFrame` / `performance.now` live, behind an injectable interface so unit tests step the clock deterministically (DIP — domain tests never schedule a real frame).
- **Cross-cutting — `errors.ts`.** Typed errors for invalid params (negative mass, non-finite stiffness) so the solver fails loud at the boundary instead of emitting `NaN` downstream.
- **Consumer seam — `packages/core/src/lit/motion-controller.ts`.** A Lit `ReactiveController` (sibling of the existing `zag-controller.ts`) that lets a `LabElement` drive an animation through `@labpics/ui-motion`. This is the integration boundary: `@labpics/ui-core` gains a **devDependency-free / peer** path to the engine; it must NOT add a hard runtime coupling that breaks the zero-dep promise of the engine itself.

Dependency direction (must never invert): `core/motion-controller` → `ui-motion/animate` → {`reduced-motion`, `spring`/`tween`, `driver`} → (nothing). The solver is the innermost ring.

## Success Criteria
- [ ] CH-01 — Pure spring/tween solver: deterministic, idempotent, NaN/Infinity-proof (unit + property).
- [ ] CH-02 — Declarative `animate` API + reduced-motion collapse + typed errors (unit, both preference states).
- [ ] CH-03 — Core `motion-controller` consumer seam + docs `motion.html` fixture + e2e under emulated `prefers-reduced-motion`; zero-dep + bundle-size proof; full gate green.

## Chapters
| Chapter | Status | Priority |
|---------|--------|----------|
| `chapters/solver-core/`        | ready       | 1 |
| `chapters/declarative-animate/`| ready       | 2 |
| `chapters/consumer-and-gate/`  | placeholder | 3 |

Sequential — NOT parallel. CH-02 imports CH-01's solver; CH-03 imports CH-02's `animate` and wires the consumer + the e2e gate. CH-03 is `placeholder` and is refined after CH-02 lands (its consumer-seam and bundle-size shape depend on CH-02's real public API surface — P1, never guess future state).

## Backlog
Deferred owner requests live in the sibling `BACKLOG.md`. Drain `[OPEN]` items each grounding/NextWork cycle, priority-first, anchored to the verbatim quote, before declaring the epic complete. (None filed at creation.)

## Invariants — must NEVER regress (any builder, any chapter)
1. **Zero runtime dependencies.** `@labpics/ui-motion` `package.json` `dependencies` stays `{}` (empty/absent). devDependencies (vitest/tsup/typescript) are fine. Built `dist` imports nothing external.
2. **CSS-safe output.** No solver/animate path ever returns `NaN`, `Infinity`, or `-Infinity`. Every numeric output is a finite number safe to write into a CSS value.
3. **Determinism + idempotency.** Identical inputs (params + `t`) → identical output, every call. No hidden global state, no `Date.now()` inside the pure solver.
4. **Reduced-motion is honoured at the API boundary, always.** No public animate path can run a multi-frame animation when the policy says reduce — it collapses to instant/near-instant.
5. **Domain purity / dependency direction.** `spring.ts`/`tween.ts` never import the DOM, `window`, `matchMedia`, or `requestAnimationFrame`. The dependency arrow only points inward.
6. **Pin the public API.** The set of exported names from `@labpics/ui-motion` is asserted by a test, so a silent removal/rename fails CI (mirrors the colors-contract-pin discipline).
7. **TDD RED-proof (RULE-4).** Every test file lands RED first (proven to fail against the placeholder/stub) before GREEN. No self-verification; isolated verification per CLAUDE.md.

## Notes — grounding evidence (verified 2026-06-22, this session)
- Branch is `main`, working tree CLEAN. RULE-3: every builder MUST branch before committing; PR-only into main; CI green before push. The brief's "RED-stage work already staged uncommitted" is FALSE in this tree — start from the placeholder.
- `packages/motion`: `src/index.ts` = 1-line placeholder (`export const PACKAGE_NAME`). package.json has NO `test` script and NO vitest dep — CH-01 adds `"test": "vitest run"` + `vitest@2.1.8` (pin to the repo-wide version) + a `vitest.config.ts` copied from `packages/core/vitest.config.ts` (node env, `test/**/*.test.ts`). tsup config = `libraryPreset()` (dual ESM+CJS+d.ts) — already correct, no change needed.
- Test layout precedent: `packages/core/test/*.test.ts` + `packages/core/vitest.config.ts` (`environment: 'node'`). Pure-solver tests run in node with NO browser. Property test: implement a small deterministic LCG fuzzer (no new dep) over mass/stiffness/damping bounds — do NOT add fast-check (would violate the "research dep choices, not from memory" rule without a check; a hand-rolled bounded fuzzer keeps zero deps and is sufficient for the NaN/Infinity class).
- CI `quality` job runs `pnpm test` → `pnpm -r --if-present test`; once `packages/motion` has a `test` script its vitest tests run in CI automatically — no ci.yml edit required for unit tests.
- Lit controller precedent: `packages/core/src/lit/zag-controller.ts` is the ONLY existing `ReactiveController` — `motion-controller.ts` is its sibling. `lab-element.ts` is the `LabElement` base. Read both before writing the controller.
- e2e harness: `apps/docs/playwright.config.ts`, `testDir: ./tests`, projects chromium + webkit, `webServer` runs `pnpm run build && pnpm run preview` on 127.0.0.1:4321. Each demo is its own `apps/docs/src/<name>.html` + `<name>-demo.ts(x)` entry (multi-page Vite). CH-03 adds `motion.html` + `motion-demo.ts` + `tests/motion.spec.ts`.
- **Playwright CAN emulate prefers-reduced-motion** (unlike prefers-reduced-transparency — see `materials.spec.ts` which had to assert rule-text instead). Use `test.use({ reducedMotion: 'reduce' })` (or `page.emulateMedia({ reducedMotion: 'reduce' })`) for a REAL emulated-media assertion, satisfying the scope's exit-criterion literally. A second project/spec without it asserts motion DOES happen (differential).
- Bundle size: measure built `dist/index.js` (e.g. gzipped byte count via a tiny node script) and RECORD it in the chapter exit evidence + `INTEGRATION.md` or a `docs/` note. No hard budget set by the scope — record the number; flag if it is surprising.
- Consumes `@labpics/colors` only via `--lab-*` CSS; motion does not consume colour roles directly, but the docs fixture must still use the contract (no hardcoded colours — the existing no-hardcoded-colour guard scans `packages/*` and `apps/*`).
- MUST NOT (all chapters): add any runtime dependency to ui-motion; introduce WASM/Rust; import DOM/window into the pure solver; emit NaN/Infinity; self-verify (use isolated verification + RED-proof per CLAUDE.md).
- Gate per `labui-two-test-layers-e2e-gate`: grep consumers repo-wide AND run `pnpm test:e2e` locally before push (unit `pnpm test` does NOT catch consumer-integration).
