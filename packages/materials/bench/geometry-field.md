# Finite boundary distance and retained optical fields

Measured 2026-11-18 on Windows x64, Node 24.15.0. Reproduce with
`pnpm --filter @labpics/ui-materials exec tsx bench/geometry-field.bench.ts`.
The source cases and complete numbers are beside this file. The baseline is
commit `7e27bf4`, before this geometry change. Both versions ran on the same host.

| Shape, CSS pixels | Cold before → after, ms | Retained before → after, ms |
| --- | ---: | ---: |
| Circular 320×200 | 1.232 → 1.204 | 0.306 → 0.283 |
| Elliptical 200×150 | 3.748 → 4.647 | 0.613 → 0.599 |
| Asymmetric 320×200 | 10.293 → 10.693 | 1.087 → 0.961 |
| Smoothed asymmetric 320×200 | 55.252 → 23.769 | 1.087 → 0.933 |

Each cold sample evicts both field caches before timing. Geometry construction
for the retained smoothed contour is outside the timed field operation. The
complete distance/profile/byte-encoding path is inside it; PNG encoding, DOM,
canvas and browser GPU work are outside it. The retained batches vary depth.
These are local measurements, not timing assertions for CI.

The bitmap's rounded width and height are mapped back to the exact CSS box.
Both field paths sample `(x + .5) * width / bitmapWidth` and the corresponding
independent y step. A fractional DPR or CSS size therefore cannot move a sample
outside the outline merely by switching between the symmetric and general path.
The 101×81, DPR1.25 regression previously changed refraction by about18px after
an imperceptible corner edit; the remaining difference is within quantization.

The smoothed cold field is 2.32× faster; retained asymmetric updates improve by
12–14%. Correct evaluation beyond elliptical corner rectangles adds 0.90 ms to
the small elliptical cold case and 0.40 ms to the asymmetric case. The ordinary
circular path retains its quarter-field algorithm and existing golden bytes.

There are no object or array allocations per queried pixel. The contour keeps a
BVH over its existing bounded-error segments; its query uses one retained typed
stack. Both field caches remain bounded to four entries each. Asymmetric fields
add two `Int32Array(H)` coverage arrays (8H bytes per field), permitting depth
growth to calculate only newly needed pixels. Existing float distance/normal
storage is unchanged. `retainedFieldBytes` measures both field caches, including
the small eviction fixtures; it excludes render-map and shared encoding scratch.
Repeated depth changes preserve that number.

## Numerical contract

Each CSS box consists of four finite straight portions and four restricted
quarter-ellipse arcs. Straight projections clamp to the real endpoints; the
corner's bounding rectangle does not determine where that arc can be nearest.
For example, a 200×150 box with top-left radii 60×20 at (30,25) has distance
approximately 21.824909, rather than the previous 25.

For the ellipse solver, put the major radius first (`a >= b`) and use
`s = sin(theta)`. The derivative of squared distance, divided by `cos(theta)`, is
proportional to
`F(s) = (b²-a²)s + a*qx*s/sqrt(1-s²) - b*qy`.
When `qx <= 0`, an interior stationary point cannot be a minimum. Otherwise
`F'` changes sign at most once, and only its increasing branch can contain an
interior minimum. That branch supplies the safeguarded Newton bracket. The two
endpoints are already considered by the finite straight portions. This handles
points outside the corner rectangle without reflecting them onto a different
quarter of a full ellipse. At the boundary, the implicit gradient avoids loss
of direction from subtracting nearly equal coordinates.

The smoothed contour still follows the emitted Figma cubic/arc SVG path. Its
distance search visits finite segment candidates in nearest-bound order. The
existing subdivision error is 1/4096 CSS pixel; the exact SVG is unchanged.
Both field paths retain signed distances, so outside pixels remain neutral.

The independent oracle samples the actual CSS ellipse boundary and parses the
emitted SVG using the SVG endpoint-to-centre equations. It does not read the
production segment buffer or distance solver. Across 693 interior/exterior
positions, including asymmetric, overlap-scaled, degenerate-axis, narrow and
100000:1 corners, checked distance and projected-boundary errors are below
4e-6 px for analytic CSS arcs and `1/4096 + 3e-6` px for smoothed contours.
These are corpus bounds, not a claim that finite sampling proves a global bound.
Separate checks cover zero-area boxes, inward normals directly on an arc,
outside clipping, circular golden bytes, and exact cached shrink/grow bytes.

## Sources and applicability

- [Eberly, Distance from a Point to an Ellipse](https://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf), §§2.1 and 2.8: nearest-point normal and robust root finding. Its full-ellipse reflection cannot be applied directly to a restricted corner arc.
- [CSS Backgrounds, overlapping curves](https://www.w3.org/TR/css-backgrounds-3/#corner-overlap): one overlap scale for used corner radii.
- [SVG 2, elliptical arc implementation notes](https://www.w3.org/TR/SVG2/implnote.html#ArcImplementationNotes): independent oracle conversion from the actual emitted path.
- [Figma, Desperately seeking squircles](https://www.figma.com/blog/desperately-seeking-squircles/): the authored smoothed outline, retained by this change.
- [A Primer on Bézier Curves](https://pomax.github.io/bezierinfo/#splitting): subdivision and control hulls for bounded curve approximation.
