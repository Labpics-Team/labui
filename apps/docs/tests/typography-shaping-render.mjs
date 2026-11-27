import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';

const root = new URL('../../../', import.meta.url);
const output = new URL('docs/evidence/accordion-typography-20261119/', root);
const font = await readFile(new URL('packages/fonts/fonts/Geist-Variable.woff2', root));
const { roles } = JSON.parse(await readFile(new URL('packages/tokens/src/text-styles.json', root)));
const ligatures = 'office affiliation efficient pattern';
const cases = [
  { id: 'body', role: 'body', text: 'Yes. It adheres to the WAI-ARIA design pattern.' },
  { id: 'body-cyrillic', role: 'body', text: 'Общий доступ к проекту и материалам' },
  { id: 'body-ligatures', role: 'body', text: ligatures },
  { id: 'emphasized', role: 'body-emphasized', text: ligatures },
  { id: 'headline', role: 'headline', text: ligatures },
  { id: 'caption', role: 'caption-xs', text: ligatures },
  { id: 'body-zero', role: 'body', text: ligatures, letterSpacing: 0 },
  { id: 'body-positive', role: 'body', text: ligatures, letterSpacing: 0.25 },
  { id: 'emphasized-negative', role: 'body-emphasized', text: ligatures, letterSpacing: -0.25 },
];
const records = [];
for (const [engine, driver] of Object.entries({ chromium, webkit })) {
  const browser = await driver.launch({ headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.setContent(
      '<style>body{margin:0}#row{width:max-content;font-synthesis:none}i{display:inline-block;width:0;height:0;vertical-align:baseline}</style><div id="row"><span id="text"></span><i></i></div>',
    );
    await page.evaluate(async (data) => {
      const face = new FontFace('LabGeistShaping', `url(data:font/woff2;base64,${data})`, {
        weight: '100 900',
      });
      document.fonts.add(face);
      await face.load();
    }, font.toString('base64'));
    for (const sample of cases) {
      const style = {
        ...roles[sample.role],
        letterSpacing: sample.letterSpacing ?? roles[sample.role].letterSpacing,
      };
      const measured = await page.evaluate(
        ({ style, text }) => {
          const row = document.querySelector('#row');
          const el = document.querySelector('#text');
          row.style.cssText = `font:${style.fontWeight} ${style.fontSize}px/${style.lineHeight}px LabGeistShaping;letter-spacing:${style.letterSpacing}px`;
          el.textContent = text;
          const range = document.createRange();
          range.selectNodeContents(el);
          const box = row.getBoundingClientRect();
          return {
            width: range.getBoundingClientRect().width,
            baseline: row.querySelector('i').getBoundingClientRect().y - box.y,
            linebox: box.height,
          };
        },
        { style, text: sample.text },
      );
      records.push({ ...sample, style, engine, browser: browser.version(), ...measured });
    }
  } finally {
    await browser.close();
  }
}
await mkdir(output, { recursive: true });
await writeFile(
  new URL('browser-shaping.json', output),
  `${JSON.stringify(
    {
      fontSha256: createHash('sha256').update(font).digest('hex'),
      records,
    },
    null,
    2,
  )}\n`,
);

// Updating the independent native reference is explicit, never part of the test run.
if (process.argv.includes('--update-fixtures')) {
  const lines = ['id\trole\ttracking\ttext\tchromiumWidth\twebkitWidth'];
  for (const sample of records.filter((row) => row.engine === 'chromium')) {
    const other = records.find((row) => row.engine === 'webkit' && row.id === sample.id);
    lines.push(
      [
        sample.id,
        sample.role,
        sample.style.letterSpacing,
        sample.text,
        sample.width,
        other.width,
      ].join('\t'),
    );
  }
  await writeFile(
    new URL('native/compose/src/desktopTest/resources/typography-shaping.tsv', root),
    `${lines.join('\n')}\n`,
  );
}
console.info(`Measured ${records.length} browser cases with the bundled Geist.`);
