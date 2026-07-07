// Гейт трёх уровней (ADR: примитив/семантика vs компонент). Владелец постановил
// «Misc был ошибкой уровня → компонентный уровень». Компонент-юзкейс токены
// (привязка к конкретному компоненту, а не к семантической роли) вынесены из
// СЕМАНТИКИ (passport.roles) в отдельный COMPONENT-слой (passport.components).
//
// Правило downward-only: компонент МОЖЕТ ссылаться на семантику, семантика на
// компонент — НИКОГДА. Тест КУСАЕТСЯ (RED-first): до выноса 7 badge-токенов
// лежали в roles (первый it падал бы), семантика ссылалась бы на компонент,
// алиас border-ghost жил бы в паспорте, а None-ступень была бы только у
// нейтрали Border — каждый из этих фактов красит соответствующий it. Провенанс —
// сам файл labui.config.json (структурный инвариант, не литерал-заплатка).
//
// Класс А (contract/структурный unit) + Б (регрессия словаря как набор).
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PASSPORT_FINGERPRINT, createLabuiEngine } from '../engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, '..', 'labui.config.json');
const cfg = JSON.parse(await readFile(configPath, 'utf8'));

// Класс компонент-юзкейс имён (не список-заплатка): префикс компонента/Misc.
const COMPONENT_USECASE = /^(badge-|control-|misc-)/;

// Полный набор сентиментов семьи Border (канон): нейтраль + бренд + 4 сентимента.
// None-ступень (нулевой токен) обязана присутствовать у КАЖДОГО — единообразие
// Ghost→None. Нейтраль несёт её как `border-none`, сентименты — `border-<s>-none`.
const BORDER_SENTIMENTS = ['neutral', 'brand', 'danger', 'warning', 'success', 'info'];

/** Имя None-ступени Border для сентимента (нейтраль — без суффикса сентимента). */
function borderNoneRole(sentiment) {
  return sentiment === 'neutral' ? 'border-none' : `border-${sentiment}-none`;
}

/** Рекурсивно: ссылается ли значение рецепта на какое-либо имя из набора. */
function refsAny(node, names) {
  if (typeof node === 'string') return names.has(node);
  if (Array.isArray(node)) return node.some((n) => refsAny(n, names));
  if (node && typeof node === 'object') return Object.values(node).some((n) => refsAny(n, names));
  return false;
}

describe('три уровня: семантика (roles) vs компонент (components)', () => {
  it('СЕМАНТИКА не содержит ни одного компонент-юзкейс токена', () => {
    const leaked = cfg.roles.filter((r) => COMPONENT_USECASE.test(r.name)).map((r) => r.name);
    expect(leaked).toEqual([]);
  });

  it('COMPONENT-слой существует и держит ровно вынесенные компонент-токены', () => {
    expect(Array.isArray(cfg.components)).toBe(true);
    const names = cfg.components.map((r) => r.name);
    expect(names).toEqual([
      'badge-fill-brand',
      'badge-fill-danger',
      'badge-fill-warning',
      'badge-fill-success',
      'badge-fill-info',
      // Ось static свёрнута в ОДИН лист + флаг pick:[dark,light] (флаги вместо
      // веток). Резолвер разворачивает его на границе wasm в badge-fill-static-
      // dark/-light байт-идентично (см. flags-dry.test.mjs, engine.expandFlags).
      'badge-fill-static',
    ]);
    // все листья слоя — именно компонент-юзкейс (слой не протёк семантикой)
    expect(names.every((n) => COMPONENT_USECASE.test(n))).toBe(true);
  });

  it('downward-only: ни одна семантическая роль не ссылается на компонент-токен', () => {
    const compNames = new Set(cfg.components.map((r) => r.name));
    const violating = cfg.roles.filter((r) => refsAny(r.recipe, compNames)).map((r) => r.name);
    expect(violating).toEqual([]);
  });

  // Замок исключения: проекция ЗАКОНА ПАРЫ. passport.aliases несут ровно ДВЕ
  // несущие-лейбл семантические поверхности (fill-accent/fill-danger),
  // деривируемые generate-contract.semanticPairOverrides из badge-fill-*.
  // Это ЕДИНСТВЕННОЕ известное семантика→компонент отношение; байт-идентичность
  // сгенерированного контракта запрещает инверсию ссылки СЕЙЧАС (иначе
  // fill-accent перестал бы быть var(--lab-badge-fill-brand)). Замок ловит
  // ЛЮБОЙ НОВЫЙ протёк: множество должно оставаться ровно этой парой, пока
  // владелец не поднимет закон пары на семантический уровень (флаг владельцу).
  it('замок: семантика→компонент через алиасы — ровно проекция закона пары', () => {
    const compNames = new Set(cfg.components.map((r) => r.name));
    const semToComp = (cfg.aliases ?? [])
      .filter((a) => compNames.has(a.target))
      .map((a) => a.alias)
      .sort();
    expect(semToComp).toEqual(['fill-accent', 'fill-danger']);
  });

  it('движок видит те же роли: отпечаток паспорта стабилен после выноса', async () => {
    const { fingerprint } = await createLabuiEngine();
    expect(fingerprint).toBe(PASSPORT_FINGERPRINT);
  });
});

describe('гигиена: Ghost→None единообразно', () => {
  it('нигде в паспорте нет вокаба ghost (заменён на none)', () => {
    // grep -oic ghost по паспорту == 0: имена ролей, алиасы и их таргеты,
    // а также имена компонентного слоя.
    const haystack = [
      ...cfg.roles.map((r) => r.name),
      ...(cfg.aliases ?? []).map((a) => `${a.alias} ${a.target}`),
      ...(cfg.components ?? []).map((c) => c.name),
    ].join('\n');
    expect(/ghost/i.test(haystack), 'вокаб ghost остался в паспорте').toBe(false);
  });

  it('None-токен присутствует у КАЖДОГО сентимента семьи Border', () => {
    const names = new Set(cfg.roles.map((r) => r.name));
    const missing = BORDER_SENTIMENTS.map(borderNoneRole).filter((r) => !names.has(r));
    expect(missing, 'сентименты Border без None-ступени').toEqual([]);
  });
});
