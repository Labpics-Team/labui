# Prototype A — Lit / Web Components — FINDINGS

> Throwaway prototype for cross-stack-core. Draft input for the criteria matrix in
> decision-and-adr. Path A = Lit Web Components core + thin per-stack wrappers
> (bench recommendation). Measured on React/Next 15 and Astro, per the 4 blocking
> bench criteria. Numbers are real (build + analysis), not estimates.
>
> Stack measured: lit@3.3.3, @lit/react@1.0.8, @lit-labs/nextjs@0.2.4
> (+@lit-labs/ssr-react@0.3.4, @lit-labs/ssr@4.1.0), next@15.5.19, react@19.2.7,
> @astrojs/lit@4.3.0, astro@5.18.2, @lit-labs/ssr@3.2.2 (pinned, see criterion 1).
> Date: 2026-06-12.

## Axis coverage (structural, not all 432 renders)

lab-button covers every owner axis from Figma:

| Axis | Values implemented |
|------|--------------------|
| Type | accent / neutral / danger |
| Kind | fill / tinted / border / ghost |
| Icon-button | square icon-only mode (icon attribute, slot="icon") |
| Size | s / m / l |
| State | default / hover / pressed (:active) / loading / disabled / focus (:focus-visible) |

Rendered as a live matrix in demo/ (the Playwright target). The component consumes
ONLY --lab-* semantics (fill-*, label-*, border-*, surface-*) — no hardcoded hex
anywhere in src/lab-button.ts. Separation is by SURFACE (fill/tinted/ghost differ by
background); the border is its own role used only by kind=border, never a separator
on top (owner principle). The component never references a theme — themes are
imitated by swapping the --lab-* set on an ancestor (fixtures/themes.css, Light/Dark).

## Criterion 1 — SSR / hydration

VERDICT: SPLIT. Astro = PASS (with one dependency pin). Next 15 = PARTIAL — shallow
SSR only, declarative shadow DOM NOT serialized -> FOUC risk for shadow internals.

### Astro — PASS
- @astrojs/lit integration added; nothing else required to wire it.
- Built HTML contains the full declarative shadow DOM (template shadowrootmode=open
  with inner button and projected slot content) — correct first paint, no JS, no FOUC.
- Evidence: proto-a-lit-astro ssr:probe -> declarative shadow DOM present: true /
  inner button inside the shadow: true / RESULT: PASS.
- HACK REQUIRED: with default transitive @lit-labs/ssr@3.3.1, any Lit element with a
  slot crashes the Astro build ("Cannot read properties of undefined (reading
  length)" at @lit-labs/ssr render-value.js:getLast — uninitialized slotStack).
  Isolated to a one-slot minimal element. Fixed by scoped pnpm override
  "@astrojs/lit>@lit-labs/ssr": "3.2.2" in root package.json. Version-skew inside the
  Astro Lit integration, not a component defect.

### Next 15 — PARTIAL (measured limitation)
- @lit-labs/nextjs@0.2.4 wraps the Next config; typed @lit/react wrapper rendered
  behind a 'use client' boundary (Server-Component shell page). Element renders,
  hydrates, is interactive.
- BUT the server HTML is SHALLOW: lab-button tag + light-DOM text only, NO
  shadowrootmode, NO template, NO inner button. Shadow DOM is built on the client at
  hydration -> brief FOUC window for shadow internals.
- Tested four ways, all shallow: static prerender, force-dynamic, the @lit/react
  wrapper path, and a raw lab-button tag path. Raw path DOES emit type/kind attributes
  server-side (so inherited --lab-* colours apply) but still no declarative shadow DOM.
- @lit-labs/nextjs README: tested against Next 13/14 (peer allows 15), Lit Labs
  (experimental). Deep SSR must be behind 'use client' (it was) — even so, under Next
  15 it did not serialize shadow DOM in this prototype.
- Evidence: curl http://127.0.0.1:4401/raw | grep -c shadowrootmode -> 0.
- IMPLICATION: Lit deep-SSR solid on Astro, unreliable on Next 15 with the Labs
  plugin. Re-test when @lit-labs/nextjs officially supports Next 15/16.

## Criterion 2 — Type-safety (React 19)

VERDICT: PASS. No any-holes.
- @lit/react createComponent gives a typed Button whose type/kind props are the
  LabButtonType / LabButtonKind unions. A wrong literal is a compile error.
- Verified end-to-end by a REAL Next 15 type-check during build (next build runs tsc
  over app/button-showcase.tsx importing the wrapper) — passed. Also proto-a-lit
  typecheck clean under the repo strict base tsconfig.
