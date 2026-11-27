# Ellipsis raster diagnostics across desktop platforms

CI for integrated `dd36c79` passes Android API 33/35 and Windows OPENGL.
Linux SOFTWARE reports three changed Badge prefix pixels in each of density 1 /
fontScale 2 and density 2 / fontScale 1; its alpha assertion stops at a one-channel
difference of 1. macOS METAL stops at an alpha difference of 2. These first-failure
messages do not establish a bound for the complete paint matrix.

`TextEllipsisInkRenderTest` writes full evidence before its aggregate assertion.
All three paint modes run even if an earlier mode differs.
The primary scenes retain their original size and draw order. Separate wide/wide
scenes calibrate the comparator at the same positions; they do not add draw calls
to the primary scene.

The Native Compose workflow preserves `native/compose/build/lineboxes` even when
a test fails. Under `ellipsis/`:

- `badge-*.png` and `paint-*.png` retain the complete real render.
- `pixels/<case>/wide.png` and `compared.png` retain the exact prefix crops.
- `difference-x16.png` magnifies absolute RGB differences; equal pixels are black.
- `summary.tsv` records all pixel counts, per-channel maxima, changed counts and means.
- `changed-pixels.tsv` records every changed pixel's coordinates, both ARGB values
  and signed per-channel differences.
- `channel-histogram.tsv` contains the complete distribution of absolute differences.
- `geometry.tsv` records the crop positions; `runtime.tsv` records OS/JVM/render setting.
- Cases containing `control` compare two wide, untruncated labels.

## Measured result and accepted coverage difference

[CI run 44597871780](https://github.com/Labpics-Team/labui/actions/runs/44597871780),
source `ca8fec1`, completed the matrix without changing the renderer. The durable
[summaries](platform-results/summary.tsv), [every changed pixel](platform-results/changed-pixels.tsv),
and [actual-size / enlarged comparison](platform-results/comparison.png) show:

- Linux Badge: three edge pixels, maximum RGB difference 10/255, at density 1 /
  scale 2 and density 2 / scale 1. The other four Badge combinations are identical.
- Linux alpha and brush: three edge pixels, maxima 5/255 and 6/255 respectively.
- macOS Badge: all six comparisons are identical. Alpha and brush differ in three
  and four edge pixels, maxima 8/255 and 9/255 respectively.
- Decoration/shadow and every wide/wide calibration are identical on both platforms.

The differences lie on the antialiased outer edge of Å. Inspection at actual size
and enlarged found no lost accent or visible seam. The comparator now permits at
most four changed pixels and at most 10/255 in an RGB channel; alpha remains exact.
This is a bound on this fixed prefix fixture, not a global image-error average.
Wide/wide calibration still requires zero differences. Production text, fonts,
layout, clipping and rendering remain unchanged.

The same bound rejects all 18 missing-restoration / double-paint comparisons in
the [negative controls](platform-controls/README.md). Missing restoration changes
11–84 Badge pixels with maxima 197–255; double painting changes 125–468 with
maximum 64. Alpha, brush and decoration controls also fail the bound. These
controls separate the accepted edge coverage difference from lost or repainted ink.
