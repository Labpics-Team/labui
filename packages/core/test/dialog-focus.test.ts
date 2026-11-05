// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  type DialogFocusContext,
  completeFailedDialogFocus,
  composedAncestors,
  dialogFinalFocusTarget,
} from '../src/components/dialog/focus.js';

afterEach(() => document.body.replaceChildren());

function fixture(): DialogFocusContext & {
  owner: HTMLDivElement;
  content: HTMLDivElement;
  background: HTMLButtonElement;
  trigger: HTMLButtonElement;
} {
  const owner = document.createElement('div');
  const trigger = document.createElement('button');
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

  it.each(['removed', 'disabled', 'inert'])('%s trigger не становится точкой возврата', (state) => {
    const context = fixture();
    if (state === 'removed') context.trigger.remove();
    else if (state === 'disabled') context.trigger.disabled = true;
    else context.owner?.setAttribute('inert', '');
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
