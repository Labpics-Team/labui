# Токены Lab UI

Пакет задаёт геометрию, типографику и порядок слоёв. Подключите
`@labpics/ui-tokens/tokens.css`; компоненты читают семантические CSS-переменные.
Изменения для своего продукта передаются в `generateFromOverride`.

## Подписи компонентов

Плавная типографическая шкала зависит от ширины окна. Роли `switch-label`
и `switch-label-l` сохраняют размер относительно корневого шрифта: подпись
переключателя меняется с масштабом интерфейса, а не с шириной страницы.

```ts
import { generateFromOverride } from '@labpics/ui-tokens';

const artifacts = generateFromOverride({
  typography: {
    fixedRoles: {
      'switch-label-l': {
        fontSizeRem: 1.5,
        lineHeight: 1,
        letterSpacingEm: -0.0165,
      },
    },
  },
});
```

Роль задаёт кегль в rem, межстрочный интервал множителем и трекинг в em.
Переопределение заменяет запись целиком и сохраняет соседние роли. Имя роли
не может совпадать со ступенью плавной шкалы. Генератор выпускает согласованные
CSS, TypeScript и DTCG; корневой размер для DTCG задаёт `typography.remBasePx`.
