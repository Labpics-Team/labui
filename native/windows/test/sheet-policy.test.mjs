import assert from 'node:assert/strict';
import { test } from 'node:test';
import { policyWitness as witness } from './sheet-policy.fixtures.mjs';
import {
  POLICY_CASES,
  POLICY_SCHEMA,
  policyReadback,
  validatePolicyWitness,
} from './sheet-policy.mjs';

const SELECTOR = POLICY_CASES[0];
const FLEX = POLICY_CASES[1];
const copy = (value) => structuredClone(value);
function viewport(width = 343, height = 358) {
  return {
    ...witness(SELECTOR).steps[0].viewport,
    actualWidth: width,
    actualHeight: height,
    viewportWidth: width,
    viewportHeight: height,
    extentWidth: width,
    extentHeight: height,
    scrollableWidth: 0,
    scrollableHeight: 0,
  };
}

function root(kind, width = 343, height = 358, desiredHeight = 58, measureHeight = height) {
  return {
    ...witness(SELECTOR).steps[0].root,
    kind,
    lastMeasure: { width, height: measureHeight },
    actual: { width, height },
    desired: { width: Math.min(width, 200), height: desiredHeight },
    layoutSlot: { x: 0, y: 0, width, height },
  };
}

function selectorSample(itemACalls, itemBCalls, index) {
  const calls = itemACalls + itemBCalls;
  return {
    ...witness(SELECTOR).steps[index].selector,
    calls,
    ownerCalls: calls,
    itemACalls,
    itemBCalls,
  };
}

function replacement(mutated = false) {
  return {
    ...witness(SELECTOR).steps[mutated ? 4 : 2].replacement,
    retiredTemplateChanged: mutated,
    retiredScrollPresentersDiffer: mutated,
    retiredSizesContentToTemplatedParent: !mutated,
  };
}

function rejectMutation(entry, mutate, phase) {
  const control = witness(entry);
  assert.equal(validatePolicyWitness(control, entry), control);
  const value = copy(control);
  mutate(value);
  assert.throws(
    () => validatePolicyWitness(value, entry),
    (error) => {
      assert.equal(error.code, 'ERR_ASSERTION');
      assert.ok(['content-layout', 'content-template'].includes(error.sheetPhase));
      if (phase) assert.equal(error.sheetPhase, phase);
      assert.ok(error.message.length < 200);
      assert.equal(error.actual, false);
      assert.equal(error.expected, true);
      return true;
    },
  );
}

test('policy cases are a frozen closed selector and Flex contract', () => {
  assert.equal(POLICY_SCHEMA, 'sheet-policy-v1');
  assert.deepEqual(POLICY_CASES, [
    {
      name: 'Content-Selector-Retirement',
      theme: 'Light',
      material: 'Solid',
      scenario: 'selector-retirement',
      alignment: 'Stretch',
      state: 'Half',
    },
    {
      name: 'Content-Flex-Recovery',
      theme: 'Light',
      material: 'Solid',
      scenario: 'flex-recovery',
      alignment: 'Stretch',
      state: 'Flex',
    },
  ]);
  assert.ok(Object.isFrozen(POLICY_CASES) && POLICY_CASES.every(Object.isFrozen));
  for (const entry of POLICY_CASES) {
    const value = witness(entry);
    assert.deepEqual(witness(entry.scenario), value);
    assert.equal(validatePolicyWitness(value, entry), value);
    assert.deepEqual(policyReadback(value), value);
    for (const field of Object.keys(entry)) {
      const foreign = { ...entry, [field]: 'private-sentinel' };
      assert.throws(() => validatePolicyWitness(value, foreign), { code: 'ERR_ASSERTION' });
    }
  }
});

