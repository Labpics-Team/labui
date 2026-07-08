# Changesets

Этой папкой управляет [Changesets](https://github.com/changesets/changesets).

Когда меняете публикуемый пакет, добавьте changeset:

```bash
pnpm changeset
```

Выберите затронутые пакеты и semver-бамп (patch / minor / major), напишите
однострочное резюме. Файл changeset коммитится вместе с вашим PR; релизы
используют его в главе `release`. `@labpics/ui-docs` игнорируется (приватное
приложение, никогда не публикуется).
