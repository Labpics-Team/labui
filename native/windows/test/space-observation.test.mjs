import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spaceFixture } from './space-observation.fixture.mjs';
import { validateSpaceObservation } from './space-observation.mjs';

function validate(fixture, theme = 'Light') {
  return validateSpaceObservation(fixture.space, fixture.identity, theme, fixture.window);
}

for (const boundary of [1, 2]) {
  test(`complete PRE endpoint data rejects a missing late idle at retarget ${boundary}`, () => {
    const fixture = spaceFixture();
    const observation = fixture.space.observation;
    const requests = observation.observations.filter(
      (sample) => sample.motion.phase === 'requested',
    );
    const preview = observation.events.filter((event) => event.kind.startsWith('previewKey'))[
      boundary
    ];
    const endpoint = boundary === 1 ? 1 : 0;
    Object.assign(requests[boundary].motion, {
      position: endpoint,
      readbackPosition: endpoint,
      nativePosition: { x: endpoint * 1000, y: 0, z: 0 },
      nativeReadbackPosition: { x: endpoint * 1000, y: 0, z: 0 },
    });
    preview.position = endpoint;
    const key = observation.events.filter(
      (event) => event.kind === 'keyDown' || event.kind === 'keyUp',
    )[boundary];
    key.position = boundary === 1 ? 0.99998 : 0.00002;
    // PRE полностью заполнен и относится к прежнему request; последующий key уже видит новое движение.
    assert.equal(preview.nativeRequestId, requests[boundary - 1].motion.nativeRequestId);
    assert.throws(() => validate(fixture), /before-retarget readback/);
  });
}

test('normal interruption fixtures and reduced Snap keep independent clocks and two native activations', () => {
  for (const theme of ['Light', 'Dark']) {
    for (const motion of [true, false]) validate(spaceFixture(theme, motion), theme);
  }
});

test('widening only the measured harness start bracket preserves a feasible shared clock', () => {
  for (const theme of ['Light', 'Dark']) {
    for (const motion of [true, false]) {
      const fixture = spaceFixture(theme, motion);
      const actualOrigin = BigInt(fixture.window.clockOriginTicks);
      fixture.window.clockOriginTicks = String(actualOrigin - 4000n);
      // f=1 MHz: receipt завершён на 435 ms при том же истинном H, внутри [216,438].
      assert.equal(
        Number(BigInt(fixture.space.injection.completedTicks) - actualOrigin) / 1000,
        435,
      );
      assert.doesNotThrow(() => validate(fixture, theme));
    }
  }
});

test('clock binding accepts an inclusive origin endpoint and rejects the adjacent impossible interval', () => {
  const fixture = spaceFixture();
  const actualOrigin = BigInt(fixture.window.clockOriginTicks);
  fixture.window.clockOriginTicks = String(actualOrigin - 4000n);
  fixture.window.clockOriginUpperTicks = String(actualOrigin);
  fixture.space.window.inputCompletedMs = 435;
  assert.deepEqual(validate(fixture), {
    originTicks: String(actualOrigin - 4000n),
    originUpperTicks: String(actualOrigin),
    frequency: 1000000,
    lowerMs: 4,
    upperMs: 4,
  });
  fixture.space.window.inputCompletedMs = 434.999;
  assert.throws(() => validate(fixture), /outside measured command/);
});

test('different events cannot choose contradictory origins from the same measured bracket', () => {
  const fixture = spaceFixture();
  const actualOrigin = BigInt(fixture.window.clockOriginTicks);
  fixture.window.clockOriginTicks = String(actualOrigin - 4000n);
  fixture.window.clockOriginUpperTicks = String(actualOrigin);
  fixture.space.window.inputStartedMs = 226;
  fixture.space.window.inputCompletedMs = 442;
  // Receipt start требует delta>=104 ms; arm end требует delta<=101 ms.
  // Оба ограничения по отдельности пересекают [100,104], общего решения нет.
  assert.throws(() => validate(fixture), /outside measured command/);
});