test('foreign, private, partial, failed or non-JSON witnesses cannot qualify', () => {
  for (const entry of POLICY_CASES) {
    for (const mutate of [
      (v) => {
        v.schema = 'sheet-content-v2';
      },
      (v) => {
        v.scenario = entry === SELECTOR ? FLEX.scenario : SELECTOR.scenario;
      },
      (v) => {
        v.message = 'private-sentinel';
      },
      (v) => {
        Reflect.deleteProperty(v, 'failure');
      },
      (v) => {
        v.steps = {};
      },
      (v) => {
        v.steps.pop();
      },
      (v) => {
        v.steps.push(copy(v.steps[0]));
      },
      (v) => {
        v.steps.reverse();
      },
      (v) => {
        v.phase = v.steps[0].phase;
      },
      (v) => {
        v.status = 'pending';
      },
      (v) => {
        v.status = 'failed';
      },
      (v) => {
        v.failure = {
          phase: v.phase,
          code: 'native-call',
          type: 'COMException',
          hresult: -2147467259,
        };
      },
      (v) => {
        v.steps.extra = 'private-sentinel';
      },
      (v) => {
        Object.setPrototypeOf(v.steps, { private: 'private-sentinel' });
      },
      (v) => {
        Reflect.deleteProperty(v.steps, '0');
      },
      (v) => {
        v.steps[0] = [];
      },
      (v) => {
        v.steps[0].private = 'private-sentinel';
      },
      (v) => {
        Object.defineProperty(v, 'private', { value: 'private-sentinel' });
      },
      (v) => {
        v[Symbol('private-sentinel')] = true;
      },
      (v) => {
        Object.defineProperty(v, 'schema', { get: () => 'private-sentinel', enumerable: true });
      },
    ])
      rejectMutation(entry, mutate);
    for (const value of [null, undefined, true, 'private-sentinel', 1, [], new Date(), new Map()])
      assert.throws(() => validatePolicyWitness(value, entry), { code: 'ERR_ASSERTION' });
  }
});

test('every nested native sample has an exact public shape and bounded finite values', () => {
  for (const entry of POLICY_CASES) {
    const index = entry === SELECTOR ? 0 : 1;
    const targets = [
      (v) => v.steps[index],
      (v) => v.steps[index].viewport,
      (v) => v.steps[index].root,
      (v) => v.steps[index].root.lastMeasure,
      (v) => v.steps[index].root.actual,
      (v) => v.steps[index].root.desired,
      (v) => v.steps[index].root.layoutSlot,
      ...(entry === SELECTOR ? [(v) => v.steps[0].selector, (v) => v.steps[2].replacement] : []),
    ];
    for (const target of targets)
      for (const mutate of [
        (v) => {
          target(v).message = 'private-sentinel';
        },
        (v) => {
          delete target(v)[Object.keys(target(v))[0]];
        },
        (v) => {
          Object.setPrototypeOf(target(v), { private: 'private-sentinel' });
        },
      ])
        rejectMutation(entry, mutate);
    for (const invalid of [
      null,
      '343',
      false,
      -1,
      1e6 + 1,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ]) {
      rejectMutation(entry, (v) => {
        v.steps[index].bodyHeight = invalid;
      });
      for (const field of Object.keys(viewport()).filter(
        (field) => typeof viewport()[field] === 'number',
      ))
        rejectMutation(entry, (v) => {
          v.steps[index].viewport[field] = invalid;
        });
      for (const sample of ['lastMeasure', 'actual', 'desired', 'layoutSlot'])
        for (const field of ['width', 'height'])
          rejectMutation(entry, (v) => {
            v.steps[index].root[sample][field] = invalid;
          });
    }
    for (const invalid of [
      null,
      '0',
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
      -1e6 - 1,
      1e6 + 1,
    ])
      for (const field of ['x', 'y'])
        rejectMutation(entry, (v) => {
          v.steps[index].root.layoutSlot[field] = invalid;
        });
  }
});

test('selector counters prove the same owner, reached A/B selections and cumulative bounded calls', () => {
  for (const index of [0, 1, 2, 3, 4]) {
    for (const field of [
      'calls',
      'ownerCalls',
      'otherCalls',
      'itemACalls',
      'itemBCalls',
      'otherItemCalls',
      'singleArgumentCalls',
    ])
      for (const invalid of [null, -1, 0.5, '1', 1025, Number.POSITIVE_INFINITY])
        rejectMutation(SELECTOR, (v) => {
          v.steps[index].selector[field] = invalid;
        });
    for (const mutate of [
      (s) => {
        s.ownerCalls--;
        s.otherCalls++;
      },
      (s) => {
        s.otherItemCalls++;
        s.calls++;
        s.ownerCalls++;
      },
      (s) => {
        s.singleArgumentCalls++;
      },
      (s) => {
        s.calls++;
      },
      (s) => {
        s.sameSelector = false;
      },
      (s) => {
        s.rootMatchesContent = false;
      },
      (s) => {
        s.generatedRootChanged = index === 0 ? false : index === 4;
      },
    ])
      rejectMutation(
        SELECTOR,
        (v) => mutate(v.steps[index].selector),
        index >= 2 ? 'content-template' : 'content-layout',
      );
  }
  for (const index of [1, 3])
    rejectMutation(SELECTOR, (v) => {
      const previous = v.steps[index - 1].selector;
      v.steps[index].selector = { ...previous, generatedRootChanged: true };
    });
  rejectMutation(SELECTOR, (v) => {
    v.steps[0].selector = selectorSample(0, 1, 0);
  });
  rejectMutation(SELECTOR, (v) => {
    v.steps[4].selector = selectorSample(1, 2, 4);
  });
  const repeated = witness();
  for (let index = 0; index < repeated.steps.length; index++)
    repeated.steps[index].selector = selectorSample(
      [2, 2, 3, 5, 6][index],
      [0, 3, 5, 6, 6][index],
      index,
    );
  validatePolicyWitness(repeated, SELECTOR);
  const maximum = witness();
  maximum.steps[4].selector = selectorSample(512, 512, 4);
  validatePolicyWitness(maximum, SELECTOR);
});

