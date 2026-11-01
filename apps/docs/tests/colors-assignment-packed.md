# Проверка LabUI с архивом LabColors V3

Сценарий проверяет назначение трёх цветовых ролей в настоящем `<lab-button>` и
обычном тексте. Отдельный временный consumer устанавливает архив `@labpics/colors`
и локально собранные пакеты `@labpics/ui-core`, `@labpics/ui-shadow` через npm.
Vite разрешает публичный entrypoint кнопки из установленного пакета без aliases.
Fixture не входит в обычную сборку документации.

## Запуск

Нужны Node и pnpm из корневого `package.json`, npm, установленный Chrome и локальный
архив, совпадающий с [закреплённым subject](colors-assignment-subject.json).
Из корня LabUI:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @labpics/ui-shadow build
pnpm --filter @labpics/ui-core build
pnpm --filter @labpics/ui-shadow pack --pack-destination /path/outside/labui/ui-packages
pnpm --filter @labpics/ui-core pack --pack-destination /path/outside/labui/ui-packages
node apps/docs/tests/colors-assignment-packed.mjs --tarball /path/to/labpics-colors-1.0.3.tgz --ui-core-tarball /path/outside/labui/ui-packages/labpics-ui-core-0.0.0.tgz --ui-shadow-tarball /path/outside/labui/ui-packages/labpics-ui-shadow-0.0.0.tgz --out /path/outside/labui/browser-proof
```

`--out` должен находиться вне checkout. Для Edge добавьте `--browser-channel msedge`.
Harness проверяет SHA-256 архива LabColors и установленного WASM, фиксирует хэши
обоих архивов LabUI, dependency tree и пути модулей из browser bundle. Затем создаёт
`receipt.json`, `authored.png` и `assigned-diagnostic.png`. При ошибке сохраняет
`failure.json` и завершает процесс с ненулевым кодом. Используйте новый каталог
для каждого запуска, чтобы различать результаты. Временный consumer удаляется,
браузер и локальный HTTP-сервер закрываются.

## Что проверяется

| Сценарий | Условие | Ожидаемый результат |
| --- | --- | --- |
| Авторские значения | `maxDelta = 0`, contrast report-only | `ready`, все три роли сохранены |
| Строгая диагностика | Белый label, hard WCAG 4.5, `maxDelta = 0` | `unsatisfied`, текущий набор скрыт |
| Экспериментальное назначение | Белый label, hard WCAG 4.5, `maxDelta = 0.1` | `ready`, accent изменён, primary сохранён |

Авторские RGB: light accent `[0,122,255]`, dark accent `[74,143,255]`, label
`[255,255,255]`, primary light `[16,16,18]`, primary dark `[246,248,250]`.
Light accent и белый label сверены с прочитанным design reference; dark accent и
оба primary объявлены потребителем по замороженному CSS reference. Это не новый
захват dark mode из Figma.

Primary и белый label заданы как fixed targets: сценарий не разрешает менять их.
Основной текст получает собственный report-only WCAG на поверхности scope.
Только accent входит в assignment; все три выхода возвращаются одним snapshot.

Дополнительно проверяются `waiting`, `stale`, `incomplete`, восстановление,
освобождение runtime/snapshot при отключении, изоляция двух scope и настоящие
click, Enter, Space. Готовые RGB из snapshot сравниваются с computed style кнопки
и текста; контраст кнопки независимо пересчитывается из её RGB. Публикация трёх
ролей происходит одной заменой `style.cssText` дочернего элемента. Унаследованный
`contract.css` подключён без изменений, чужая роль на родителе сохраняется.

## Предел результата

`0.1` — экспериментальный допуск solver, который не принят как визуальный бюджет.
Fixture отключает переход цветов для статической проверки публикации; она не
доказывает анимационные свойства. Геометрия и фон существующего компонента не
меняются, полное совпадение с Figma не заявляется.

Результат относится к локально собранным и установленным архивам LabUI и LabColors.
Опубликованный LabUI здесь не проверяется. Архив LabColors
экспериментальный; этот сценарий не разрешает его публикацию и не закрывает
отдельные ограничения размера WASM/пакета.
