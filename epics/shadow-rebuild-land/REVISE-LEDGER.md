# shadow.html revise ledger — 2026-06-22 (rev. 5)

Target: `http://127.0.0.1:4321/shadow.html`
Source served from: `.claude/worktrees/shadow-rebuild-land/apps/docs/dist/` (built from
`apps/docs/src/shadow.html` + `shadow-demo.{ts,css}` in that worktree; served by
`vite preview` on :4321).
Order applied: **UX (structure/flow/IA/states) → UI (craft) → GOV (provenance)**.
Re-render: same URL, rebuilt dist, fresh full-page screenshots
(`shadow-revised-light.png`, `shadow-revised-dark.png`).

Disposition rule: every finding/warning is **CLOSED** (fixed + measured) or
**DEFERRED** (explicit reason). None silently dropped.

---

## A. CONFIRMED findings

| # | Finding | Sev | Discipline | Disposition | Evidence |
|---|---------|-----|-----------|-------------|----------|
| A0 | Focal subject (the elevation ladder) is near-invisible in the default dark theme — shadow ink color equals the page background (zero luminance delta), so the screen whose entire job is to differentiate 5 elevation levels cannot be ordered. | High | ux-hierarchy / ui | **CLOSED — class fix (dark-mode elevation model, grafted from best practice; not a patch).** Root cause re-measured live: dark page bg `rgb(16,16,18)`, card surface `rgb(28,28,30)`, shadow ink `#101012` = exactly the page bg at peak alpha 0.12 → the drop shadow contributes ~0 luminance contrast against its surround, so all 5 levels read as flat boxes (Josh-Comeau principle, restated by the finding: a drop shadow only reads as depth with luminance contrast against its surround). The owner's shadow contract (`packages/shadow/src/generated/shadow.css`) is **generated / owner-controlled and correct in LIGHT** (dark ink on a light page = strong contrast) — it was **not** hand-edited. The defect is dark-mode-specific and lives in the **demo page chrome**, which the demo legitimately owns. **Fix (UX→UI):** adopt the established dark-theme elevation model — convey depth by *lightening the surface* as elevation rises (higher level = lighter surface), shadow as a secondary cue. Source: Material Design "Dark theme" elevation overlays (m2.material.io/design/color/dark-theme). Five `--demo-elev-1..5` surfaces, **derived from the stub's own dark neutral ladder** (`--lab-bg-secondary` #1c1c1e → `--lab-bg-tertiary` #242426) extended by a monotonic white overlay (5/9/14%), **not invented from taste**. Size ladder XS→XL = levels 1→5; role aliases map onto the same surfaces (resting=xs, raised=s, overlay=l, modal=xl); tinted cards compose the brand tint *over* their per-level surface so they keep ordering. Surface-only change → no geometry change → **no layout shift** (min-height reserved; cards never move). Light theme: all 5 surfaces stay `#ffffff` → depth stays the shadow's job (unchanged). GOV: an honest `p.lede` (`depth-model-note`) states the model on the page. | Playwright live re-measure (transitions stilled): **DARK** per-level relative luminance `[0.0117, 0.0178, 0.0285, 0.0393, 0.0558]` — **strictly increasing** (monotonicUp=true, min step 0.0061), each level perceptibly lighter than the one below, page L=0.0052 (XL ≈10.7× page). Role grid `[0.0117,0.0178,0.0393,0.0558]` monotonic and each role == its aliased size. Tinted XL (L 0.0657) > tinted S (L 0.0256). **LIGHT** all 5 = L 1.0 (flat #fff, shadow carries depth — preserved). Screenshots `shadow-revised-dark.png` (5 levels visibly ordered, ladder legible) + `shadow-revised-light.png` (shadow ladder intact). New permanent regression test `shadow.spec.ts:204` "five elevation surfaces are orderable by luminance" green ×2 (chromium+webkit). e2e **18/18**; `tsc --noEmit` exit 0; `vite build` exit 0. |
| A1 | "Light angle" slider is a dead-end control — token updates, zero rendered effect on any card. | High | ux-flow-states | **CLOSED — class fix (remove, not patch).** Root cause measured: (1) `--lab-light-angle` is referenced by **zero** CSS rules — the shipped ladder is a literal vertical projection; (2) the JS re-projection wrote an inline `box-shadow` whose `color-mix(...var(--lab-shadow-alpha-*)...)` was **discarded by the cascade**, so `getComputedStyle` fell back to the `.lab-shadow-*` rule → byte-identical across angles. Rather than rescue a fragile inert knob, the control was **removed entirely**: no `<details class="advanced">`, no range input, no `output`, no projection JS. Replaced by an honest static `p.config-note` stating the angle is a **generator input** (`--lab-light-angle`, set before the ladder is emitted), matching the owner verdict "vertical is the default, angle is a config option". Removing the JS also eliminated the fractional-px artifacts it produced. | Playwright re-measure pre-fix: `identical_45_90=true`, inline box-shadow set but computed falls back to CSS rule, `--lab-light-angle` in 0 CSS rules. Post-fix: `angle-input` absent, `input[type=range]` count 0, `details` count 0, `config-note` present. e2e green. Screenshots show no Advanced disclosure. |
| A2 | Body measure exceeds the readable limit — up to ~103ch/line (lede #2), lede ~89ch, config-note ~82ch as rendered (font-true: lede 85.3ch, config-note 97.5ch); target 45–75ch. | High | ui-typography | **CLOSED — class fix (measure in `ch`, not a per-paragraph patch).** Root cause re-measured live (1440×1000, dpr 1): both `.lede` and `.config-note` capped at `max-width: 46rem` (= 736px usable). The cap was expressed in **rem**, which is decoupled from the font that actually sets the line — so the measure floated free of character count and, being a fixed pixel width, got **worse on the smaller 14px** `.config-note` (font-true 97.5ch, +30% over ceiling) than on the 16px lede (85.3ch). Two orthogonal methods agreed (canonical `ch` = width / `0`-advance, and chars/rendered-line). **Fix (UI craft):** cap body copy in `ch` — the font's own advance unit — at **`60ch`** on both `.lede` and `.config-note`. Because `1ch` scales with each element's own font, one value caps **every** body style (and any future body copy) inside the 45–75ch band regardless of font-size; `ch` is the canonical typographic measure unit (grafted best practice — the line-length solution any runner-up variant converges on, not invented from taste). Pixel-width change only on text containers whose height/flow already reflow naturally → no card geometry change → **no layout shift** (cards untouched). No GOV claim on the page asserts a line length, so no citation needed updating. | Playwright live re-measure post-rebuild (`shadow-BzfequdP.css`): all three body styles font-true **chCapacity = 60** (`inBand 45–75 = true` for every element); realistic average chars/line = **72.5** (under the 75 ceiling) for both the 16px lede and the 14px config-note; lede #2 reflowed 103/3-line → 77/4-line (governing cap in band). New permanent regression test `shadow.spec.ts:254` "body copy stays within the readable measure (45–75ch) on every body style" green ×2 (chromium+webkit). e2e **20/20**; `tsc --noEmit` exit 0; `vite build` exit 0. Screenshots `shadow-revised-light.png` / `shadow-revised-dark.png` show narrower, comfortable paragraphs; A0 dark ladder + W5–W9 contrast unregressed. |
| A4 | **UX / IA (rev. 5).** Inverted label hierarchy: the PRIMARY specimen group — the XS..XL size ladder, which is the actual deliverable (the 5-size contract) — was the ONLY group with no visible heading; its sole label was an `aria-label="Elevation sizes"` invisible to sighted users. Both DERIVED groups (`Semantic roles` = aliases onto sizes; `Opt-in surface tint` = opt-in) had visible H2s. A sighted maintainer scanning headings (`querySelectorAll('h1..h6')` = `['Shadow stack','Semantic roles','Opt-in surface tint']`) could not locate the core ladder; the primitive read as subordinate to its own derivatives. | High | ux-ia | **CLOSED — class fix (every specimen group titled by a real visible heading wired to its grid; not a one-off heading patch).** Root cause re-measured live: the size grid carried `aria-label` only (`hasOwnHeading=false`), while the two derived sections were preceded by visible H2s — so the labelling mechanism was inconsistent *across peer groups*, and the inconsistency happened to hide the primary one. **Fix (UX, applied FIRST):** give **every** group the same labelling contract — a visible `<h2 class="section-head">` + a one-line descriptor `.lede`, each `<section>` wired to its heading via `aria-labelledby` (no group labelled by `aria-label` only). The PRIMARY group leads: its heading is first in DOM/visual order and carries extra weight (`.section-head--primary`, bold + a brand accent rule) so a heading-scan lands on the core ladder first; the two derived headings stay at 600 weight so the order reads primitive → derived. This closes the CLASS *"a specimen group labelled by an invisible-only mechanism / inconsistent group labelling"*, not just this one heading. Surface/geometry untouched (only a heading + lede inserted into the natural grid flow, cards never move) → **no layout shift**. The redundant `aria-label`s were removed in favour of `aria-labelledby` so the accessible name now equals the on-screen heading text (one source of truth). | Playwright live re-measure (rebuilt dist `shadow-BQ8MrmHT.css`): `querySelectorAll('h1..h6')` = `['Shadow stack' (h1,700,48px), 'Elevation sizes' (h2,**700**,20px,id=size-head), 'Semantic roles' (h2,600,20px), 'Opt-in surface tint' (h2,600,20px)]` — all `offsetParent!=null` (visible). All 3 specimen `section.grid` have `aria-labelledby` resolving to a visible heading; `ariaLabelOnly=false` for every grid; `aria-label` count on grids = 0. First `.section-head` `firstSectionHeadIsPrimary=true`. New permanent regression test `shadow.spec.ts:293` "every specimen group is titled by a VISIBLE heading wired to its grid; the primary ladder leads" — **RED-proved** (reverted dist to the pre-fix aria-label-only form → test FAILS at `size-grid must not be labelled by aria-label only`; restored → PASS) then green ×2 (chromium+webkit). e2e **22/22**; `tsc --noEmit` exit 0; `vite build` exit 0. Screenshots `shadow-revised-light.png` / `shadow-revised-dark.png` show the bold brand-ruled "Elevation sizes" heading leading the ladder, with the two derived groups subordinate. |
| A3 | **GOV / citation-provenance (rev. 4).** Decision-ledger source citation `layer.ts:12 SHADOW_SLOTS=['s1','s2','s3','s4']` (ledger items L3 / item 3 in the peer-review prompts) is **tree-ambiguous**: it names a file:line but not the tree/commit. An isolated auditor reading the **`main`** tree (`edb01bb`) finds `layer.ts:13 = SHADOW_LAYERS=['minor','ambient','penumbra','major']` and **no** `SHADOW_SLOTS` / `s1..s4` anywhere → correctly concludes "fabricated citation." But the page under audit (`http://127.0.0.1:4321/shadow.html`) is **not** built from main. | Critical | gov-citations | **CLOSED — class fix (pin every source citation to tree+commit; not a one-line patch).** Root cause measured: the served URL is built from the **`shadow-rebuild-land` worktree** (branch `shadow-rebuild-land`, HEAD `b99a4fa`), whose own `packages/shadow/src/domain/layer.ts:12` is **exactly** `export const SHADOW_SLOTS = ['s1', 's2', 's3', 's4'] as const` (and `:26` `SLOT_ALPHA { s1:0.12, s2:0.04, s3:0.02, s4:0.01 }`), and whose generated `shadow.css` emits the **served** contract `--lab-shadow-alpha-s1..s4` (confirmed by `getComputedStyle` on the live page). So the citation is **exact against the tree the page is actually built from**, and false against main **only because the `SHADOW_LAYERS → SHADOW_SLOTS` rename (`minor/ambient/penumbra/major` → `s1..s4`) is the very shadow work being landed.** The auditor was not wrong to flag it — the *citation* was wrong to omit which tree, which is the defect. **Fix:** every TypeScript-source citation in this ledger is now pinned to `<tree>@<commit>:<path>:<line>` and a Provenance subsection (§E) records the main↔worktree rename divergence, so no isolated auditor can re-derive "fabrication" by reading the wrong tree. The CLASS closed is *tree-ambiguous source citations*, not this one line. No page pixels change (GOV-only). | Read `main@edb01bb:packages/shadow/src/domain/layer.ts:13` → `SHADOW_LAYERS=['minor','ambient','penumbra','major']`, grep `SHADOW_SLOTS\|s1..s4` over `main` shadow src = **0 matches**. Read `shadow-rebuild-land@b99a4fa:packages/shadow/src/domain/layer.ts:12` → `SHADOW_SLOTS=['s1','s2','s3','s4']`, `:26` `SLOT_ALPHA s1=.12 s2=.04 s3=.02 s4=.01`. `curl :4321/assets/shadow-BzfequdP.css \| grep alpha` → `--lab-shadow-alpha-s1..s4` (served contract = slot names). `git -C <worktree> rev-parse --short HEAD` = `b99a4fa`; `git -C <root> rev-parse --short HEAD` = `edb01bb`. e2e **20/20**, `tsc --noEmit` exit 0 (both trees). No page change → A0/A1/A2 + W1–W9 unregressed (same `shadow-BzfequdP.css`). |

A1 (UX) cascades to close three of the warnings below (target-size, the JS-origin
fractional px, and part of reduce-motion's surface area). A0 (UX→UI) closes the
central High and is locked by a new permanent regression test. A2 (UI typography,
rev. 3) closes the body-measure High with a `ch`-unit class fix and a new
permanent regression test. **A3 (GOV citation-provenance, this cycle, rev. 4)**
closes the Critical "fabricated citation" by pinning every source citation to its
tree+commit and recording the main↔worktree rename in §E — a GOV-only change, no
page pixels touched (the served `shadow-BzfequdP.css` is byte-identical, so A0/A1/A2
and W1–W9 are unregressed by construction). Ordering held: UX and UI were already
closed in prior cycles; rev. 4's sole finding was GOV, applied last.

**A4 (UX/IA) + W10/W11 (GOV contrast) — this cycle, rev. 5.** A4 closes the central
High of this cycle (inverted label hierarchy) with a class fix — every specimen group is
now titled by a real, visible, `aria-labelledby`-wired heading, the primary XS..XL ladder
leading with the heaviest heading — locked by a new RED-proved permanent regression test
(`shadow.spec.ts:293`). W10/W11 close the two deterministic APCA small-text warnings by
raising the dark muted ink to `#e6e6ec` (Lc ≥79 on the lightest rungs). Ordering held
strictly: **UX (A4 heading/IA) → UI (heading weight/accent craft) → GOV (W10/W11 ink)**.
No layout shift (heading insertion rides the natural grid flow; ink/weight are paint-only).
The served build advanced from `shadow-BzfequdP.css` to `shadow-BQ8MrmHT.css`.

---

## B. DETERMINISTIC WARNINGS — each FIXED or accepted-with-reason

| # | Warning | Layer | Disposition | Evidence |
|---|---------|-------|-------------|----------|
| W1 | target-size: 16px < 24 @ `input#angle[type=range]` (192x16). | UI | **CLOSED.** The range input was removed with the dead-end control (A1). No sub-24px target remains; the smallest interactive target is the `Switch to dark/light` button (≈137x39, passes 24px floor). | `input[type=range]` count = 0 post-fix; only interactive element is the toggle button. |
| W2 | reduce-motion: ignores `prefers-reduced-motion`. | GOV | **CLOSED.** Added `@media (prefers-reduced-motion: reduce) { body, #theme-toggle, #theme-toggle:hover, .card { transition: none; } }`. All decorative easing (theme swap, toggle hover, card elevation) collapses to instant. Locked with a permanent regression test in `shadow.spec.ts`. | Under `page.emulateMedia({reducedMotion:'reduce'})`: `matches=true`, body/card/toggle `transitionDuration` all `0s` on chromium AND webkit. New e2e test green ×2. |
| W3 | reduced-motion: emulated true yet all 13 transitions kept non-zero durations; no `@media` guard. | GOV | **CLOSED — same fix as W2** (this is the detailed restatement of W1's motion finding). Guard now present and proven; default (no preference) still eases as designed (0.16s shadow / 0.2s bg+color). | Same as W2; default-mode measure shows easing intact (`card 0.16s`, `body 0.2s,0.2s`). |
| W4 | type-scale: fractional px 12.8 (sizes 48/20/16/12.8). @ code labels, lede/summary. | UI | **CLOSED.** `.card-label` / `.card code` moved from `0.8rem` (12.8px) to `0.75rem` (12px). `summary` (12.8px source) removed with the disclosure (A1). The `config-note` uses `0.875rem` (14px), on the integer scale. | Live `getComputedStyle` distinct font sizes now `[12px, 14px, 16px, 20px, 48px]`; fractional-px set empty. |
| W5 | contrast: APCA Lc 70<75 @ `p.lede` (light), fg #6b6b76 on #f4f4f6, 16px. | GOV | **CLOSED.** Light secondary ink `--demo-ink-soft` `#6b6b76` → `#555560`. Still a clear soft-gray vs the `#16161a` primary (hierarchy preserved). | Checker: #555560 on #f4f4f6 @16px → APCA Lc **79.1** PASS (WCAG 6.7). Live lede color = rgb(85,85,96). |
| W6 | contrast: APCA Lc 70<75 @ `summary 'Advanced'` (light). | GOV | **CLOSED.** The `summary` element was removed with the disclosure (A1); the surviving secondary text on the light page is `.lede` / `.config-note`, both at the new `#555560` (Lc ≥79). | Element no longer exists; replacement copy uses passing ink. |
| W7 | contrast: APCA Lc 59<75 @ `p.lede` (dark), fg #b0b0b9 on #101012, 16px. | GOV | **CLOSED.** Dark secondary ink pinned `#b0b0b9` → `#d2d2da` (default `:root`, overriding the stub's `--lab-label-secondary`). | Checker: #d2d2da on #101012 @16px → APCA Lc **79.2** PASS (WCAG 12.65). Live dark lede = rgb(210,210,218). |
| W8 | contrast: APCA Lc 59<75 @ `summary 'Advanced'` (dark). | GOV | **CLOSED.** Same as W6 — `summary` removed; replacement copy uses `#d2d2da` (Lc ≥79 dark). | Element gone; replacement ink passes. |
| W9 | contrast: APCA Lc 58<75 @ code labels (dark), 12.8px on #1c1c1e (e.g. `.lab-shadow-xs`). | GOV | **CLOSED.** Two effects compound: ink `#b0b0b9`→`#d2d2da` and size 12.8px→12px. | Checker: #d2d2da on #1c1c1e (card surface) @12px → APCA Lc **78.0** PASS (WCAG 11.32). |
| W10 | contrast (rev. 5): APCA Lc **69**<75 @ `.lab-elevation-modal` code label — 12px muted `#d2d2da` on the lightest dark elevation surface (`#434344`). WCAG 6.57 PASS but small-text APCA fails. | GOV | **CLOSED — class fix (raise the dark muted ink to clear the LIGHTEST rung, not a per-card patch).** Root cause: the dark elevation model *lightens the surface as elevation rises*, so the 12px muted code label rides onto progressively lighter surfaces up to the ~#43 XL/modal rung. The prior ink `#d2d2da` was tuned for the page (#101012, Lc 79) but only reached Lc 69 on the lightest rung — the muted ink must clear Lc 75 against the *brightest* surface in the ladder. Fix: `--demo-ink-soft` (dark) `#d2d2da` → **`#e6e6ec`**, applied at both the default `:root` and `[data-theme="dark"]`. One value, every rung passes; `#e6e6ec` stays a clear soft-gray below the primary ink (hierarchy preserved). | Repo checker `design-rules/contrast.checkContrastPair` (same math as the warning): #e6e6ec on #434344 @12px → APCA Lc **81.2** PASS (WCAG 7.95); on the darkest rung #1c1c1e → Lc **90.3**. Live DOM: `.lab-elevation-modal .card-label` color = `rgb(230,230,236)` = #e6e6ec, 12px. e2e 22/22; screenshots show legible labels on all rungs. |
| W11 | contrast (rev. 5): APCA Lc **67**<75 @ `.card-tinted.lab-shadow-xl` card label — 12px muted `#d2d2da` on tinted XL dark surface (`#434953`). WCAG 6.03 PASS but small-text APCA fails. | GOV | **CLOSED — same class fix as W10.** The tinted-XL surface is the lightest tinted rung (the tint composes over the elev-5 surface), so it hit the same shortfall. The single ink raise to `#e6e6ec` clears it. | Checker: #e6e6ec on #434953 @12px → APCA Lc **79.3** PASS (WCAG 7.29). Live DOM: `.card-tinted.lab-shadow-xl .card-label` color = `rgb(230,230,236)`, 12px. |

No warning left undisposed. No exception rows were required — every warning was a real
defect on this page and was **fixed**, not accepted.

### This cycle's deterministic warnings (rev. 5): two APCA small-text warnings — BOTH FIXED

The rev. 5 input carried two deterministic `contrast.mjs verdict=warn` rows (W10, W11
above) and one CONFIRMED High (A4, UX/IA). Order held: **UX first** (A4 — visible
heading per specimen group), **UI second** (the heading craft: weight tiers + brand
accent rule on `.section-head--primary`, integer 20px scale, no fractional px), **GOV
last** (W10/W11 — raise the dark muted ink to `#e6e6ec`). Both warnings were **real
defects on this page and were FIXED, not accepted** — so **no `{aspect,
decision:"accept", because, evidence}` exception row was required**. The class closed is
*"dark muted small-text ink must clear APCA Lc 75 against the LIGHTEST rung of the dark
elevation ladder"* — one ink value fixes every rung (modal, XL, tinted-XL), not a
per-card patch. Checker-gap note (provenance): `checkContrastPair` already models this
exactly (APCA Lc 75 small-text bar) — the warnings were a true math-layer catch, and the
fix was verified with the same checker (Lc 79–81 on the two warning surfaces).

### Prior cycle (rev. 4) deterministic warnings: `[]` (none)

The rev. 4 revision input carried `WARNINGS: []` and `QUAL fails: []`. The single
CONFIRMED item this cycle was the **Critical** finding **A3** (fabricated/ambiguous
source citation), now CLOSED by the tree+commit citation-pinning class fix above and
§E. Because the warnings array was empty and the one CONFIRMED item was fixed (not
accepted), **no `{aspect, decision:"accept", because, evidence}` exception row was
required** — exception rows exist only for a deterministic warning left
unfixed-on-purpose, and there were none this cycle. The fix is GOV-only (provenance);
no checker math was involved, so there is no checker-gap to record for A3 beyond the
provenance pinning itself.

### Prior cycle (rev. 3) deterministic warnings: `[]` (none new)

The rev. 3 revision input carried `WARNINGS: []` and `QUAL fails: []`. The single
CONFIRMED item that cycle was the **High** finding **A2** (body measure exceeds the
readable limit), CLOSED by the `ch`-unit class fix above. No undisposed warning
remained; therefore **no `{aspect, decision:"accept", because, evidence}` exception row
was needed** (an exception row is only for a deterministic warning left
unfixed-on-purpose — there were none that cycle). Note for provenance: the repo's own
deterministic checkers (`design-rules/checks.mjs`) cover shadow dirt, type-scale,
radius, currency and contrast, but do **not** model a body-measure ceiling
(chars-per-line) — so A2 was correctly raised as a confirmed narrow-critic finding, not
a math-layer catch. That checker gap is recorded here (a candidate to add a
`checkMeasure` rule), not silently absorbed.

### Prior cycle (rev. 2) deterministic warnings: `[]`

The rev. 2 CONFIRMED item was the **High** finding A0 (dark-theme focal subject), CLOSED
by fix above; `checkShadowColors` flags only pure-#000 shadows (a light-theme dirt rule)
and does not model the dark-theme zero-luminance-delta class — A0 was correctly a
confirmed finding, not a math-layer catch. No exception row was needed then either.

---

## C. Verification (isolated, tool-grounded)

> **rev. 5 delta:** `tsc --noEmit` exit 0 (no `any`/`@ts-ignore`/`@ts-expect-error`;
> the new test's `first` access is guarded explicitly). `vite build` exit 0 → served
> dist advanced to `shadow-BQ8MrmHT.css`. e2e **22/22** (chromium+webkit) including the
> new `shadow.spec.ts:293` IA lock, which was **RED-proved**: reverting the built
> `dist/shadow.html` to the pre-fix `aria-label`-only form makes it FAIL at exactly
> `size-grid must not be labelled by aria-label only`; restoring the build → PASS.
> GOV W10/W11 re-checked with the repo's own `contrast.checkContrastPair`: `#e6e6ec`
> @12px → Lc 81.2 on #434344 (W10) and Lc 79.3 on #434953 (W11), both PASS; Lc 90.3 on
> the darkest #1c1c1e; light muted `#555560` unchanged (Lc 85.6 PASS). Live DOM confirms
> 4 headings (1×h1 + 3×h2, primary at weight 700, derived at 600, all visible), every
> specimen grid `aria-labelledby` a visible heading, dark labels `rgb(230,230,236)`.
> Re-render: same URL `http://127.0.0.1:4321/shadow.html`, rebuilt dist, fresh full-page
> screenshots `shadow-revised-light.png` + `shadow-revised-dark.png`, inspected per
> component (bold brand-ruled "Elevation sizes" leads; derived groups subordinate; 5 dark
> rungs ordered; labels legible on the lightest rung).


- **Typecheck:** `tsc --noEmit` → exit 0 (no `any`, no `@ts-ignore`, no `@ts-expect-error`).
- **Build:** `vite build` → exit 0; served dist refreshed — rev. 3 emits
  `shadow-BzfequdP.css` carrying the `60ch` body-measure cap on `.lede` / `.config-note`
  **and** the rev. 2 dark elevation model; `shadow-demo` JS still carries theme-toggle
  only (zero projection/`boxShadow`/range logic). (The "use client" rollup notes are
  pre-existing bundling noise from the React packages — unrelated to this change.)
- **e2e (re-run this cycle):** `playwright test shadow.spec.ts` → **20/20 PASS**
  (chromium + webkit) on `2026-06-22` against the unchanged served dist, including the
  `prefers-reduced-motion` regression test, the rev. 2 `shadow.spec.ts:204` "five
  elevation surfaces are orderable by luminance" lock, **and** the rev. 3
  `shadow.spec.ts:254` "body copy stays within the readable measure (45–75ch) on every
  body style" CLASS lock. rev. 4 added no page test (GOV-only) but re-ran the full suite
  to prove the citation fix regressed nothing.
- **rev. 4 GOV verification (citation provenance):** read both trees directly —
  `main@edb01bb:packages/shadow/src/domain/layer.ts:13` = `SHADOW_LAYERS=[…minor…major]`,
  `shadow-rebuild-land@b99a4fa:…/layer.ts:12` = `SHADOW_SLOTS=['s1','s2','s3','s4']`;
  served `:4321/assets/shadow-BzfequdP.css` exposes `--lab-shadow-alpha-s1..s4` (slot
  contract). Citation `layer.ts:12 SHADOW_SLOTS` is **exact** against the built tree.
  `tsc --noEmit` exit 0 in both `packages/shadow` and `apps/docs`.
- **Live measurement (Playwright getComputedStyle, 1440×1000, dpr 1):**
  - rev. 3 (measure): all three body styles font-true **chCapacity = 60** (`inBand 45–75
    = true`); realistic average **72.5 chars/line** (< 75 ceiling) for both the 16px lede
    and the 14px config-note; the prior worst (103ch, +37%) is gone.
  - rev. 2 (dark ladder, unregressed): dark per-level luminance strictly increasing
    `[0.0117,0.0178,0.0285,0.0393,0.0558]`; light flat at 1.0 (shadow carries depth);
    shadow-vs-surface "never a glow" still holds.
- **No layout shift:** rev. 3 changes only the `max-width` (pixel width) of text
  containers that reflow naturally; card geometry/box-shadow untouched. rev. 2 changed
  only `background` (eased) on cards whose `min-height` is reserved. CLS = 0.
- **Re-render:** same URL `http://127.0.0.1:4321/shadow.html`; fresh full-page screenshots
  `shadow-revised-light.png` + `shadow-revised-dark.png`; inspected per-component by eye
  (narrower comfortable paragraphs; 5 dark levels visibly ordered; role + tinted grids
  order; light shadow ladder intact; toggle label in sync; dark text legible).

## D. Deferred — out of scope (stated, not silent)

| Item | Why deferred |
|------|--------------|
| Page chrome literals (`--demo-bg/card/ink` light block) are demo-only pins, not the real `@labpics/colors` per-theme contract. | Pre-existing by design (stub is single-theme); the source comments already flag "re-point to var(--lab-label-secondary) once the engine themes it". Not a finding in this cycle; replacing the stub is the colors-engine epic's job, not shadow.html craft. |
| `favicon.ico` → HTTP 404 console error on load (observed during rev. 4 re-render). | Benign dev-server artifact, not a page defect: the demo specimen ships no favicon and the page renders fully without it. Out of scope for shadow.html visual craft; recorded here so the observed console error is not silently dropped. |

---

## E. Provenance — source citations pinned to tree + commit (rev. 4)

The served page (`http://127.0.0.1:4321/shadow.html`, `vite preview`) is built from the
**`shadow-rebuild-land`** worktree, **not** repo `main`. The shadow work being landed is
a rename — `SHADOW_LAYERS` (`minor/ambient/penumbra/major`) on main becomes
`SHADOW_SLOTS` (`s1..s4`) on the branch — so a citation that names only `file:line`
resolves to **opposite facts** depending on which tree the reader checks out. Every
source citation below is therefore pinned to `<tree>@<commit>:<path>:<line>`.

| Tree | Commit | `layer.ts` line 12–13 | Served alpha contract |
|------|--------|------------------------|------------------------|
| `main` (repo root) | `edb01bb` | `:13 SHADOW_LAYERS = ['minor','ambient','penumbra','major']` (no `SHADOW_SLOTS`) | `--lab-shadow-alpha-minor..major` |
| `shadow-rebuild-land` (served) | `b99a4fa` | `:12 SHADOW_SLOTS = ['s1','s2','s3','s4']`; `:26 SLOT_ALPHA {s1:.12,s2:.04,s3:.02,s4:.01}` | `--lab-shadow-alpha-s1..s4` |

**Corrected, tree-pinned citations** (superseding the bare `layer.ts:12` form used in the
`.playwright-mcp/peer-context.txt` / `peer-ctx.txt` review prompts):

- **L3 / four-ply law:** `shadow-rebuild-land@b99a4fa:packages/shadow/src/domain/layer.ts:12`
  `export const SHADOW_SLOTS = ['s1','s2','s3','s4'] as const` — four slots per level.
  Fixed per-slot alphas: same file `:26` `SLOT_ALPHA {s1:0.12,s2:0.04,s3:0.02,s4:0.01}`.
  Rendered proof: served `shadow-BzfequdP.css` `--lab-shadow-alpha-s1..s4` = `.12/.04/.02/.01`
  (`getComputedStyle(:root)` on the live page) + `shadow.spec.ts:54` "every card resolves
  to a real four-ply box-shadow" PASS ×2.
- **Why an isolated auditor saw "fabrication":** checking `main@edb01bb` finds
  `SHADOW_LAYERS` / `minor..major` and **zero** `SHADOW_SLOTS`/`s1..s4` — a correct
  observation about the **wrong tree**. The defect was the missing tree qualifier, now
  supplied. The decision (four plies, fixed alphas) was true throughout; only its citation
  address was ambiguous.

This closes the CLASS *tree-ambiguous source citation* for this ledger: any future source
reference must carry its `<tree>@<commit>` so it is verifiable without guessing the branch.
