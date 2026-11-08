// Keep both fixture generators byte-stable with the repository's JSON format.
export function serializeBackdropFixture(descriptor) {
  const json = JSON.stringify(descriptor, null, 2);
  const rgba = JSON.stringify(descriptor.replacementRgba).replaceAll(',', ', ');
  return `${json.replace(/"replacementRgba": \[[^\]]*\]/, `"replacementRgba": ${rgba}`)}\n`;
}
