# Liquid Glass (web)

Real Apple-style **Liquid Glass** for the web — the backdrop actually **refracts**
(bends like a lens) at the rim, with chromatic dispersion and a soft top-lit
rim sheen. Lightweight, pure CSS + a tiny zero-dependency runtime, fully
configurable, and driven by the **same parameter model as Figma's native Glass
effect**.

## Run the playground

```bash
node serve.mjs        # → http://127.0.0.1:4477
```

Open the URL in **Chrome or Edge**. Drag the pane over the picture and watch the
background bend behind it. Toggle Light/Dark, try the presets, and move the
sliders — they are 1:1 with Figma/iOS Glass settings.

## Why Chromium for the refraction

The lens is an SVG `feDisplacementMap` wired into `backdrop-filter: url(#…)`.
**Only Chromium renders an SVG filter on a backdrop today** — Firefox and Safari
parse it but don't apply it (Mozilla bug 1961378, WebKit bug 245510). The
runtime feature-detects the real engine: on Chromium you get the full lens; on
everything else it degrades **honestly** to a clean frosted blur (never a broken
surface). `prefers-reduced-transparency` collapses it to an opaque card.

## Use the material

```html
<link rel="stylesheet" href="liquid-glass.css" />
<div class="lab-liquid-glass" id="card">…</div>
<script type="module">
  import { attach } from './liquid-glass.js';
  attach(document.getElementById('card')); // adds the lens + keeps it size-synced
</script>
```

Configure entirely through CSS custom properties (set inline, per-theme, or
per-instance). Each maps to a Figma Glass knob:

| CSS variable        | Figma           | Range        | What it does                         |
| ------------------- | --------------- | ------------ | ------------------------------------ |
| `--lg-radius`       | radius          | `0–40px`     | backdrop blur (frostiness)           |
| `--lg-refraction`   | refraction      | `0–1`        | edge bend strength (lens)            |
| `--lg-depth`        | depth           | `2–34px`     | width of the refractive rim band     |
| `--lg-dispersion`   | dispersion      | `0–1`        | chromatic fringe at the rim          |
| `--lg-corner`       | corner radius   | `0–90px`     | pane radius                          |
| `--lg-tint` / `--lg-tint-opacity` | fill | rgb / `0–1` | body tint                          |
| `--lg-saturate`     | —               | `1–2.6`      | backdrop colour boost                |

`refraction`, `depth`, and `dispersion` are read by the runtime to (re)build the
displacement filter; the rest are pure CSS and update with no JS.

## Performance

The expensive part — the displacement map — is regenerated **only on resize**
(built once per geometry, shared across same-sized instances, resize storms
collapse to one trailing-edge build), and its heaviest chunk — the PNG encode —
runs **off the main thread** (`canvas.toBlob`); only the ¼-symmetric field
loop stays synchronous. Tuning refraction/dispersion updates only
the `feDisplacementMap` scale attributes in place — no markup re-parse, no
feImage re-attach; blur / saturate / tint are pure CSS. Dragging the pane moves
it on `left`/`top` (a transform would shear the lens off its filter region —
the drag-seam) with **zero engine JS per frame**: bounds are measured once per
gesture and the position write is coalesced to one per frame, so the whole
per-frame cost is the GPU compositing of the quality-locked filter itself.

### Cost model for glass-heavy UIs

Measured (weak-device emulation, animated backdrop): **`--lg-dispersion` is the
expensive knob** — it roughly doubles a surface's per-frame GPU cost (the
chromatic fringe is three displacement passes instead of one). Blur, tint,
saturation and the rim sheen are cheap. In a UI with many live glass surfaces,
spend dispersion on the hero surfaces and set `--lg-dispersion: 0` on small or
numerous ones. The knobs cannot be silently cheapened: half-resolution
displacement maps and 2-pass dispersion were both measured far above the
visual-noise floor (maxΔ up to 224/250 on high-frequency backdrops) — the
quality is load-bearing, so the engine never trades it for speed.

## Files

- `liquid-glass.css` — the material class (tint, specular, volume, fallbacks).
- `liquid-glass.js` — the refraction runtime (`attach`, `supportsRefraction`).
- `index.html` + `playground.{css,js}` — the configurator demo.
- `assets/backdrop.svg` — the demo backdrop (straight lines + circles make the
  bend and dispersion obvious).
