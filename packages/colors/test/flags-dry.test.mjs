// DRY-гейт «ФЛАГИ ВМЕСТО ВЕТОК» (под-срез static+inverted). Закон: дерево
// паспорта несёт ТОЛЬКО смысл — тема/состояние выражаются ФЛАГОМ листа, а не
// парой sibling-листьев, отличающихся лишь суффиксом темы/состояния. Резолвер
// (engine.mjs) разворачивает флаг НА МЕСТЕ в конкретные роли на границе wasm.
//
// Почему НЕ «форс темы» (как наивно предполагалось): нейтральные pick движка
// (NeutralPick::Light/Dark, lab-colors config.rs:1284-1289) ТЕМА-ИНВАРИАНТНЫ —
// pick:dark даёт тёмный якорь в ОБЕИХ темах. Форсирование темы не переключает
// light↔dark нейтраль, поэтому флаг разворачивается по ОСИ pick, а движок (ядро,
// вне зоны) не трогается. Разворот байт-идентичен старым листьям → отпечаток
// паспорта не дрейфует (тот же канонический DTO), что и есть регресс-контроль.
//
// Класс А (структурный unit по авторскому паспорту) + Д-подобный RED-proof:
// тест КУСАЕТСЯ — на паспорте ДО свёртки (пара badge-fill-static-dark/light в
// components) первый it падает; ре-интродукция любой дубль-пары краснит снова.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PASSPORT_FINGERPRINT, createLabuiEngine } from '../engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(await readFile(join(here, '..', 'labui.config.json'), 'utf8'));

/** Все авторские листья паспорта (семантика + компонент), по именам. */
const leafNames = [...cfg.roles, ...(cfg.components ?? [])].map((r) => r.name);
const leafSet = new Set(leafNames);

describe('DRY: флаги вместо тема/состояние-веток (static, inverted)', () => {
  // Ось static: лист «X-static» несёт флаг pick∈{light,dark}; ДВА sibling-листа
  // X-static-light + X-static-dark — запрещённая ветка-дубль (различие лишь темой).
  it('ноль static тема-веток: нет листьев *-static-(light|dark)', () => {
    const forks = leafNames.filter((n) => /-static-(light|dark)$/.test(n));
    expect(forks, 'static-листья должны быть свёрнуты в один лист + флаг pick').toEqual([]);
  });

  // Ось inverted: лист «X-inverted» — ветка-дубль ТОЛЬКО если существует и его
  // не-inverted пара «X» (тогда inverted — состояние-флаг, не отдельный смысл).
  // fx-glow-inverted легитимен (нет листа fx-glow) — свой источник (inverted-якорь).
  it('ноль inverted состояние-веток: нет пары {X, X-inverted}', () => {
    const forks = leafNames
      .filter((n) => n.endsWith('-inverted'))
      .filter((n) => leafSet.has(n.slice(0, -'-inverted'.length)));
    expect(forks, 'inverted-дубли должны быть свёрнуты в один лист + флаг').toEqual([]);
  });

  // Байт-идентичность свёртки: разворот флага на границе wasm воспроизводит
  // канонический DTO паспорта → отпечаток равен пину (нулевой дрейф вывода).
  it('отпечаток паспорта стабилен после свёртки (байт-идентичность)', async () => {
    const { fingerprint } = await createLabuiEngine();
    expect(fingerprint).toBe(PASSPORT_FINGERPRINT);
  });

  // Разворот флага реален: обе конкретные роли эмитятся движком и РАЗЛИЧНЫ
  // (light ≠ dark), т.е. один лист + флаг дал две выведенные заливки.
  it('флаг развёрнут: badge-fill-static-{dark,light} эмитятся и различны', async () => {
    const { colors } = await createLabuiEngine();
    const roles = colors.resolveTheme('#FFFFFF', 'light').roles;
    const dark = roles['badge-fill-static-dark'];
    const light = roles['badge-fill-static-light'];
    expect(dark, 'движок не эмитит badge-fill-static-dark').toBeDefined();
    expect(light, 'движок не эмитит badge-fill-static-light').toBeDefined();
    expect(dark.css).not.toBe(light.css);
  });
});
