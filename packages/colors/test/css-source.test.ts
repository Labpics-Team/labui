import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { consumedNamesInSource } from './consumed-contract.js';
import { cssImports, stripComments } from './css-source.js';
import { scanSource } from './no-hardcoded-colour.js';
import { componentFiles, scanDimensionSource } from './no-magic-dimension.js';
import { scanZIndexSource } from './no-magic-zindex.js';

describe('the scanners share actual TS and CSS source boundaries', () => {
  const leak =
    '.x { background: url(https://cdn.test/a.png); width: 45px; z-index: 9999; color: #fff; gap: var(--lab-space-unknown); }';

  it.each([
    ['quoted string', `const styles = ${JSON.stringify(leak)};`],
    ['single quoted string', `const styles = '${leak}';`],
    ['template', `const styles = \`${leak}\`;`],
    ['tagged template', `const styles = css\`${leak}\`;`],
    ['template with interpolation', `const styles = css\`\${base}\n${leak}\`;`],
    ['protocol relative URL', `const styles = \`${leak.replace('https:', '')}\`;`],
  ])('does not hide trailing declarations after a URL in a %s', (_name, source) => {
    expect(scanDimensionSource('p.ts', source).map((hit) => hit.token)).toEqual(['45px']);
    expect(scanZIndexSource('p.ts', source).map((hit) => hit.rule)).toEqual(['magic-zindex']);
    expect(scanSource('p.ts', source).map((hit) => hit.token)).toEqual(['#fff']);
    expect(consumedNamesInSource('p.ts', source).map((hit) => hit.name)).toEqual([
      '--lab-space-unknown',
    ]);
  });

  it('removes comments in both languages, including nested templates, without changing offsets', () => {
    const source = [
      '// width: 77px; color: #bad; var(--lab-comment)',
      'const styles = css`.x { /* width: 88px; color: #bad; */',
      '  content: "https://a/*literal*/"; width: 45px;',
      '  color: ${pick(/* #bad */ `rgb(${r} ${g} ${b})`)};',
      '}`; // color: #bad;',
    ].join('\n');
    const clean = stripComments(source, true);
    expect(clean).toHaveLength(source.length);
    expect(clean.split('\n')).toHaveLength(source.split('\n').length);
    expect(clean).not.toContain('#bad');
    expect(clean).toContain('https://a/*literal*/');
    expect(scanDimensionSource('p.ts', source)).toMatchObject([{ token: '45px', line: 3 }]);
    expect(scanSource('p.ts', source)).toEqual([]);
  });

  it('recognizes multiline generated CSS comments in arrays joined into styles', () => {
    const source = [
      'function stylesheet() {',
      '  const lines = ["/*", "color: #bad;", "*/", ".x { color: #fff; }"];',
      '  return lines.join("\\n");',
      '}',
      'const other = ["/*", "#abc"];',
      'const live = ".y { color: #fed; }";',
    ].join('\n');
    expect(scanSource('p.ts', source).map((hit) => hit.token)).toEqual(['#fff', '#abc', '#fed']);
  });
});

describe('local integer layers need an effective isolation declaration', () => {
  const child = '.surface .paint { z-index: 1; }';
  it.each([
    `.surface { isolation: isolate; isolation: auto; } ${child}`,
    `.surface { isolation: isolate; all: unset; } ${child}`,
    `.surface { isolation: isolate; } .surface:hover { isolation: auto; } ${child}`,
    `.surface { isolation: isolate; } .surface { isolation: auto; } ${child}`,
    `.surface { isolation: isolate; @media (min-width: 1px) { isolation: auto; } } ${child}`,
    `.surface { @media (min-width: 1px) { isolation: isolate; } } ${child}`,
    `.surface { isolation: auto !important; isolation: isolate; } ${child}`,
    `.surface { isolation: isolate !important; isolation: auto !important; } ${child}`,
    `@supports (isolation: isolate) { .surface { isolation: isolate; } } ${child}`,
    '.surface { isolation: isolate; & + .paint { z-index: 1; } }',
    '.surface { isolation: isolate; } .surface, .surface .paint { z-index: 1; }',
    'const a = `.surface { isolation: isolate; }`; const b = `.surface .paint { z-index: 1; }`;',
  ])('rejects an unproved local stack: %s', (source) => {
    expect(scanZIndexSource(source.startsWith('const ') ? 'p.ts' : 'p.css', source)).toMatchObject([
      { rule: 'magic-zindex' },
    ]);
  });

  it.each([
    `.surface { isolation: auto; isolation: isolate; } ${child}`,
    `.surface { isolation: isolate !important; isolation: auto; } ${child}`,
    `.surface { isolation: isolate; } ${child.replace('1;', '1 !important;')}`,
    '.surface { isolation: isolate; & .paint { z-index: -2; } }',
    '.surface { isolation: isolate; .paint { z-index: -2; } }',
    '.surface { isolation: isolate; @media (min-width: 1px) { & > .paint { z-index: -2; } } }',
    `@media (min-width: 1px) { .surface { isolation: isolate; } ${child} }`,
    `@media (min-width: 1px) { .surface { isolation: isolate; } } @media (min-width: 1px) { ${child} }`,
    `@supports (isolation: isolate) { .surface { isolation: isolate; } ${child} }`,
    '.one, .two { isolation: isolate; & > .paint { z-index: 1; } }',
    'const styles = css`.surface { isolation: isolate; & > .paint { z-index: 1; } }`;',
  ])('accepts a proved local stack: %s', (source) => {
    expect(scanZIndexSource(source.startsWith('const ') ? 'p.ts' : 'p.css', source)).toEqual([]);
  });
});

