import MagicString from 'magic-string';
import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';
import {
  type SwitchLabelContent,
  switchLabelContents,
  switchLabelElementContent,
} from './label-content.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Template = DefaultTreeAdapterMap['template'];

function isHtmlElement(node: Node): node is Element {
  return 'tagName' in node && node.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

function isTemplate(node: Node): node is Template {
  return isHtmlElement(node) && node.tagName === 'template' && 'content' in node;
}

function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function hasClass(node: Element, name: string): boolean {
  return (
    attribute(node, 'class')
      ?.split(/[\t\n\f\r ]+/)
      .includes(name) ?? false
  );
}

function labelContent(node: Node): SwitchLabelContent {
  if ('tagName' in node) {
    return switchLabelElementContent(
      node.tagName,
      () => switchLabelContents(node.childNodes.map(labelContent)),
      (name) => attribute(node, name),
      () => {
        if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || node.tagName !== 'svg')
          return 'unknown';
        const title = node.childNodes.find(
          (child) =>
            'tagName' in child &&
            child.namespaceURI === node.namespaceURI &&
            child.tagName === 'title',
        );
        return title ? nativeTextContent(title) : 'empty';
      },
    );
  }
  return node.nodeName === '#text' && 'value' in node && node.value.trim() ? 'present' : 'empty';
}

function nativeTextContent(node: Node): SwitchLabelContent {
  if ('childNodes' in node) return switchLabelContents(node.childNodes.map(nativeTextContent));
  return node.nodeName === '#text' && 'value' in node && node.value.trim() ? 'present' : 'empty';
}

function escaped(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/**
 * Тот же source-offset путь, что Card: Lit уже вывел light DOM и DSD.
 * Дерево только читается; правим собственные атрибуты Switch, сохраняя HTML,
 * escaping контента и гидрационные маркеры. Второго render/serialize нет.
 */
export function shapeSwitchLabels(source: string): string {
  if (!/<lab-switch[\t\n\f\r />]/i.test(source)) return source;
  const output = new MagicString(source);
  const pending: Node[] = [...parseFragment(source, { sourceCodeLocationInfo: true }).childNodes];

  function setAttribute(node: Element, name: string, value: string | undefined): void {
    if (attribute(node, name) === value) return;
    const location = node.sourceCodeLocation;
    if (!location?.startTag) throw new Error('Switch SSR: отсутствует собственный start tag');
    const existing = location.attrs?.[name];
    const replacement = value === undefined ? '' : `${name}="${escaped(value)}"`;
    if (existing) {
      output.overwrite(existing.startOffset, existing.endOffset, replacement);
    } else if (replacement) {
      const end = location.startTag.endOffset;
      output.appendLeft(source[end - 2] === '/' ? end - 2 : end - 1, ` ${replacement}`);
    }
  }

  while (pending.length) {
    const node = pending.pop();
    if (!node || !('tagName' in node)) continue;
    for (const child of node.childNodes) pending.push(child);
    if (isTemplate(node)) for (const child of node.content.childNodes) pending.push(child);
    if (!isHtmlElement(node) || node.tagName !== 'lab-switch') continue;

    const shadow = node.childNodes.find(
      (child): child is Template =>
        isTemplate(child) && attribute(child, 'shadowrootmode') !== undefined,
    );
    const root = shadow?.content.childNodes.find(
      (child): child is Element =>
        isHtmlElement(child) &&
        child.tagName === 'label' &&
        hasClass(child, 'root') &&
        attribute(child, 'data-lab-switch') !== undefined,
    );
    if (!root) continue;
    const input = root.childNodes.find(
      (child): child is Element => isHtmlElement(child) && child.tagName === 'input',
    );
    const start = root.childNodes.find(
      (child): child is Element => isHtmlElement(child) && hasClass(child, 'label-start'),
    );
    const end = root.childNodes.find(
      (child): child is Element => isHtmlElement(child) && hasClass(child, 'label-end'),
    );
    const slot = end?.childNodes.find(
      (child): child is Element =>
        isHtmlElement(child) && child.tagName === 'slot' && !(attribute(child, 'name') ?? ''),
    );
    if (!input || !start || !end || !slot)
      throw new Error('Switch SSR: отсутствует собственная анатомия');

    const assigned = node.childNodes.filter((child) => {
      if (child === shadow) return false;
      if ('tagName' in child) return !(attribute(child, 'slot') ?? '');
      return child.nodeName === '#text';
    });
    const content = [
      switchLabelContents(start.childNodes.map(labelContent)),
      switchLabelContents((assigned.length ? assigned : slot.childNodes).map(labelContent)),
    ];
    const hidden = [
      attribute(node, 'hide-label-start') !== undefined,
      attribute(node, 'hide-label-end') !== undefined,
    ];
    const ids: string[] = [];
    for (const [index, label] of [start, end].entries()) {
      setAttribute(label, 'hidden', !hidden[index] && content[index] !== 'empty' ? undefined : '');
      if (hidden[index] || content[index] !== 'present') continue;
      const id = attribute(label, 'id');
      if (!id) throw new Error('Switch SSR: отсутствует ID видимой подписи');
      ids.push(id);
    }
    setAttribute(input, 'aria-labelledby', ids.length ? ids.join(' ') : undefined);
    setAttribute(input, 'aria-label', ids.length ? undefined : attribute(node, 'aria-label'));
  }
  return output.toString();
}
