// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type DialogFocusContext,
  completeFailedDialogFocus,
  composedAncestors,
  dialogFinalFocusTarget,
} from '../src/components/dialog/focus.js';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture(): DialogFocusContext & {
  owner: HTMLDivElement;
  content: HTMLDivElement;
  background: HTMLButtonElement;
  trigger: HTMLButtonElement;
} {
  const owner = document.createElement('div');
  const trigger = document.createElement('button');
  // HappyDOM не выполняет layout. Эта положительная геометрия квалифицируется
  // реальными hidden/display/visibility cases в installed browser consumer.
  vi.spyOn(trigger, 'offsetWidth', 'get').mockReturnValue(16);
  vi.spyOn(trigger, 'offsetHeight', 'get').mockReturnValue(0);
  vi.spyOn(trigger, 'getClientRects').mockReturnValue(Object.assign([], { item: () => null }));
  const background = document.createElement('button');
  const content = document.createElement('div');
  content.dataset.scope = 'dialog';
  content.dataset.part = 'content';
  content.dataset.state = 'open';
  owner.append(trigger);
  document.body.append(background, owner, content);
  background.focus();
  return { owner, trigger, content, background };
}

describe('общий владелец final focus Dialog и Sheet', () => {
  it('завершает final focus до активации trap, когда открытие не фокусировало trigger', () => {
    const context = fixture();
    completeFailedDialogFocus(context);
    expect(document.activeElement).toBe(context.trigger);
    expect(dialogFinalFocusTarget(context)).toBe(context.trigger);
  });

  it.each([
    'removed',
    'disabled',
    'inert',
    'not-rendered',
    'visibility-hidden',
    'visibility-collapse',
  ])('%s trigger не становится точкой возврата', (state) => {
    const context = fixture();
    if (state === 'removed') context.trigger.remove();
    else if (state === 'disabled') context.trigger.disabled = true;
    else if (state === 'inert') context.owner.setAttribute('inert', '');
    else if (state === 'not-rendered')
      vi.spyOn(context.trigger, 'offsetWidth', 'get').mockReturnValue(0);
    else context.trigger.style.visibility = state === 'visibility-hidden' ? 'hidden' : 'collapse';
    expect(dialogFinalFocusTarget(context)).toBeNull();
    completeFailedDialogFocus(context);
    expect(document.activeElement).toBe(context.background);
  });

  it.each(['shadow', 'slot'])('%s inert ancestor не становится точкой возврата', (ancestry) => {
    const context = fixture();
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    if (ancestry === 'shadow') {
      host.inert = true;
      shadow.append(context.owner);
    } else {
      const blocker = document.createElement('div');
      blocker.inert = true;
      const slot = document.createElement('slot');
      blocker.append(slot);
      shadow.append(blocker);
      host.append(context.owner);
      expect(slot.assignedElements()).toContain(context.owner);
      // HappyDOM теряет assignedSlot; браузер проверяет фактическую связь.
      Object.defineProperty(context.owner, 'assignedSlot', { configurable: true, get: () => slot });
    }
    expect(dialogFinalFocusTarget(context)).toBeNull();
    completeFailedDialogFocus(context);
    expect(document.activeElement).toBe(context.background);
  });

  it('отключённый owner не возвращает фокус даже при живом trigger', () => {
    const context = fixture();
    document.body.append(context.trigger);
    context.owner?.remove();
    expect(dialogFinalFocusTarget(context)).toBeNull();
    completeFailedDialogFocus(context);
    expect(document.activeElement).toBe(context.background);
  });

  it('поздний resolver отключённого owner сохраняет focus самостоятельного modal', () => {
    const context = fixture();
    context.owner.remove();
    const independent = document.createElement('div');
    independent.dataset.scope = 'dialog';
    independent.dataset.part = 'content';
    independent.dataset.state = 'open';
    const action = document.createElement('button');
    independent.append(action);
    document.body.append(independent);
    action.focus();
    expect(dialogFinalFocusTarget(context)).toBe(action);
    completeFailedDialogFocus(context);
    expect(document.activeElement).toBe(action);
  });

  it('из собственного shadow content возвращает deep active focus к trigger', () => {
    const context = fixture();
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.append(input);
    context.content?.append(host);
    input.focus();
    expect(document.activeElement).toBe(host);
    completeFailedDialogFocus(context);
    expect(document.activeElement).toBe(context.trigger);
  });

  it.each(['direct', 'shadow', 'slot'])(
    '%s: самостоятельный modal сохраняет текущий фокус при failure и позднем cleanup',
    (ancestry) => {
      const context = fixture();
      const independent = document.createElement('div');
      independent.dataset.scope = 'dialog';
      independent.dataset.part = 'content';
      independent.dataset.state = 'open';
      const host = document.createElement('div');
      const action = document.createElement('button');
      independent.append(host);
      if (ancestry === 'direct') host.append(action);
      else {
        const shadow = host.attachShadow({ mode: 'open' });
        if (ancestry === 'shadow') shadow.append(action);
        else {
          shadow.append(document.createElement('slot'));
          host.append(action);
        }
      }
      document.body.append(independent);
      action.focus();
      expect(dialogFinalFocusTarget(context)).toBe(action);
      completeFailedDialogFocus(context);
      expect(dialogFinalFocusTarget(context)).toBe(action);
      expect(
        action.getRootNode() instanceof ShadowRoot
          ? host.shadowRoot?.activeElement
          : document.activeElement,
      ).toBe(action);
    },
  );

  it.each(['direct', 'shadow', 'slot'])(
    '%s: surviving parent остаётся допустимым местом возврата к trigger ребёнка',
    (ancestry) => {
      const context = fixture();
      const parent = document.createElement('div');
      parent.dataset.scope = 'dialog';
      parent.dataset.part = 'content';
      parent.dataset.state = 'open';
      const action = document.createElement('button');
      parent.append(action);
      if (ancestry === 'direct') parent.append(context.owner);
      else {
        const wrapper = document.createElement('div');
        const shadow = wrapper.attachShadow({ mode: 'open' });
        parent.append(wrapper);
        if (ancestry === 'shadow') shadow.append(context.owner);
        else {
          shadow.append(document.createElement('slot'));
          wrapper.append(context.owner);
        }
      }
      document.body.append(parent);
      action.focus();
      expect(composedAncestors(context.owner)).toContain(parent);
      expect(dialogFinalFocusTarget(context)).toBe(context.trigger);
      completeFailedDialogFocus(context);
      const root = context.trigger.getRootNode();
      expect(root instanceof ShadowRoot ? root.activeElement : document.activeElement).toBe(
        context.trigger,
      );
    },
  );
});
