# Prototype B — Button on Mitosis (compile-to-N) — FINDINGS

Throwaway prototype for the cross-stack-core decision. The SAME Button is
written ONCE in the Mitosis JSX subset (src/button.lite.tsx) and compiled to
native React and Svelte components. Measured on the SAME four criteria as
prototype A so the criteria-matrix can compare like-for-like.

Verdict in one line: Mitosis CAN deliver a genuinely zero-runtime, typed,
theme-agnostic Button across targets — but only after fighting an immature 0.x
compiler whose defaults are wrong, whose JSDoc handling is broken, and whose
output needs per-target hand-patching. The write-once promise is PARTIALLY
true; "write once, ship unedited" is not.

Environment: Mitosis @builder.io/mitosis 0.13.2 + CLI 0.13.2 (latest stable —
still pre-1.0 in 2026), React 19.0, Svelte 5.16, Next 15.1.3, Astro 5.1.1,
Node 24. Targets compiled: React (Next 15 fixture) + Svelte (most divergent
target — the honesty test).

---

## Axis coverage (structural, not 432 renders)

One source covers: Type accent|neutral|danger x Kind fill|tinted|border|ghost x
Size s|m|l x State default|hover|pressed|loading|disabled|focus + icon-slot.
States are expressed via CSS pseudo-classes (:hover, :active, :focus-visible,
:disabled) and props (loading, disabled); the Next fixture renders 19 buttons
per theme (38 total, server-rendered — verified in HTML).

---

## Criterion 1 — SSR / hydration (Next 15 + Astro)

Result: PASS for both, with real evidence. No FOUC on either.

