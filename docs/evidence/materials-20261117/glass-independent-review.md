# Независимое ревью Glass

18.11.2026, агент `/root/glass_optics_independent_review_20261117`, отдельное
ревью без истории автора. Текст передан ревьюером и сохранён исполнителем.

**CLEAR** оптической правке `.4/2.8 + depth bound`. Проверенный
`glass-optics.ts` SHA-256:
`70aa2b5fd65f79d1395c0c36d6e3ba3a72970be2936fa24a3721ec843b9d46e2`.
Исходники собраны независимо через esbuild `write:false`, Chromium
140.0.7339.186 headless, DPR1, 1552×520. Итоговый PNG побайтно совпал с
depth-bound прототипом (MAE/max 0); исполнитель отдельно подтвердил равенство
с сохраняемым `refined-web-glass-frost-0.5.png`.

Сравнила сохранённые Figma Effects, Dock, baseline `.6/2.2`, `.4/2.8` и
depth-bound при 100%. Выбрала depth-bound: Soft возвращает синий край вместо
коричневого обода, Strong теряет лишнее кольцо; объём, рисунок остальных
рецептов и цельность Dock сохраняются. Плотные первые ≈3px Soft остаются
различием приближения; видимого нового kink не обнаружила. Выбор основан на
изображениях, не общей MAE.

На финальном исходнике выполнила 20 кадров движения backdrop до (+26,+14),
затем 20 кадров transform линз до (+18,+9) и возврат. Каждый круг менял
содержимое: MAE от исходного 12.761/15.354/5.698/3.998 RGB; возврат MAE/max 0.
За оба этапа SVG mutations 0, canvas encodes 0. Browser/pages закрыты,
файлов ревьюер не создавала. Это проверка живого захвата и стабильности карты,
не performance benchmark.

Основной Effects ROI исключает 3px, поэтому край отдельно просмотрен и
сверены contour bands. HTML измерителя не воспроизводит parent
BACKGROUND_BLUR128/NOISE.04 исходной Figma; абсолютный MAE не доказывает полное
совпадение композиции. Dock source dispersion=0, цветовую дисперсию оценивала
по Effects (source=.6). Общая таблица формы/оптики и граница параметров
сохранены, tier-исключений нет. Изменение не подтверждает полный SURFACES/release.
174 PASS, build/typecheck сообщает исполнитель; независимый ревьюер эти
команды не повторяла.

Первоисточники: `plans/labui/r1.md`, `figma-effects-scenes.json`,
`figma-glass-pattern.json`, `figma-dock-*.json` и PNG;
[Figma GlassEffect](https://github.com/figma/plugin-typings/blob/master/plugin-api.d.ts).
