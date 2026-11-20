import { describe, expect, it } from 'vitest';
import {
  changeMenuChecked,
  menuCheckedValues,
  menuModel,
} from '../src/components/menu/contract.js';
describe('menu tree and selection contract', () => {
  const model = menuModel([
    { value: 'a', label: 'A', kind: 'radio', group: 'view' },
    { value: 'b', label: 'B', kind: 'radio', group: 'view' },
    { value: 'check', label: 'Check', kind: 'check' },
    { value: 'disabled', label: 'Disabled', kind: 'check', disabled: true },
    {
      value: 'more',
      label: 'More',
      kind: 'submenu',
      items: [{ value: 'action', label: 'Action' }],
    },
  ]);
  it('requires stable unique identities through nested panels', () => {
    expect(() =>
      menuModel([{ value: 'a', label: 'A', kind: 'submenu', items: [{ value: 'a', label: 'A' }] }]),
    ).toThrow('unique');
    expect(model.panels.map((p) => p.key)).toEqual(['root', 'submenu:more']);
    expect(model.panelByItem.get('action')).toBe('submenu:more');
  });
  it('normalizes radio groups, duplicates and stale/action values', () => {
    expect(menuCheckedValues(model, ['a', 'b', 'check', 'check', 'missing', 'action'])).toEqual([
      'a',
      'check',
    ]);
    expect(changeMenuChecked(model, ['a', 'check'], 'b', true)).toEqual(['check', 'b']);
    expect(changeMenuChecked(model, ['a'], 'a', false)).toEqual(['a']);
    expect(changeMenuChecked(model, [], 'disabled', true)).toEqual([]);
  });
  it('keeps an initially empty menubar distinct from an empty popup', () => {
    expect(menuModel([], 'Menu', undefined, []).panels).toEqual([]);
    expect(menuModel([]).panels.map((panel) => panel.key)).toEqual(['root']);
  });
});
