import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { rawContentPath } from './icons-content-scale-consumer.mjs';
import { ICONS_HARNESS_FILES } from './icons-harness.mjs';
import {
  MICROPHONE_COMPARISON_ICONS,
  MICROPHONE_COMPARISON_VISUAL_FILES,
  MICROPHONE_ENTRIES,
  MICROPHONE_ICONS,
  MICROPHONE_VISUAL_FILES,
  assertMicrophoneComparisonEvidence,
  assertMicrophoneComparisonObservation,
  assertMicrophonePaths,
  assertMicrophoneVisualEvidence,
  microphoneComparisonVisualFile,
  microphoneFixture,
  microphoneReference,
  microphoneTypeFixture,
  microphoneVisualFile,
  rawMicrophoneParts,
  validateMicrophoneReference,
} from './icons-microphone-consumer.mjs';
import { assertIconsImport, consumerFixture, consumerPublicEntries } from './icons-packed.mjs';
import { readAuthorMaster } from './prepare-icons-inputs.mjs';

const snapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-microphone-masters.json', import.meta.url)),
);
const peerSnapshot = JSON.parse(
  await readFile(new URL('./fixtures/icons-annulus-masters.json', import.meta.url)),
);
const pin = {
  figma: { fileKey: snapshot.manifest.source.fileKey, version: snapshot.manifest.source.version },
};
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lab-ui-microphone-oracle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'semantics'), { recursive: true });
  await writeFile(join(root, 'semantics/figma-baseline.json'), JSON.stringify(snapshot.manifest));
  await writeFile(join(root, 'semantics/author-anatomy.json'), JSON.stringify(snapshot.semantic));
  for (const [file, bytes] of Object.entries(snapshot.masters)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), bytes);
  }
  return { root, reference: await microphoneReference(root, pin, readAuthorMaster) };
}

// Достаточный healthy control: геометрическая нормализация raw contours без producer.
function narrowedPaths(reference, width) {
  const parts = rawMicrophoneParts(reference);
  const body = parts.find((part) => part.id === 'microphone-body');
  const contours = body.d.split(/(?=M)/).filter(Boolean).map(rawContentPath);
  const range = (contour) => {
    const xs = contour.flatMap((segment) => segment.points.map((point) => point[0]));
    return [Math.min(...xs), Math.max(...xs)];
  };
  const [outerLow, outerHigh] = range(contours[0]);
  body.d = contours
    .map((contour) => {
      const [low, high] = range(contour);
      const center = (low + high) / 2;
      const span = high - low - (outerHigh - outerLow) * (1 - width);
      return contour
        .map(
          ({ command, points }) =>
            command +
            points
              .flatMap(([x, y]) => [center + ((x - center) * span) / (high - low), y])
              .join(' '),
        )
        .join('');
    })
    .join('');
  if (reference.declaration.composition)
    return [{ d: parts.map((part) => part.d).join(''), fillRule: 'evenodd' }];
  return parts.map(({ d, fillRule }) => ({ d, fillRule }));
}

test('four saved raw masters retain independently authored compound and layered anatomy', async (t) => {
  const { reference } = await fixture(t);
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      assertMicrophonePaths(source.paths, source, 1);
      for (const width of [0.9, 0.8])
        assertMicrophonePaths(narrowedPaths(source, width), source, width);
    }
  assert.notDeepEqual(reference.icons.mic.outline.paths, reference.icons.mic.filled.paths);
  assert.notDeepEqual(
    reference.icons['mic-circle'].outline.paths,
    reference.icons['mic-circle'].filled.paths,
  );
});

test('raw source receipts refuse edited masters and foreign declarations before producer import', async (t) => {
  const { root, reference } = await fixture(t);
  const invalid = structuredClone(reference);
  invalid.icons['mic-circle'].filled.declaration.parts[2].contourIndices = [1];
  assert.throws(() => validateMicrophoneReference(invalid, pin.figma));
  invalid.icons['mic-circle'].filled = structuredClone(reference.icons['mic-circle'].filled);
  invalid.icons.mic.filled.author.masterSha256 = 'a'.repeat(64);
  assert.throws(() => validateMicrophoneReference(invalid, pin.figma));
  const file = snapshot.manifest.icons.mic.outline.master;
  await writeFile(join(root, file), snapshot.masters[file].replace('M19.1299', 'M19.0299'));
  await assert.rejects(
    () => microphoneReference(root, pin, readAuthorMaster),
    /raw microphone master/,
  );
});

