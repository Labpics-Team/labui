# LabUI Core Contract

> The rules every LabUI component obeys, on both renderers. This is the
> foundation ~38 components × 5 stacks sit on (ADR-0001, A-prime). A component
> that breaks a rule here is wrong, no matter how good it looks.
>
> Status: scaffold contract (chapter `core-scaffold`). The base + Behaviors
> decision is fixed by [ADR-0001](./adr/0001-cross-stack-base.md); this document
> fixes the contract built on it. Reversible defaults are flagged **FOR OWNER
> REVIEW**.

## 0. The three laws this contract enforces

1. **Behaviors are the source of truth.** Interaction logic (ARIA, focus,
   keyboard, state) lives in a Zag machine, consumed identically by the Lit and
   React renderers. A renderer is a thin visual binding over the machine — never
   a second copy of the logic.
2. **Components speak only the semantic language.** A component reads
   `--lab-*` *roles* and *dimensions*. Never a primitive. Never a hex.
3. **Theme and material are ambient.** A component never knows which theme or
   material is active. One attribute on an ancestor re-skins every component with
   zero component edits.

---

## 1. State declaration pattern

A component's interaction state comes from its **Zag machine**, not from ad-hoc
element fields. The machine is the single source of truth; the host attributes
and shadow-DOM parts are a *reflection* of it.

### The seam: `MachineModule`

Both renderers depend on one abstraction (`@labpics/ui-core` →
`MachineModule<Schema, Api>`): a machine plus its `connect`. Every
`@zag-js/<component>` package already matches this shape.

```ts
// behaviors/types.ts — the one type both renderers depend on (DIP)
interface MachineModule<T extends MachineSchema, Api> {
  readonly machine: Machine<T>;
  connect<P extends PropTypes>(service: Service<T>, normalize: NormalizeProps<P>): Api;
}
```

### Lit: machine → host via a reactive controller

The Lit base (`LabElement`) runs the machine through `ZagController`, which wraps
Zag's framework-agnostic `VanillaMachine`:

- **machine → Lit**: the controller `subscribe`s and calls `host.requestUpdate()`
  on every transition, so `render()` re-runs `connect(...)` with fresh state.
- **Lit → DOM**: `controller.spread(node, api.getRootProps())` applies the
  connect output (attributes, ARIA, event listeners) onto a real shadow-DOM node
  the vanilla way (`spreadProps`).
- **host → machine**: `getProps()` reads the host's reflected attributes and
  feeds them into the machine each update, so the two never disagree.
- **Shadow DOM**: the controller passes `getRootNode: () => host.renderRoot`, so
  Zag's id-based DOM queries resolve **inside the shadow root**.

```ts
class LabFoo extends LabElement {
  static properties = {
    // Machine OUTPUT mirrored onto the host, REFLECTED so :host([…]) styling and
    // SSR see it. Reflected, never `state: true` (Lit doesn't reflect state).
    pressed: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  private readonly foo = this.runMachine(fooModule, () => ({
    disabled: this.disabled,
    onChange: (v) => { this.pressed = v; },   // machine → host
  }));

  updated() {
    this.foo.clearSpreads();                  // drop last render's listeners
    const api = this.foo.api;
    const root = this.renderRoot.querySelector('button');
    if (root) this.foo.spread(root, api.getRootProps());
  }
}
```

### React: machine → component via `useZag`

The React base is a single hook, `useZag(module, props)` (`@labpics/ui-react`),
mirroring `runMachine`. It runs the **same module** through `@zag-js/react`:

```tsx
'use client';
function LabFooReact(props) {
  const api = useZag(fooModule, { id: useId(), disabled: props.disabled });
  return <button {...api.getRootProps()}>{props.children}</button>;
}
```

### Rule

- State that the machine owns (pressed, open, value, focused…) is **read from the
  machine**, never duplicated as independent element state.
- The host's **reflected attributes** are the contract the styles read
  (`:host([pressed])`). They mirror the machine; they are not a second source of
  truth.
- A renderer never re-implements ARIA/keyboard/focus that the machine provides.

### Legitimate opt-out: a component MAY have no machine

A Zag machine is **mandatory only when there is machine state to own**. A
component **legitimately opts out** of the seam when the platform already owns all
of its behaviour — i.e. when it has **none** of:

