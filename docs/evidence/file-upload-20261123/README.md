# File Upload — 23 November 2026

The component implements the public Lab UI **Drag'n'drop** and **Drag'n'drop input**
families. Figma was inspected and exported read-only. Measurements and source
bindings live in `packages/tokens/src/components.json` and `catalog/registry.json`.

The compact field retains 40/48/56 px height, Geist body typography and the authored
file glyph. The area starts at 381.2 px. Default, hover, drag, selected and disabled
states retain the exact illustration frames, bitmap overflow and hover offset.
Transparent `contentsOnly` PNG exports work in both themes; the drag background
is an authored diagonal pattern. The remove action and multiple-file list extend
the source to support a complete selection workflow.

## Results

- `file-upload.spec.ts`: 30 passing scenarios across Chromium and WebKit. Both
  renderers open the real file chooser, preserve accepted `FormData` on rejection
  and cancel, support controlled refusal, native/external forms, disabled
  fieldsets, read-only values, required validation, reset cancellation, file drop,
  duplicates, limits and keyboard focus after removal. Scoped axe checks pass for
  both views in both themes.
  Real filesystem folder drop via Chromium CDP is rejected while a real empty
  file is accepted; these two tests skip WebKit, which has no CDP facility. The
  suite also covers multiple selection with a limit of one, same-metadata single
  replacement, and scaled layout/artwork/hover geometry at narrow 200% text size.
- `file-upload-ssr.test.ts` and `file-upload-ssr.test.mjs`: three passing SSR tests.
  Local File objects cannot be serialized through the Lit JSON hydration boundary.
- `packed.json`: seven local LabUI tarballs plus the recorded Icons 0.4 artifact
  were installed into a clean temporary consumer. Lit and React ESM/CJS SSR,
  TypeScript declarations, esbuild bundle and actual picker/form/rejection/removal
  paths passed in Chromium and WebKit. This verifies the artifacts; it does not
  attest Icons 0.4 registry publication.
- `render.generated.json` and the PNGs were produced by
  `apps/docs/tests/file-upload-render.mjs`, using real fonts at 1200 px surface
  width. Both renderers and themes cover five area states and three compact sizes.
- Core, React and docs TypeScript checks passed. Artwork generation is read-only
  under `--check`. [Compose evidence](../../../native/compose/evidence/file-upload-20261123/README.md)
  records native checks and the system-dialog/platform limits.

Two pre-existing integration limits remain visible: the branch's base lockfile
does not contain the Icons 0.4 dependency already required by core/React/docs, so a
repository-wide frozen install cannot succeed before that dependency is resolved.
Rendering React after the Lit DOM shim in the same Node process emits Zag's
`useLayoutEffect` SSR warning; the checked HTML remains correct and standalone
React SSR does not emit it.

## Reproduce

Build tokens, core and React before starting the docs Vite server; browser fixtures
consume the built packages. Run the scoped Playwright suite, then
`file-upload-render.mjs` against `PW_BASE_URL` (default `http://127.0.0.1:4392`).
`file-upload-packed.mjs` uses `LAB_ICONS_TARBALL` when qualification needs the
recorded Icons artifact. Its temporary consumer and browser processes are removed
in `finally`.

Primary sources: [Lab UI](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[Zag File Upload](https://zagjs.com/components/file-upload),
[FileKit](https://github.com/vinceglb/FileKit),
[FileKit platform support](https://filekit.mintlify.app/platform-support).