test('oracle catches silent fallback, altered height, missing counter and jagged curves', async (t) => {
  const { reference } = await fixture(t);
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      const healthy = narrowedPaths(source, 0.8);
      assertMicrophonePaths(healthy, source, 0.8);
      assert.throws(() => assertMicrophonePaths(source.paths, source, 0.8), /bodyWidth/);
      const bodyPath = source.declaration.parts.find(
        (part) => part.id === 'microphone-body',
      ).pathIndex;
      const jagged = structuredClone(healthy);
      jagged[bodyPath].d = jagged[bodyPath].d.replace(/C([^A-Za-z]*)/g, (_, operands) => {
        const points = operands.trim().split(/[\s,]+/);
        return [0, 2, 4].map((index) => `L${points.slice(index, index + 2).join(' ')}`).join('');
      });
      assert.throws(() => assertMicrophonePaths(jagged, source, 0.8));
      const height = structuredClone(healthy);
      const bodyParts = rawMicrophoneParts({ ...source, paths: height });
      const changedBody = bodyParts.find((part) => part.id === 'microphone-body');
      const originalBody = changedBody.d;
      changedBody.d = changedBody.d.replace(
        /^M([-\d.]+) ([-\d.]+)/,
        (_, x, y) => `M${x} ${Number(y) + 0.01}`,
      );
      height[bodyPath].d = height[bodyPath].d.replace(originalBody, changedBody.d);
      assert.throws(() => assertMicrophonePaths(height, source, 0.8), /высота/);
    }
  const compound = reference.icons['mic-circle'].filled;
  const missing = narrowedPaths(compound, 0.8);
  missing[0].d = missing[0].d.split(/(?=M)/).filter(Boolean).slice(0, 2).join('');
  assert.throws(() => assertMicrophonePaths(missing, compound, 0.8));
  const extra = narrowedPaths(compound, 0.8);
  extra[0].d += 'M10 10L11 10L10 11Z';
  assert.throws(() => assertMicrophonePaths(extra, compound, 0.8));
});

test('unchanged support, enclosure and paint are required for every supported variant', async (t) => {
  const { reference } = await fixture(t);
  for (const icon of MICROPHONE_ICONS)
    for (const variant of ['outline', 'filled']) {
      const source = reference.icons[icon][variant];
      const healthy = narrowedPaths(source, 0.9);
      const altered = structuredClone(healthy);
      altered[0].d = altered[0].d.replace(/^M([-\d.]+)/, (_, x) => `M${Number(x) + 0.01}`);
      assert.throws(() => assertMicrophonePaths(altered, source, 0.9), /стойка|обрамление/);
      const paint = structuredClone(healthy);
      paint[0].fillRule = paint[0].fillRule === 'evenodd' ? 'nonzero' : 'evenodd';
      assert.throws(() => assertMicrophonePaths(paint, source, 0.9));
    }
});

test('schema9 adds public microphones and preserves earlier packed fixtures', () => {
  const old = consumerPublicEntries(8);
  assert.deepEqual(
    consumerPublicEntries(9).filter((entry) => !old.includes(entry)),
    MICROPHONE_ENTRIES,
  );
  for (const entry of MICROPHONE_ENTRIES) assertIconsImport(entry);
  assert.throws(() => assertIconsImport('@labpics/icons/variations/mic-off'));
  assert.throws(() => assertIconsImport('@labpics/icons/ir/author-capsule-runtime'));
  assert.equal(consumerFixture(8).includes('mountMicrophoneConsumer'), false);
  assert.ok(consumerFixture(9).includes(microphoneFixture()));
  assert.ok(ICONS_HARNESS_FILES.includes('apps/docs/tests/icons-microphone-consumer.mjs'));
  const types = microphoneTypeFixture();
  assert.ok(types.includes("variant:'filled',variation:{bodyWidth:.8}"));
  assert.equal((types.match(/@ts-expect-error/g) ?? []).length, 2);
});

