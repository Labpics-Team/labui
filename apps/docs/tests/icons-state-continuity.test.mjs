import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  consumerFixture,
  installViewportPointerBlocker,
  sameStateOpacity,
} from './icons-packed.mjs';

const stateIds = ['attention', 'confirmation', 'decrease', 'dismissal', 'increase', 'question'];
const statePose = (values) =>
  stateIds.map((id, index) => ({ partId: `state-${id}`, value: values[index] }));

function pointerDocument(width, height, { inset = 0, intercept = true } = {}) {
  let blocker;
  const document = {
    documentElement: { clientWidth: width, clientHeight: height },
    createElement() {
      const element = {
        style: {},
        setAttribute() {},
        getBoundingClientRect() {
          // Подмена моделирует только fixed/inset layout, не browser hit-testing.
          const viewport = this.style.position === 'fixed' && this.style.inset === '0';
          return viewport
            ? { left: inset, top: 0, right: width, bottom: height }
            : { left: 48, top: 600, right: 96, bottom: 648 };
        },
      };
      return element;
    },
    body: {
      append(element) {
        blocker = element;
      },
    },
    elementFromPoint() {
      return intercept && blocker?.style.pointerEvents === 'auto' ? blocker : null;
    },
  };
  return { document, blocker: () => blocker };
}

test('pointer контроль не зависит от target-box до автоматической прокрутки', () => {
  // target-box был y=600; click после scroll действует в y=180.
  const oldRectangle = { left: 48, top: 600, right: 96, bottom: 648 };
  const action = { x: 72, y: 180 };
  assert.ok(action.y < oldRectangle.top, 'старый fixed overlay пропускает новый action point');
  for (const [width, height] of [
    [640, 360],
    [320, 240],
  ]) {
    const fixture = pointerDocument(width, height);
    const witness = installViewportPointerBlocker({
      ownerDocument: fixture.document,
      getBoundingClientRect() {
        throw new Error('target-box не должен участвовать');
      },
    });
    assert.ok(action.x >= witness.left && action.x <= witness.right);
    assert.ok(action.y >= witness.top && action.y <= witness.bottom);
    assert.equal(witness.centerHit, true);
    assert.equal(fixture.blocker().style.left, undefined);
    assert.equal(fixture.blocker().style.top, undefined);
  }
});

test('pointer контроль отвергает неполное покрытие и неподтверждённый hit target', () => {
  for (const options of [{ inset: 1 }, { intercept: false }]) {
    const fixture = pointerDocument(640, 360, options);
    assert.throws(
      () => installViewportPointerBlocker({ ownerDocument: fixture.document }),
      /Pointer blocker не закрывает viewport/,
    );
  }
});

function changeStateAtAdmission(visible, admitted, { playback = 'running', reset = false } = {}) {
  const fixture = consumerFixture(2);
  const start = fixture.indexOf('function changeState(');
  const end = fixture.indexOf('\nfunction readState()', start);
  assert.ok(start >= 0 && end > start, 'В consumer отсутствует changeState');
  let pose = structuredClone(visible);
  const snapshot = () => ({ opacity: structuredClone(pose), playback: previous.state });
  const previous = {
    state: playback,
    stop() {
      if (this.state !== 'stopped') pose = structuredClone(admitted);
      this.state = 'stopped';
    },
    pause() {
      pose = structuredClone(admitted);
      this.state = 'paused';
    },
  };
  const stateNodes = new Map(visible.map((item) => [item.partId, { partId: item.partId }]));
  const sequence = (steps) => {
    // Подмена задаёт только границу admission; clock и исполнение Motion здесь не моделируются.
    previous.stop();
    pose = steps.map(([node, properties]) => ({
      partId: node.partId,
      value: reset
        ? Number(node.partId === 'state-confirmation')
        : Array.isArray(properties.opacity)
          ? properties.opacity[0]
          : admitted.find((item) => item.partId === node.partId).value,
    }));
    return { state: 'running', finished: Promise.resolve({ status: 'finished' }) };
  };
  const compileStateEffect = (state, { duration }) => ({
    ok: true,
    effect: {
      stages: stateIds.map((id) => ({
        partId: `state-${id}`,
        to: Number(id === state),
        at: 0,
        duration,
      })),
      options: { duration, easing: 'linear' },
    },
  });
  const change = new Function(
    'compileStateEffect',
    'matchMedia',
    'stateNodes',
    'sequence',
    'stateOpacityWitness',
    'stateWitness',
    'stateControl',
    `let stateCompletion; let stateGeneration = 0; let stateTarget;
     const stateLabels = { confirmation: 'Подтверждение' };
     const stateSelect = {}; const stateStatus = {};
     ${fixture.slice(start, end)}
     return changeState;`,
  )(
    compileStateEffect,
    () => ({ matches: false }),
    stateNodes,
    sequence,
    snapshot,
    snapshot,
    previous,
  );
  return change('confirmation', 600);
}

test('новое намерение сохраняет последнюю видимую смесь при более позднем admission', () => {
  const visible = statePose([0.005, 0, 0, 0, 0, 0.995]);
  const admitted = statePose([0.0263333, 0, 0, 0, 0, 0.9735]);
  const result = changeStateAtAdmission(visible, admitted);
  assert.deepEqual(result.before, visible);
  sameStateOpacity(visible, result.after, result.continuity);
});

test('передача сохраняет все компоненты running и paused смесей', () => {
  for (const playback of ['running', 'paused']) {
    for (const fraction of [0.01, 0.2, 0.5, 0.99]) {
      const mixture = [fraction / 2, 1 - fraction, 0, 0, 0, fraction / 2];
      for (let shift = 0; shift < stateIds.length; shift++) {
        const visible = statePose(
          mixture.map((_, index) => mixture[(index + shift) % mixture.length]),
        );
        const admitted = playback === 'paused' ? visible : statePose([0.45, 0.1, 0, 0, 0, 0.45]);
        const result = changeStateAtAdmission(visible, admitted, { playback });
        assert.deepEqual(result.before, visible);
        sameStateOpacity(visible, result.after, result.continuity);
      }
    }
  }
});

test('контроль совпадающего admission проходит, а явный reset остаётся видимым', () => {
  const visible = statePose([0.2, 0.3, 0, 0, 0, 0.5]);
  const healthy = changeStateAtAdmission(visible, visible);
  sameStateOpacity(visible, healthy.after, healthy.continuity);
  const reset = changeStateAtAdmission(visible, visible, { reset: true });
  assert.deepEqual(reset.before, visible);
  assert.throws(
    () => sameStateOpacity(visible, reset.after, reset.continuity),
    /видимая opacity скачет: state-attention/,
  );
});

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
