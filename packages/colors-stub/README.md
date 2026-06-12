# `@labpics/colors` (local stub)

**Temporary.** This package vendors the `--lab-*` CSS custom-property contract by
hand so LabUI can pin and test the color integration point before the real
`@labpics/colors` is published.

- Real package: produced by `lab-colors-v1` → chapter `native-and-release`.
- Real runtime: `lab-colors-v1` → chapter `runtime-engine` (resolves `--lab-*`
  from the background at runtime).

## Swap-out plan

1. When `@labpics/colors` is published, replace the workspace `@labpics/colors`
   dependency target from this stub to the registry package.
2. The `--lab-*` variable **names** must not change, so consumers
   (`apps/docs`, components) need zero edits.
3. Delete `packages/colors-stub`.

Do **not** add a color resolver here. Missing core API is filed as a request to
`lab-colors-v1`, never implemented in LabUI.