- Next 15: `next build` succeeds; the page is prerendered as static content.
  The server HTML contains the fully-rendered button markup (all
  class="lab-btn ...", data-type/kind/size, aria-busy present — not a blank
  shell) and both data-theme="light"/"dark" panels. CSS is emitted as a
  `<link rel="stylesheet" ... data-precedence="next">` in `<head>`, so styles
  arrive with first paint -> NO FOUC. Route weight: 1.05 kB First Load JS delta.
  Note: Mitosis emits "use client" at the top of the React output, so the
  component is a CLIENT component (SSR'd then hydrated). Correct for an
  interactive button, but Mitosis decides the RSC boundary for you — there is no
  way to get a server-only variant from the same source.
- Astro 5: consumed as a React island (client:load). `astro build` compiles both
  server and client bundles; the island is server-rendered (38 `<button>` tags
  in SSR HTML) and CSS is inlined -> no FOUC. Hydration works in `astro dev`.
  Caveat (NOT a Mitosis problem): the Astro 5.1.1 standalone Node adapter runtime
  throws ERR_UNSUPPORTED_ESM_URL_SCHEME ... protocol 'astro:' on Node 24 — an
  Astro+Node version issue at server start, unrelated to the compiled component
  (which builds and dev-SSRs fine). The Playwright smoke boots the Next fixture
  (primary target) for reliability; Astro SSR verified by build + astro dev curl.

Takeaway: Mitosis output SSRs natively on both stacks because it emits real
framework components. SSR is a non-issue for the React target.

---

## Criterion 2 — Type safety

Result: PASS AFTER patching. The raw output does NOT typecheck.

Props/types survive compilation: LabButtonType, LabButtonKind, LabButtonSize,
and LabButtonProps are emitted verbatim into the React and Svelte outputs
(Svelte binds them via export let x: LabButtonProps["x"]). No `any` in the
hand-written source (Biome noExplicitAny enforced, lint green).

The generated React output required 3 MANUAL PATCHES to typecheck under the
repo's strict tsconfig (scripts/patch-output.ts applies and logs them):

1. Event type does not translate. Source onClick?: (event: MouseEvent) (DOM type
   — correct for Svelte/Vue/Solid native handlers) is passed through verbatim to
   React, which fires a SYNTHETIC React.MouseEvent<HTMLButtonElement>. Raw output
   errors TS2345. Mitosis has NO portable event type — retype per target.
2. children has no portable type. Mitosis exports no cross-target node type, so
   the source types children?: unknown; React's {props.children} then needs
   React.ReactNode or fails TS2322. Widened by patch.
3. Dead const Shows = null; injected from the `<Show>` import — fails
   noUnusedLocals. Pure dead code, removed by patch.

Raw-output proof: tsc -p output/tsconfig.react.json ->
error TS2304: Cannot find name 'useLocalProxy' (with the DEFAULT stateType — see
Criterion 4) and, after fixing that, the three errors above. After the 3
patches: typecheck clean (exit 0).

Takeaway: types are rich and preserved, but "type-safe out of the box" is false.
Every target needs hand-fixes for event types and children, plus dead-code
cleanup. At 38 components x 5 stacks this patch cost compounds.

---

## Criterion 3 — Styling on --lab-* + theme switching

Result: PASS. Clean — the strongest criterion for Mitosis.

- The Button consumes ONLY --lab-* (src/button.css). No hardcoded color anywhere.
  Type modifiers re-point local role variables (--_bg: var(--lab-accent) etc.)
  so a single rule set serves all three intents.
- Separation by surface, not border (owner's principle): fill/tinted/ghost
  separate via background/transparency; only kind=border carries a border, and
  there it is the control's OUTLINE role (inset box-shadow), not a separator.
- Theme = swapping the --lab-* set, proven by Playwright with resolved colors
  from the SAME compiled component:
    accent/fill bg: light rgb(58, 91, 255) vs dark rgb(110, 139, 255)
    danger/fill bg: light rgb(224, 50, 47) vs dark rgb(255, 92, 92)
  The component never names a theme; theme/light.css + theme/dark.css swap the
  whole role set on a [data-theme] ancestor.

Deliberate choice: styles are authored as a STANDALONE STYLESHEET, NOT Mitosis
useStyle/css. Reason: Mitosis's style solutions diverge per target (CSS-in-JS for
React, `<style>` for Svelte/Vue) which would make the cross-target weight/parity
comparison dishonest and couple styling to the compiler. A plain --lab-*
stylesheet is byte-identical on every target. This is the honest path but it
means Mitosis contributes NOTHING to styling here — the styling win is plain CSS
custom properties, not the tool.

Observed CSS subtlety (for the matrix): when a role var is declared by a
[data-theme] SELECTOR on an ancestor, a runtime style.setProperty re-point of
that var did not cascade through the --_bg indirection in Chromium during the
test. Theme switching by swapping the SET (the product requirement) works
perfectly; live single-token JS re-pointing of a selector-declared var is the
brittle part. Not a Mitosis issue — pure CSS cascade.

---

## Criterion 4 — Size (gzip, React target)

Result: PASS — genuinely zero-runtime, BUT only with the correct (non-default)
config.

Component-only weight (esbuild, minified, react/react-dom external —
scripts/measure.ts):

| Target | raw    | gzip  | runtime dep |
|--------|--------|-------|-------------|
| React  | 898 B  | 470 B | NONE (confirmed — no valtio/mobx/solid in bundle) |
| Svelte | 1732 B | 774 B | svelte runtime (external, shared) |

The zero-runtime claim is true — but the DEFAULT config silently breaks it. The
first config used stateType: 'hooks', which is NOT a valid React stateType.
Instead of erroring, Mitosis SILENTLY fell through to its valtio default and
emitted const state = useLocalProxy(...) from valtio/utils — i.e. it added a
RUNTIME DEPENDENCY and forgot to emit the import
(TS2304: Cannot find name 'useLocalProxy'). The valid zero-runtime value is
stateType: 'variables' (plain const declarations). Discovered only by reading
Mitosis's generators/react/helpers/state.js.

Takeaway: 0.46 KB gzip, zero runtime — excellent — IF you know to set
stateType: 'variables'. The footgun (invalid value -> silent runtime dep + broken
import) is a maturity red flag.

---

## DECISIVE SECTION — DX, maturity & vendor lock (the bench's key Mitosis risk)

The qualitative input the ADR most needs. Honest, unflattering.

What did NOT translate / required manual work
- Per-target patches to compile: 3 for React (event type, children type, dead
  Shows). Every patch is logged in scripts/patch-output.ts. A true write-once
  tool needs zero. These are STRUCTURAL (recur for every component), not one-off.
- No portable event type and no portable node/children type. The two most common
  interactive-component needs (a click handler, children) both leak
  target-specific typing. This is the core write-once crack.
- The RSC boundary is decided for you: "use client" is always emitted. Fine for
  a Button; a problem for components that could be server-only.

Compiler bugs / fragility hit in ONE small component
- JSDoc is mangled. Multi-line block comments are collapsed onto a single line in
  the output AND duplicated before every exported type (see
  output/react/src/button.tsx lines 24/48...). A multi-line doc comment on an
  interface member even CRASHED the compile (Mitosis's bundled prettier 2.8.8
  threw a parse error) until the comment was made single-line. The tool cannot
  round-trip ordinary documentation.
- Silent invalid-config fallthrough (the stateType footgun) — wrong output, no
  error.
- Bundled toolchain is old: Mitosis ships prettier 2.8.8 (2022-era) internally.

Vendor lock & ecosystem maturity (2026)
- Still 0.x (0.13.2) after years — no 1.0, no stability guarantee.
- Svelte output targets SVELTE 4 IDIOMS ($: reactive labels, on:click, slot),
  all legacy/deprecated in the installed Svelte 5.16. It compiles in Svelte 5
  compatibility mode with warnings (element_invalid_self_closing_tag) but is NOT
  idiomatic Svelte 5 and will break when Svelte drops legacy mode. Mitosis lags
  target-framework evolution.
- Lock-in shape: the source is a non-standard JSX subset (useStore,
  useDefaultProps, Show, .lite.tsx). It is NOT React, NOT valid for any framework
  directly. Abandoning Mitosis means rewriting every component by hand — the
  source is only useful THROUGH the compiler. That is the vendor lock the bench
  warned about, confirmed concretely.

Where Mitosis genuinely shines
- One real source -> real native components for React + Svelte, both SSR-capable.
- Truly zero-runtime React output (470 B) when configured right.
- Types preserved end-to-end (modulo the event/children gaps).
- Styling on --lab-* is clean and identical across targets (because we used plain
  CSS, not the compiler's style feature).

---

## Risks (mirror of prototype A's risk section)

| Risk | Severity | Evidence |
|------|----------|----------|
| 0.x maturity, no 1.0 | High | npm latest = 0.13.2 |
| Per-component manual patching scales 38x5 | High | 3 patches for 1 trivial component |
| No portable event/children types | High | TS2345 / TS2322 on raw output |
| Lags frameworks (Svelte 4 output on Svelte 5) | Medium | $:/on:/slot in output |
| Silent wrong-config -> runtime dep | Medium | useLocalProxy / stateType footgun |
| JSDoc mangled / can crash compile | Medium | prettier 2.8.8 parse throw |
| Hard vendor lock (non-standard source) | High | .lite.tsx only usable via compiler |
| Styling win is CSS, not Mitosis | Info | useStyle avoided on purpose |

---

## Reproduce

    cd prototypes/proto-b-mitosis
    pnpm install --ignore-workspace
    pnpm compile        # mitosis build + patch-output (logs the 3 patches)
    pnpm measure        # gzip weight + zero-runtime check
    pnpm exec tsc --noEmit -p ./output/tsconfig.react.json   # React typecheck: clean
    pnpm test:e2e       # Playwright smoke (Next 15 SSR, both themes): 5 passed
    # Astro: cd fixtures/astro && astro dev  (build works; standalone-node runtime
    #        hits an Astro/Node-24 astro: scheme bug, unrelated to Mitosis)

## Gates (this sandbox)
- Mitosis compile (React + Svelte): green.
- React output typecheck (strict): clean after 3 logged patches.
- Svelte output: compiles on Svelte 5 (2 legacy-self-closing warnings).
- Biome lint (hand-written source, repo config): green.
- Playwright smoke (Next 15 SSR, both themes): 5 passed.
- Root biome lint .: green (generated output/ + .next ignored).
- Main workspace untouched: prototypes/ is outside the pnpm workspace globs;
  only additive biome.json ignore entries changed in shared files.