test('optical evidence requires four width and motion-mode PNGs linked to their observations', () => {
  assert.deepEqual(MICROPHONE_VISUAL_FILES, [
    'result/no-preference-microphone-width-0.9.png',
    'result/no-preference-microphone-width-0.8.png',
    'result/reduce-microphone-width-0.9.png',
    'result/reduce-microphone-width-0.8.png',
  ]);
  const visuals = MICROPHONE_VISUAL_FILES.map((path) => ({
    path,
    bytes: Buffer.from(`capture:${path}`),
  }));
  const records = ['no-preference', 'reduce'].flatMap((mode) =>
    [0.9, 0.8].map((width) => {
      const file = microphoneVisualFile(mode, width);
      return {
        name: `${mode}:microphone-width-${width}:optical`,
        result: 'PASS',
        file,
        bodyWidth: width,
        pngSha256: createHash('sha256')
          .update(visuals.find((visual) => visual.path === file).bytes)
          .digest('hex'),
        variants: ['mic/outline', 'mic/filled', 'mic-circle/outline', 'mic-circle/filled'],
        sizes: [16, 24, 48],
        samples: 12,
      };
    }),
  );
  assertMicrophoneVisualEvidence(visuals, records);
  assert.throws(() => assertMicrophoneVisualEvidence(visuals.slice(1), records), /отсутствует/);
  assert.throws(() => assertMicrophoneVisualEvidence(visuals, records.slice(1)), /receipt/);
  const changed = structuredClone(visuals);
  changed[0].bytes = Buffer.from('different capture');
  assert.throws(() => assertMicrophoneVisualEvidence(changed, records), /PNG не совпал/);
  for (const update of [
    (record) => {
      record.bodyWidth = 1;
    },
    (record) => {
      record.variants.pop();
    },
    (record) => {
      record.sizes = [24];
    },
  ]) {
    const altered = structuredClone(records);
    update(altered[0]);
    assert.throws(() => assertMicrophoneVisualEvidence(visuals, altered));
  }
  assert.throws(() => microphoneVisualFile('reduce', 0.79));
  assert.throws(() => microphoneVisualFile('failure', 0.8));
});

test('comparison fixture uses the public static peers and retains microphone controls', () => {
  const fixture = microphoneFixture();
  for (const icon of MICROPHONE_COMPARISON_ICONS) {
    const entry = `@labpics/icons/symbols/${icon}`;
    assert.ok(fixture.includes(`from '${entry}'`));
    assert.ok(consumerPublicEntries(9).includes(entry));
    assertIconsImport(entry);
  }
  assert.ok(fixture.includes('[microphoneQuestionSource, microphonePlaybackSource]'));
  assert.ok(fixture.includes('microphone-comparison-row'));
  assert.ok(fixture.includes('Ширина корпуса'));
  assert.ok(fixture.includes('Авторская форма'));
  assert.ok(fixture.includes('microphone-download'));
  // Проверяется сериализованная browser fixture, браузер здесь не запускается.
  assert.doesNotThrow(() => new Function(fixture.replace(/^import .*$/gm, '')));
});

