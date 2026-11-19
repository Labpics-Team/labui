# Avatar — 18 ноября 2026

`avatar-source.json` — read-only снимок авторского набора Avatar `6107:10719`,
десять цветов при размере 32×32. `status-source.json` отдельно подтверждает
четыре присутствия и точный прозрачный вырез: circle(16,16,16) минус
circle(28,28,6), точка circle(28,28,4). Figma document profile — sRGB.

Буквенная часть использует общую геометрию Figma: 14/12 px, weight800,
центрированный текстовый блок 32×30 с origin0/0. Размеры S24 и L48 —
пропорциональные расширения размера M32. Для SF Pro Rounded Heavy выбрана
открытая замена Sunghyun Sans ExtraBold с кириллицей; её контуры не тождественны
исходному шрифту. Лицензия и pinned font источник лежат в пакете fonts.

Проверены Lit/React: все десять цветов × три размера × две темы, настоящий
загруженный шрифт, RTL, 200% текста, имя/decorative, override инициалов,
загрузка/ошибка/запоздалое событие старого URL. SSR-сценарий выполняет загрузку
изображения до hydration и проверяет сохранение исходного img и обновление
после hydration. Compose CPU-проверка без окон повторяет темы, размеры,
семантику, графемы и настоящий HTTP, включая прозрачный PNG после загрузки.

**Незавершённая часть этого среза — текстурный материал.** Текущий fallback
пока рисует плоскую роль цвета. Нельзя объявлять Avatar точным переносом или
выпускать компонент в этом состоянии. Полный источник состоит из Fallback
image, двух Figma Texture-слоёв и вложенных HUE/COLOR; готовые цветные PNG
служат только для сравнения. Root исследует воспроизведение материала из
исходных слоёв, включая порядок compositing и фильтрацию при уменьшении.
Финальный материал, его измерение и изображения должны заменить этот абзац
перед интеграцией. Android/iOS compile выполняется в интеграционном CI;
локально проверен Desktop на JDK21.

Исследованные первоисточники:

- [Figma Avatar](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6107-10719)
- [W3C non-separable blending](https://www.w3.org/TR/compositing-1/#blendingnonseparable)
- [Coil Compose](https://coil-kt.github.io/coil/compose/)
- [Coil network](https://coil-kt.github.io/coil/network/)
- [Kotlin String / NSString](https://kotlinlang.org/docs/native-objc-interop.html#casting-between-mapped-types)
