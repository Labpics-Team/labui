---
"@labpics/ui-materials": minor
"@labpics/ui-core": minor
---

Materials are three now (ADR-0008): the `blur` tier is removed as a
perceptual duplicate of `acrylic`. `MaterialMode` is `solid | glass |
acrylic`; every `[data-material="blur"]` CSS block is gone and a
regression lock in `degradations.test.ts` keeps it that way. Migration:
`data-material="blur"` → `data-material="acrylic"`.
