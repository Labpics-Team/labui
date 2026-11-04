import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dynamicFixture } from './dynamic-observation.fixture.mjs';
import { validateDynamicObservation } from './dynamic-observation.mjs';

const roundtrip = (value) => JSON.parse(JSON.stringify(value));
const validate = (fixture) =>
  validateDynamicObservation(fixture.space, fixture.identity, fixture.window, fixture.countBefore);

test('same loaded Button observes system disable and continues four-edge input', () => {
  for (const countBefore of [9, 10]) validate(roundtrip(dynamicFixture(countBefore)));
});

test('setting observer may precede or follow product Snap', () => {
  const before = dynamicFixture();
  Object.assign(before.space.observation.settings[1], {
    readStartedMs: 168.9,
    elapsedMs: 169,
    observationCount: 3,
  });
  validate(roundtrip(before));
  validate(roundtrip(dynamicFixture()));
});

test('native Snap allows value-only and idle completion with the same endpoint', () => {
  const fixture = dynamicFixture();
  for (const sample of fixture.space.observation.trace.observations) {
    if (sample.motion.origin === 'Snap' && sample.motion.phase === 'value') {
      sample.motion.phase = 'idle';
      sample.motion.nativeVelocity = 0;
      sample.motion.nativeVelocityVector = { x: 0, y: 0, z: 0 };
    }
  }
  validate(roundtrip(fixture));
});

const cases = [
  [
    'static scenario',
    (f) => {
      f.space.scenario = 'interrupted';
    },
  ],
  [
    'wrong process',
    (f) => {
      f.space.observation.trace.pid++;
    },
  ],
  [
    'wrong live channel',
    (f) => {
      f.space.observation.trace.channel = 2;
    },
  ],
  [
    'wrong settings mode',
    (f) => {
      f.identity.animation.expected = false;
    },
  ],
  [
    'settings missing',
    (f) => {
      f.space.observation.settings.pop();
    },
  ],
  [
    'settings never changed',
    (f) => {
      f.space.observation.settings[1].animationsEnabled = true;
    },
  ],
  [
    'setter readback true',
    (f) => {
      f.space.observation.mutation.readback = true;
    },
  ],
  [
    'setter on dispatcher',
    (f) => {
      f.space.observation.mutation.threadId = 1;
    },
  ],
  [
    'mutation before interior read',
    (f) => {
      f.space.observation.mutation.startedMs = 165;
    },
  ],
  [
    'mutation outside held input',
    (f) => {
      f.space.observation.mutation.completedMs = 205;
    },
  ],
  [
    'already settled at mutation',
    (f) => {
      f.space.observation.trace.events[4].position = 1;
    },
  ],
  [
    'idle before system Snap',
    (f) => {
      f.space.observation.trace.observations[2].motion.phase = 'idle';
    },
  ],
  [
    'requested without movement',
    (f) => {
      for (const index of [1, 2])
        f.space.observation.trace.observations[index].motion.phase = 'custom';
    },
  ],
  [
    'missing system Snap',
    (f) => {
      f.space.observation.trace.observations[3].motion.phase = 'value';
    },
  ],
  [
    'same-target Snap not acknowledged',
    (f) => {
      f.space.observation.trace.observations[4].motion.phase = 'custom';
    },
  ],
  [
    'system Snap to wrong endpoint',
    (f) => {
      f.space.observation.trace.observations[4].motion.position = 0;
      f.space.observation.trace.observations[4].motion.readbackPosition = 0;
    },
  ],
  [
    'stale native callback',
    (f) => {
      f.space.observation.trace.observations[4].motion.nativeRequestId--;
    },
  ],
  [
    'ignored callback',
    (f) => {
      f.space.observation.trace.observations[4].motion.phase = 'ignored';
    },
  ],
  [
    'wrong final endpoint',
    (f) => {
      f.space.observation.trace.observations.at(-1).motion.readbackPosition = 0.5;
    },
  ],
  [
    'last Snap unacknowledged',
    (f) => {
      f.space.observation.trace.observations.at(-1).motion.phase = 'custom';
    },
  ],
  [
    'repeat down',
    (f) => {
      f.space.observation.trace.events[3].repeat = true;
    },
  ],
  [
    'lost focus',
    (f) => {
      f.space.observation.trace.events[4].focused = false;
    },
  ],
  [
    'replaced channel',
    (f) => {
      f.space.observation.trace.events[4].currentChannel = false;
    },
  ],
  [
    'extra click',
    (f) => {
      f.space.observation.trace.countAfter++;
    },
  ],
  [
    'unaccepted OS edge',
    (f) => {
      f.space.injection.events[1].accepted = 0;
    },
  ],
  [
    'wrong OS edge order',
    (f) => {
      f.space.injection.events[1].keyDown = true;
    },
  ],
  [
    'wrong readiness identity',
    (f) => {
      f.space.injection.readiness[1].step = 1;
    },
  ],
  [
    'input ends before last edge',
    (f) => {
      f.space.injection.completedTicks = f.space.injection.events[2].completedTicks;
    },
  ],
  [
    'trace overflow',
    (f) => {
      f.space.observation.trace.overflow = 1;
    },
  ],
  [
    'retained discarded callback',
    (f) => {
      f.space.observation.trace.firstDiscarded = {};
    },
  ],
  [
    'observer failure',
    (f) => {
      f.space.observation.trace.failure = 'lost';
    },
  ],
  [
    'incomplete trace',
    (f) => {
      f.space.observation.trace.status = 'waiting';
    },
  ],
  [
    'no common harness origin',
    (f) => {
      f.space.window.completeCompletedMs = 460;
    },
  ],
  [
    'clock precision lost',
    (f) => {
      f.space.observation.trace.clockOriginTicks = Number(
        f.space.observation.trace.clockOriginTicks,
      );
    },
  ],
];
for (const [name, mutate] of cases)
  test(`rejects ${name}`, () => {
    const fixture = dynamicFixture();
    mutate(fixture);
    assert.throws(() => validate(roundtrip(fixture)), /Dynamic:/);
  });