- `open` (disclosure / popover / dialog lifecycle),
- `value` / `checked` / `selected` (a value the component holds),
- `pressed` / `expanded` (a toggled interaction state),
- **roving focus** (a focus index across a set of children),
- **typeahead** (incremental match over a list).

If none of these apply, the component carries **no interaction state**, so there
is nothing for a machine to be the source of truth *of*. Wiring one would add a
dependency and a render cycle to reflect state the platform already owns —
machinery for a checkbox the platform ships. Such a component extends
`LabElement` (for `delegatesFocus` + the shared base conventions) but **does not
call `runMachine`**, and its React twin uses **no `useZag`**. This is a
documented exception, not a violation; reviewers must not flag a machine-less
presentational component as non-conformant, and future agents must not bolt a
machine onto one to "complete" it.

**Examples (all of this batch):**

| Component | Owns machine state? | Verdict |
|---|---|---|
| `lab-button` | No — native `<button>` carries role + Enter/Space + focus | Opts out |
| `lab-badge` | No — a static label/count | Opts out |
| `lab-kbd` | No — a styled, semantic `<kbd>` | Opts out |
| `lab-loader` | No — a CSS animation + `role="status"`/`aria-busy` | Opts out |
| `lab-avatar` | No — image→initials fallback is local view state, not shared interaction state | Opts out |

A component that **does** have any of the listed states (Switch, Tabs, Dropdown,
Slider, …) is **not** eligible for the opt-out and must drive the seam.

The other six rules (semantic-only token consumption, 1:1 Figma axes, the a11y
contract, theme/material agnosticism, materials consumed-not-reinvented, and the
SSR contract) **apply to every component, machine-less ones included** — opting
out of the machine opts out of *that section only*, nothing else.

---

## 2. Consuming `--lab-*` — the three languages

```
primitives  →  semantic roles  →  components
(--lab-neutral-*,   (--lab-label-*, --lab-fill-*,    (read roles + dimensions
 --lab-accent-*)     --lab-border-*, --lab-bg-*,       ONLY)
                     --lab-fx-*, --lab-mat-*)
```

A component reads **only**:

| Layer | Families it may read |
|---|---|
| Semantic roles | `--lab-label-*` · `--lab-fill-*` · `--lab-border-*` · `--lab-bg-*` · `--lab-fx-*` |
| Material roles | `--lab-mat-*` (from `materials.css`) |
| Dimensions | `--lab-space-*` · `--lab-radius-*` · `--lab-z-*` · `--lab-font-*` · `--lab-line-height-*` |

A component **never**:

- reads a **primitive** (`--lab-neutral-*`, `--lab-accent-*`) — those belong to
  the colour engine;
- hardcodes a **hex / rgb / hsl** for any role colour;
- gives a **colour role a literal fallback** (`var(--lab-fill-accent, #999)`). A
  missing role is a contract bug, surfaced loudly — not papered over.

### The only way to reference a token

`@labpics/ui-core` exports two helpers so the `--lab-*` contract is the single
surface a component touches:

```ts
cssVar('--lab-fill-accent')                 // → "var(--lab-fill-accent)"   (React / inline styles)
litVar('--lab-fill-accent')                 // → CSSResult for css`…`        (Lit styles)
cssVar('--lab-space-md', '--lab-space-4')   // dimension fallback → "var(--lab-space-md, var(--lab-space-4))"
```

Dimension tokens **may** take a fallback (another token, or a literal length like
`1rem`) so a component stays usable before tokens load. Colour roles may not.

> The exact role names are owned by **@labpics/colors** (it extends
> `colors-stub/contract.css` to the full Labels/Fills/Border/Backgrounds/FX set,
> Light/Dark/IC). This scaffold depends on the **names**, never the values.

---

## 3. Public API shape (single across Lit & React)

The Figma axes map 1:1 onto props/attributes, identically on both renderers.

| Figma axis | Prop / attribute | Values |
|---|---|---|
| Type | `type` | `neutral` · `accent` · `danger` (sentiment roles for inputs: `danger`/`warning`/`success`) |
| Kind | `kind` | `fill` · `tinted` · `border` · `ghost` |
| Size | `size` | `s` · `m` · `l` |
| State | (machine-driven) | `default` · `hover` · `pressed` · `focus` · `loading` · `disabled` |

