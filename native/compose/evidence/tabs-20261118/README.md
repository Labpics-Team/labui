# Tabs — native evidence, 18 ноября 2026

Источник — неизменённая [LabUI 2.1 Figma](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1):
Tab / Tinted, Tab / Underlined и tab-control. Геометрия, роли и тень берутся
из единственного профиля `packages/tokens/src/components.json#tabs`.
S/L расширяют авторский M; они не объявлены дополнительными Figma masters.

`comparison.png` сопоставляет read-only PNG экспорт с реальным Compose-рендером
и поставляемым Geist. Обе картинки получены при 2× и показаны в размере применения.
`comparison.generated.json` содержит среднюю абсолютную ошибку RGB по всему кадру;
это вспомогательное измерение, а не замена осмотра текста, радиусов и линии.
Underlined active рисует xs-shadow только от полосы 1 dp. Тень отдельного
tab-control видна снаружи; авторская группа обрезает её по границе списка.

`tabs-{light,dark}-{100,125,200}.png` показывают Tinted/Underlined, обе оси,
Start/End, selected/default/disabled и живые панели. Horizontal получает
равные минимальные доли; длинная подпись расширяет прокручиваемую полосу.
Vertical оставляет панели не менее 10 em и при нехватке места располагается
над ней. Решение следует естественной ширине списка, а не breakpoint.

`TabsRenderTest` проверяет:

- Controlled отказ, повторное принятие, manual/automatic, Home/End, стрелки
  по оси в LTR/RTL, пропуск disabled, pointer и удаление вкладки с фокусом.
- Сохранение обычного `remember` и отредактированного поля; скрытая панель
  исключена из semantics и фокуса. Удалённое выбранное значение не подменяется.
- Непрерывность поля и фокуса при переносе vertical, включая `BoxWithConstraints`
  внутри панели. Intrinsic-запросы относятся только к списку.
- Авторский M 48 dp, Bottom icon-only 44 dp, геометрию S/L, inset 2 dp
  у четырёх горизонтальных сегментов и 4 dp у остальных.
- Обе темы, 100/125/200%, одну строку без дробления текста, прокрутку к фокусу,
  промежуточные кадры общего Lab Motion и остановку при reduced motion.

`TabsWorkspaceExample` использует установленные Maven-байты LabUI и Icons.
`TabsConsumerTest` проходит 18 сочетаний темы × Solid/Acrylic/Glass × масштаба,
редактирует textarea, отклоняет переход, принимает его после переключения
«Разрешить переход» и возвращает прежний черновик. Материал принадлежит карточке
приложения; Tabs сохраняет авторский control-bg и не требует отдельного LabScene.
`materials-{100,125,200}.png` показывает результаты этого пути.

Проверка публикации использует `0.1.0-tabs-20261118.4` в локальном Maven repository,
без `uiSource`; Icons — локальный `0.4.0-semantic.6`. Это проверка разрешения
и выполнения артефактов, а не заявление о публичном выпуске.

Команды из корня LabUI, JDK 21:

```powershell
./native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.TabsRenderTest --console=plain
$env:ORG_GRADLE_PROJECT_publicationVersion = '0.1.0-tabs-20261118.4'
$env:ORG_GRADLE_PROJECT_publicationRepository = "$PWD/native/compose/build/tabs-repository"
./native/compose/gradlew.bat -p native/compose publishDesktopPublicationToDistributionRepository publishKotlinMultiplatformPublicationToDistributionRepository :ui-colors:publishDesktopPublicationToDistributionRepository :ui-colors:publishKotlinMultiplatformPublicationToDistributionRepository --console=plain
$env:ORG_GRADLE_PROJECT_uiVersion = $env:ORG_GRADLE_PROJECT_publicationVersion
$env:ORG_GRADLE_PROJECT_uiRepository = $env:ORG_GRADLE_PROJECT_publicationRepository
$env:ORG_GRADLE_PROJECT_iconsVersion = '0.4.0-semantic.6'
$env:ORG_GRADLE_PROJECT_iconsRepository = '<accepted-icons-checkout>/native/compose/build/repository'
./native/compose/gradlew.bat -p native/compose/consumer desktopTest --tests pics.lab.ui.sample.TabsConsumerTest --console=plain
python native/compose/evidence/tabs-20261118/export-matrices.py
python native/compose/evidence/tabs-20261118/compare-source.py --tinted-source <export.png> --underlined-source <export.png> --control-source <export.png>
```

Сцены — CPU `ImageComposeScene`, без окон и озвучки. Штатный bridge Compose
получает native Tab/Selected/Disabled semantics; NVDA, VoiceOver, TalkBack
и реальные Android/iOS-устройства этим прогоном не проверялись.

Для кадров с прокруткой `render(System.nanoTime())` обязателен: default timestamp
равен нулю и останавливает анимацию BringIntoView. В проверке Motion время
задаётся явно. Неразмещение скрытой панели само по себе не скрывает semantics,
поэтому retained wrapper очищает их и запрещает вход фокуса.

Основания: [Compose focus traversal](https://developer.android.com/develop/ui/compose/touch-input/focus/focus-traversal),
[intrinsic measurements](https://developer.android.com/develop/ui/compose/layouts/intrinsic-measurements)
и [custom layouts](https://developer.android.com/develop/ui/compose/layouts/custom).