test('JSON admission rejects type substitution throughout critical fields', () => {
  const setters = [
    (f, v) => {
      f.space.observation.schemaVersion = v;
    },
    (f, v) => {
      f.space.observation.trace.pid = v;
    },
    (f, v) => {
      f.space.observation.trace.events[4].position = v;
    },
    (f, v) => {
      f.space.observation.trace.observations[4].motion.nativeRequestId = v;
    },
    (f, v) => {
      f.space.observation.mutation.threadId = v;
    },
    (f, v) => {
      f.space.observation.settings[1].observationCount = v;
    },
    (f, v) => {
      f.space.injection.clockFrequency = v;
    },
  ];
  for (const set of setters)
    for (const invalid of ['1', null, true, [], {}, Number.NaN]) {
      const fixture = dynamicFixture();
      set(fixture, invalid);
      assert.throws(() => validate(roundtrip(fixture)), /Dynamic:/);
    }
});

test('trace interpretation is invariant under a common exact tick-origin translation', () => {
  for (const offset of [1n, 1000000000000n, -1000000000000n]) {
    const fixture = dynamicFixture();
    const move = (value) => String(BigInt(value) + offset);
    fixture.space.observation.trace.clockOriginTicks = move(
      fixture.space.observation.trace.clockOriginTicks,
    );
    for (const name of ['clockOriginTicks', 'clockOriginUpperTicks'])
      fixture.window[name] = move(fixture.window[name]);
    const injection = fixture.space.injection;
    for (const record of [injection, ...injection.events, ...injection.readiness]) {
      record.startedTicks = move(record.startedTicks);
      record.completedTicks = move(record.completedTicks);
    }
    validate(roundtrip(fixture));
  }
});

test('CLI requires the named dynamic result and exact companion timing file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'labui-dynamic-validator-'));
  const script = fileURLToPath(new URL('./dynamic-observation.mjs', import.meta.url));
  const fixture = dynamicFixture(10);
  const result = {
    lifetime: {},
    dynamicMotion: {
      scenario: 'dynamic-reduced-motion',
      gestureTiming: 'interaction-Dynamic-window.json',
      space: fixture.space,
    },
  };
  const identity = { ...fixture.identity, dynamicMotionExpected: true };
  const execute = () =>
    spawnSync(process.execPath, [script, join(root, 'result.json'), join(root, 'identity.json')], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
  try {
    await writeFile(join(root, 'identity.json'), JSON.stringify(identity));
    await writeFile(join(root, 'result.json'), JSON.stringify(result));
    await writeFile(join(root, 'interaction-Dynamic-window.json'), JSON.stringify(fixture.window));
    const healthy = execute();
    equalExit(healthy, 0);
    assert.match(healthy.stdout, /Dynamic observation: PASS/);
    result.dynamicMotion.gestureTiming = '../outside.json';
    await writeFile(join(root, 'result.json'), JSON.stringify(result));
    const unsafe = execute();
    equalExit(unsafe, 1);
    assert.match(unsafe.stderr, /Dynamic: timing filename/);
    result.dynamicMotion.gestureTiming = 'interaction-Dynamic-window.json';
    identity.dynamicMotionExpected = false;
    await writeFile(join(root, 'result.json'), JSON.stringify(result));
    await writeFile(join(root, 'identity.json'), JSON.stringify(identity));
    const missing = execute();
    equalExit(missing, 1);
    assert.match(missing.stderr, /Dynamic: dynamic qualification expected/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function equalExit(result, code) {
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, code, result.stderr);
}