- Constraint found: consumers must type-check against the emitted .d.ts, not the
  decorator source (a consumer tsconfig without experimentalDecorators mis-parses
  Lit @property). Package exports point types at dist/*.d.ts — standard publish shape,
  not a blocker, but the core must ship declarations (it would anyway).

## Criterion 3 — Styling: --lab-* through Shadow DOM + theme switching

VERDICT: PASS.
- CSS custom properties pierce the shadow boundary; the --lab-* contract resolves
  inside the shadow root. Proven by a Playwright assertion reading the inner shadow
  button's resolved background.
- Theme switching with ZERO component edits: swapping data-theme (swaps only the
  --lab-* set) re-skins the same component — accent fill #6e8bff (Dark) -> #3a5bdc
  (Light). Green in the smoke.
- PITFALL found and fixed (record for matrix): an indirection --_bg:
  var(--lab-fill-accent) consumed as background-color: var(--_bg) goes STALE on theme
  swap in Chromium (the var()->var() chain across the shadow boundary does not
  re-invalidate the painted longhand). Fix: set colour longhands
  (background-color/color/border-color) DIRECTLY in the [type][kind] selectors. The
  core must follow this rule (no intermediate custom-property hop for themed colours
  inside shadow DOM).

## Criterion 4 — Size (runtime + component, gzip, measured)

VERDICT: 11.59 KB gzip for the full self-contained artifact (Lit runtime + Button,
bundled + minified). Measured, not estimated:

| Artifact | raw | gzip |
|----------|-----|------|
| Lit runtime + Button (bundled, minified) — first WC consumer cost | 36.16 KB | 11.59 KB |
| Button code alone (Lit external — marginal cost per additional component) | 7.97 KB | 2.24 KB |
| Next 15 route First Load JS (whole page, incl. React) | — | ~111 KB |

Method: tsup emits a dedicated Lit-bundled dist/size.js; scripts/measure-size.mjs
gzips it at level 9. The ~11.6 KB exceeds the oft-quoted "Lit ~5 KB" because it
includes lit-html + @lit/reactive-element + lit-element + the component. The MARGINAL
cost once Lit is loaded once is ~2.2 KB gzip per component — the number that matters
for the 38-component library.

## Net read for decision-and-adr (fact, not the decision)

- STRONG: styling/theming through shadow DOM is clean and fits the --lab-* contract
  (crit 3); React 19 type-safety is real (crit 2); marginal per-component weight is
  small (~2.2 KB).
- WATCH: SSR is the deciding cost. Astro deep-SSR works (one scoped dep pin); Next 15
  deep-SSR does NOT with the current Labs plugin — shallow tag only, shadow-content
  FOUC. React/Next is a top-2 target stack, so this is the load-bearing risk for path
  A; weigh against path B (Mitosis), which emits native per-stack components with
  native SSR.

## What did NOT work / honest gaps

- @lit-labs/nextjs@0.2.4 did not produce declarative shadow DOM on Next 15 in any
  tested configuration. Not root-caused beyond "Labs plugin tested on 13/14"; a fix
  may need a newer plugin release. BIGGEST OPEN RISK FOR A.
- The Astro slot crash needed a pinned @lit-labs/ssr@3.2.2 — acceptable, but a
  moving-target Labs dependency.
- Visual-regression screenshots not added (out of scope for the prototype; the smoke
  asserts behaviour + that states differ, per the task). Full visual matrix lands in
  qa-playwright.

## How to reproduce

    pnpm install
    pnpm --filter @labpics/proto-a-lit build       # consumable + size.js + d.ts
    pnpm --filter @labpics/proto-a-lit size         # criterion 4 number
    pnpm --filter @labpics/proto-a-lit typecheck    # criterion 2
    pnpm --filter @labpics/proto-a-lit test:e2e     # criterion 3 + a11y (5 tests, :4400)
    pnpm --filter @labpics/proto-a-lit-astro build
    pnpm --filter @labpics/proto-a-lit-astro ssr:probe   # criterion 1 Astro (PASS)
    pnpm --filter @labpics/proto-a-lit-next build
    pnpm --filter @labpics/proto-a-lit-next start &      # criterion 1 Next
    curl -s http://127.0.0.1:4401/raw | grep -c shadowrootmode   # -> 0 (shallow)

## Repo-shared files touched (collision note with proto-B)

Kept minimal, as the task requires:
- pnpm-workspace.yaml — added prototypes/* and prototypes/*/fixtures/* globs
  (additive; proto-B needs the same — identical lines merge cleanly).
- root package.json — added scoped pnpm.overrides
  "@astrojs/lit>@lit-labs/ssr": "3.2.2" (scoped: affects only the Astro integration's
  SSR dep; does not touch standalone lit-labs/ssr or proto-B Lit).
- root biome.json — added .astro/, .next/, dist-demo/ to the ignore list (generated
  artifacts; additive).

Ports owned by proto-A: 44xx (demo 4400, Next 4401, Astro 4402) — chosen to not
collide with the docs harness (:4321) or proto-B (43xx).
