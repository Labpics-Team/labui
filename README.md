# Lab UI

Дизайн-система Labpics: компоненты интерфейса, светлая и тёмная темы,
семантические токены и материалы Solid, Glass, Acrylic. Веб-компоненты
и привязки для React, Vue, Svelte, Solid и Astro используют общий контракт.

[![CI](https://github.com/Labpics-Team/labui/actions/workflows/ci.yml/badge.svg)](https://github.com/Labpics-Team/labui/actions/workflows/ci.yml)
[![Код: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)

Визуальный эталон — [Lab UI v2.1 в Figma Community](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Цвет вычисляет [Lab Colors](https://github.com/Labpics-Team/lab-colors),
движение исполняет [Lab Motion](https://github.com/Labpics-Team/lab-motion).

## Начало работы

Репозиторий открыт, веб-пакеты пока разрабатываются в workspace: они имеют
версию `0.0.0` и не публикуются в npm. Для знакомства запустите каталог
из исходников. Нужны Git, Node.js и pnpm; их версии указаны в
[package.json](package.json).

```sh
git clone https://github.com/Labpics-Team/labui.git
cd labui
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @labpics/ui-docs dev
```

Откройте адрес, который напечатает Vite, и перейдите к **Component documentation**.
[Первый запуск каталога](docs/tutorials/catalogue.md) объясняет страницы,
переключение темы и просмотр вариантов компонента.

## Первый компонент

Пример рассчитан на приложение в собранном workspace с зависимостями
`workspace:*` и сборщиком, который поддерживает импорт CSS, например Vite.
Подключите стили и нужный компонент в модуле приложения:

```typescript
import '@labui/colors/contract.css';
import '@labpics/ui-tokens/tokens.css';
import '@labpics/ui-tokens/motion.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/button';
import { setTheme } from '@labpics/ui-core';

setTheme(document.documentElement, 'light');

const button = document.createElement('lab-button');
button.setAttribute('type', 'accent');
button.setAttribute('kind', 'fill');
button.textContent = 'Сохранить';
document.body.append(button);
```

[Подключение компонентов](docs/how-to/use-components.md) содержит вариант
для React, работу со стилями и выбор материала. Свойства, события и примеры
отдельных компонентов находятся в локальном каталоге.

## Материалы

Solid, Glass и Acrylic — общая ось оформления поверхности. Progressive blur
задаётся отдельно как краевой эффект. Переключение материала сохраняет
анатомию и взаимодействие компонента; механикой эффектов и их поддержкой
в браузере владеет пакет Materials.

[Темы и материалы](docs/reference/theme-materials.md) ·
[Инварианты системы](docs/reference/invariants.md).

## Документация и разработка

[Все руководства](docs/README.md) ·
[Карта пакетов](docs/reference/packages.md) ·
[Устройство системы](docs/explanation/architecture.md) ·
[Участие в проекте](CONTRIBUTING.md) ·
[Сообщить об уязвимости](SECURITY.md).

Нативные SDK входят в замысел Lab UI. Их реализация и квалификация ведутся
отдельно; наличие веб-компонента не означает готовность соответствующего SDK.

## Лицензии

Код и документация: [MIT](LICENSE). Labpics.
Шрифты Geist и Geist Mono: [SIL OFL 1.1](packages/fonts/OFL.txt);
их источники описаны в [PROVENANCE.md](packages/fonts/PROVENANCE.md).