describe('exceptions require complete static CSS in the source', () => {
  it.each([
    "const mode = 'active'; function stylesheet(mode) { return `@media (forced-colors: ${mode}) { .x { color: CanvasText; } }`; } stylesheet('none');",
    "const mode = 'active'; { const mode = 'none'; const css = `@media (forced-colors: ${mode}) { .x { color: CanvasText; } }`; }",
    "const prefs = { mode: 'active' }; const alias = prefs; alias.mode = 'none'; const css = `@media (forced-colors: ${prefs.mode}) { .x { color: CanvasText; } }`;",
    "const prefs = { mode: 'active' }; Object.assign(prefs, { mode: 'none' }); const css = `@media (forced-colors: ${prefs.mode}) { .x { color: CanvasText; } }`;",
    "const prefs = { mode: 'active' }; update(prefs); const css = `@media (forced-colors: ${prefs.mode}) { .x { color: CanvasText; } }`;",
    "Object.entries = () => [['mode', 'none']]; const css = `@media (forced-colors: ${Object.entries({ mode: 'active' }).map(([, value]) => value).join('')}) { .x { color: CanvasText; } }`;",
    "const mode = 'active'; function stylesheet(Object) { return `@media (forced-colors: ${Object.entries({ mode }).map(([, value]) => value).join('')}) { .x { color: CanvasText; } }`; }",
  ])('keeps system paint visible when a binding or object is not proved: %s', (source) => {
    expect(scanSource('p.ts', source).map((hit) => hit.token)).toEqual(['CanvasText']);
  });

  it('resolves an unshadowed primitive const while preserving a formatter lexical scope', () => {
    expect(
      scanSource(
        'p.ts',
        "const mode = 'active'; const css = `@media (forced-colors: ${mode}) { .x { color: CanvasText; } }`;",
      ),
    ).toEqual([]);
    const source =
      "const mode = 'none'; const read = () => mode; const css = `@media (forced-colors: ${['active'].map((mode) => read()).join('')}) { .x { color: CanvasText; } }`;";
    expect(scanSource('p.ts', source).map((hit) => hit.token)).toEqual(['CanvasText']);
  });

  it.each([
    'const alias = p; alias.padding = 77;',
    'const alias = p.tail; alias.width = 77;',
    'Object.assign(p, { padding: 77 });',
    'update(p);',
    'update(p.tail);',
    'export { p };',
    'p.padding++;',
    'delete p.padding;',
    '({ padding: p.padding } = { padding: 77 });',
    '[p.padding] = [77];',
    'p.shadow.map((layer) => layer.x = 77);',
    'p.shadow.map(update);',
  ])('revokes profile syntax proof after mutation or object escape: %s', (change) => {
    const source = `import { tooltipProfile as p } from '@labpics/ui-tokens'; ${change} const css = \`.surface { isolation: isolate; padding: \${p.padding}px; } .surface::before { z-index: -1; }\`;`;
    expect(scanZIndexSource('p.ts', source)).toMatchObject([{ rule: 'magic-zindex' }]);
  });

  it('resolves imported authored profiles and pure formatters without executing source', () => {
    const prefix =
      "import { tooltipProfile as p } from '@labpics/ui-tokens'; const rem = (n: number) => `${n / 16}rem`;";
    const styles =
      'const styles = `.surface { isolation: isolate; padding: ${rem(p.padding)}; } .surface::before { z-index: -1; }`;';
    expect(scanZIndexSource('p.ts', prefix + styles)).toEqual([]);
    expect(scanZIndexSource('p.ts', styles)).toMatchObject([{ rule: 'magic-zindex' }]);
    expect(
      scanZIndexSource('p.ts', `${prefix} p.padding = readUserValue(); ${styles}`),
    ).toMatchObject([{ rule: 'magic-zindex' }]);
    expect(
      scanZIndexSource(
        'p.ts',
        `${prefix} const reset = '.surface { isolation: auto; }'; ${styles.replace('`;', '${reset}`;')}`,
      ),
    ).toMatchObject([{ rule: 'magic-zindex' }]);
  });

  it('proves a complete forced-colors block even when another rule is dynamic', () => {
    const prefix =
      "import { dialogProfile as p } from '@labpics/ui-tokens'; const rem = (n: number) => `${n / 16}rem`;";
    const block =
      '@media (forced-colors: active) { .x { outline: ${rem(p.strokeWidth)} solid CanvasText; } }';
    expect(scanSource('p.ts', `${prefix} const styles = \`\${unknown}\n${block}\`;`)).toEqual([]);
    expect(
      scanSource(
        'p.ts',
        `${prefix} const styles = \`${block.replace('.x {', '${unknown} .x {')}\`;`,
      ),
    ).toHaveLength(1);
  });

  it.each([
    '.surface${suffix} { isolation: isolate; } .surface .paint { z-index: 9999; }',
    '.surface { isolation: isolate; ${reset} } .surface .paint { z-index: 9999; }',
    ".surface { isolation: isolate; color: ${litVar('--lab-label-primary')}; } .surface .paint { z-index: 9999; }",
  ])('does not prove isolation by removing interpolation: %s', (css) => {
    expect(scanZIndexSource('p.ts', `const styles = css\`${css}\`;`)).toMatchObject([
      { rule: 'magic-zindex' },
    ]);
  });

  it.each([
    '@media (forced-colors: active)${condition} { .x { color: CanvasText; } }',
    '@media (forced-colors: active) { ${rules} .x { color: CanvasText; } }',
  ])('does not prove the forced palette through interpolation: %s', (css) => {
    expect(scanSource('p.ts', `const styles = css\`${css}\`;`).map((hit) => hit.token)).toEqual([
      'CanvasText',
    ]);
  });

  it.each(['isolation: auto', 'all: unset'])(
    'a reset in another literal cancels isolation irrespective of composition order: %s',
    (reset) => {
      const styles =
        'const styles = `.surface { isolation: isolate; } .surface .paint { z-index: 9999; }`;';
      const overrides = `const overrides = \`.surface { ${reset}; }\`;`;
      for (const source of [
        `${styles} ${overrides} const all = [styles, overrides];`,
        `${overrides} ${styles} const all = [styles, overrides];`,
      ]) {
        expect(scanZIndexSource('p.ts', source)).toMatchObject([{ rule: 'magic-zindex' }]);
      }
    },
  );

  it.each([
    [
      'quoted cooked',
      'const styles = ".surface { isolation: isolate; }\\n.surface .paint { z-index: 1; }";',
    ],
    [
      'template cooked',
      'const styles = `.surface { isolation: isolate; }\\n.surface .paint { z-index: 1; }`;',
    ],
    [
      'String.raw',
      'const styles = String.raw`.surface { isolation: isolate; }\n.surface .paint { z-index: 1; }`;',
    ],
    [
      'single complete array literal',
      'const styles = [".surface { isolation: isolate; }\\n.surface .paint { z-index: 1; }"].join("\\n");',
    ],
  ])('reads %s CSS using its actual string semantics', (_kind, source) => {
    expect(scanZIndexSource('p.ts', source)).toEqual([]);
  });

  it('keeps backslash sequences raw for String.raw and reports cooked findings at the literal start', () => {
    expect(
      scanZIndexSource(
        'p.ts',
        'const styles = String.raw`.surface { isolation: isolate; }\\n.surface .paint { z-index: 1; }`;',
      ),
    ).toMatchObject([{ rule: 'magic-zindex' }]);
    const source =
      'const prefix = true;\nconst styles = ".x {\\n z-index: 9999;\\n color: #fff; }";';
    expect(scanZIndexSource('p.ts', source)).toMatchObject([{ rule: 'magic-zindex', line: 2 }]);
    expect(scanSource('p.ts', source)).toMatchObject([{ token: '#fff', line: 2 }]);
    const palette =
      'const styles = "@media (forced-colors: active) {\\n .x { color: CanvasText; }\\n }";';
    expect(scanSource('p.ts', palette)).toEqual([]);
  });
});