test('whole Sheet template accepts cached B selection with new roots and retired parts', () => {
  const cached = witness(SELECTOR);
  for (const index of [2, 3, 4])
    cached.steps[index].selector = selectorSample([1, 2, 2][index - 2], 1, index);
  assert.equal(validatePolicyWitness(cached, SELECTOR), cached);
  for (const mutate of [
    (step) => {
      step.root.kind = 'a';
    },
    (step) => {
      step.selector.generatedRootChanged = false;
    },
    (step) => {
      step.replacement.contentPresentersDiffer = false;
    },
    (step) => {
      step.replacement.retiredContentCleared = false;
    },
    (step) => {
      step.replacement.retiredViewportLoaded = true;
    },
  ]) {
    const invalid = copy(cached);
    mutate(invalid.steps[2]);
    assert.throws(
      () => validatePolicyWitness(invalid, SELECTOR),
      (error) => error.code === 'ERR_ASSERTION' && error.sheetPhase === 'content-template',
    );
  }
});

test('generated roots and full Sheet retirement cannot be replaced by identity or stale-part claims', () => {
  for (let index = 0; index < 5; index++) {
    for (const mutate of [
      (s) => {
        s.contentIsNull = true;
      },
      (s) => {
        s.contentIsUiElement = true;
      },
      (s) => {
        s.root.kind = 'auto';
      },
      (s) => {
        s.root.loaded = false;
      },
      (s) => {
        s.root.heightIsAuto = false;
      },
      (s) => {
        s.root.unboundedWidth = true;
      },
      (s) => {
        s.root.unboundedHeight = true;
      },
      (s) => {
        s.root.actual.height = 0;
      },
      (s) => {
        s.root.layoutSlot.width = 0;
      },
      (s) => {
        s.root.layoutSlot.height++;
      },
      (s) => {
        s.root.layoutSlot.x = -1;
      },
      (s) => {
        s.root.layoutSlot.y = 1;
      },
      (s) => {
        s.root = null;
      },
      (s) => {
        s.selector = null;
      },
    ])
      rejectMutation(SELECTOR, (v) => mutate(v.steps[index]));
  }
  for (const index of [2, 3, 4]) {
    for (const field of Object.keys(replacement(index === 4)))
      rejectMutation(
        SELECTOR,
        (v) => {
          v.steps[index].replacement[field] = !v.steps[index].replacement[field];
        },
        'content-template',
      );
    rejectMutation(
      SELECTOR,
      (v) => {
        v.steps[index].replacement = null;
      },
      'content-template',
    );
  }
  for (const index of [0, 1])
    rejectMutation(SELECTOR, (v) => {
      v.steps[index].replacement = replacement();
    });
});

test('active viewport finite policy and measured extent remain mandatory in Half and Flex', () => {
  for (const entry of POLICY_CASES)
    for (let index = 0; index < witness(entry).steps.length; index++) {
      for (const mutate of [
        (s) => {
          s.viewport = null;
        },
        (s) => {
          s.viewport.sizesContentToTemplatedParent = false;
        },
        (s) => {
          s.viewport.sizesContentToTemplatedParent = null;
        },
        (s) => {
          s.viewport.loaded = 'true';
        },
        (s) => {
          s.viewport.visibility = 'private-sentinel';
        },
      ])
        rejectMutation(entry, (v) => mutate(v.steps[index]));
      if (entry === FLEX && index === 0) continue;
      for (const mutate of [
        (s) => {
          s.viewport.loaded = false;
        },
        (s) => {
          s.viewport.visibility = 'collapsed';
        },
        (s) => {
          s.viewport.viewportWidth = 0;
        },
        (s) => {
          s.viewport.viewportHeight = 0;
        },
        (s) => {
          s.viewport.viewportWidth++;
        },
        (s) => {
          s.viewport.viewportHeight++;
        },
        (s) => {
          s.viewport.scrollableWidth++;
        },
        (s) => {
          s.viewport.scrollableHeight++;
        },
        (s) => {
          s.viewport.actualHeight++;
        },
      ])
        rejectMutation(entry, (v) => mutate(v.steps[index]));
    }
});

