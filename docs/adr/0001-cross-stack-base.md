# ADR 0001 — Cross-stack base for LabUI

- Status: **Accepted (autonomous, by owner mandate — flagged FOR OWNER REVIEW)**
- Date: 2026-06-12
- Epic / chapter: labui-v1 / cross-stack-core
- Deciders: next-frontend agent (autonomous), pending Daniel's review
- Supersedes: none
- Default reversibility: **reversible** (see "Consequences → Reversibility")

> Owner-gate note. The task originally required an explicit owner gate on this
> architectural fork. The owner stepped away and granted full autonomy ("take it
> to the absolute, write the ADR with a reversible default yourself, prepare it
> for my review"). Per that mandate the gate is replaced by: **decision accepted
> autonomously, marked FOR OWNER REVIEW, default chosen to be reversible.** Core
> scaffolding (the next task) does not start any irreversible work until this ADR
> is reviewed; the chosen base is escapable (see Reversibility).

---

## Context

LabUI must deliver ONE component model (~38 components, Button alone has 432
Figma variants) to FIVE stacks: React/Next, Vue, Solid, Svelte, Astro. The
choice of base technology is the central architectural fork of the whole design
system — everything (~38 components × 5 adapters) sits on it.

Two paths were prototyped on the most-loaded component (Button) and measured
against four blocking criteria (SSR on Next+Astro, prop/event type-safety,
`--lab-*` styling through the boundary, theme switching without component
edits), plus weighted criteria and a 38×5 cost model. Inputs — исторические
артефакты: из репозитория удалены после принятия решения, доступны в
git-истории и указанных PR:

- `prototypes/proto-a-lit/FINDINGS.md` (PR #5) — Path A, Lit / Web Components.
- `prototypes/proto-b-mitosis/FINDINGS.md` (PR #4) — Path B, Mitosis.
- `epics/labui-v1/chapters/cross-stack-core/matrix.md` — the criteria matrix
  that consolidates both FINDINGS and recommends **Option A-prime**.
- `prototypes/spike-wc-ssr/spike-FINDINGS.md` — the falsifier spike
  that closed the matrix's one open measurement.

Design inputs already settled by the owner (2026-06-13):

- A reusable **Behaviors layer (headless interaction logic)** is **mandatory**,
  orthogonal to the base, written once and consumed by every renderer.
- "Cost of owning a generator" is an explicit, first-class risk criterion.
- **"React-first, adapters later" is rejected** — React is a required target of
  the base decision, not a later phase. The economics of 5 stacks are the
  product's core value.

### The matrix verdict in one paragraph

Under the bench rule (the pure Lit/WC path is accepted only if all four blocking
criteria PASS), **pure Path A fails**: Lit deep-SSR does not serialize
declarative shadow DOM under Next 15 with `@lit-labs/nextjs@0.2.4` (shallow tag
only → FOUC window), and Next 15 is the primary product stack. Path B (Mitosis)
passes all four but only after structural per-component patches, and carries
structural risks that time does not heal: non-portable event/children types,
`.lite.tsx` source that is valid for no framework (vendor lock), a patch pipeline
that grows with the library, and lag behind framework evolution (Svelte 5+).

The matrix's key move: the bench rule kills the **pure** Lit path, but it does
**not** kill the hybrid **A-prime**, because in A-prime React does not depend on
Lit SSR at all.

---

## Decision

### 1. Base technology: **Option A-prime (hybrid)**

- **Lit / Web Components** as the base for the four WC-friendly stacks:
  **Astro, Vue, Solid, Svelte** (delivered as standard custom elements).
- **A native, thin React implementation** for React/Next — NOT a Lit wrapper —
  so the React path never touches Lit SSR and the Next 15 blocker disappears.
- **Both renderers sit on ONE shared Behaviors layer** (headless interaction
  state machines: ARIA, focus, keyboard, state). The Behaviors layer is the
  source of truth; Lit and React are thin presentation adapters over it.

This is the matrix recommendation (Part 5), now de-risked by the falsifier spike
below.

### 2. Behaviors layer: **Zag.js (`@zag-js/*`), reversible default**

- Adopt **Zag.js** finite-state-machine packages as the Behaviors layer rather
  than hand-rolling a custom headless layer from scratch.
- The Lit base consumes the **framework-agnostic machine core via
  `@zag-js/vanilla` (`VanillaMachine` + `normalizeProps`/`spreadProps`/`connect`)**
  inside a Lit reactive controller — Zag has no Lit adapter, and it does not need
  one: the vanilla runner spreads computed props onto shadow-DOM nodes directly.
- The native React path consumes the **`@zag-js/react`** adapter over the **same
  machine package** — the machine is authored/selected once per component and
  shared by both renderers.

Why Zag over a custom layer (criteria from the task — accessibility coverage,
maintenance, prior art, "don't reinvent the wheel"):

| Criterion | Zag.js | Own minimal layer |
|-----------|--------|-------------------|
| Framework-agnostic core | Yes — `@zag-js/core` + `@zag-js/vanilla`, no framework dep (confirmed: VanillaMachine class runner) | We would rebuild this |
| Adapter for BOTH renderers A-prime needs | Yes — vanilla (for Lit) **and** React adapter, same machine | We write 2 adapters |
| Accessibility (ARIA/focus/keyboard) | Built-in per component, the hard 80% | We re-implement WCAG details per component × risk of drift |
| Prior art (task area 12) | Chakra's successor; inspired by Radix, React-Aria, Open UI | n/a |
| Maturity | **v1.x stable (1.41.2)** — past 1.0, active | Greenfield, unproven |
| Reinvention cost on 38 components | Low — adopt machines incrementally, one npm pkg per component | High — full headless lib is its own project |

The decisive fit: A-prime needs the SAME interaction logic consumed by two
different renderers (Lit + React). Zag's "write the machine once, connect via a
per-framework adapter" model is precisely that shape, and it already ships the
two adapters we need (vanilla + React). A hand-rolled layer would re-derive this
plumbing and the WCAG details Zag already covers.

This choice is a **reversible default**: see Reversibility.

### 3. Falsifier spike result (the matrix's one open measurement)

The matrix flagged that **WC-SSR was never measured on Vue/Svelte/Solid** (proto-A
measured only Astro PASS + Next PARTIAL). That was the A-prime falsifier: if ≥2
of those three stacks FAIL WC-SSR with no workaround, A-prime is wounded.

Spike (`prototypes/spike-wc-ssr/`, удалён из репо после принятия решения — см.
git-историю; the byte-identical proto-A Lit Button rendered
through each stack's SSR core, evidence = `node <stack>/ssr-probe.mjs`, exit 0):

| Stack | Native custom-element SSR | Lit-SSR (`@lit-labs/ssr`) embed path | Verdict |
|-------|---------------------------|--------------------------------------|---------|
| Vue 3 (`vue/server-renderer`) | shallow — tag only, no DSD | declarative shadow DOM + inner `<button>` + `<style>` + `--lab-*` | **PASS** |
| Svelte 5 (`svelte/server`) | shallow — tag only, no DSD | declarative shadow DOM + inner `<button>` | **PASS** |
| Solid (`solid-js/web`) | shallow — tag only, no DSD | declarative shadow DOM + inner `<button>` | **PASS** |

**Outcome: 0/3 FAIL → A-prime is NOT killed.** WC deep-SSR holds on all four
non-React stacks (Astro proven by proto-A; Vue/Svelte/Solid proven here).

Honest nuance recorded for scaffold: the PASS is via the **`@lit-labs/ssr` embed
path** (declarative shadow DOM = styled first paint, no FOUC), NOT via native
custom-element SSR — which is shallow on every stack including Next. Deep WC-SSR
is a property of the `@lit-labs/ssr` engine, not of the host framework; every SSR
framework that can emit a raw HTML string carries the DSD through intact. The
cost is per-stack adapter wiring (a ~10-line SSR shim calling `@lit-labs/ssr`),
not a structural blocker.

---

## Options considered

### Option A (pure Lit/WC) — REJECTED by the bench rule

38 Lit components + 38×5 thin typed wrappers. `@lit/react` and peers make wrappers
nearly free. **Blocker:** React deep-SSR on Next 15 is unsolved (FOUC on the
primary stack), not closeable by a wrapper. Kept as the reference point; dead for
Next 15. (matrix Part 3, Option A.)

### Option A-prime (hybrid: Lit for 4 stacks + native React, shared Behaviors) — **CHOSEN**

Behaviors (1× per component, framework-agnostic) + Lit core (38, covers
Astro/Vue/Svelte/Solid via WC) + native React (38, solves Next 15 fully — no Lit
in the React path) + thin per-stack wrappers. More expensive to CREATE than B
(two visual implementations), **cheaper to OWN** (a platform standard, not a
0.x generator). React's only blocker vanishes because it does not depend on Lit
SSR. (matrix Part 3, Option A-prime; Part 5 recommendation.)

### Option B (Mitosis + patch pipeline) — REJECTED

One `.lite.tsx` source → generated output for every stack. Cheapest to create
(single source) but: 3 structural patches per trivial component (event type,
children, dead code), event type re-patched per stack; a `scripts/patch-output.ts`
that becomes permanent, growing infrastructure; no 1.0 after 388 versions; JSDoc
mangling; vendor lock (`.lite.tsx` is valid for no framework — anti-pattern "code
requires the tool"); lag behind Svelte 5. Its key risks are **structural**, not
version bugs that time fixes. (matrix Parts 2–4, "DECISIVE".)

### Option C (Behaviors + native visuals on all 5 stacks, no generator, no Lit-SSR addon) — REJECTED (but informs A-prime)

Maximum control, native SSR everywhere, zero vendor lock, zero generator — but
38×5 native visual implementations is the most expensive to create. **Falsifier:
if 5× native visual is economically unviable.** It is, for 38 components — which
is exactly why A-prime (Lit collapses 4 of the 5 visual implementations into one
WC core) is the compromise. (matrix Part 3, Option C.)

### Do-nothing / defer — REJECTED

Deferring the base decision blocks `core-scaffold`, `components-and-docs` (~38
components) and `multi-stack-adapters` (×5) — the entire downstream of labui-v1.
The two prototypes + matrix + spike are precisely the evidence needed to decide
now; deferring discards measured work and stalls the epic.

---

## Rationale (against the matrix cells + craft-arch)

- **Dependency direction (DIP).** In A-prime the source of truth is the Behaviors
  layer (internal, framework-agnostic). Lit and React are outer presentation
  adapters depending inward on Behaviors. In B the source of truth is `.lite.tsx`
  — valid code for no framework, usable only through a compiler: an inversion
  (details depend on a tool, not on an abstraction). (matrix Part 5, DIP.)
- **OCP.** Adding a stack in A-prime = a new renderer over the unchanged
  Behaviors layer (new code). In B = extending the patch pipeline (modifying
  generated output + the patch script) — modification, not extension.
- **Structural vs temporal risk.** A's blocker (Lit deep-SSR on Next) is temporal
  AND fully bypassed in the hybrid (native React). B's core blockers
  (non-portable types, vendor lock, framework lag) are structural — not healed by
  waiting. Betting 38 components on a third-party 0.x generator's roadmap is more
  debt than a second native React implementation over shared logic. (matrix
  Parts 4–5.)
- **Behaviors multiplier.** The mandated Behaviors layer makes the "second
  (React) implementation" cheap: it duplicates only the thin visual binding, not
  the interaction logic — that already lives in the shared machine. (matrix
  Part 3, A-prime.)
- **Spike closes the last unknown.** The only un-measured A-prime risk (WC-SSR on
  Vue/Svelte/Solid) is now measured PASS 3/3. The remaining moving-target risk is
  one-sided and external: the `@lit-labs/ssr` Astro pin (3.2.2) — it does not
  touch the React path.

---

## Consequences

### For the 5 adapters

- **React/Next** — native React components over `@zag-js/react`. No Lit, no Lit
  SSR; Next 15 SSR is fully native. This is the second visual implementation —
  the explicit, accepted cost of A-prime.
- **Astro** — Lit WC via `@astrojs/lit` (build-time deep SSR, PASS in proto-A).
  Requires the scoped `@lit-labs/ssr` 3.2.2 pin (version-skew workaround).
- **Vue / Svelte / Solid** — Lit WC. Native custom-element SSR is shallow; the
  adapter must wire `@lit-labs/ssr` to emit declarative shadow DOM for no-FOUC
  first paint (spike-proven). Client-side interactivity comes from the Lit
  reactive controller driving a `VanillaMachine`.

### Cost (38 components × 5 stacks — direction, from matrix Part 3, not hours)

- **Create** (cheap → expensive): B (one source) < **A-prime** (Lit + React +
  Behaviors) < C (5× visual).
- **Own** (cheap → expensive): C ≈ **A-prime** (platform standard + one stalling
  Astro addon) ≪ B (0.x generator + patch pipeline + framework lag).
- A-prime trades higher creation cost (two visual implementations) for low,
  predictable ownership cost. The Behaviors layer lowers cost in every option and
  is orthogonal to the base.

### Reversibility (why this default is safe to accept autonomously)

- **Base:** Lit and Web Components are an open platform standard. Leaving Lit
  means rewriting element classes, but the WC output is portable, and the React
  path is already independent of Lit. The risk is concentrated in the Lit **Labs**
  addons (`ssr`, `nextjs`), not the core.
- **Behaviors = Zag.js:** isolated behind the component's own controller seam.
  Because the machine is consumed through a thin per-renderer connector, swapping
  Zag for a hand-rolled layer later changes the connector, not every component's
  visuals. This is why Zag is a **reversible default**, not a lock-in.
- **No irreversible work starts before owner review:** `core-scaffold` populates
  `packages/core` only after this ADR is reviewed; the spike is throwaway.

### Risks carried forward

- `@lit-labs/nextjs` is stalled (last release 2025-07-11) — irrelevant to
  A-prime because React does not use it, but it means pure-Lit-on-Next stays dead.
- `@lit-labs/ssr` must stay pinned at 3.2.2 for the Astro path; monitor whether a
  future Astro drops compatibility while the addon stays unmaintained.
- A-prime maintains two visual implementations (Lit + React). The Behaviors layer
  caps the duplication to visuals only — but the visual parity between the two
  must be enforced by the Playwright visual matrix (qa chapter).

---

## Falsifiers for the future (revisit this ADR if)

- **Kills A-prime:** the second native React implementation's visual maintenance
  proves unsustainable at 38 components even with shared Behaviors; OR the
  `@lit-labs/ssr` Astro pin stops building on a future Astro and the addon stays
  abandoned with no replacement; OR WC-SSR regresses on a stack that the spike
  passed.
- **Kills the Zag.js choice (fall back to a custom Behaviors layer):** Zag's
  `@zag-js/vanilla` proves too awkward inside Lit's reactive-controller lifecycle
  for a real component (e.g. SSR id hydration mismatches between the vanilla and
  React adapters that cannot be reconciled); OR a needed component has no Zag
  machine and authoring one upstream is heavier than a bespoke machine; OR Zag's
  release cadence/license shifts adversely.
- **Re-opens Option B:** only if A-prime's two-implementation cost is empirically
  unbearable AND Mitosis ships a stable 1.0 that removes the structural type
  blockers — both required together.

---

## Verification (this ADR)

- Falsifier spike PASS 3/3 on Vue/Svelte/Solid — `prototypes/spike-wc-ssr/spike-FINDINGS.md` (в git-истории), probes exit 0.
- ≥3 options incl. do-nothing/defer — above.
- Decision traced to matrix cells (Parts 3–5) and proto-A FINDINGS.
- Behaviors layer chosen with reasoning (Zag.js vs own), reversible.
- Path onto the other 3 stacks (Vue/Solid/Svelte) described under "Consequences → adapters".
- Accepted autonomously by owner mandate; flagged FOR OWNER REVIEW; default reversible.

---

## NOT in scope of this ADR (handed to core-scaffold / later tasks)

- Populating `packages/core` (core-scaffold — the next task).
- The full core CONTRACT specification (state declaration pattern, `--lab-*`
  consumption rules, separation principle, public API shape, a11y contract) —
  this ADR fixes the BASE + Behaviors decision; the contract document is authored
  in core-scaffold against the chosen base.
- Selecting the specific Zag machine per component (per-component, in
  components-and-docs).
- Visual parity enforcement between the Lit and React renderers (qa chapter).
