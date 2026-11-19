import { readFile } from 'node:fs/promises';
const tokens = JSON.parse(
  await readFile(new URL('../src/generated/tokens.dtcg.json', import.meta.url), 'utf8'),
);
const fluid = tokens['letter-spacing'].md.$value * tokens['font-size'].md.$value.value;
console.info('The fluid scale is a configurable approximation, not authored style parity.');
for (const [name, style] of Object.entries(tokens.typography)) {
  const tracking = style.$value.letterSpacing.value;
  console.info(
    `${name}: ${style.$value.fontWeight} ${style.$value.fontSize.value}px / ${style.$value.fontSize.value * style.$value.lineHeight}px, tracking ${tracking}px; source ${style.$extensions['com.labpics.ui-tokens'].sourceNode}`,
  );
  if (style.$value.fontSize.value === 16)
    console.info(
      `  Replacing this with fluid md tracking (${fluid}px) drifts by ${((fluid - tracking) * 100).toFixed(2)}px across 100 intervals.`,
    );
}
