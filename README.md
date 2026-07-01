# LabUI

> High-level design system by Labpics — cross-stack, token-driven, consuming the
> `@labpics/colors` color core.

LabUI is a cross-stack design system: dimension tokens (em/rem), fluid typography,
switchable materials (blur / glass / solid), an icon system, and a docs site.
Components consume **semantic tokens only** and the color core is consumed as a
package — never duplicated. Motion lives in the standalone `@labpics/motion`
package (consumed like the color core when a component needs JS-driven motion),
not bundled here.

This repository is the monorepo skeleton. Packages are intentionally empty
placeholders that build cleanly; real implementation lands chapter by chapter.

## Packages

| Path                | Package              | Purpose                                              |
| ------------------- | -------------------- | ---------------------------------------------------- |
| `packages/tokens`   | `@labpics/ui-tokens` | Token generator + generated dimension/type tokens    |
| `packages/core`     | `@labpics/ui-core`   | Cross-stack component core (base TBD in cross-stack)  |
| `packages/icons`    | `@labpics/icons`     | TEMPORARY stub bridge for the external icon core (see below) |
| `packages/react`    | `@labpics/ui-react`  | React / Next adapter                                 |
| `packages/vue`      | `@labpics/ui-vue`    | Vue adapter                                          |
| `packages/solid`    | `@labpics/ui-solid`  | Solid adapter                                        |
| `packages/svelte`   | `@labpics/ui-svelte` | Svelte adapter                                       |
| `packages/astro`    | `@labpics/ui-astro`  | Astro adapter                                        |
| `apps/docs`         | `@labpics/ui-docs`   | Documentation site + Playwright smoke fixtures       |

> Scope `@labpics/ui` and repo name `labui` are the reversible default
> (see `EPIC.md` open question). Renaming is safe until first publish.

## Color core: `@labpics/colors`

LabUI **consumes** the color core; it does not re-implement the resolver,
`semantic.rs`, or any WASM color engine. The integration contract is CSS custom
properties prefixed `--lab-*`.

The package is **not published to npm yet** (produced by the `lab-colors-v1`
`native-and-release` chapter). Until then, the docs smoke fixture declares the
`--lab-*` contract by hand — see `apps/docs/` and `INTEGRATION.md` for the exact
seam and the TODO that swaps the stub for the real runtime engine.

## Icon core: `@labpics/icons`

LabUI **consumes** the icon core; it does not re-implement an SVG build/resolver
engine. The real package (`Labpics-Team/lab-icons`, 444 SVG Filled + Outline,
tree-shakeable ESM, `currentColor`) is **not published to a registry yet**
(`private: true`, no tags/releases) — an external blocker on that repo, not on
LabUI. `packages/icons` is a thin, build-free stub bridge (mirrors
`packages/colors-stub`) that only makes the import specifier resolve; see
`packages/icons/README.md` and `docs/external-deps/lab-icons.md`.

## Tooling

| Concern        | Choice                  | Why                                                                 |
| -------------- | ----------------------- | ------------------------------------------------------------------- |
| Package manager| **pnpm** workspaces     | Content-addressed store, `workspace:` protocol, strict hoisting     |
| Bundler        | **tsup** (esbuild)      | Zero-config dual ESM+CJS+`.d.ts` per package; right size for libs   |
| Lint + format  | **Biome**               | One fast binary (no ESLint/Prettier plugin churn), deterministic CI |
| Types          | **TypeScript** strict   | `tsconfig.base.json`, ES2022 target (browsers ~2023+)               |
| Versioning     | **Changesets**          | Per-package semver, changelog, release later in `release` chapter   |
| E2E / visual   | **Playwright**          | Smoke today, full component matrix in `qa-playwright`               |

## Develop

```bash
pnpm install          # install workspace
pnpm -r build         # build every package (placeholders build clean)
pnpm -r typecheck     # strict typecheck across the workspace
pnpm lint             # Biome lint
pnpm format           # Biome format (write)
pnpm test:e2e         # Playwright smoke (installs browsers on first run)
```

Requirements: Node `>=20`, pnpm `>=9` (see `package.json#engines`,
`packageManager`).

## Contributing

- **PR-only into `main`.** Direct pushes are rejected; CI (lint + typecheck +
  build + Playwright) must be green before merge. No `--no-verify`, no `--force`.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, …).
- Package changes need a Changeset: `pnpm changeset`.

## License

To be finalized in the `release` chapter. No publishing happens before then.