test('collapsed empty Flex admits null and zero layout without inventing loaded content', () => {
  const nullable = witness(FLEX);
  for (const field of Object.keys(nullable.steps[0].viewport))
    if (typeof nullable.steps[0].viewport[field] === 'number')
      nullable.steps[0].viewport[field] = null;
  validatePolicyWitness(nullable, FLEX);
  const retained = witness(FLEX);
  retained.steps[0].viewport = { ...viewport(), visibility: 'collapsed' };
  validatePolicyWitness(retained, FLEX);
  for (const mutate of [
    (s) => {
      s.contentIsNull = false;
    },
    (s) => {
      s.contentIsUiElement = true;
    },
    (s) => {
      s.bodyHeight = 64;
    },
    (s) => {
      s.root = root('auto');
    },
    (s) => {
      s.selector = selectorSample(1, 0, 0);
    },
    (s) => {
      s.replacement = replacement();
    },
    (s) => {
      s.viewport.visibility = 'visible';
    },
    (s) => {
      s.viewport.actualHeight = -1;
    },
    (s) => {
      s.viewport.viewportHeight = Number.POSITIVE_INFINITY;
    },
  ])
    rejectMutation(FLEX, (v) => mutate(v.steps[0]), 'content-layout');
});

test('Flex recovery requires a loaded auto UIElement and real anatomy while admitting natural height and overflow', () => {
  for (const mutate of [
    (s) => {
      s.contentIsNull = true;
    },
    (s) => {
      s.contentIsUiElement = false;
    },
    (s) => {
      s.root = null;
    },
    (s) => {
      s.root.kind = 'a';
    },
    (s) => {
      s.root.loaded = false;
    },
    (s) => {
      s.root.heightIsAuto = false;
    },
    (s) => {
      s.root.unboundedHeight = true;
    },
    (s) => {
      s.root.desired.height = 1;
    },
    (s) => {
      s.selector = selectorSample(1, 0, 0);
    },
    (s) => {
      s.replacement = replacement();
    },
    (s) => {
      s.bodyHeight++;
    },
  ])
    rejectMutation(FLEX, (v) => mutate(v.steps[1]), 'content-layout');
  for (const height of [1, 42.125, 100, 748]) {
    const natural = witness(FLEX);
    natural.steps[1].bodyHeight = 64 + height;
    natural.steps[1].viewport = viewport(240, height);
    natural.steps[1].root = root('auto', 240, height, height, 748);
    validatePolicyWitness(natural, FLEX);
  }
  const overflow = witness(FLEX);
  overflow.steps[1].bodyHeight = 812;
  overflow.steps[1].viewport = { ...viewport(100, 748), extentHeight: 1200, scrollableHeight: 452 };
  overflow.steps[1].root = root('auto', 100, 1200, 1200, 748);
  validatePolicyWitness(overflow, FLEX);
});

test('narrower native widths and legitimate Half overflow are accepted beside extent mutations', () => {
  const narrower = witness();
  for (const step of narrower.steps) {
    step.viewport = { ...viewport(240), actualWidth: 343 };
    step.root = root(step.root.kind, 240);
    step.root.lastMeasure.width = 343;
  }
  validatePolicyWitness(narrower, SELECTOR);
  const overflow = witness();
  for (const step of overflow.steps) {
    step.viewport.extentHeight = 600;
    step.viewport.scrollableHeight = 242;
    step.root = root(step.root.kind, 343, 600, 600, 358);
  }
  validatePolicyWitness(overflow, SELECTOR);
  rejectMutation(SELECTOR, (v) => {
    v.steps[0].root.lastMeasure.width = 344;
  });
  rejectMutation(SELECTOR, (v) => {
    v.steps[0].root.layoutSlot.width = 344;
    v.steps[0].root.actual.width = 344;
  });
});

