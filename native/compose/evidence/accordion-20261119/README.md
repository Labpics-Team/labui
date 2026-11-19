# Accordion — Compose, 19 ноября 2026

`LabAccordion` читает `components.json#accordion`, Lab Colors роли и Lab Motion.
M воспроизводит 503×56 closed и 503×88 open: padding/radius 16 dp, content gap 8 dp,
шеврон 16 dp. Состояния rest/hover отрисованы при density 2, а обе темы и системный
размер текста 100/200% — в CPU `ImageComposeScene`, без окон или озвучки.

`compare-*.png` показывают read-only источник над Compose на белом фоне при 2×.
Геометрия совпадает; расхождение body с источником относится к смешанным версиям
Geist и остаётся открытым в общей Typography/Fonts границе. Подробности и исходный
TextStyle — [web evidence](../../../../docs/evidence/accordion-20261119/README.md).
`comparison.generated.json` фиксирует RGB-разницу, без утверждения о попиксельном совпадении.

Четыре `AccordionRenderTest` проверяют author dimensions/hover, font scale,
controlled отказ и принятие, ArrowDown с пропуском disabled, Enter, multi/single,
non-collapsible, сохранение обычного `remember`, возврат фокуса из закрываемого поля,
отсутствие скрытой semantics, промежуточную высоту Lab Motion и retarget.
Начальный и reduced-motion кадры не требуют перехода.

`AccordionFormExample` и `AccordionConsumerTest` устанавливают Maven-артефакты
`0.1.0-accordion-20261119.1`, без `uiSource` и других source substitutions.
В двух темах при 100/200% тест редактирует адрес, получает отказ раскрытия,
разрешает переход переключателем и возвращает сохранённый адрес после другой
панели. `installed.generated.json` содержит координаты и хеши проверенных JAR.
Это локальная проверка поставки, не публичный Maven release.

```powershell
./native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.AccordionRenderTest --console=plain
$env:ORG_GRADLE_PROJECT_publicationVersion = '0.1.0-accordion-20261119.1'
$env:ORG_GRADLE_PROJECT_publicationRepository = "$PWD/native/compose/build/accordion-repository"
./native/compose/gradlew.bat -p native/compose publishDesktopPublicationToDistributionRepository publishKotlinMultiplatformPublicationToDistributionRepository :ui-colors:publishDesktopPublicationToDistributionRepository :ui-colors:publishKotlinMultiplatformPublicationToDistributionRepository --console=plain
$env:ORG_GRADLE_PROJECT_uiVersion = $env:ORG_GRADLE_PROJECT_publicationVersion
$env:ORG_GRADLE_PROJECT_uiRepository = $env:ORG_GRADLE_PROJECT_publicationRepository
$env:ORG_GRADLE_PROJECT_iconsVersion = '0.4.0-semantic.6'
$env:ORG_GRADLE_PROJECT_iconsRepository = '<accepted-icons-checkout>/native/compose/build/repository'
./native/compose/gradlew.bat -p native/compose/consumer :desktopTest --tests pics.lab.ui.sample.AccordionConsumerTest --console=plain
```

Native semantics сообщает heading/button и Expand/Collapse actions. Проверены
offscreen семантика и клавиатура; работа системных screen readers и Android/iOS
устройств этим прогоном не заявляется.
