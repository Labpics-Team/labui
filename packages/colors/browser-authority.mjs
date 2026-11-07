const scopeAttribute = 'data-lab-colors-scope';

/** Один inline-владелец отделяет авторские намерения от опубликованных outputs. */
export function createInlineAuthority(scope, names) {
  const drafts = new Map();
  const installed = new Map();
  const read = (name) => ({
    declaration: scope.style.getPropertyValue(name).trim(),
    priority: scope.style.getPropertyPriority(name),
  });
  const equal = (left, right) =>
    right !== undefined &&
    left.declaration === right.declaration &&
    left.priority === right.priority;
  let restored = false;
  const capture = () => {
    for (const name of names) {
      const value = read(name);
      if (!installed.has(name) || !equal(value, installed.get(name))) drafts.set(name, value);
    }
  };
  const write = (values) => {
    if (restored) return;
    capture();
    // Один cssText присваивает полный слой; несвязанные inline свойства остаются текущими.
    const prepared = scope.ownerDocument.createElement('div').style;
    prepared.cssText = scope.style.cssText;
    for (const name of names) prepared.setProperty(name, values.get(name), 'important');
    scope.style.cssText = prepared.cssText;
    for (const name of names) installed.set(name, read(name));
  };
  const masking = new Map(names.map((name) => [name, 'initial']));
  const id = scope.ownerDocument.defaultView.crypto.randomUUID();
  let root = scope.getRootNode();
  return {
    id,
    inputs() {
      capture();
      return names
        .filter((name) => drafts.get(name)?.declaration)
        .sort()
        .map((name) => ({
          name: name.slice('--lab-'.length),
          ...drafts.get(name),
        }));
    },
    isCurrent() {
      return (
        scope.isConnected &&
        scope.getRootNode() === root &&
        scope.getAttribute(scopeAttribute) === id &&
        names.every((name) => equal(read(name), installed.get(name)))
      );
    },
    acquire() {
      root = scope.getRootNode();
      scope.setAttribute(scopeAttribute, id);
      write(masking);
    },
    publish: write,
    revoke() {
      // Отзыв не зависит от потерянного marker, sheet или старого style root.
      write(masking);
    },
    dispose() {
      if (restored) return;
      capture();
      const prepared = scope.ownerDocument.createElement('div').style;
      prepared.cssText = scope.style.cssText;
      for (const name of names) {
        if (!equal(read(name), installed.get(name))) continue;
        const draft = drafts.get(name);
        if (draft?.declaration) prepared.setProperty(name, draft.declaration, draft.priority);
        else prepared.removeProperty(name);
      }
      scope.style.cssText = prepared.cssText;
      if (scope.getAttribute(scopeAttribute) === id) scope.removeAttribute(scopeAttribute);
      restored = true;
    },
  };
}
