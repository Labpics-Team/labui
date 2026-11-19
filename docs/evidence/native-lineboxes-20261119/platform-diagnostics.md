# Ellipsis raster diagnostics across desktop platforms

CI for integrated `dd36c79` passes Android API 33/35 and Windows OPENGL.
Linux SOFTWARE reports three changed Badge prefix pixels in each of density 1 /
fontScale 2 and density 2 / fontScale 1; its alpha assertion stops at a one-channel
difference of 1. macOS METAL stops at an alpha difference of 2. These first-failure
messages do not establish a bound for the complete paint matrix.

`TextEllipsisInkRenderTest` now writes full evidence before its unchanged exact
pixel assertion. All three paint modes run even if an earlier mode differs.
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

No production renderer, font, layout, or pixel tolerance changes in this diagnostic
commit. A tolerance decision requires Linux/macOS images, their complete distributions,
and controls that still reject missing accents and double painting.
