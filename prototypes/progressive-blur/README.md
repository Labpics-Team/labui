# Progressive Blur (web)

Variable-strength **backdrop blur along an axis** — the real thing, not the
"one blur + opacity mask" fake (that cross-fades blurred pixels against SHARP
ones across the whole surface, so sharp content ghosts through mid-fade).
Configured like a **Figma gradient**: an axis from point A to point B, any
number of stops (`position → blur`), an optional **easing curve per segment**
(CSS keywords or `cubic-bezier(…)`). Zero dependencies, zero per-frame JS,
fully tokenisable through CSS custom properties.

## Run the playground

```bash
node serve.mjs        # → http://127.0.0.1:4478
```

## How it works — the cumulative (onion) stack

The web has no variable-radius backdrop blur, so the profile B(t) is
discretised onto a geometric ladder of levels; for each level one child strip
covers the **superlevel region** `{ t : B(t) ≥ L_k }` with the **incremental**
radius `√(L_k² − L_{k−1}²)`. A strip's backdrop includes the strips painted
before it, and Gaussian blurs compose as `√Σr²` — so the interior of every
band renders **exactly** its ladder level, and each feathered edge cross-fades
only the small increment against the composition beneath it: the gentlest
possible seam. Non-monotone profiles (`0 0px, 50% 20px, 1 0px`) fall out for
free — a level simply owns several disjoint strips.

The naive alternative — disjoint strips with absolute radii — is broken by
construction: overlapping siblings re-blur each other's output (a weaker strip
can never show a sharper picture than the stronger strip painted beneath it),
so every seam becomes order-dependent. The cumulative model turns that
browser behaviour into the mechanism instead of fighting it.

## Use the effect

```html
<link rel="stylesheet" href="progressive-blur.css" />
<div class="lab-progressive-blur" id="veil" style="position:absolute; inset:0 0 auto 0; height:45%"></div>
<script type="module">
  import { attach } from './progressive-blur.js';
  attach(document.getElementById('veil')); // reads --pb-* and keeps itself size-synced
</script>
```

| Custom property | Default        | What it does                                        |
| --------------- | -------------- | --------------------------------------------------- |
| `--pb-from`     | `50% 0%`       | axis start (`x y`, % of the box or px)               |
| `--pb-to`       | `50% 100%`     | axis end                                             |
| `--pb-stops`    | `0 16px, 1 0px`| Figma-like stops: `<at> <blur>px [easing]`, any count |
| `--pb-levels`   | `6`            | max strip count (quality/cost knob)                  |
| `--pb-feather`  | `auto`         | cross-fade width along the axis (px)                 |

Easing attaches to the stop a segment ENDS at:
`0 24px, 55% 4px ease-in-out, 1 0px cubic-bezier(.2,0,.8,1)`.

The host must not form a backdrop root (no `filter`, `opacity < 1`, `mask` or
blend on it) — the strips would blur the element instead of the page behind.

## Performance

Zero per-frame JS: geometry rebuilds only on resize/config change (trailing-
edge rAF) and is a handful of style writes. Strips are tight superlevel
bboxes carrying only incremental radii; blur cost scales ~linearly with
radius and the increments telescope, so the whole stack costs about as much
as ONE full-surface blur at the strongest stop — not N×.

## Honest degradation

`prefers-reduced-transparency` → no strips at all (runtime + CSS backstop).
No `backdrop-filter` support → no strips, content stays untouched.

## Testing (pb-harness.mjs)

A new effect has no golden pixels, so the gate is **physical**: a two-scale
test pattern renders behind the surface and the local-contrast profile along
the axis is measured off screenshots — attenuation at the strong end,
monotonicity, no banding cliffs, easing measurably bending the profile,
multi-stop valleys, axis orientation, plus DOM invariants (cumulative √Σr²
equals the strongest stop exactly; feather fades present; ladder dense;
strips tight), determinism and reduced-transparency honesty. A Class-D
mutation harness weakens eight dimensions (feather, level count, easing,
blur strength, strip tightness, axis, superlevel coverage, reduced
transparency) and proves each one's named isolating check flips to fail.
Honest accounting: 8 of the 14 physical checks own a mutant killer; the
other six (strong-end attenuation, banding cliff, multi-stop valley,
determinism, array-stops rebuild, clamp extent) are exercised by the suite
but have no dedicated mutant. The pure-math sliver-merge guard has its own
unit-level killer in `apps/docs/tests/progressive-blur/pb-math.unit.test.mjs`.
