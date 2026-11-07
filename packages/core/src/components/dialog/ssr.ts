import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';
import { isInteractiveTriggerLabelElement } from './trigger-label.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Template = DefaultTreeAdapterMap['template'];

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function isTemplate(node: Node): node is Template {
  return (
    isElement(node) &&
    node.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
    node.tagName === 'template' &&
    'content' in node
  );
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

function assertLabel(nodes: readonly Node[]): void {
  const pending = [...nodes];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !isElement(node)) continue;
    if (isInteractiveTriggerLabelElement(node.tagName, (name) => attribute(node, name))) {
      throw new TypeError(
        'LabModal SSR: interactive children require one button in slot="trigger".',
      );
    }
    // template content инертен, включая собственный DSD выбранного LabButton.
    pending.push(...node.childNodes);
  }
}

function ownTriggerSlot(shadow: Template): Element | undefined {
  const pending = [...shadow.content.childNodes];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !isElement(node)) continue;
    if (
      node.tagName === 'slot' &&
      node.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
      attribute(node, 'name') === 'trigger' &&
      attribute(node, 'data-projection') === 'direct'
    ) {
      return node;
    }
    pending.push(...node.childNodes);
  }
}

/** Server render проверяет тот же slot contract до отдачи HTML, без DOM runtime. */
export function assertModalTriggerMarkup(source: string): void {
  if (!/<lab-(?:sheet|dialog|alert-dialog)[\t\n\f\r />]/i.test(source)) return;
  const tree = parseFragment(source);
  const pending: Node[] = [...tree.childNodes];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !isElement(node)) continue;
    pending.push(...node.childNodes);
    if (isTemplate(node)) pending.push(...node.content.childNodes);
    if (
      node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      !['lab-sheet', 'lab-dialog', 'lab-alert-dialog'].includes(node.tagName)
    )
      continue;
    const shadow = node.childNodes.find(
      (child): child is Template =>
        isTemplate(child) && attribute(child, 'shadowrootmode') !== undefined,
    );
    if (!shadow || !ownTriggerSlot(shadow)) continue;
    assertLabel(
      node.childNodes.filter(
        (child) => child !== shadow && (!isElement(child) || !attribute(child, 'slot')),
      ),
    );
    const assigned = node.childNodes.filter(
      (child): child is Element =>
        child !== shadow && isElement(child) && attribute(child, 'slot') === 'trigger',
    );
    const trigger = assigned[0];
    if (assigned.length) {
      if (
        assigned.length !== 1 ||
        !trigger ||
        !['button', 'lab-button'].includes(trigger.tagName)
      ) {
        throw new TypeError(
          'LabModal SSR: slot="trigger" requires one LabButton or native button.',
        );
      }
      const nativeType = attribute(trigger, trigger.tagName === 'button' ? 'type' : 'html-type');
      if (
        (trigger.tagName === 'button' && nativeType !== 'button') ||
        (nativeType && nativeType !== 'button')
      ) {
        throw new TypeError('LabModal SSR: trigger must keep native type="button".');
      }
      assertLabel(trigger.childNodes);
    }
  }
}
