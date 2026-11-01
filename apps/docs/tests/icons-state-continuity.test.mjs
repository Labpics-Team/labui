import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameStateOpacity } from './icons-packed.mjs';

test('диагностика сохраняет строгую проверку совпадающей позы', () => {
  const pose = [
    { partId: 'state-question', value: 0.65 },
    { partId: 'state-confirmation', value: 0.35 },
  ];
  assert.doesNotThrow(() => sameStateOpacity(pose, structuredClone(pose)));
  assert.doesNotThrow(() =>
    sameStateOpacity(pose, [pose[0], { partId: 'state-confirmation', value: 0.351 }]),
  );
});

test('скачок оставляет числа и временной witness для failure receipt', () => {
  const before = [{ partId: 'state-confirmation', value: 0.4666666666666667 }];
  const after = [{ partId: 'state-confirmation', value: 0.4716666666666667 }];
  const witness = {
    eventIndex: 1,
    continuity: {
      before: { readStartedAt: 280, readCompletedAt: 280, timelineTime: 280 },
      admitted: {
        sampledAt: 283,
        animations: [
          {
            partId: 'state-confirmation',
            currentTime: 0,
            firstKeyframe: { opacity: 0.4716666666666667, offset: 0 },
          },
        ],
      },
      after: { readStartedAt: 283, readCompletedAt: 283, timelineTime: 283 },
    },
  };
  assert.throws(
    () => sameStateOpacity(before, after, witness),
    (error) => {
      assert.match(error.message, /state-confirmation.*delta=0\.005/);
      assert.deepEqual(error.stateContinuity, {
        differences: [
          {
            partId: 'state-confirmation',
            before: before[0].value,
            after: after[0].value,
            delta: after[0].value - before[0].value,
          },
        ],
        witness,
      });
      assert.deepEqual(JSON.parse(JSON.stringify(error.stateContinuity)).witness, witness);
      return true;
    },
  );
  assert.throws(() => sameStateOpacity(before, [{ partId: 'state-confirmation', value: 0 }]));
});
