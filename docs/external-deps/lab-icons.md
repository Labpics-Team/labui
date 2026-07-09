# External dependency — `@labpics/icons` engine gap

> Call-site-anchored record of the single EXTERNAL blocker on the icon core.
> LabUI must NOT vendor an SVG build/resolver engine, copy `lab-icons` sources,
> or maintain a local icon set. This gap is owned by the `lab-icons` repo, not
> by LabUI. **Status: the external blocker is RESOLVED (2026-07-09)** — what
> remains is LabUI-side swap-out work, tracked below.

## The blocker — RESOLVED 2026-07-09

`Labpics-Team/lab-icons` (now a **public** repo) ships the real icon library —
444 SVG (Filled + Outline), tree-shakeable ESM, `currentColor`, rem-scaled
geometry — under the package name `@labpics/icons`. The package **is published
to npm**: `@labpics/icons@0.2.0` (`dist-tags.latest = 0.2.0`), git tag
`v0.2.0`, `package.json` `"private": false`. Any consumer, including LabUI,
can install it from the npm registry today.

Precision note: GitHub **Releases** objects are still empty (`releases` → `[]`);
installability is provided by the npm publication + git tag, which satisfies
the swap-out precondition as originally written ("npm or GitHub Packages, with
real tags/releases" — npm + tag `v0.2.0`).

| Capability class | Consuming call site | Owner repo | Status |
| --- | --- | --- | --- |
| Published `@labpics/icons` ESM+types entry | **no current consumer** — nothing in `packages/*` or `apps/docs` imports `@labpics/icons` yet (re-grepped repo-wide 2026-07-09) | `Labpics-Team/lab-icons` | **Resolved**: `0.2.0` on npm, tag `v0.2.0`, repo public |

## What LabUI does instead (until swap-out executes)

`packages/icons` is a thin, build-free **stub bridge** (mirrors
`packages/colors-stub`'s pattern): it exists only so the `@labpics/icons`
import specifier resolves in the workspace. It contains:

- no SVG source,
- no build pipeline (no `tsup`, `svgo`, `rollup`, no `src/`/`scripts/` tree),
- no icon set at all.

The guard test `packages/icons/test/no-internal-engine.test.ts` fails CI if
any of those come back — it is the mechanical anchor that keeps this a bridge,
not a re-implementation. The guard stays until the stub is deleted by the
swap-out below.

Components that need an icon today render their own inline SVG (a few
Playwright fixtures only); there is no `@labpics/icons`-shaped consumer
contract to keep in sync yet, unlike the richer `--lab-*` role contract
`lab-colors.md` tracks.

## Swap-out plan — precondition MET, now actionable (owned by LabUI)

1. ~~When `lab-icons` publishes `@labpics/icons`~~ **Done upstream**:
   `@labpics/icons@0.2.0` is on npm (see Provenance). Point the workspace
   dependency at the registry package when the first real consumer lands.
2. Delete `packages/icons` (the stub bridge) — requires a `pnpm-lock.yaml`
   regeneration (workspace importer entry) in the same change.
3. No consumer edits expected — nothing currently imports from the stub.

The swap-out is deliberately **not** bundled with this record update: deleting
a workspace package touches the lockfile and CI matrix, so it ships as its own
reviewed change.

## Provenance

Verified 2026-07-09 (blocker resolution):
`gh api repos/Labpics-Team/lab-icons/tags` → `v0.2.0`, `v0.2.0-dist`,
`gh api repos/Labpics-Team/lab-icons/releases` → `[]` (no Releases objects),
`gh api repos/Labpics-Team/lab-icons/contents/package.json` → `"private": false`,
`gh repo view Labpics-Team/lab-icons` → visibility `PUBLIC`,
`npm view @labpics/icons version` → `0.2.0`
(tarball `https://registry.npmjs.org/@labpics/icons/-/icons-0.2.0.tgz`).

Historical record — verified 2026-07-01 (blocker active):
`gh api repos/Labpics-Team/lab-icons/tags` → `[]`,
`gh api repos/Labpics-Team/lab-icons/releases` → `[]`,
`gh api repos/Labpics-Team/lab-icons/contents/package.json` → `"private": true`,
`npm view @labpics/icons` → `404 Not Found`.