### Conventions

- **Lit**: variant axes are **reflected string/boolean attributes**
  (`type="accent"`, `?disabled`). Styling keys off `:host([type='accent'][kind='fill'])`.
- **React**: the same axes are **props of the same name and value set**, typed as
  string-literal unions. A shared types module keeps the unions identical.
- **State axes** (`hover`/`pressed`/`focus`/`loading`/`disabled`) are driven by
  the machine + CSS pseudo-classes, not set by the consumer (except `disabled`
  and `loading`, which are inputs).
- **Events**: Lit dispatches `CustomEvent`s named `lab-<verb>` (e.g.
  `lab-change`); React exposes the matching `on<Verb>` callback prop. Both
  originate from the **same machine callback**, so they fire on the same
  transitions.
- **Slots**: Lit uses named slots (`<slot name="icon">`, default slot for label);
  React uses the matching props (`icon`, `children`). Names correspond 1:1.

---

## 4. Accessibility contract

ARIA roles/states, focus management, and keyboard interaction are **delegated to
the Zag machine** — that is the whole reason Behaviors is the source of truth.

A component must:

- spread `api.get*Props()` onto the **correct structural nodes** (the machine
  decides `role`, `aria-*`, `tabindex`, key handlers — the component only places
  them);
- set `delegatesFocus: true` on its shadow root (the `LabElement` base does this)
  so focusing the host moves focus to the inner interactive node;
- keep a real, focusable, native interactive element (`<button>`, `<input>`) at
  the interaction point — never a `div` with a click handler;
- expose a focus-visible ring via the **`--lab-border-focus`** role, never a
  removed outline;
- meet WCAG 2.1 AA. **WCAG floors are never traded for aesthetics** (EPIC.md). An
  element is separated by a **surface/Fills token**, not a border drawn on top.

A component must **not** re-implement ARIA/keyboard the machine already provides,
nor hand-roll focus trapping the machine owns.

---

## 5. Theming — Light / Dark without touching the component

### Selector convention (the contract for @labpics/colors)

`@labpics/ui-core` fixes the attribute + cascade convention; `@labpics/colors`
binds its role variables under exactly these selectors. `materials.css` already
binds material roles the same way, so the layers compose.

| Attribute | Values | Default when absent |
|---|---|---|
| `data-theme` | `light` · `dark` | `prefers-color-scheme`, else `dark` |
| `data-material` | `ambient` · `solid` · `glassy`¹ | `ambient` |

¹ `glassy` is a **documented web alias of `ambient`** (owner verdict: true glass
is native-only). Honest degradation, not a fake.

### Resolution order (lives in CSS, works without JS)

1. nearest ancestor with `[data-theme="…"]` wins;
2. else `@media (prefers-color-scheme)`;
3. else the dark default.

`theme.css` ships the structural insertion points (it defines **no colour
values** — that would duplicate `semantic.rs`, forbidden). The colour engine
fills the role bindings in those blocks.

### Rule

- A component **never reads `data-theme`/`data-material`** and never branches on
  the active theme/material. It reads roles; a theme is a different binding of
  those roles on an ancestor.
- Switching theme/material is **one attribute flip** on the host or document
  root, with **zero component edits**. (Proven by `<lab-proof>`: flipping
  `data-theme` re-skins it; the smoke asserts it.)
- JS enhancement only: `setTheme(root, 'light')` / `setMaterial(root, 'solid')`
  are conveniences; the CSS contract works with JS disabled.

---

## 6. Materials — consume, never re-implement

The material system (`@labpics/ui-core/materials.css`, the fx-engine, the shadow
stack) is owned elsewhere. A component **consumes** material tokens:

- reads `--lab-mat-*` roles (blur, fill-alpha, rim, specular, …) and
  `--lab-fx-*` (glow, focus-ring, skeleton, shadow);
- applies the material surface by composing existing classes (`.lab-ambient`)
  where a surface needs the material, never by re-deriving blur/blend/grain.

