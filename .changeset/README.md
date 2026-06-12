# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

When you change a published package, add a changeset:

```bash
pnpm changeset
```

Pick the affected packages and a semver bump (patch / minor / major), write a
one-line summary. The changeset file is committed with your PR; releases consume
it in the `release` chapter. `@labpics/ui-docs` is ignored (private app, never
published).
