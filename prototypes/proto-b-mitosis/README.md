# proto-b-mitosis (throwaway)

Path B of the cross-stack-core fork: the LabUI Button written ONCE in Mitosis
and compiled to React + Svelte. Self-contained, NOT in the pnpm workspace,
deletable in `core-scaffold`. Read `FINDINGS.md` for the measured comparison.

Layout:
- `src/button.lite.tsx` — the write-once Mitosis source.
- `src/button.css`      — Button styles, consume only `--lab-*`.
- `theme/{light,dark}.css` — the swappable `--lab-*` role sets.
- `output/`             — Mitosis-compiled React + Svelte (committed as evidence).
- `scripts/patch-output.ts` — the per-target manual fixes, logged (3 for React).
- `scripts/measure.ts`  — gzip weight + zero-runtime check.
- `fixtures/next`, `fixtures/astro`, `fixtures/shared` — SSR fixtures.
- `tests/`              — Playwright smoke (Next 15 SSR, both themes).

See FINDINGS.md "Reproduce".
