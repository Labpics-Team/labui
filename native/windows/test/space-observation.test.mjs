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

test('normal interruption fixtures and reduced Snap keep independent clocks and two native activations', () => {
  for (const theme of ['Light', 'Dark']) {
    for (const motion of [true, false]) validate(spaceFixture(theme, motion), theme);
  }
});

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
      f.space.observation.events[1].key = 'Space';
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
      f.space.observation.events[5].position = 0;
    },
    (f) => {
      f.space.observation.events[7].position = 1;
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
  assert.throws(() => validate(snap), /stale|final/);
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
