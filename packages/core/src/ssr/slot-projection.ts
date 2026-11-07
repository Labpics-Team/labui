import { type DefaultTreeAdapterMap, parseFragment } from 'parse5';

/** Named direct slot сохраняет настоящий элемент и исходные hydration markers. */
export function projectSingleSlot(source: string | undefined, name: string): string {
  if (source === undefined) return '';
  if (typeof source !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new TypeError('LabUI SSR: invalid direct slot input.');
  }
  const tree = parseFragment(source, { sourceCodeLocationInfo: true });
  const nodes = tree.childNodes.filter(
    (node) =>
      node.nodeName !== '#comment' &&
      !(node.nodeName === '#text' && 'value' in node && !node.value.trim()),
  );
  const node = nodes[0];
  if (
    nodes.length !== 1 ||
    !node ||
    !('tagName' in node) ||
    node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
  ) {
    throw new TypeError('LabUI SSR: a direct slot requires exactly one HTML element.');
  }
  const element: DefaultTreeAdapterMap['element'] = node;
  const assigned = element.attrs.find((attribute) => attribute.name === 'slot');
  if (assigned) {
    if (assigned.value !== name) {
      throw new TypeError('LabUI SSR: direct slot element already belongs to another slot.');
    }
    return source;
  }
  const end = element.sourceCodeLocation?.startTag?.endOffset;
  if (end === undefined) throw new TypeError('LabUI SSR: direct slot start tag is unavailable.');
  const offset = source[end - 2] === '/' ? end - 2 : end - 1;
  return `${source.slice(0, offset)} slot="${name}"${source.slice(offset)}`;
}
