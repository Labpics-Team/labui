/**
 * Юнит-тесты анализатора ядра — проверяют, что манифест выведен из исходников верно
 * (класс А). Ловят регресс правил извлечения: пропы/события/слоты/наследование/фильтры.
 */
import { describe, expect, it } from 'vitest';
import { buildManifest } from '../src/build-manifest.js';
import type { ComponentMeta } from '../src/types.js';

const manifest = buildManifest();
const byTag = (tag: string): ComponentMeta => {
  const c = manifest.components.find((x) => x.tag === tag);
  if (!c) throw new Error(`нет компонента ${tag}`);
  return c;
};

describe('анализатор ядра → манифест', () => {
  it('находит ровно 27 элементов, все с тегом lab-*', () => {
    expect(manifest.components).toHaveLength(27);
    for (const c of manifest.components) expect(c.tag.startsWith('lab-')).toBe(true);
  });

  it('field не элемент (shared a11y-хелпер) — в манифесте нет', () => {
    expect(manifest.components.find((c) => c.tag === 'lab-field')).toBeUndefined();
  });

  it('button: публичные пропы, без ariaLabel; события пусты; слоты default+icon+end', () => {
    const btn = byTag('lab-button');
    expect(btn.props.map((p) => p.name).sort()).toEqual(
      ['type', 'kind', 'size', 'icon', 'loading', 'disabled', 'htmlType', 'description'].sort(),
    );
    // ariaLabel исключён (aria-* проходит нативным fall-through).
    expect(btn.props.find((p) => p.name === 'ariaLabel')).toBeUndefined();
    // htmlType маппится на атрибут html-type.
    expect(btn.props.find((p) => p.name === 'htmlType')?.attr).toBe('html-type');
    expect(btn.events).toEqual([]);
    expect(btn.slots.default).toBe(true);
    expect(btn.slots.named).toEqual(['end', 'icon']);
  });

  it('классификация видов: булев / строка / prop (массивы через converter/attribute:false)', () => {
    const btn = byTag('lab-button');
    expect(btn.props.find((p) => p.name === 'icon')?.kind).toBe('boolean');
    expect(btn.props.find((p) => p.name === 'type')?.kind).toBe('string');
    const select = byTag('lab-select');
    expect(select.props.find((p) => p.name === 'items')?.kind).toBe('prop');
    expect(select.props.find((p) => p.name === 'value')?.kind).toBe('prop');
    const accordion = byTag('lab-accordion');
    expect(accordion.props.find((p) => p.name === 'items')?.kind).toBe('prop');
  });

  it('avatar: внутреннее состояние { state: true } исключено', () => {
    const avatar = byTag('lab-avatar');
    expect(avatar.props.find((p) => p.name === '_imageFailed')).toBeUndefined();
  });

  it('alert-dialog наследует пропы/события dialog', () => {
    const alert = byTag('lab-alert-dialog');
    expect(alert.props.map((p) => p.name)).toEqual([
      'size',
      'modal',
      'closable',
      'heading',
      'description',
    ]);
    expect(alert.events).toContain('open-change');
  });

  it('события собираются из new CustomEvent', () => {
    expect(byTag('lab-checkbox').events).toEqual(['checked-change']);
    expect(byTag('lab-slider').events).toEqual(['value-change', 'value-change-end']);
    expect(byTag('lab-input').events).toEqual(['lab-change', 'lab-input']);
  });

  it('слоты: динамические (tabs/accordion) помечены dynamic; статические собраны', () => {
    expect(byTag('lab-tabs').slots.dynamic).toBe(true);
    expect(byTag('lab-accordion').slots.dynamic).toBe(true);
    expect(byTag('lab-card').slots.named).toEqual(['footer', 'header', 'media']);
    expect(byTag('lab-switch').slots.named).toEqual(['icon-off', 'icon-on']);
  });

  it('pascal/subpath выведены из тега', () => {
    const alert = byTag('lab-alert-dialog');
    expect(alert.subpath).toBe('alert-dialog');
    expect(alert.pascal).toBe('AlertDialog');
  });
});
