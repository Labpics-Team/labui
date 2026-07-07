# @labpics/fonts

Self-host Geist и Geist Mono для LabUI — вариативные `woff2` + `@font-face`.
Пакет **опциональный**: дизайн-система работает и без него (тогда рендерится
фолбэк-стек из токена `--lab-font-family`), но с ним получаете фирменную
гарнитуру без обращения к внешним CDN.

## Установка семейства

Гарнитуру задаёт НЕ этот пакет, а токены `@labpics/ui-tokens`
(`--lab-font-family` / `--lab-font-family-mono`) на скоупе `[data-theme]`. Этот
пакет лишь регистрирует файлы шрифта, чтобы стек «`'Geist', …фолбэки`» разрешался
в настоящий Geist. Достаточно один раз подключить CSS:

```css
@import '@labpics/fonts/fonts.css';   /* регистрирует @font-face Geist / Geist Mono */
```

Компоненты остаются на `font: inherit` — семейство наследуется от корня темы.

## Что внутри

- `fonts/Geist-Variable.woff2` — Geist, ось `wght` 100–900 одним файлом.
- `fonts/GeistMono-Variable.woff2` — Geist Mono, ось `wght` 100–900.
- `fonts.css` — два `@font-face` c `font-display: swap`.
- `OFL.txt` — лицензия (SIL Open Font License 1.1).
- `PROVENANCE.md` — источник, версия, SHA-256, как обновлять.

## Лицензия

Шрифты — **OFL 1.1** (© Vercel + basement.studio), см. `OFL.txt`. OFL разрешает
self-host и редистрибуцию в составе продукта при сохранении текста лицензии
(он тут рядом). Мы шрифт не изменяем.

## OpenType-фичи (проверено чтением бинарников, fvar/GSUB)

Фичи заводятся токенами `--lab-font-feature-*` в `@labpics/ui-tokens`, но полный
проверенный перечень держим здесь, у самого шрифта. **Заведены токены только на
реально существующие фичи** — `zero`, `calt`, `onum` в Geist ОТСУТСТВУЮТ, токенов
на них нет (были бы no-op).

Geist (Sans):
- `tnum` — табличные (моноширинные) цифры → токен `--lab-font-feature-tabular`.
- `frac` — дробные глифы (½ из 1/2) → токен `--lab-font-feature-fractions`.
- `case`, `dlig`, `pnum`, `ss01`–`ss11` — присутствуют, под токены не выведены
  (ситуативные; включаются вручную через `font-feature-settings`).

Geist Mono (моноширинный, `tnum`/`pnum`/`dlig` не нужны — он уже табличный):
- `ss09` — «Non-slashed zero»: по умолчанию ноль ПЕРЕЧЁРКНУТ, `"ss09" 1` убирает
  черту (полезно для читаемости кода — на вкус).
- `ss11` — «Coding ligatures»: лигатуры для кода (`=>`, `!=` и т.п.).
- `frac`, `ss01`–`ss04`, `ss06`–`ss10` — присутствуют.

Пример ручного включения фичи Mono (в самом пакете-потребителе):

```css
.code { font-family: var(--lab-font-family-mono); font-feature-settings: 'ss11' 1; }
```
