// Гигиена трёх уровней паспорта labui: примитив (движок) / СЕМАНТИКА (роли без
// юзкейса) / КОМПОНЕНТ (юзкейсы-переназначения). Гейт КУСАЕТСЯ (RED-first): на
// до-фикс паспорте бейдж-вокаб живёт в roles, алиас border-ghost остаётся,
// а None-ступень есть только у нейтрали Border — каждый из этих фактов красит
// тест. Провенанс — сам файл labui.config.json (структурный инвариант, не литерал).
//
// Класс А (contract/структурный unit) + Б (регрессия словаря как набор).
import { describe, expect, it } from 'vitest';

import passport from '../labui.config.json' with { type: 'json' };

// Компонентный вокаб (юзкейсы) ЗАПРЕЩЁН в семантическом слое (roles). Он живёт
// на компонентном слое (passport.components) как переназначения, резолвясь в
// идентичные финальные цвета. Паттерны зеркалят канон LabUI-таксономия §уровни.
const FORBIDDEN_SEMANTIC_VOCAB = [/badge/i, /control-bg/i, /\bmisc\b/i];

// Полный набор сентиментов семьи Border (канон): нейтраль + бренд + 4 сентимента.
// None-ступень (нулевой токен) обязана присутствовать у КАЖДОГО — единообразие
// Ghost→None. Нейтраль несёт её как `border-none`, сентименты — `border-<s>-none`.
const BORDER_SENTIMENTS = ['neutral', 'brand', 'danger', 'warning', 'success', 'info'];

/** Имена ролей семантического слоя. */
function semanticRoleNames() {
  return passport.roles.map((r) => r.name);
}

/** Имя None-ступени Border для сентимента (нейтраль — без суффикса сентимента). */
function borderNoneRole(sentiment) {
  return sentiment === 'neutral' ? 'border-none' : `border-${sentiment}-none`;
}

/** Рекурсивно собрать все строковые значения объекта (для скана источников). */
function stringValues(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const v of node) stringValues(v, out);
  else if (node && typeof node === 'object') for (const v of Object.values(node)) stringValues(v, out);
  return out;
}

describe('гигиена уровней: семантика без компонентного вокаба', () => {
  it('roles НЕ содержит badge/control-bg/misc (переехали на компонентный слой)', () => {
    const offenders = semanticRoleNames().filter((name) =>
      FORBIDDEN_SEMANTIC_VOCAB.some((re) => re.test(name)),
    );
    expect(offenders, 'компонентный вокаб в семантическом roles').toEqual([]);
  });

  it('компонентный слой существует и несёт бейдж-переназначения', () => {
    expect(Array.isArray(passport.components), 'passport.components не массив').toBe(true);
    const compNames = passport.components.map((c) => c.name);
    // Полный набор пар бейджа (закон пары ядра) переехал на компонентный слой.
    const expected = [
      'badge-fill-brand',
      'badge-fill-danger',
      'badge-fill-warning',
      'badge-fill-success',
      'badge-fill-info',
      'badge-fill-static-dark',
      'badge-fill-static-light',
    ];
    const missing = expected.filter((n) => !compNames.includes(n));
    expect(missing, 'бейдж-роли не на компонентном слое').toEqual([]);
  });
});

describe('гигиена уровней: нижний слой не ссылается на верхний', () => {
  it('семантические roles НЕ ссылаются на имена компонентного слоя', () => {
    const componentNames = new Set((passport.components ?? []).map((c) => c.name));
    const leaks = [];
    for (const role of passport.roles) {
      for (const value of stringValues(role.recipe ?? {})) {
        if (componentNames.has(value)) leaks.push(`${role.name} → ${value}`);
      }
    }
    expect(leaks, 'семантика ссылается на компонентный слой').toEqual([]);
  });
});

describe('гигиена: Ghost→None единообразно', () => {
  it('нигде в паспорте нет вокаба ghost (заменён на none)', () => {
    // grep -oic ghost по паспорту == 0: имена ролей, алиасы и их таргеты.
    const haystack = [
      ...passport.roles.map((r) => r.name),
      ...passport.aliases.map((a) => `${a.alias} ${a.target}`),
      ...(passport.components ?? []).map((c) => c.name),
    ].join('\n');
    expect(/ghost/i.test(haystack), 'вокаб ghost остался в паспорте').toBe(false);
  });

  it('None-токен присутствует у КАЖДОГО сентимента семьи Border', () => {
    const names = new Set(semanticRoleNames());
    const missing = BORDER_SENTIMENTS.map(borderNoneRole).filter((r) => !names.has(r));
    expect(missing, 'сентименты Border без None-ступени').toEqual([]);
  });
});
