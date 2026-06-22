# Design spec — shadow rebuild, landed onto main (v1)

> Status: **ESCALATE** — not landed, not done. A taste/scope call is needed before this proceeds.
> See [`## NOT PASSED — open`](#not-passed--open) at the bottom. Everything above documents
> the verified state of the work as of the rev. 5 build; it does **not** assert the job is complete.

- Spec target file: `C:/Users/Daniel/projects/labui/.design/shadow-rebuild-land-v1.spec.md`
- Rendered URL (live, served): `http://127.0.0.1:4321/shadow.html`
- Source tree served: `.claude/worktrees/shadow-rebuild-land/` worktree, branch `shadow-rebuild-land`, HEAD `b99a4fa` (served via `vite preview` on `:4321` from rebuilt `apps/docs/dist/`).
- Served stylesheet: `apps/docs/dist/assets/shadow-BQ8MrmHT.css` (rev. 5).
- Final screenshots: `.design/shadow-rebuild-land-v1-final-light.png`, `.design/shadow-rebuild-land-v1-final-dark.png` (copies of the ledger's `shadow-revised-{light,dark}.png`).

---

## Key job

A labui maintainer wants to land the shadow rebuild — the 5-size XS..XL elevation ladder, the
`layer`→`slot` rename, the fixed Figma alphas, and the surface-tinted vertical light source —
onto current `main`, with the consumed `--lab-*` contract preserved and every guard/test green.

**Persona:** the maintainer landing the work (not a first-time reader of the design system).

**Critical reframe found during grounding.** The brief's premise ("land the branch cleanly")
is unsafe. `fix/shadow-owner-verdict` is cut from merge-base `6a92b08` (PR #7) and sits 22
commits behind `main` (PRs #26–#47). A naive `git merge` of the branch stages **40,335
deletions** — it would revert every component, the docs site, the colors-stub, and the tokens.
The real shadow work is only ~17 files / ~1108 insertions, isolated to `packages/shadow/**`,
`apps/docs/src/shadow*`, `apps/docs/tests/shadow.spec.ts`, `.changeset/materials-shadow-stack.md`.
So the key job is **REPLAY** (cherry-pick / rebase the 3 commits `f80c2cb`, `a2d9072`, `2839f4d`
onto current main in a worktree) — **not** a back-merge — then verify the renamed
`--lab-shadow-alpha-*` contract survives the colors-stub consumed-contract +
no-hardcoded-colour guards that landed *after* the branch base.

Plan of record: `epics/shadow-rebuild-land/EPIC.md`.

## Polar Star — steps achieved vs budget

- **Budget:** 18 steps.
- **Achieved:** the design/verification loop ran **6 rounds** and **plateaued at 3 open items**
  (confirmed + qual + warn) after round 6. The rev. 5 build closed five disciplined findings
  (A0 dark-elevation model, A1 dead light-angle control, A2 body-measure, A4 IA heading
  hierarchy, W10/W11 dark small-text contrast); the round-6 items did **not** close.
- **Verdict:** the Polar Star (land clean, all guards green, owner-mergeable) is **not reached**.
  The loop hit a plateau that needs a human taste/scope decision rather than another round —
  hence ESCALATE.

---

## UX

### Flow
Single-page specimen at `http://127.0.0.1:4321/shadow.html`. The reader scans top-to-bottom:
intro lede → light/dark theme toggle + static angle note → **Elevation sizes** (the primary
XS..XL ladder) → **Semantic roles** (aliases onto sizes) → **Opt-in surface tint** (derived,
opt-in). One interactive control only: the `Switch to dark/light` button. There is **no**
runtime light-angle control — the angle is a generator input, stated in a static note (closed
finding A1).

### Information architecture
Three peer specimen groups, each a `<section>` titled by a **visible** `<h2 class="section-head">`
wired via `aria-labelledby` (no `aria-label`-only group). DOM/visual order communicates
primitive → derived:

1. **Elevation sizes** — the deliverable. 5 cards: `.lab-shadow-xs / -s / -m / -l / -xl`.
   Heading carries extra weight (`.section-head--primary`, 700 + brand accent rule) so a
   heading-scan lands here first.
2. **Semantic roles** — 4 cards: `.lab-elevation-resting / -raised / -overlay / -modal`,
   aliases onto sizes (resting=xs, raised=s, overlay=l, modal=xl). Heading at weight 600.
3. **Opt-in surface tint** — 2 cards (`opt-in tint · S`, `opt-in tint · XL`), tint composed
   over the per-level surface. Heading at weight 600.

### States
- **Theme:** light (default neutral page) ↔ dark, via the toggle. Label stays in sync
  (`Switch to dark` / `Switch to light`).
- **Light theme depth cue:** the drop shadow. All 5 surfaces stay `#ffffff`; depth = shadow.
- **Dark theme depth cue:** the **surface**. Each level sits on a lighter surface than the one
  below (dark-theme elevation model, Material Design dark elevation overlays); shadow is a
  secondary cue. Five `--demo-elev-1..5` surfaces derived from the stub's dark neutral ladder
  (`--lab-bg-secondary` `#1c1c1e` → `--lab-bg-tertiary` `#242426`) extended by a monotonic
  white overlay (5/9/14%). Measured dark per-level relative luminance is **strictly increasing**
  `[0.0117, 0.0178, 0.0285, 0.0393, 0.0558]` (page L = 0.0052).
- **Elevation transition:** eased via a `box-shadow` transition (token `--lab-shadow-transition`),
  ~0.16s shadow / 0.2s bg+color; collapses to `0s` under `prefers-reduced-motion: reduce`.
- **Tinted state:** opt-in; tint nudges the dark anchor, never lightens the composite past the
  surface, so ordering is preserved (tinted XL L 0.0657 > tinted S L 0.0256).

---

## UI

### Tokens (consumed, not re-authored)
- **Shadow contract:** `--lab-shadow-alpha-s1..s4` = `0.12 / 0.04 / 0.02 / 0.01` (FIXED across
  all 5 sizes; depth grows by geometry alone). Source:
  `shadow-rebuild-land@b99a4fa:packages/shadow/src/domain/layer.ts:12` `SHADOW_SLOTS` + `:26`
  `SLOT_ALPHA`. Served as `--lab-shadow-alpha-s1..s4` in `shadow-BQ8MrmHT.css`.
- **Light source:** single global `--lab-light-angle` = `0deg` (vertical).
  `packages/shadow/src/config.ts:13` `DEFAULT_LIGHT_ANGLE_DEG = 0`. One angle for the whole
  stack; no per-level angle.
- **Shadow ink / anchor:** `#101012` (Figma N12 — NOT pure black).
  `config.ts:21-22` `SHADOW_COLOR_FALLBACK_LIGHT/DARK = '#101012'`. Tint is opt-in via
  `--lab-surface-shadow-tint` and `color-mix` over transparent.
- **Migrated colour roles consumed by the demo:** `--lab-label-brand-primary`,
  `--lab-bg-primary/secondary/tertiary` (the post-migration names; the removed
  `--lab-accent / --lab-surface-base / -raised` are **not** used).
- **Dimension/type tokens:** `--lab-space-*`, `--lab-radius-*`, `--lab-font-weight-semibold`
  (PR #43) from `packages/core` / `@labpics/ui-tokens`.

### Type scale (rendered, integer px — no fractional sizes)
| Role | Size | Weight |
|---|---|---|
| h1 | 48px | 700 |
| h2 (`.section-head`) | 20px | 700 primary / 600 derived |
| body lede | 16px | 400 |
| `.config-note` | 14px | 400 |
| card label / `code` | 12px | — |

Distinct rendered sizes: `[12px, 14px, 16px, 20px, 48px]` (the 12.8px fractional value W4 flagged
is gone). **Measure:** body copy capped at **`60ch`** on `.lede` and `.config-note` (the font's
own advance unit), keeping every body style inside the 45–75ch band (measured avg 72.5 ch/line).

### Spacing & layout
Cards laid on a grid; each elevation level reserves `min-height`, so surface/ink changes never
move a card → CLS = 0. The dark surface-lightening change and the body-measure cap are both
geometry-neutral (paint / max-width only).

### Color roles
- Light secondary ink `--demo-ink-soft` = `#555560` (APCA Lc 79.1 on `#f4f4f6` @16px).
- Dark secondary/muted ink = `#e6e6ec` (clears APCA Lc 75 small-text on the **lightest** dark
  rung `#434344` → Lc 81.2; darkest rung `#1c1c1e` → Lc 90.3). Primary dark ink stays above it
  (hierarchy preserved).
- Shadow ink anchor `#101012` (above).

### Motion specs (trigger / duration / easing per state)
| State change | Trigger | Duration | Easing / mechanism |
|---|---|---|---|
| Elevation depth change | hover / state change on a card | ~0.16s | `box-shadow` transition wired by `--lab-shadow-transition` (eases the surface rising/settling; INP-friendly) |
| Theme swap (bg) | toggle click | ~0.2s | `background` transition |
| Theme swap (text color) | toggle click | ~0.2s | `color` transition |
| Toggle hover | pointer hover on `#theme-toggle` | (decorative ease) | button hover transition |
| Any of the above | `prefers-reduced-motion: reduce` | **0s** | `@media (prefers-reduced-motion: reduce)` collapses body/`#theme-toggle`/`.card` transitions to none |

Verified: `shadow.spec.ts:96` "elevation changes ease — the motion token wires a box-shadow
transition" PASS (chromium+webkit); `shadow.spec.ts:113` reduced-motion lock PASS.

---

## Decision ledger (verbatim)

Recorded as the design decisions of record, each with its citation. Reproduced verbatim from
the planning ledger.

1. **[ia / ux]** Land by REPLAY (cherry-pick `f80c2cb`,`a2d9072`,`2839f4d` onto `origin/main` in
   a worktree), not back-merge of the stale branch.
   *Because:* The branch is 22 commits behind merge-base `6a92b08`; a naive merge stages 40,335
   deletions that revert every component, the docs site, colors-stub and tokens. Replay isolates
   intent from staleness — the smallest action that lands the work without reverting 22 PRs.
   *Evidence:* `git merge-base main fix/shadow-owner-verdict` = `6a92b08`;
   `git diff --shortstat origin/main..HEAD` = 17 files, 1107 ins / 636 del;
   `git diff --name-only origin/main..HEAD | grep -v '^(packages/shadow|apps/docs/src/shadow|apps/docs/tests/shadow|.changeset)'`
   returned NONE.

2. **[state / ux]** Resolve the one `shadow-demo.css` conflict by keeping branch design intent
   (`--lab-shadow-tint-strength:0.35`) but adopting main's MIGRATED contract names
   (`--lab-label-brand-primary`, `--lab-bg-primary/secondary`), never the removed
   `--lab-accent / --lab-surface-base / raised`.
   *Because:* The branch was cut before the contract migration (PRs #41-#47). The
   consumed-contract guard scans `apps/**` and would flag the removed names as 'unclassified' →
   FAIL. Migrating the names satisfies the guard the branch never saw without weakening it
   (CLAUDE.md anti-podlog).
   *Evidence:* grep of `roles.json`: `--lab-accent / --lab-surface-base` absent (0 matches),
   `--lab-label-brand-primary / --lab-bg-primary` present; `consumed-contract.test.ts` PASS 6/6
   after resolution; guard source `packages/colors-stub/test/consumed-contract.ts`
   `consumerFiles()` globs `apps/**/*.css`.

3. **[structure / ui]** Preserve the four-ply layered stack as a hard law — 4 named slots s1..s4
   per elevation level, never collapsed to a single shadow, across all 5 sizes XS..XL.
   *Because:* Layered multi-ply box-shadows with exponentially growing offset/blur read as real
   depth; a single drop reads as a sticker.
   *Evidence:* `packages/shadow/src/domain/layer.ts:12` `export const SHADOW_SLOTS = ['s1','s2','s3','s4']`;
   `shadow.spec.ts` 'every card resolves to a real four-ply box-shadow' PASS chromium+webkit;
   Tobias Ahlin layered-smooth-box-shadows + Josh Comeau joshwcomeau.com/css/designing-shadows.

4. **[graphics / ui]** Keep ONE global light source for the whole stack via a single
   `--lab-light-angle` token (branch sets 0deg = vertical); do not introduce a second per-level
   angle.
   *Because:* A shared light direction is what makes a set of shadows look like one physical
   scene; per-element angles break the illusion.
   *Evidence:* `packages/shadow/src/config.ts:13` `export const DEFAULT_LIGHT_ANGLE_DEG = 0`;
   `shadow.spec.ts` 'default light is vertical: every ply has zero horizontal offset' PASS;
   Josh Comeau: 'decide on a single light source for all elements on the page'.

5. **[color / ui]** Shadow colour is the surface tint / dark anchor `#101012`, never pure black;
   tint is opt-in via `--lab-surface-shadow-tint` and `color-mix` over transparent.
   *Because:* Layering black over a coloured background desaturates and washes it to grey;
   matching hue and lowering lightness yields an authentic shadow.
   *Evidence:* `packages/shadow/src/config.ts:21-22` `SHADOW_COLOR_FALLBACK_* = '#101012'`
   (Figma N12, in no-hardcoded-colour ALLOWLIST); `shadow.spec.ts` 'shadow is the neutral anchor,
   never pure black; tint is opt-in' PASS; Josh Comeau washed-out-grey passage.

6. **[motion / ui]** Drive elevation transitions from a token (`--lab-shadow-transition`) so depth
   changes ease via a box-shadow transition rather than snapping.
   *Because:* Elevation is a depth signal; an eased transition communicates the surface
   rising/settling without a jarring jump (INP-friendly, token-driven).
   *Evidence:* `shadow.spec.ts` 'elevation changes ease — the motion token wires a box-shadow
   transition' PASS chromium+webkit; `--lab-shadow-transition` classifies as local-or-gap under
   `--lab-shadow-` prefix. *(Source text truncated in the planning ledger at this point.)*

---

## Asset provenance

| Primitive | Provenance | License |
|---|---|---|
| **`@labpics/ui-shadow` (`packages/shadow`)** — shadow stack package: `config.ts` (`--lab-light-angle`, `#101012` anchor), `domain/{layer,elevation,alias,alpha-contract,box-shadow}.ts`, `generate-css.ts`, `generated/shadow.css`. Single source of truth for every elevation/shadow token; no box-shadow authored by hand. | internal Labpics monorepo workspace package; landed via cherry-pick of `f80c2cb`,`a2d9072`,`2839f4d` onto `origin/main` (commits `625cbec..b99a4fa` on branch `shadow-rebuild-land`). | internal (Labpics monorepo, workspace package) |
| **`@labpics/colors` (`packages/colors-stub`)** — vendored colour contract: `contract.css` + `roles.json` (`--lab-*` role bindings) + consumed-contract / no-hardcoded-colour / no-literal-colour-fallback guards. Surface tint `--lab-surface-shadow-tint` and the theme anchor resolve from this contract; consumed exclusively, no resolver re-implemented. | internal Labpics monorepo, vendored stub of unpublished `@labpics/colors`; guards landed on main PRs #41-#47, all 77 tests PASS against the renamed `--lab-shadow-*` names. | internal (Labpics monorepo, vendored stub) |
| **`@labpics/ui-tokens` + `packages/core`** (`DIMENSION_PREFIXES` in `core/src/css.ts`; `--lab-space-*`, `--lab-radius-*`, `--lab-font-weight-semibold`) — dimension/typography tokens the shadow geometry and demo chrome compose against. | internal Labpics monorepo; `--lab-font-weight-semibold` introduced PR #43, consumed by the migrated `shadow-demo.css`. | internal (Labpics monorepo) |

---

## Rendered URL + final screenshot

- **URL:** `http://127.0.0.1:4321/shadow.html` (served from the `shadow-rebuild-land@b99a4fa`
  worktree dist via `vite preview`; stylesheet `shadow-BQ8MrmHT.css`, rev. 5).
- **Final light render:** `.design/shadow-rebuild-land-v1-final-light.png` — bold brand-ruled
  "Elevation sizes" heading leads the XS..XL ladder; drop-shadow depth ladder intact; derived
  Semantic-roles and Opt-in-tint groups subordinate; no Advanced/angle control.
- **Final dark render:** `.design/shadow-rebuild-land-v1-final-dark.png` — five surface-lightened
  rungs visibly ordered XS→XL; labels legible on the lightest rung; tint composed over surface.

---

## Scope caveat — muddiness check covers WARM dirt only

The deterministic shadow-dirt / muddiness gate (`design-rules`, `checkShadowColors`) flags only
**warm dirt** — shadows drifting toward black/grey that desaturate a *warm* surface. Non-warm
**dullness** (e.g. a cool/neutral surface reading flat or lifeless) is **not gated** by the
checker. Any judgement about non-warm dullness in this spec rests on visual inspection of the
renders, not on a deterministic check, and must not be read as guard-enforced. The dark-theme
zero-luminance-delta class (finding A0) was likewise outside the warm-dirt checker and was caught
as a narrow-critic finding, not a math-layer catch.

---

## NOT PASSED — open

**This work is NOT landed and NOT done.** Status is **ESCALATE**: after 6 review rounds the loop
plateaued at **3 open items** that did not close through another iteration and need a human
taste/scope call. Do not treat the rev. 5 closures above as completion of the job.

The 3 open items confirmed at round 6 (post-dating the rev. 5 ledger closures):

1. **[ui] False header hierarchy across the three peer sections.** Three peer section headers
   exist, but only the first ("Elevation sizes") receives parent-level emphasis (the brand
   accent + 700 weight); the two derived headings read as a different tier rather than as peers
   of one heading family. Whether the primary-leads emphasis is right, or whether all three
   should share one tier, is a **taste call**.

2. **[gov] `ia`-row git evidence is misquoted.** The decision-ledger `ia` row (REPLAY) cites a
   `git diff` command whose cited numbers do **not** reproduce from the cited diff range — the
   command quoted does not yield the quoted 40,335 / 17-files / 1107-ins figures. The citation
   must be re-pinned to the exact command+range that produces each number, or the numbers
   corrected. **Additionally noted during this grounding:** the current `main` tree (`edb01bb`)
   already contains `SHADOW_SLOTS=['s1'..'s4']` in `packages/shadow/src/domain/layer.ts`, so the
   ledger §E claim that `main` carries `SHADOW_LAYERS=['minor'..'major']` no longer holds against
   the live `main` — the citation's tree facts have moved and need re-verification before any
   "fabrication closed" claim is relied on.

3. **[ux] Contract-survival verification is back-loaded behind a draft chapter.** The single
   highest-risk gate of the whole job — proving the renamed `--lab-shadow-alpha-*` contract
   survives the consumed-contract + no-hardcoded-colour guards on **current main** after replay —
   sits entirely behind `chapters/verify-contract-green/` (status: `draft`/placeholder). The
   replay plan never pins verification to the worktree commit, and the demo page renders zero
   on-page provenance, re-creating the exact "fabricated/ambiguous citation" trap that ledger
   A3 just closed.

**Escalation ask (taste/scope):** decide (a) the section-header tier model (primary-leads vs.
all-peers), and (b) whether the contract-survival gate must be executed on current `main` before
this lands — given main already carries the slot rename, the replay/contract-survival premise may
need re-scoping rather than another review round.