for (const boundary of [1, 2]) {
  test(`retarget ${boundary} preserves movement samples at the replacement timestamp`, () => {
    const fixture = spaceFixture();
    const samples = fixture.space.observation.observations;
    const requests = samples.filter((sample) => sample.motion.phase === 'requested');
    const preview = fixture.space.observation.events.filter((event) =>
      event.kind.startsWith('previewKey'),
    )[boundary];
    preview.elapsedMs = requests[boundary].elapsedMs;
    preview.readStartedMs = preview.elapsedMs;
    for (const sample of samples) {
      if (
        sample.motion.nativeRequestId === requests[boundary - 1].motion.nativeRequestId &&
        sample.motion.phase !== 'requested'
      ) {
        sample.elapsedMs = requests[boundary].elapsedMs;
        sample.motion.seconds = sample.elapsedMs / 1000;
      }
    }
    assert.doesNotThrow(() => validate(fixture));
  });

  for (const offsetMs of [-0.001, 0]) {
    test(`retarget ${boundary} rejects prior idle at replacement timestamp ${offsetMs} ms`, () => {
      const fixture = spaceFixture();
      const samples = fixture.space.observation.observations;
      const requests = samples.filter((sample) => sample.motion.phase === 'requested');
      const replacement = requests[boundary];
      const elapsedMs = replacement.elapsedMs + offsetMs;
      const endpoint = boundary === 1 ? 1 : 0;
      const position = {
        position: endpoint,
        readbackPosition: endpoint,
        nativePosition: { x: endpoint * 1000, y: 0, z: 0 },
        nativeReadbackPosition: { x: endpoint * 1000, y: 0, z: 0 },
      };
      Object.assign(replacement.motion, structuredClone(position));
      const insertion = samples.indexOf(replacement);
      samples.splice(insertion, 0, {
        elapsedMs,
        threadId: 1,
        motion: {
          ...requests[boundary - 1].motion,
          ...position,
          phase: 'idle',
          seconds: elapsedMs / 1000,
          nativeVelocity: 0,
          nativeVelocityVector: { x: 0, y: 0, z: 0 },
        },
      });
      for (const event of fixture.space.observation.events) {
        if (event.observationCount > insertion) event.observationCount++;
      }
      if (boundary === 2) {
        fixture.space.observation.events.filter((event) => event.kind === 'pressed')[2].position =
          0.00001;
        fixture.space.observation.events.filter((event) => event.kind === 'keyDown')[1].position =
          0.00002;
      }
      assert.throws(() => validate(fixture), /interrupted operation already idle/);
    });
  }
}

test('missing trace and invalid required fields, enum, number or generation cannot pass', () => {
  const changes = [
    (f) => {
      f.space = undefined;
    },
    (f) => {
      f.space.observation.pid++;
    },
    (f) => {
      f.space.observation.processStartedAtUnixMs++;
    },
    (f) => {
      f.space.observation.channel = 2;
    },
    (f) => {
      f.space.observation.theme = 'Dark';
    },
    (f) => {
      f.space.observation.status = 'waiting';
    },
    (f) => {
      f.space.observation.overflow = 1;
    },
    (f) => {
      f.space.observation.failure = 'buffer lost';
    },
    (f) => {
      f.space.observation.positionKind = 'atomic';
    },
    (f) => {
      Reflect.deleteProperty(f.space.observation.observations[0].motion, 'nativeVelocity');
    },
    (f) => {
      f.space.observation.observations[0].motion.nativePosition.x = Number.NaN;
    },
    (f) => {
      f.space.observation.observations[0].motion.nativeReadbackPosition.y =
        Number.POSITIVE_INFINITY;
    },
    (f) => {
      f.space.observation.observations[0].motion.nativeVelocityVector = {};
    },
    (f) => {
      f.space.observation.observations[0].motion.phase = 'settling';
    },
    (f) => {
      f.space.observation.observations[0].motion.origin = 'animation';
    },
    (f) => {
      f.space.observation.observations[0].threadId = null;
    },
    (f) => {
      f.space.observation.events[1].currentChannel = false;
    },
    (f) => {
      f.space.observation.events[1].focused = false;
    },
    (f) => {
      f.space.observation.events[1].position = '0.5';
    },
    (f) => {
      f.space.observation.events[0].key = 'Space';
    },
    (f) => {
      f.space.observation.events[1].kind = 'pressed-intent';
    },
    (f) => {
      f.space.observation.events[2].repeat = true;
    },
    (f) => {
      f.space.observation.events[2].key = 'Enter';
    },
    (f) => {
      f.space.observation.events[2].isPressed = false;
    },
    (f) => {
      f.space.observation.clockOriginTicks = Number(f.space.observation.clockOriginTicks);
    },
    (f) => {
      Reflect.deleteProperty(f.window, 'clockOriginUpperTicks');
    },
    (f) => {
      f.window.clockFrequency++;
    },
    (f) => {
      f.space.injection.clockFrequency++;
    },
  ];
  for (const change of changes) {
    const fixture = spaceFixture();
    change(fixture);
    assert.throws(() => validate(fixture), undefined, String(change));
  }
});