describe('forced palette is a condition proof, not a header spelling', () => {
  it.each([
    'screen and (forced-colors: active)',
    'only screen and (forced-colors: active)',
    '(forced-colors: active) and (min-width: 1px)',
    '((forced-colors: active) and (min-width: 1px))',
    'screen and (forced-colors: active), print and (forced-colors: active)',
    '((forced-colors: active) or (forced-colors: active))',
  ])('accepts system paint when every branch entails active forced colours: %s', (query) => {
    const source = `@media ${query} { .x { color: CanvasText; } }`;
    expect(scanSource('p.css', source)).toEqual([]);
    expect(scanSource('p.ts', `const styles = css\`${source}\`;`)).toEqual([]);
  });
  it.each([
    'not screen and (forced-colors: active)',
    'not (forced-colors: active)',
    '(forced-colors: active), screen',
    '(forced-colors: active) or (min-width: 1px)',
    '(forced-colors: none)',
  ])(
    'keeps system paint visible when a branch does not imply active forced colours: %s',
    (query) => {
      expect(scanSource('p.css', `@media ${query} { .x { color: CanvasText; } }`)).toHaveLength(1);
    },
  );
});

describe('RGB serialization reads runtime expressions, not TypeScript annotations', () => {
  it.each([
    '0 as Channel',
    '0 satisfies Channel',
    '<Channel>0',
    '(0 as Channel)!',
    'Number<Channel>(0)',
    '(0).valueOf()',
    '[0][channel]',
  ])('rejects static channel %s', (channel) => {
    expect(
      scanSource('p.ts', `const fill = \`rgb(\${${channel}} \${${channel}} \${${channel}})\`;`),
    ).toHaveLength(1);
  });
  it.each(['c.r as Channel', 'c.r satisfies Channel', '(c.r)!', 'Number<Channel>(c.r)'])(
    'allows runtime channel %s',
    (channel) => {
      expect(
        scanSource('p.ts', `const fill = \`rgb(\${${channel}} \${${channel}} \${${channel}})\`;`),
      ).toEqual([]);
    },
  );
});