A component **must not** touch `packages/shadow`, the fx-engine, or re-define
`materials.css`. Those are off-limits zones (open PRs #9, #11). Consume the
output; do not reinvent it.

---

## 7. SSR contract

| Path | Engine | First paint |
|---|---|---|
| **Lit** (Astro, Vue, Svelte, Solid) | `@lit-labs/ssr` → declarative shadow DOM | styled, no FOUC |
| **React / Next** | native React SSR | native, no Lit in the path |

### Lit path

WC deep-SSR is a property of **`@lit-labs/ssr`**, not of the host framework
(spike-FINDINGS.md, PASS 3/3 + Astro). Every SSR framework that emits a raw HTML
string carries the DSD through intact. The SSR shim lives at
**`@labpics/ui-core/ssr`**:

```ts
import { renderToString, html } from '@labpics/ui-core/ssr';
import '@labpics/ui-core/proof';   // register elements AFTER the shim's DOM install
const dsd = renderToString(html`<lab-foo type="accent">…</lab-foo>`);
// embed via the framework's raw-HTML slot: Vue v-html, Svelte {@html}, Solid innerHTML
```

- The shim is behind its **own entry** and lists `@lit-labs/ssr` as an
  **optional peer**, so consumers that never server-render the Lit path (the
  React renderer) never pull the SSR engine into their bundle.
- **Import order is load-bearing**: the shim installs the DOM globals; element
  modules must be imported after it.
- Astro uses its built-in `@astrojs/lit` (pinned `@lit-labs/ssr` 3.2.2 per
  proto-A); other Lit stacks wire this shim (~10 lines).

### React path

Native React SSR. No Lit, no DSD, no shim. Next 15's shallow WC-SSR never touches
React — the entire reason A-prime keeps a native React renderer.

---

## 8. Package layout & dependency direction

```
@labpics/ui-core   (renderer-agnostic + Lit)
  behaviors/types.ts   MachineModule  ← the seam BOTH renderers depend on (DIP)
  theme.ts · css.ts    theming + token-consumption contract (shared)
  lit/                 LabElement, ZagController   (Lit renderer)
  ssr/                 @lit-labs/ssr shim          (entry: /ssr)
  proof/               <lab-proof>                  (entry: /proof)
  *.css                materials · glass · theme    (consumed, side-effect)

@labpics/ui-react  (native React renderer)
  use-zag.ts           React side of the seam (over @zag-js/react)
  proof.tsx            <LabProofReact>
  (re-exports seam types from core)
```

### Why this split (ADR-0001 + craft-arch)

- **Shared, renderer-agnostic** (the seam types, theming convention,
  token-consumption helpers, the machine choice) lives in **core**. Both
  renderers depend inward on it.
- **Lit renderer** (base element + controller) lives in **core** because the four
  WC stacks consume Lit directly.
- **React renderer** is **native** (ADR-0001): it lives in **`packages/react`** so
  the React path never imports Lit. It depends on core only for the **types**, not
  for any Lit runtime.
- The dependency arrow points **renderers → behaviors seam**, never the reverse.
  Swapping Zag for a hand-rolled layer later changes the modules behind
  `MachineModule`, not the components.

---

## 9. The proof

`<lab-proof>` / `<LabProofReact>` are **PROOF elements, not the production
Button**. They exist only to prove this contract is real and compiles on both
renderers. They drive the whole seam — Lit base + Zag `@zag-js/toggle` machine +
token consumption + theme/material agnosticism + SSR — and are covered by a
Playwright smoke (SSR DSD, render, click→state, token-follow, theme-flip) green on
Chromium **and** WebKit. The production Button (432 variants) is a later chapter;
it reuses this **seam**, not this element.

---

## Verification checklist (per component)

- [ ] Interaction state comes from a Zag machine via the seam; no duplicated
      element state.
- [ ] Reads only semantic roles + dimensions through `cssVar`/`litVar`. No
      primitive, no hex, no colour-role fallback.
- [ ] Figma axes map 1:1 to props/attributes, identical on Lit & React.
- [ ] ARIA/focus/keyboard delegated to the machine; native interactive node;
      `--lab-border-focus` ring; WCAG AA, no traded floors.
- [ ] No `data-theme`/`data-material` reads; theme/material flip re-skins with
      zero edits.
- [ ] Material/fx/shadow consumed, never re-implemented; off-limits packages
      untouched.
- [ ] Lit path SSRs to DSD via `@labpics/ui-core/ssr`; React path SSRs natively.
- [ ] `pnpm -r typecheck` + `pnpm -r build` clean; smoke green on Chromium +
      WebKit.
