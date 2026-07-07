# LabUI

> High-level design system by Labpics — cross-stack, token-driven, consuming the
> `@labpics/colors` color core.

LabUI is a cross-stack design system: dimension tokens (em/rem), fluid typography,
switchable materials (blur / glass / solid), an icon system, and a docs site.
Components consume **semantic tokens only** and the color core is consumed as a
package — never duplicated. Motion lives in the standalone `@labpics/motion`
package (consumed like the color core when a component needs JS-driven motion),
not bundled here.

## Packages

| Path                  | Package              | Purpose                                              |
| --------------------- | -------------------- | ---------------------------------------------------- |
| `packages/tokens`     | `@labpics/ui-tokens` | Token generator + generated dimension/type tokens    |
| `packages/core`       | `@labpics/ui-core`   | Cross-stack component core (Lit Web Components, ADR-0001) |
| `packages/shadow`     | `@labpics/ui-shadow` | Shadow/elevation stack generator (`--lab-elevation-*`) |
| `packages/colors-stub`| `@labpics/colors`    | TEMPORARY workspace stub of the unpublished color core (see below) |
| `packages/icons`      | `@labpics/icons`     | TEMPORARY stub bridge for the external icon core (see below) |
| `packages/react`      | `@labpics/ui-react`  | React / Next adapter (native renderer, ADR-0001)     |
| `packages/vue`        | `@labpics/ui-vue`    | Vue adapter over the Lit web components + SSR        |
| `packages/solid`      | `@labpics/ui-solid`  | Solid adapter over the Lit web components + SSR      |
| `packages/svelte`     | `@labpics/ui-svelte` | Svelte 5 adapter over the Lit web components + SSR   |
| `packages/astro`      | `@labpics/ui-astro`  | Astro integration over the Lit web components + SSR  |
| `packages/adapter-codegen` | `@labpics/adapter-codegen` | Private dev tool: generates the adapter wrappers from the core manifest |
| `apps/docs`           | `@labpics/ui-docs`   | Documentation site + Playwright smoke fixtures       |

The Vue/Svelte/Solid/Astro wrappers are **generated** from a single manifest derived
from the core sources (`@labpics/adapter-codegen`), so their API cannot drift from the
Lit/React versions. See [docs/adapters.md](docs/adapters.md).

## Color core: `@labpics/colors`

LabUI **consumes** the color core; it does not re-implement the resolver,
`semantic.rs`, or any WASM color engine. The integration contract is CSS custom
properties prefixed `--lab-*`.

The package is **not published to npm yet**. Until then the contract is served
by the workspace stub `packages/colors-stub` (visible in the workspace as
`@labpics/colors`) — see `INTEGRATION.md` for the exact seam and the swap-out
plan, and `docs/external-deps/lab-colors.md` for the canonical gap record.

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
| Versioning     | **Changesets**          | Per-package semver, changelog; release happens later                |
| E2E / visual   | **Playwright**          | Smoke + component e2e (`pnpm test:e2e`)                             |

## Develop

```bash
pnpm install          # install workspace
pnpm -r build         # build every package
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

To be finalized before the first publish. No publishing happens before then.