it('follows every local CSS import form through the actual component graph, once per file', () => {
  const root = mkdtempSync(join(tmpdir(), 'labui-css-imports-'));
  const files: Record<string, string> = {
    'packages/core/src/components/probe/lab-probe.ts': 'import "./styles.css"; import "lit";',
    'packages/core/src/components/probe/styles.css':
      '@import "quoted.css"; @import url(bare.css); @import url("./double.css") layer(base); @import url(\'./single.css\') screen; @import "https://cdn.test/external.css"; @import url(//cdn.test/external.css);',
    'packages/core/src/components/probe/quoted.css': '@import "./styles.css";',
    'packages/core/src/components/probe/bare.css': '.x { width: 45px; }',
    'packages/core/src/components/probe/double.css': '.x { width: 46px; }',
    'packages/core/src/components/probe/single.css': '.x { width: 47px; }',
  };
  try {
    for (const [path, source] of Object.entries(files)) {
      const file = resolve(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, source);
    }
    const actual = componentFiles('probe', root);
    expect(actual).toEqual(Object.keys(files).sort());
    expect(
      actual
        .flatMap((path) => scanDimensionSource(path, readFileSync(resolve(root, path), 'utf8')))
        .map((hit) => hit.token)
        .sort(),
    ).toEqual(['45px', '46px', '47px']);
    expect(
      cssImports('/* @import "./comment.css"; */ @import url(https://cdn.test/style.css);'),
    ).toEqual(['https://cdn.test/style.css']);
  } finally {
    // root is the exact directory returned by mkdtempSync, never a computed parent.
    rmSync(root, { recursive: true });
  }
});