test('lost phase, stale completion and a third click are rejected without weakening Snap', () => {
  for (const change of [
    (f) => {
      f.space.observation.events.splice(2, 1);
    },
    (f) => {
      f.space.observation.events.splice(3, 1);
    },
    (f) => {
      f.space.observation.events.filter((event) => event.kind === 'previewKeyUp')[0].position = 0;
    },
    (f) => {
      f.space.observation.events.filter((event) => event.kind === 'previewKeyDown')[1].position = 1;
    },
    (f) => {
      f.space.observation.observations[4].motion.phase = 'idle';
    },
    (f) => {
      f.space.observation.observations.splice(4, 1);
    },
    (f) => {
      f.space.observation.observations.at(-1).motion.nativeRequestId--;
    },
    (f) => {
      f.space.observation.observations.at(-1).motion.operation--;
    },
    (f) => {
      f.space.observation.observations.at(-1).motion.readbackPosition = 0.002;
    },
    (f) => {
      f.space.observation.observations.at(-1).motion.position = 0.002;
    },
    (f) => {
      f.space.observation.observations.at(-1).motion.phase = 'value';
    },
    (f) => {
      f.space.observation.events.at(-1).position = 0.002;
    },
    (f) => {
      f.space.observation.events.at(-1).isPressed = true;
    },
    (f) => {
      f.space.observation.events.splice(-1, 0, {
        ...f.space.observation.events.at(-2),
        kind: 'click',
        key: null,
        repeat: false,
      });
    },
    (f) => {
      f.space.observation.countAfter++;
    },
  ]) {
    const fixture = spaceFixture();
    change(fixture);
    assert.throws(() => validate(fixture), undefined, String(change));
  }
  const snap = spaceFixture('Light', false);
  validate(snap);
  snap.space.observation.observations.at(-1).motion.nativeRequestId--;
  for (const event of snap.space.observation.events) {
    if (event.observationCount === snap.space.observation.observations.length)
      event.nativeRequestId--;
  }
  assert.throws(() => validate(snap), /stale|final/);
});

test('PRE uses existing endpoint tolerances and permits interior readback regardless of later movement', () => {
  for (const boundary of [1, 2]) {
    for (const position of [0, 0.0005, 0.001, 0.999, 0.9995, 1]) {
      const fixture = spaceFixture();
      fixture.space.observation.events.filter((event) => event.kind.startsWith('previewKey'))[
        boundary
      ].position = position;
      assert.throws(() => validate(fixture), /before-retarget readback/);
    }
    for (const position of [0.0011, 0.5, 0.9989]) {
      const fixture = spaceFixture();
      fixture.space.observation.events.filter((event) => event.kind.startsWith('previewKey'))[
        boundary
      ].position = position;
      fixture.space.observation.events.filter(
        (event) => event.kind === 'keyDown' || event.kind === 'keyUp',
      )[boundary].position = 0;
      assert.doesNotThrow(() => validate(fixture));
    }
  }
});

