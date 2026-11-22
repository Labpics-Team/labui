# Dialog motion — 20–22 November 2026

Source: [unchanged LabUI AlertDialog 6109:3720](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6109-3720), read with the official Figma MCP. Its 480 px surface, 36 px padding/gap, 24 px corners, typography and actions remain unchanged. The source does not prescribe a transition.

The dialog unfolds downward from its heading. A popover unfolds away from its resolved anchor side. Text keeps its final size and position; a separate live material paints the current aperture's bounds. One LabMotion scalar drives both, the scrim and the arrow. The endpoint has no additional content clipping.

`dialog-acrylic-normal-speed.webm` and `dialog-glass-normal-speed.webm` record the built Lit AlertDialog at the actual entrance/exit token speed. `contact-sheet.png` shows the retained top-origin motion. `web.json` records geometry, interruption, live reduced motion, four anchor sides, nested React clipping and a small frame/resource observation. The local run observes about 4.3 ms rAF p95, one Acrylic filter or two Glass filters, and unchanged text extents. These observations describe this run, not a frame-rate guarantee for other devices.

`apps/docs/tests/dialog-motion.mjs` compares p=0/.25/.5/.75/1 against a static material at the same current bounds, outside the dialog plane. It reuses the already qualified material recipe/filter, so the comparison isolates Dialog's composition, not the material renderer itself. The changed backdrop deliberately stays below light Elevated's color-dodge saturation. The current aperture's blur/refraction can differ from a fully open panel: its physical bounds are different.

Local Chromium: intermediate/live-scene comparison within 2 RGB; the captured run's live-scene maximum error is 0. WebKit screenshot readback is recorded only for geometry and lifecycle; its optics remain marked `requires-display-compositor`. `MATERIAL_CAPTURE=display` reuses `displayPixels` to qualify real Linux/macOS compositors in isolated CI. Display execution is blocked outside CI.

`dialog-motion-live.mjs` also records the ordinary cold Glass entrance and exit through CDP, without screenshot calls during motion. A small marker encodes the actual pose into each frame. Each captured frame is compared with the settled rendering of that same geometry; both captures use CSS-pixel output at DPR 1 or 2. `glass-live-1.json` and `glass-live-2.json` contain every comparison (tolerance 2 RGB). The low-frequency checkerboard keeps refraction visible; fine stripes disappear under frost and can hide a missing lens.

This test caught the original async publication failure: the shape moved while PNG encoding and Image load callbacks kept superseding each other. Merely removing the image callback still left a stale first frame because ResizeObserver deferred optical updates to another rAF. The shared renderer now compresses the unchanged long-axis middle into one strip while retaining both ends and the actual short-axis thickness. The source preserves the full field's pixel phase, including fractional DPR. Unit tests compare all reconstructed bytes; independent review additionally checked 288 sizes, DPRs, elliptical corners and smoothing values. Bounded CPU maps publish before paint, and ResizeObserver updates filter data without writing layout. Larger incompressible fields retain async encoding.

`DialogMotionRenderTest` compares the production Compose DialogSurface with a static LabSurface at the same bounds, including zero, both themes, all three materials and a changed retained scene (60 combinations). Its pointer test covers four directions at p=0/.5/1: clipped actions cannot receive clicks, visible actions can. The content uses a layer shape for drawing and hit-testing; the material remains its sibling. Local Windows execution uses Java headless + Skia SOFTWARE, without windows or audio. `DialogFamilyRenderTest` also passes for confirmation, focus, anchoring, themes, materials and enlarged text. Native images are generated under `native/compose/build/dialog-motion-evidence`.

Why the layers are separate:

- [Filter Effects 2: Backdrop Root](https://drafts.fxtf.org/filter-effects-2/#BackdropRoot): group opacity, mask and clip-path alter the material's input scene.
- [Josh Comeau: backdrop-filter](https://www.joshwcomeau.com/css/backdrop-filter/): blur samples the element's bounds; ancestor overflow trims the input before filtering.
- [Emil Kowalski: animation tips](https://emilkowal.ski/ui/7-practical-animation-tips): preserve the opening control's spatial origin and avoid shrinking text from zero.
- [Canvas getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext#willreadfrequently): procedural CPU pixels use a software canvas, avoiding GPU readback solely to encode PNGs.
- [Compose drawing modifiers](https://developer.android.com/develop/ui/compose/graphics/draw/modifiers): a drawing-only clip does not define the interaction boundary.

The earlier center aperture exposed isolated lines from the middle of the description. The retained top edge makes the heading readable first. No opacity is applied to arbitrary content slots, which may themselves contain live materials.