test('comparison oracle requires both authorships, all sizes, intact peers and physical adjacency', async (t) => {
  const { reference } = await fixture(t);
  const peers = { icons: {} };
  for (const icon of ['question-circle', 'play-circle']) {
    peers.icons[icon] = {};
    for (const variant of ['outline', 'filled']) {
      const record = peerSnapshot.manifest.icons[icon][variant];
      const bytes = Buffer.from(peerSnapshot.masters[record.master]);
      peers.icons[icon][variant] = {
        ...readAuthorMaster(bytes),
        author: {
          kind: 'figma',
          ...pin.figma,
          nodeId: record.nodeId,
          masterSha256: createHash('sha256').update(bytes).digest('hex'),
        },
      };
    }
  }
  const observed = (bodyWidth) => {
    const rows = ['outline', 'filled'].flatMap((variant) =>
      [16, 24, 48].map((size) => ({
        variant,
        size,
        caption: `${variant === 'outline' ? 'Контурные' : 'Залитые'}, ${size} px`,
      })),
    );
    return {
      bodyWidth,
      rows,
      samples: rows.flatMap(({ variant, size }, rowIndex) =>
        MICROPHONE_COMPARISON_ICONS.map((icon, index) => {
          const raw =
            icon === 'mic-circle' ? reference.icons[icon][variant] : peers.icons[icon][variant];
          return {
            icon,
            variant,
            size,
            author: raw.author,
            viewBox: raw.viewBox,
            staticIdentity: true,
            domIdentity: true,
            tag: 'lab-button',
            slot: 'icon',
            hidden: 'true',
            focusable: 'false',
            width: size,
            height: size,
            label: icon,
            target: { x: index * 80, y: rowIndex * 80, width: 64, height: 64 },
            paths:
              icon === 'mic-circle' && bodyWidth !== 1 ? narrowedPaths(raw, bodyWidth) : raw.paths,
          };
        }),
      ),
    };
  };
  for (const width of [1, 0.8])
    assertMicrophoneComparisonObservation(observed(width), reference, peers, width);
  for (const mutate of [
    (item) => {
      item.bodyWidth = 1;
    },
    (item) => {
      item.rows.pop();
    },
    (item) => {
      item.samples.pop();
    },
    (item) => {
      item.samples[0].width = 24;
    },
    (item) => {
      item.samples[1].target.y += 80;
    },
    (item) => {
      item.samples[1].target.x = 60;
    },
    (item) => {
      item.samples[1].paths = peers.icons['question-circle'].filled.paths;
    },
    (item) => {
      item.samples[1].author.nodeId = '0:0';
    },
    (item) => {
      item.samples[1].staticIdentity = false;
    },
    (item) => {
      item.samples[1].domIdentity = false;
    },
    (item) => {
      item.samples[2].target.width = 40;
    },
    (item) => {
      item.samples[0].hidden = 'false';
    },
  ]) {
    const broken = structuredClone(observed(0.8));
    mutate(broken);
    assert.throws(() => assertMicrophoneComparisonObservation(broken, reference, peers, 0.8));
  }
});

test('comparison captures require baseline and narrowed forms in both motion modes', () => {
  assert.deepEqual(MICROPHONE_COMPARISON_VISUAL_FILES, [
    'result/no-preference-microphone-adjacent-width-1.png',
    'result/no-preference-microphone-adjacent-width-0.8.png',
    'result/reduce-microphone-adjacent-width-1.png',
    'result/reduce-microphone-adjacent-width-0.8.png',
  ]);
  const visuals = MICROPHONE_COMPARISON_VISUAL_FILES.map((path) => ({
    path,
    bytes: Buffer.from(`capture:${path}`),
  }));
  const records = ['no-preference', 'reduce'].flatMap((mode) =>
    [1, 0.8].map((width) => {
      const file = microphoneComparisonVisualFile(mode, width);
      return {
        name: `${mode}:microphone-adjacent-width-${width}:capture`,
        result: 'PASS',
        file,
        bodyWidth: width,
        pngSha256: createHash('sha256')
          .update(visuals.find((visual) => visual.path === file).bytes)
          .digest('hex'),
        icons: [...MICROPHONE_COMPARISON_ICONS],
        variants: ['outline', 'filled'],
        sizes: [16, 24, 48],
        groups: 6,
        samples: 18,
      };
    }),
  );
  assertMicrophoneComparisonEvidence(visuals, records);
  assert.throws(() => assertMicrophoneComparisonEvidence(visuals.slice(1), records), /отсутствует/);
  assert.throws(() => assertMicrophoneComparisonEvidence(visuals, records.slice(1)), /receipt/);
  assert.throws(
    () => assertMicrophoneComparisonEvidence([...visuals, visuals[0]], records),
    /повторён/,
  );
  assert.throws(
    () => assertMicrophoneComparisonEvidence(visuals, [...records, records[0]]),
    /повторён/,
  );
  const changed = structuredClone(visuals);
  changed[0].bytes = Buffer.from('different capture');
  assert.throws(() => assertMicrophoneComparisonEvidence(changed, records), /PNG не совпал/);
  for (const mutate of [
    (item) => {
      item.bodyWidth = 0.8;
    },
    (item) => {
      item.icons.pop();
    },
    (item) => {
      item.variants = ['outline'];
    },
    (item) => {
      item.sizes = [24];
    },
    (item) => {
      item.groups = 5;
    },
    (item) => {
      item.samples = 12;
    },
    (item) => {
      item.result = 'skipped';
    },
  ]) {
    const broken = structuredClone(records);
    mutate(broken[0]);
    assert.throws(() => assertMicrophoneComparisonEvidence(visuals, broken));
  }
  assert.throws(() => microphoneComparisonVisualFile('reduce', 0.9));
  assert.throws(() => microphoneComparisonVisualFile('failure', 0.8));
});
