import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';
import { hasCardText } from './regions.js';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Template = DefaultTreeAdapterMap['template'];

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

function isHtmlElement(node: Node): node is Element {
  return isElement(node) && node.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

function isHtmlTemplate(node: Node): node is Template {
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

function meaningful(node: Node): boolean {
  return (
    isElement(node) ||
    (node.nodeName === '#text' && hasCardText((node as DefaultTreeAdapterMap['textNode']).value))
  );
}

/**
 * Lit выводит shadow DOM раньше light children. После единственного render
 * назначение уже известно: меняем только hidden собственных регионов Card.
 * Смещения parse5 относятся к исходной JS-строке; serialize изменил бы caller
 * HTML и гидрационные маркеры, поэтому дерево используется только для чтения.
 */
export function shapeCardRegions(source: string): string {
  if (!/<lab-card[\t\n\f\r />]/i.test(source)) return source;
  const tree = parseFragment(source, { sourceCodeLocationInfo: true });
  const pending: Node[] = [...tree.childNodes];
  const offsets: number[] = [];
  while (pending.length) {
    const node = pending.pop();
    if (!node || !isElement(node)) continue;
    for (const child of node.childNodes) pending.push(child);
    if (isHtmlTemplate(node)) {
      for (const child of node.content.childNodes) pending.push(child);
    }
    if (!isHtmlElement(node) || node.tagName !== 'lab-card') continue;

    const shadow = node.childNodes.find(
      (child): child is Template =>
        isHtmlTemplate(child) && attribute(child, 'shadowrootmode') !== undefined,
    );
    if (!shadow) continue;
    const article = shadow.content.childNodes.find(
      (child): child is Element =>
        isHtmlElement(child) && child.tagName === 'article' && attribute(child, 'part') === 'card',
    );
    // Чужой DSD с тем же именем host не является анатомией Core Card.
    if (!article) continue;
    const content = article.childNodes.find(
      (child): child is Element => isHtmlElement(child) && attribute(child, 'part') === 'content',
    );
    if (!content) throw new Error('Card SSR: отсутствует собственный Content');

    for (const [parent, region, name] of [
      [article, 'media', 'media'],
      [content, 'header', 'header'],
      [content, 'body', ''],
      [content, 'footer', 'footer'],
    ] as const) {
      const wrapper = parent.childNodes.find(
        (child): child is Element => isHtmlElement(child) && hasClass(child, `${region}-region`),
      );
      // imageSrc renders images directly; it has no caller media region.
      if (!wrapper && region === 'media') continue;
      const slot = wrapper?.childNodes.find(
        (child): child is Element =>
          isHtmlElement(child) &&
          child.tagName === 'slot' &&
          (attribute(child, 'name') ?? '') === name,
      );
      if (!wrapper || !slot || !wrapper.sourceCodeLocation?.startTag) {
        throw new Error(`Card SSR: отсутствует собственный регион ${region}`);
      }
      const assigned = node.childNodes.filter((child) => {
        if (child === shadow) return false;
        if (isElement(child)) return (attribute(child, 'slot') ?? '') === name;
        return name === '' && child.nodeName === '#text';
      });
      const present = (assigned.length ? assigned : slot.childNodes).some(meaningful);
      if (!present && attribute(wrapper, 'hidden') === undefined) {
        offsets.push(wrapper.sourceCodeLocation.startTag.endOffset - 1);
      }
    }
  }
  if (!offsets.length) return source;
  offsets.sort((a, b) => a - b);
  const parts: string[] = [];
  let start = 0;
  for (const offset of offsets) {
    parts.push(source.slice(start, offset), ' hidden');
    start = offset;
  }
  parts.push(source.slice(start));
  return parts.join('');
}
