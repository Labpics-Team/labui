/**
 * @labpics/icons — local stub bridge.
 *
 * Real package: Labpics-Team/lab-icons (private repo, 444 SVG Filled+Outline,
 * tree-shakeable ESM, currentColor, rem-scaled viewBox). It is NOT published
 * to a registry yet (package.json there is `"private": true`, no tags, no
 * releases) — an EXTERNAL blocker on that repo, not on LabUI.
 *
 * This file intentionally contains NO icon set, NO SVG source, and NO
 * build/resolver engine. It exists only so the `@labpics/icons` import
 * specifier resolves in the workspace before the real package is published.
 * Nothing in LabUI consumes an icon from this stub today (see
 * docs/external-deps/lab-icons.md) — components that need an icon render
 * their own inline SVG until the swap-out.
 */
export const PACKAGE_NAME = '@labpics/icons';