test('PRE requires preceding movement and rejects mismatched state, prefix, request or ordering', () => {
  for (const change of [
    (preview) => {
      preview.isPressed = !preview.isPressed;
    },
    (preview) => {
      preview.operation++;
    },
    (preview) => {
      preview.nativeRequestId++;
    },
    (preview) => {
      preview.observationCount++;
    },
    (preview) => {
      preview.observationCount = '3';
    },
    (preview) => {
      preview.operation = null;
    },
    (preview) => {
      preview.readStartedMs = 204.6;
      preview.elapsedMs = 204.6;
    },
  ]) {
    const fixture = spaceFixture();
    change(fixture.space.observation.events.find((event) => event.kind === 'previewKeyUp'));
    assert.throws(() => validate(fixture), undefined, String(change));
  }
  const late = spaceFixture();
  const preview = late.space.observation.events.find((event) => event.kind === 'previewKeyUp');
  preview.observationCount = 1;
  for (const sample of late.space.observation.observations.slice(1, 3)) {
    sample.elapsedMs = 204.4;
    sample.motion.seconds = 0.2044;
  }
  assert.throws(() => validate(late), /movement before interruption absent/);
  const absent = spaceFixture();
  absent.space.observation.events = absent.space.observation.events.filter(
    (event) => !event.kind.startsWith('previewKey'),
  );
  assert.throws(() => validate(absent), /bounded events|preview keys/);
});

test('OS acceptance and measured clock windows bind every edge to this gesture', () => {
  for (const change of [
    (f) => {
      f.space.injection.pid++;
    },
    (f) => {
      f.space.injection.window++;
    },
    (f) => {
      f.space.injection.events[0].accepted = 0;
    },
    (f) => {
      f.space.injection.events[0].accepted = true;
    },
    (f) => {
      f.space.injection.events[1].keyDown = true;
    },
    (f) => {
      f.space.injection.events.pop();
    },
    (f) => {
      f.space.injection.events[1].startedTicks = f.space.injection.events[0].startedTicks;
    },
    (f) => {
      f.space.injection.events[0].completedTicks = Number(
        f.space.injection.events[0].completedTicks,
      );
    },
    (f) => {
      f.space.injection.completedTicks = f.space.injection.startedTicks;
    },
    (f) => {
      f.space.window.inputStartedMs = 430;
    },
    (f) => {
      f.space.window.armCompletedMs = 213;
    },
    (f) => {
      f.space.window.completeCompletedMs = 470;
    },
    (f) => {
      f.window.clockOriginUpperTicks = String(BigInt(f.window.clockOriginTicks) - 1n);
    },
    (f) => {
      f.space.observation.events[2].readStartedMs = 120;
    },
    (f) => {
      f.space.observation.observations[0].elapsedMs = 122;
    },
  ]) {
    const fixture = spaceFixture();
    change(fixture);
    assert.throws(() => validate(fixture), undefined, String(change));
  }
});

test('CLI reads the same result, identity and both timing files, preserving input bytes', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'labui-space-observation-'));
  try {
    const identity = spaceFixture().identity;
    const result = { spacePattern: 'interrupted', captures: {} };
    for (const theme of ['Light', 'Dark']) {
      const fixture = spaceFixture(theme);
      result.captures[theme] = {
        space: fixture.space,
        gestureTiming: `interaction-${theme}-window.json`,
      };
      await writeFile(
        join(directory, `interaction-${theme}-window.json`),
        JSON.stringify(fixture.window),
      );
    }
    const resultBytes = JSON.stringify(result);
    await writeFile(join(directory, 'result.json'), resultBytes);
    await writeFile(join(directory, 'identity.json'), JSON.stringify(identity));
    const cli = fileURLToPath(new URL('./space-observation.mjs', import.meta.url));
    const run = () =>
      spawnSync(
        process.execPath,
        [cli, join(directory, 'result.json'), join(directory, 'identity.json')],
        { encoding: 'utf8', windowsHide: true },
      );
    const passed = run();
    assert.equal(passed.status, 0, passed.stderr);
    assert.equal(await readFile(join(directory, 'result.json'), 'utf8'), resultBytes);
    Reflect.deleteProperty(result.captures.Dark, 'space');
    await writeFile(join(directory, 'result.json'), JSON.stringify(result));
    const failed = run();
    assert.notEqual(failed.status, 0);
    assert.equal(failed.stdout, '');
    assert.match(failed.stderr, /trace/);
  } finally {
    const target = await realpath(directory);
    const child = relative(temporaryRoot, target);
    assert.ok(
      child &&
        !isAbsolute(child) &&
        child !== '..' &&
        !child.startsWith(`..${sep}`) &&
        !child.includes(sep),
    );
    await rm(target, { recursive: true, force: true });
  }
});