test('failed and partial readbacks retain bounded native facts and never exception text or invented values', () => {
  const sentinel = 'private-sentinel';
  for (const code of ['native-call', 'layout-timeout', 'cancelled'])
    for (const type of [
      'COMException',
      'InvalidOperationException',
      'ArgumentException',
      'TimeoutException',
      'OperationCanceledException',
      'TaskCanceledException',
    ]) {
      const failed = witness();
      failed.status = 'failed';
      failed.phase = 'sheet-template';
      failed.steps.length = 3;
      failed.failure = {
        phase: 'sheet-template',
        code,
        type,
        hresult: -2147467259,
        message: sentinel,
      };
      const readback = policyReadback(failed);
      assert.deepEqual(readback.failure, {
        phase: 'sheet-template',
        code,
        type,
        hresult: -2147467259,
      });
      assert.equal(readback.steps.length, 3);
      assert.equal(JSON.stringify(readback).includes(sentinel), false);
      assert.throws(() => validatePolicyWitness(readback, SELECTOR), { code: 'ERR_ASSERTION' });
    }
  const privateValue = witness();
  privateValue.schema = sentinel;
  privateValue.scenario = sentinel;
  privateValue.status = sentinel;
  privateValue.phase = sentinel;
  privateValue.message = sentinel;
  privateValue.failure = {
    phase: sentinel,
    code: sentinel,
    type: sentinel,
    hresult: -2147483648,
    message: sentinel,
  };
  const partialStep = {
    phase: sentinel,
    bodyHeight: Number.POSITIVE_INFINITY,
    contentIsNull: sentinel,
    viewport: {
      visibility: sentinel,
      actualHeight: -1,
      loaded: sentinel,
      sizesContentToTemplatedParent: sentinel,
    },
    root: {
      kind: sentinel,
      actual: { width: 1e20 },
      lastMeasure: { height: null },
      layoutSlot: { x: sentinel },
      message: sentinel,
    },
    selector: { calls: 1025, sameSelector: sentinel },
    replacement: { retiredViewportLoaded: sentinel },
  };
  privateValue.steps = Array(1000).fill(partialStep);
  const readback = policyReadback(privateValue);
  assert.equal(JSON.stringify(readback).includes(sentinel), false);
  assert.ok(Buffer.byteLength(JSON.stringify(readback)) < 12 * 1024);
  assert.deepEqual(
    [readback.schema, readback.scenario, readback.status, readback.phase],
    [null, null, null, null],
  );
  assert.deepEqual(readback.failure, { phase: null, code: null, type: null, hresult: -2147483648 });
  assert.equal(readback.steps.length, 5);
  assert.equal(readback.steps[0].viewport.actualHeight, null);
  assert.equal(readback.steps[0].viewport.loaded, null);
  assert.equal(readback.steps[0].root.actual.width, null);
  assert.equal(readback.steps[0].root.actual.height, null);
  assert.equal(readback.steps[0].root.layoutSlot.x, null);
  assert.equal(readback.steps[0].selector.calls, null);
  assert.equal(readback.steps[0].replacement.retiredViewportLoaded, null);
  for (const value of [null, undefined, [], true, 'private-sentinel', new Date(), new Map()])
    assert.equal(policyReadback(value), null);
  const empty = policyReadback({});
  assert.deepEqual(empty, {
    schema: null,
    scenario: null,
    status: null,
    phase: null,
    failure: null,
    steps: null,
  });
  assert.throws(() => validatePolicyWitness(empty, SELECTOR), { code: 'ERR_ASSERTION' });
});

test('readback HRESULT and counters have closed numeric bounds, accessors are not evaluated', () => {
  for (const hresult of [-2147483648, -1, 0, 2147483647]) {
    const value = witness();
    value.failure = { phase: 'initial-a', code: 'native-call', type: 'COMException', hresult };
    assert.equal(policyReadback(value).failure.hresult, hresult);
  }
  for (const hresult of [-2147483649, 2147483648, 1.5, '0', null, Number.POSITIVE_INFINITY]) {
    const value = witness();
    value.failure = { hresult };
    assert.equal(policyReadback(value).failure.hresult, null);
  }
  const value = witness();
  Object.defineProperty(value, 'schema', {
    enumerable: true,
    get() {
      throw new Error('private-sentinel');
    },
  });
  assert.equal(policyReadback(value).schema, null);
  assert.throws(
    () => validatePolicyWitness(value, SELECTOR),
    (error) => {
      assert.equal(error.message.includes('private-sentinel'), false);
      assert.equal(JSON.stringify(error).includes('private-sentinel'), false);
      return true;
    },
  );
  for (const observed of [0, 1024, -1, 1025, 1.5, '1', null]) {
    const candidate = witness();
    candidate.steps[0].selector.calls = observed;
    assert.equal(
      policyReadback(candidate).steps[0].selector.calls,
      observed === 0 || observed === 1024 ? observed : null,
    );
  }
});
