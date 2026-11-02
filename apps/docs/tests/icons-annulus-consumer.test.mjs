import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import {
  ANNULUS_ENTRIES,
  ANNULUS_ICONS,
  annulusFixture,
  annulusReference,
  annulusTypeFixture,
  assertAnnulusObservation,
  assertAnnulusPaths,
  rawAnnulusReference,
  validateAnnulusReference,
} from './icons-annulus-consumer.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-annulus-masters.json', import.meta.url)),
);
const pin = { sourceCommit: snapshot.sourceCommit, figma: snapshot.annotations.source };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t, change = () => {}) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'labui-annulus-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(dirname(resolved), parent);
    assert.ok(basename(resolved).startsWith('labui-annulus-'));
    await rm(resolved, { recursive: true, force: true });
  });
  const data = structuredClone(snapshot);
  change(data);
  for (const [file, bytes] of Object.entries({
    'semantics/figma-baseline.json': JSON.stringify(data.manifest),
    'semantics/author-anatomy.json': JSON.stringify(data.annotations),
    ...data.masters,
  })) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  return annulusReference(root, pin, readAuthorMaster);
}

test('schema6 keeps schema5 consumer and adds only the requested annulus entries', () => {
  assert.deepEqual(consumerPublicEntries(6), [...consumerPublicEntries(5), ...ANNULUS_ENTRIES]);
  for (const entry of ANNULUS_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/ir'));
  assert.throws(() => assertIconsImport('@labpics/icons/variations/ellipse'));
  assert.ok(consumerFixture(6).includes(annulusFixture()));
  assert.ok(!consumerFixture(5).includes('annulusConsumers'));
  const parsed = spawnSync(process.execPath, ['--check', '--input-type=module'], {
    input: consumerFixture(6),
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('the installed type fixture preserves source imports and explicitly refuses Filled geometry', () => {
  const source = annulusTypeFixture();
  for (const entry of ANNULUS_ENTRIES) assert.ok(source.includes(entry));
  assert.equal(source.match(/@ts-expect-error/g).length, 4);
  assert.ok(!source.includes('/dist/'));
  assert.ok(!source.includes('/ir/author-annulus'));
});

test('raw Figma sources retain independent Outline and Filled receipts before producer import', async (t) => {
  const reference = await fixture(t);
  validateAnnulusReference(reference, pin.figma);
  assert.equal(reference.semanticSha256, hash(JSON.stringify(snapshot.annotations)));
  for (const icon of ANNULUS_ICONS)
    for (const variant of ['outline', 'filled']) {
      const item = reference.icons[icon][variant];
      assert.equal(item.author.masterSha256, hash(snapshot.masters[item.sourceFile]));
      if (variant === 'filled') assert.equal(item.declaration, null);
      else
        assert.deepEqual(
          item.declaration.gesture,
          icon === 'checkmark-circle'
            ? { law: 'confirmation.presence', purpose: 'confirmation', partId: 'confirmation-mark' }
            : null,
        );
    }
  assert.equal(
    rawAnnulusReference(reference.icons['plus-circle'].outline.paths, [0, 0, 24, 24]).outerD,
    rawAnnulusReference(reference.icons['minus-circle'].outline.paths, [0, 0, 24, 24]).outerD,
  );
});

test('raw-source drift and transplanted declarations refuse before reading package geometry', async (t) => {
  await assert.rejects(
    fixture(t, (data) => {
      const file = data.manifest.icons['plus-circle'].outline.master;
      data.masters[file] += ' ';
    }),
  );
  await assert.rejects(
    fixture(t, (data) => {
      data.annotations.icons['plus-circle'].outline.parts[0].id = 'decrease-mark';
    }),
  );
  await assert.rejects(
    fixture(t, (data) => {
      data.annotations.icons['plus-circle'].filled = structuredClone(
        data.annotations.icons['plus-circle'].outline,
      );
    }),
  );
});

function variedPaths(reference, emphasis) {
  const raw = rawAnnulusReference(reference.paths, reference.viewBox);
  const scale = (raw.outerRadius - raw.referenceThickness * emphasis) / raw.innerRadius;
  // Другой порядок affine операций нужен только для positive oracle control.
  // Это не producer materializer и не product/render доказательство.
  const numbers = raw.inner.map(
    (value, index) => scale * value + (1 - scale) * raw.center[index % 2],
  );
  const inner = `M${numbers.slice(0, 2).join(' ')}${[0, 1, 2, 3].map((i) => `C${numbers.slice(2 + i * 6, 8 + i * 6).join(' ')}`).join('')}Z`;
  return [
    ...reference.paths.slice(0, -1),
    { d: raw.outerD + inner, fillRule: reference.paths.at(-1).fillRule },
  ];
}

test('countershape oracle admits useful deformation and rejects whole-glyph scaling or silent default', async (t) => {
  const reference = await fixture(t);
  for (const icon of ANNULUS_ICONS) {
    const original = reference.icons[icon].outline;
    assertAnnulusPaths(original.paths, original, 1);
    for (const emphasis of [0.8, 1.2]) {
      const paths = variedPaths(original, emphasis);
      assertAnnulusPaths(paths, original, emphasis);
      assert.notEqual(paths.at(-1).d, original.paths.at(-1).d);
      assert.throws(() => assertAnnulusPaths(original.paths, original, emphasis));
      const scaledExterior = structuredClone(paths);
      scaledExterior.at(-1).d = scaledExterior.at(-1).d.replace('M12 1.5', 'M12 1.6');
      assert.notEqual(scaledExterior.at(-1).d, paths.at(-1).d);
      assert.throws(() => assertAnnulusPaths(scaledExterior, original, emphasis));
      for (let index = 0; index < paths.length - 1; index++) {
        const alteredContent = structuredClone(paths);
        alteredContent[index].d += 'M0 0Z';
        assert.throws(() => assertAnnulusPaths(alteredContent, original, emphasis));
      }
      const wrongEmphasis = variedPaths(original, 1.1);
      assert.throws(() => assertAnnulusPaths(wrongEmphasis, original, emphasis));
    }
  }
});

test('countershape oracle refuses invalid SVG syntax even when every operand is unchanged', async (t) => {
  const reference = await fixture(t);
  for (const icon of ANNULUS_ICONS) {
    const original = reference.icons[icon].outline;
    const paths = variedPaths(original, 1.2);
    assertAnnulusPaths(paths, original, 1.2);
    const innerStart = paths.at(-1).d.lastIndexOf('M') + 1;
    for (const punctuation of ['?', ';', '/', ',', ',,']) {
      const malformed = structuredClone(paths);
      malformed.at(-1).d =
        paths.at(-1).d.slice(0, innerStart) + punctuation + paths.at(-1).d.slice(innerStart);
      assert.throws(() => assertAnnulusPaths(malformed, original, 1.2), punctuation);
    }
  }
});

function observation(reference, icon, variant) {
  const item = reference.icons[icon][variant];
  const paths = item.paths.map((path, index) => ({
    ...path,
    partId: item.declaration?.parts[index].id ?? `source-${index}`,
  }));
  return {
    icon,
    variant,
    author: item.author,
    viewBox: item.viewBox,
    paths,
    defaultIdentity: true,
    sourceDefaultIdentity: true,
    sourceOnlyDefaultIdentity: true,
    explicitDefaultIdentity: variant === 'outline' ? true : null,
    contentIdentity: true,
    roles: item.declaration?.parts.map(({ id, role }, zIndex) => ({ id, role, zIndex })),
    provenance: { kind: 'source' },
    capability:
      variant === 'filled'
        ? {}
        : {
            variation: {
              version: 1,
              law: 'annulus.counter-scale',
              defaults: { enclosureEmphasis: 1 },
              domain: {
                kind: 'radial-bernstein',
                parameter: 'enclosureEmphasis',
                evaluated: 'actual-binary64-scale',
              },
              targets: {
                svg: 'supported',
                webEffect: 'not-declared',
                lottie: 'not-exported',
                sfSymbols: 'not-exported',
              },
            },
          },
    samples: [16, 24, 48].map((size) => ({ size, width: size, height: size, paths })),
  };
}

test('browser observation oracle catches lost source identity, shifted sample or invented Filled capability', async (t) => {
  const reference = await fixture(t);
  for (const icon of ANNULUS_ICONS)
    for (const variant of ['outline', 'filled']) {
      const actual = observation(reference, icon, variant);
      assertAnnulusObservation(actual, reference, icon, variant);
      assert.throws(() =>
        assertAnnulusObservation(
          { ...actual, sourceDefaultIdentity: false },
          reference,
          icon,
          variant,
        ),
      );
      assert.throws(() =>
        assertAnnulusObservation(
          { ...actual, sourceOnlyDefaultIdentity: false },
          reference,
          icon,
          variant,
        ),
      );
      const clipped = structuredClone(actual);
      clipped.samples[0].width = 24;
      assert.throws(() => assertAnnulusObservation(clipped, reference, icon, variant));
      if (variant === 'filled') {
        const invented = { ...actual, capability: { variation: { law: 'annulus.counter-scale' } } };
        assert.throws(() => assertAnnulusObservation(invented, reference, icon, variant));
      } else {
        assert.throws(() =>
          assertAnnulusObservation(
            { ...actual, explicitDefaultIdentity: false },
            reference,
            icon,
            variant,
          ),
        );
        const renamed = structuredClone(actual);
        renamed.paths[0].partId = 'unclassified';
        assert.throws(() => assertAnnulusObservation(renamed, reference, icon, variant));
        assert.throws(() =>
          assertAnnulusObservation({ ...actual, contentIdentity: false }, reference, icon, variant),
        );
      }
    }
});
