import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Одни исходники связывают подготовку, начало и завершение consumer-прогона. */
export const ICONS_HARNESS_FILES = Object.freeze([
  'apps/docs/tests/icons-harness.mjs',
  'apps/docs/tests/icons-packed.mjs',
  'apps/docs/tests/icons-notification-consumer.mjs',
  'apps/docs/tests/icons-authored-dots-consumer.mjs',
  'apps/docs/tests/icons-annulus-consumer.mjs',
  'apps/docs/tests/icons-state-annulus-consumer.mjs',
  'apps/docs/tests/icons-content-scale-consumer.mjs',
  'apps/docs/tests/icons-microphone-consumer.mjs',
  'apps/docs/tests/icons-motion-projection-consumer.mjs',
  'apps/docs/tests/icons-source-state-consumer.mjs',
  'apps/docs/tests/icons-width-motion-consumer.mjs',
]);

export async function snapshotHarnessFiles(readRepositoryFile) {
  return Object.freeze(
    await Promise.all(
      ICONS_HARNESS_FILES.map(async (file) =>
        Object.freeze({
          file,
          sha256: createHash('sha256')
            .update(await readRepositoryFile(file))
            .digest('hex'),
        }),
      ),
    ),
  );
}

/** Неполный receipt не сокращает область проверки изменившихся исходников. */
export async function assertHarnessFilesUnchanged(snapshot, readRepositoryFile) {
  assert.ok(Array.isArray(snapshot), 'Нужен полный snapshot source harness');
  assert.deepEqual(
    snapshot.map((item) => item?.file),
    ICONS_HARNESS_FILES,
    'Неполный или изменённый набор source harness',
  );
  for (const item of snapshot) {
    assert.deepEqual(Object.keys(item).sort(), ['file', 'sha256']);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      createHash('sha256')
        .update(await readRepositoryFile(item.file))
        .digest('hex'),
      item.sha256,
      `Изменён source harness: ${item.file}`,
    );
  }
}
