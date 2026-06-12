# Falsifier spike — WC-SSR on Vue 3 / Svelte 5 / Solid — FINDINGS

> THROWAWAY spike for `decision-and-adr` (labui-v1, chapter cross-stack-core).
> Closes the one open measurement the criteria matrix flagged as the A-prime
> falsifier: *"WC-SSR on Vue/Svelte/Solid was measured by no prototype"*
> (matrix Part 5, «Что матрица НЕ закрывает» + falsifier list). proto-A measured
> only Astro (PASS) and Next 15 (PARTIAL/shallow). This spike measures the other
> three production stacks. Deleted by core-scaffold.
>
> Date: 2026-06-12. Numbers are real (vite SSR build + probe of built output),
> not estimates.
>
> Component under test: the byte-identical proto-A Lit Button
> (`prototypes/proto-a-lit/dist/index.js`, lit@3.3.3) — the same artifact that
> measured Astro PASS. Vendored into `vendor/lab-button.js` so the spike is
> self-contained (proto-A's package is on a different branch).
>
> Lit SSR engine: `@lit-labs/ssr@3.2.2` — the SAME pin proto-A used and the same
> engine `@astrojs/lit` wraps. SSR stacks: vue@3.5.13 / svelte@5.16.0 /
> solid-js@1.9.3, all on vite@6.0.7, Node v24.15.0.

---

## What the matrix needed settled

A-prime (the recommended option) = Lit/WC for the 4 non-React stacks
(Astro/Vue/Svelte/Solid) + a native React implementation, both over a shared
Behaviors layer. Its survival depends on WC-SSR actually holding on Vue, Svelte
and Solid. proto-A never measured those three. If ≥2 of them FAIL with no
workaround, A-prime is wounded and the decision must be re-weighed (matrix Part
5 falsifier). This spike is that measurement.

## Method (deliberately rough — it's a spike)

For each stack, a minimal vite SSR fixture renders the Button **two ways** and
the probe inspects the built server HTML:

1. **Native path** — `<lab-button>` written as a custom element directly in the
   framework's own template (Vue SFC / Svelte / Solid JSX). The framework's SSR
   renderer emits the tag, nothing more.
2. **Lit-SSR path** — the Button rendered through `@lit-labs/ssr` to a
   declarative-shadow-DOM (DSD) string, injected via the framework's raw-HTML
   mechanism (`v-html` / `{@html}` / `innerHTML`). This is the controlled path.

PASS criterion (from the task / matrix): the built HTML contains **declarative
shadow DOM** OR **controlled hydration without FOUC**. We document which.

## Per-stack verdicts (evidence: `node <stack>/ssr-probe.mjs`, exit 0 = PASS)

| Stack | Native custom-element SSR | Lit-SSR embed path | Verdict | PASS via |
|-------|---------------------------|--------------------|---------|----------|
| **Vue 3** (renderToString) | shallow — tag only, no `shadowrootmode` | DSD present, inner `<button>` present | **PASS** | declarative shadow DOM |
| **Svelte 5** (svelte/server render) | shallow — tag only, no `shadowrootmode` | DSD present, inner `<button>` present | **PASS** | declarative shadow DOM |
| **Solid** (solid-js/web renderToString) | shallow — tag only, no `shadowrootmode` | DSD present, inner `<button>` present | **PASS** | declarative shadow DOM |

Raw probe output (all three, exit 0):

```
--- Vue 3 WC-SSR probe ---
  native path: <lab-button> emitted:        true
  native path: declarative shadow DOM:       false  (expected false — shallow, like Next)
  lit-ssr path: declarative shadow DOM:      true
  lit-ssr path: inner <button> in shadow:    true
  RESULT: PASS (Vue SSR carries Lit DSD intact → first paint, no FOUC)

--- Svelte 5 WC-SSR probe ---  → identical shape, RESULT: PASS
--- Solid WC-SSR probe ---     → identical shape, RESULT: PASS
```

DSD payload quality (Vue, representative): the `<template shadowrootmode="open"
shadowrootdelegatesfocus>` carries the component `<style>` block AND reads
`var(--lab-fill-accent)` — i.e. **styled first paint, no FOUC**, and the
`--lab-*` contract resolves inside the shadow root exactly as proto-A measured
on Astro. All 3 buttons of the matrix render.

## The honest nuance (matters for the ADR)

The PASS on all three stacks is via the **Lit-SSR embed path**, NOT via native
custom-element SSR. Native SSR is **shallow on every stack measured** — Vue,
Svelte, Solid AND Next 15 all emit the bare tag with no declarative shadow DOM.
That is expected: only Astro ships a built-in `@astrojs/lit` integration that
runs `@lit-labs/ssr` automatically. On the other stacks the adapter must wire
`@lit-labs/ssr` itself.

So the precise, falsifiable finding is:

- **WC deep-SSR is a property of `@lit-labs/ssr`, not of the host framework.**
  The engine is framework-agnostic; every SSR framework that can emit a raw HTML
  string (all of them) can carry the DSD through intact. Proven on 3/3 here,
  plus Astro in proto-A.
- **The cost is per-stack adapter wiring**, not a structural blocker. Each
  non-Astro, non-React adapter needs a thin SSR shim that calls `@lit-labs/ssr`
  and emits the DSD string (≈10 lines, as in `shared/render-button.mjs`).

## Falsifier outcome

**A-prime is NOT killed.** The matrix falsifier required ≥2 of Vue/Svelte/Solid
to FAIL WC-SSR with no workaround. Result: **0/3 FAIL — 3/3 PASS.** WC-SSR holds
on all four non-React stacks (Astro proven by proto-A; Vue/Svelte/Solid proven
here), via the same `@lit-labs/ssr` engine. The single remaining shallow stack
is Next 15 — and A-prime deliberately routes React around Lit entirely
(native React over Behaviors), so Next's shallow WC-SSR never touches the
React path. The decision input stands: **A-prime is viable.**

## Limits of this spike (do not overclaim)

- This measures the **build-time SSR string**, not a live browser hydration
  cycle. DSD = no-FOUC *by construction* (the browser paints shadow content from
  HTML before JS), but full interactive hydration on each meta-framework
  (event wiring after `customElements` upgrade) is an adapter concern verified
  in multi-stack-adapters, not here.
- SolidStart / SvelteKit / Nuxt were NOT installed as full apps — the spike uses
  each framework's SSR core (`solid-js/web`, `svelte/server`,
  `vue/server-renderer`) directly, which is what those meta-frameworks call
  under the hood. Sufficient to settle the falsifier; not a substitute for the
  per-stack adapter task.
- `@lit-labs/ssr` is pinned to 3.2.2 (proto-A's pin; 3.3.1 crashes the Astro
  build on slotted elements per proto-A). The moving-target risk on the Astro
  Labs adapter (matrix Part 4) is unchanged; this spike does not re-open it.

## Reproduce

```
cd prototypes/spike-wc-ssr
pnpm install --ignore-workspace
pnpm probe:vue      # build + probe, exit 0 = PASS
pnpm probe:svelte
pnpm probe:solid
```
