# `@labpics/icons` (local stub bridge)

**Temporary.** This package exists only so the `@labpics/icons` import
specifier resolves inside the LabUI workspace before the real package is
published. It mirrors `packages/colors-stub`'s bridge pattern: a thin,
build-free stand-in, never a copy of the real engine.

## What this is NOT

- **Not** an icon set. There is no SVG source here.
- **Not** a build pipeline. `index.js`/`index.d.ts` are hand-authored plain
  files; the `build` script is a no-op (`node -e ...`), exactly like
  `colors-stub`. There is no `tsup`, `svgo`, `rollup`, or `src/` tree — see
  `test/no-internal-engine.test.ts`, which fails CI if any of those come back.
- **Not** consumed by any component today. Grep the repo: nothing imports
  `@labpics/icons` yet. Components that need an icon render their own inline
  SVG until the real package lands (tracked per call site in
  `docs/external-deps/lab-icons.md`).

## The real package

- Repo: `Labpics-Team/lab-icons` (private) — 444 SVG (Filled + Outline),
  tree-shakeable ESM, `currentColor`, rem-scaled geometry.
- **External blocker**: as of this PR, `lab-icons`'s own `package.json` is
  `"private": true` with zero tags/releases — it is not installable from any
  registry (npm or GitHub Packages) yet. LabUI cannot depend on it as a real
  dependency until it publishes. This is a blocker on `lab-icons`, not on
  LabUI — LabUI must not vendor its build pipeline or its SVG source here.

## Swap-out plan

1. When `@labpics/icons` is published, point the workspace dependency at the
   registry package instead of this stub.
2. Delete `packages/icons` (this directory).
3. No consumer edits expected: nothing currently imports from this stub.
