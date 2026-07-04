# External dependency — `@labpics/icons` engine gap

> Call-site-anchored record of the single EXTERNAL blocker on the icon core.
> LabUI must NOT vendor an SVG build/resolver engine, copy `lab-icons` sources,
> or maintain a local icon set. This gap is owned by the `lab-icons` repo, not
> by LabUI.

## The blocker

`Labpics-Team/lab-icons` (private repo) ships the real icon library — 444 SVG
(Filled + Outline), tree-shakeable ESM, `currentColor`, rem-scaled geometry —
under the package name `@labpics/icons`. As of this record its own
`package.json` is `"private": true` with **zero tags and zero releases**:
it is not installable from npm or GitHub Packages by any consumer, including
LabUI.

| Capability class | Consuming call site | Owner repo | Status |
| --- | --- | --- | --- |
| Published `@labpics/icons` ESM+types entry | **no current consumer** — nothing in `packages/*` or `apps/docs` imports `@labpics/icons` yet (grepped repo-wide) | `Labpics-Team/lab-icons` | Blocked: repo is `private`, no tags/releases |

## What LabUI does instead

`packages/icons` is a thin, build-free **stub bridge** (mirrors
`packages/colors-stub`'s pattern): it exists only so the `@labpics/icons`
import specifier resolves in the workspace. It contains:

- no SVG source,
- no build pipeline (no `tsup`, `svgo`, `rollup`, no `src/`/`scripts/` tree),
- no icon set at all.

The guard test `packages/icons/test/no-internal-engine.test.ts` fails CI if
any of those come back — it is the mechanical anchor that keeps this a bridge,
not a re-implementation.

Components that need an icon today render their own inline SVG (a few
Playwright fixtures only) until the real package publishes; there is no
`@labpics/icons`-shaped consumer contract to keep in sync yet, unlike the
richer `--lab-*` role contract `lab-colors.md` tracks.

## Swap-out plan

1. When `lab-icons` publishes `@labpics/icons` (npm or GitHub Packages, with
   real tags/releases), point the workspace dependency at the registry
   package.
2. Delete `packages/icons` (the stub bridge).
3. No consumer edits expected — nothing currently imports from the stub.

## Provenance

Verified 2026-07-01: `gh api repos/Labpics-Team/lab-icons/tags` → `[]`,
`gh api repos/Labpics-Team/lab-icons/releases` → `[]`,
`gh api repos/Labpics-Team/lab-icons/contents/package.json` → `"private": true`,
`npm view @labpics/icons` → `404 Not Found`.
