---
"@labpics/ui-core": patch
"@labpics/ui-react": patch
---

Pagination — unify the prev/next accessible name across renderers.

The Lit `<lab-pagination>` previously surfaced Zag's lowercase machine default
(`previous page` / `next page`) because the `updated()` spread overwrote the
template's `aria-label`, while the React `<Pagination>` kept the capitalized
`Previous page` / `Next page`. Both renderers now emit the SAME capitalized
accessible name from one source of truth, so the two cannot drift.

Production behavior is otherwise unchanged: same machine, same page-window
algorithm, same controlled/uncontrolled split, same `--lab-*` token contract —
only the prev/next accessible-name casing on the Lit renderer is corrected.
