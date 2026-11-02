import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import * as dotsConsumer from './icons-authored-dots-consumer.mjs';
import {
  AUTHORED_DOT_ENTRIES,
  assertContourPose,
  assertDotVariation,
  authoredDotsFixture,
  authoredDotsTypeFixture,
  rawDotOperands,
  scalarSequenceSteps,
  validateAuthoredDotsReference,
} from './icons-authored-dots-consumer.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { authoredDotsReference } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-authored-dots-masters.json', import.meta.url)),
);
const pin = { sourceCommit: snapshot.sourceCommit, figma: snapshot.annotations.source };

async function fixture(t, change = () => {}) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-authored-dots-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.ok(basename(resolved).startsWith('labui-authored-dots-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const data = structuredClone(snapshot);
  change(data);
  const files = {
    'semantics/figma-baseline.json': JSON.stringify(data.manifest),
    'semantics/author-anatomy.json': JSON.stringify(data.annotations),
    'semantics/author-state-groups.json': data.semantics,
    'semantics/grid.json': data.grid,
    ...data.masters,
  };
  for (const [file, bytes] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  return root;
}

test('schema5 extends actual public entries and keeps every schema4 primitive', () => {
  assert.deepEqual(consumerPublicEntries(5), [
    ...consumerPublicEntries(4),
    ...AUTHORED_DOT_ENTRIES,
  ]);
  for (const entry of AUTHORED_DOT_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/ir'));
  assert.throws(() => assertIconsImport('@labpics/icons/private/contour-runtime'));
  assert.ok(consumerFixture(5).includes(authoredDotsFixture()));
  assert.ok(!consumerFixture(4).includes('contourConsumers'));
  const parsed = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: consumerFixture(5),
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('external type consumer uses both variants and meaningful rejected public requests', () => {
  const source = authoredDotsTypeFixture();
  for (const entry of AUTHORED_DOT_ENTRIES) assert.ok(source.includes(entry));
  assert.equal(source.match(/@ts-expect-error/g).length, 3);
  assert.ok(!source.includes('/dist/'));
  assert.ok(!source.includes('/ir/contour-runtime'));
});

// В 420bfe0 download helper попал внутрь TypeScript literal: TS7006/TS2304/TS2591,
// а внешний модуль не имел вызываемого downloadedSvg. Эти два наблюдения связаны.
test('type fixture remains consumer code and compiles strict NodeNext without Node orchestration', async (t) => {
  const source = authoredDotsTypeFixture();
  const root = await fixture(t);
  const modules = {
    'node_modules/@labpics/icons/package.json': JSON.stringify({
      name: '@labpics/icons',
      type: 'module',
      exports: {
        './symbols/ellipsis-horizontal': { types: './symbol.d.ts' },
        './symbols/ellipsis-vertical': { types: './symbol.d.ts' },
        './states/ellipsis-orientation-outline': { types: './state.d.ts' },
        './states/ellipsis-orientation-filled': { types: './state.d.ts' },
        './motion': { types: './motion.d.ts' },
      },
    }),
    'node_modules/@labpics/icons/symbol.d.ts':
      "export declare function glyph(input?: {variant?: 'outline' | 'filled'; variation?: {dotScale?: number; spacingScale?: number}}): unknown;",
    'node_modules/@labpics/icons/state.d.ts':
      "export declare function compileStateEffect(state: 'horizontal' | 'vertical', request: {duration: number; from?: number; reducedMotion?: boolean}): {ok: false} | {ok: true; effect: {from: number; to: number; options: {duration: number}}};",
    'node_modules/@labpics/icons/motion.d.ts':
      'export declare function prepareContourStateEffect(effect: unknown): {ok: false} | {ok: true; sample(progress: number): unknown};',
    'node_modules/@labpics/motion/package.json': JSON.stringify({
      name: '@labpics/motion',
      type: 'module',
      exports: { '.': { types: './index.d.ts' } },
    }),
    'node_modules/@labpics/motion/index.d.ts':
      "export declare function value(initial: number): {subscribe(callback: (progress: number) => unknown): () => void; animate(to: number, options: {duration: number; ease: 'linear'}): unknown; dispose(): void};",
    'package.json': JSON.stringify({ private: true, type: 'module' }),
    'consumer.ts': source,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        types: [],
        lib: ['ES2022', 'DOM'],
      },
      files: ['consumer.ts'],
    }),
  };
  for (const [file, contents] of Object.entries(modules)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents);
  }
  // Минимальные declarations изолируют границу шаблона. Настоящий tarball проверяет heavy harness.
  const require = createRequire(import.meta.url);
  const metadata = require.resolve('typescript/package.json');
  const compiler = join(dirname(metadata), require(metadata).bin.tsc);
  const result = spawnSync(process.execPath, [compiler, '--project', join(root, 'tsconfig.json')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(result.status, 0, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  assert.ok(!source.includes('downloadedSvg'));
  assert.ok(!source.includes('Buffer'));
  assert.ok(!source.includes('waitForEvent'));
});

test('download helper exists at module scope and consumes a real stream protocol', async () => {
  assert.equal(typeof dotsConsumer.downloadedSvg, 'function');
  let clicked = false;
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const download = {
    createReadStream: async () =>
      (async function* () {
        yield bytes;
      })(),
    failure: async () => null,
  };
  const page = {
    waitForEvent: async (name) => {
      assert.equal(name, 'download');
      return download;
    },
  };
  const button = {
    click: async () => {
      clicked = true;
    },
  };
  assert.equal(await dotsConsumer.downloadedSvg(page, button), bytes.toString());
  assert.equal(clicked, true);
});

test('four independent masters carry exact Figma, semantic and grid receipts', async (t) => {
  const root = await fixture(t);
  const reference = await authoredDotsReference(root, pin);
  validateAuthoredDotsReference(reference, pin.figma);
  assert.equal(
    reference.semanticSha256,
    createHash('sha256').update(snapshot.semantics).digest('hex'),
  );
  assert.equal(reference.gridSha256, createHash('sha256').update(snapshot.grid).digest('hex'));
  for (const variants of Object.values(reference.icons))
    for (const item of Object.values(variants)) {
      assert.equal(
        item.author.masterSha256,
        createHash('sha256').update(snapshot.masters[item.sourceFile]).digest('hex'),
      );
      assert.equal(item.paths.length, 3);
    }
});

test('source oracle rejects changed raw bytes before any installed producer import', async (t) => {
  const root = await fixture(t, (data) => {
    const file = Object.keys(data.masters)[0];
    data.masters[file] = `${data.masters[file].replace('11.5', '11.4')} `;
  });
  await assert.rejects(authoredDotsReference(root, pin));
});

test('source oracle rejects a fabricated morph between different authored variants', async (t) => {
  const root = await fixture(t, (data) => {
    const semantic = JSON.parse(data.semantics);
    semantic.groups['ellipsis-orientation-outline'].states.vertical.variant = 'filled';
    data.semantics = JSON.stringify(semantic);
  });
  await assert.rejects(authoredDotsReference(root, pin));
});

test('vertical menu does not acquire a loading gesture from identical dot count', async (t) => {
  const root = await fixture(t, (data) => {
    data.annotations.icons['ellipsis-vertical'].outline.gesture = structuredClone(
      data.annotations.icons['ellipsis-horizontal'].outline.gesture,
    );
  });
  await assert.rejects(authoredDotsReference(root, pin));
});

function pose(reference, variant, state) {
  const item = reference.icons[`ellipsis-${state}`][variant];
  return {
    variant,
    viewBox: item.viewBox,
    identity: true,
    middleIdentity: true,
    middleMutations: 0,
    paths: item.parts.map(({ id, d, fillRule }) => ({ partId: id, d, fillRule })),
  };
}

test('contour endpoint oracle preserves raw strings and catches node replacement or middle writes', async (t) => {
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const variant of ['outline', 'filled'])
    for (const [state, progress] of [
      ['horizontal', 0],
      ['vertical', 1],
    ]) {
      const original = pose(reference, variant, state);
      assertContourPose(original, reference, variant, progress);
      assert.throws(() =>
        assertContourPose({ ...original, identity: false }, reference, variant, progress),
      );
      assert.throws(() =>
        assertContourPose({ ...original, middleMutations: 1 }, reference, variant, progress),
      );
      const changed = structuredClone(original);
      changed.paths[0].d += ' ';
      assert.throws(() => assertContourPose(changed, reference, variant, progress));
    }
});

const pathFromNumbers = (values) =>
  `M${values.slice(0, 2).join(' ')}${[0, 1, 2, 3].map((quarter) => `C${values.slice(2 + quarter * 6, 8 + quarter * 6).join(' ')}`).join('')}Z`;

test('raw correspondence oracle catches an incorrect interior pose despite correct endpoints', async (t) => {
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const variant of ['outline', 'filled']) {
    const expected = pose(reference, variant, 'horizontal');
    expected.paths = expected.paths.map((path, index) => {
      if (index === 1) return path;
      const a = rawDotOperands(reference.icons['ellipsis-horizontal'][variant].paths[index].d);
      const b = rawDotOperands(reference.icons['ellipsis-vertical'][variant].paths[index].d);
      return { ...path, d: pathFromNumbers(a.map((value, operand) => (value + b[operand]) / 2)) };
    });
    assertContourPose(expected, reference, variant, 0.5);
    const wrong = structuredClone(expected);
    const values = rawDotOperands(wrong.paths[0].d);
    values[2] += 0.05;
    wrong.paths[0].d = pathFromNumbers(values);
    assert.throws(() => assertContourPose(wrong, reference, variant, 0.5));
    assert.throws(() =>
      assertContourPose(pose(reference, variant, 'horizontal'), reference, variant, 0.5),
    );
  }
});

test('variation default oracle catches silent fallback and nonidentity defaults', async (t) => {
  const reference = await authoredDotsReference(await fixture(t), pin);
  for (const icon of ['ellipsis-horizontal', 'ellipsis-vertical'])
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      const observation = {
        icon,
        variant,
        viewBox: source.viewBox,
        author: source.author,
        defaultIdentity: true,
        provenance: { kind: 'source' },
        paths: source.parts.map(({ id, d, fillRule }) => ({ partId: id, d, fillRule })),
      };
      assertDotVariation(observation, reference, icon, variant, {});
      assert.throws(() =>
        assertDotVariation(
          { ...observation, defaultIdentity: false },
          reference,
          icon,
          variant,
          {},
        ),
      );
      assert.throws(() =>
        assertDotVariation(observation, reference, icon, variant, {
          dotScale: 1.1,
          spacingScale: 0.9,
        }),
      );
    }
});

test('transport fixture uses public Motion value ownership and exact sampler refusal', () => {
  const source = authoredDotsFixture();
  assert.match(source, /value as contourValue.*@labpics\/motion/);
  assert.match(source, /JSON\.parse\(JSON\.stringify\(result\.effect\)\)/);
  assert.match(source, /prepareContourStateEffect\(nextEffect\)/);
  assert.match(source, /progress\.get\(\)/);
  assert.match(source, /progress\.animate\(effect\.to/);
  assert.ok(/unsubscribe\(\);\s*progress\.dispose\(\)/.test(source));
  assert.ok(!source.includes('requestAnimationFrame'));
  assert.ok(!source.includes('setInterval'));
});

test('scalar stages read visible starts once and preserve subsequent public targets in all sample instances', () => {
  const first = {};
  const second = {};
  const effect = {
    version: 2,
    options: { easing: 'linear' },
    stages: [
      { partId: 'dot-leading', property: 'opacity', to: 0.35, at: 0, duration: 30 },
      { partId: 'dot-leading', property: 'opacity', to: 1, at: 30, duration: 30 },
    ],
  };
  const byPart = new Map([['dot-leading', [first, second]]]);
  const visible = new Map([
    [first, 0.5],
    [second, 0.6],
  ]);
  const steps = scalarSequenceSteps(effect, byPart, visible);
  assert.deepEqual(
    steps.map((step) => step[1].opacity),
    [[0.5, 0.35], [0.6, 0.35], 1, 1],
  );
  assert.deepEqual(
    steps.map((step) => step[2].ease),
    ['linear', 'linear', 'linear', 'linear'],
  );
  assert.throws(() => scalarSequenceSteps(effect, new Map(), visible));
});
