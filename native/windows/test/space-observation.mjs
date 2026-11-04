import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const number = (value, name, minimum = 0) =>
  assert.ok(
    typeof value === 'number' && Number.isFinite(value) && value >= minimum,
    `Space: ${name}`,
  );
const integer = (value, name, minimum = 0) =>
  assert.ok(Number.isSafeInteger(value) && value >= minimum, `Space: ${name}`);
const object = (value, name) =>
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), `Space: ${name}`);
const boolean = (value, name) => assert.equal(typeof value, 'boolean', `Space: ${name}`);
function ticks(value, name) {
  assert.equal(typeof value, 'string', `Space: ${name}`);
  assert.match(value, /^(0|[1-9][0-9]*)$/, `Space: ${name}`);
  const parsed = BigInt(value);
  assert.ok(parsed <= 9223372036854775807n, `Space: ${name}`);
  return parsed;
}
function vector(value, name) {
  object(value, name);
  for (const axis of ['x', 'y', 'z'])
    number(value[axis], `${name}.${axis}`, Number.NEGATIVE_INFINITY);
}
const sameRequest = (left, right) =>
  left.operation === right.operation &&
  left.nativeRequestId === right.nativeRequestId &&
  left.origin === right.origin;
const progressTolerance = 0.001;

// Проверка конкретного consumer trace. Время чтения Position не является временем атомарного состояния клавиши.
export function validateSpaceObservation(space, identity, theme, captureWindow) {
  object(space, 'trace отсутствует');
  object(identity, 'identity');
  object(captureWindow, 'capture window');
  assert.ok(['Light', 'Dark'].includes(theme), 'Space: theme');
  integer(identity.pid, 'identity pid', 1);
  integer(identity.startedAtUnixMs, 'process start', 1);
  assert.match(identity.window, /^[1-9][0-9]*$/, 'Space: window identity');
  boolean(identity.animation?.expected, 'expected animation');
  const observation = space.observation;
  const injection = space.injection;
  const window = space.window;
  object(observation, 'observation');
  object(injection, 'injection');
  object(window, 'command windows');
  assert.equal(observation.schemaVersion, 1, 'Space: schema');
  assert.equal(observation.status, 'complete', 'Space: incomplete');
  assert.equal(observation.pid, identity.pid, 'Space: observation PID');
  assert.equal(
    observation.processStartedAtUnixMs,
    identity.startedAtUnixMs,
    'Space: process generation',
  );
  assert.equal(observation.automationId, 'LabButtonMedium', 'Space: target');
  assert.equal(observation.theme, theme, 'Space: observation theme');
  assert.equal(observation.channel, theme === 'Light' ? 1 : 2, 'Space: channel generation');
  assert.equal(
    observation.animationsEnabled,
    identity.animation.expected,
    'Space: animation setting',
  );
  const before = theme === 'Light' ? 4 : 7;
  assert.equal(observation.countBefore, before, 'Space: count before');
  assert.equal(observation.countAfter, before + 2, 'Space: count after');
  assert.equal(observation.overflow, 0, 'Space: overflow');
  assert.equal(observation.failure, null, 'Space: observer failed');
  assert.equal(observation.clock, 'app-stopwatch-ms', 'Space: app clock');
  assert.equal(observation.positionKind, 'asynchronous-readback', 'Space: readback scope');
  integer(observation.clockFrequency, 'clock frequency', 1);
  assert.equal(
    injection.clockFrequency,
    observation.clockFrequency,
    'Space: input clock frequency',
  );
  assert.equal(
    captureWindow.clockFrequency,
    observation.clockFrequency,
    'Space: harness clock frequency',
  );
  assert.equal(captureWindow.clock, 'harness-stopwatch-ms', 'Space: harness clock');
  const frequency = observation.clockFrequency;
  const appOrigin = ticks(observation.clockOriginTicks, 'app origin');
  const harnessLow = ticks(captureWindow.clockOriginTicks, 'harness origin lower');
  const harnessHigh = ticks(captureWindow.clockOriginUpperTicks, 'harness origin upper');
  assert.ok(harnessHigh >= harnessLow, 'Space: harness origin bounds');
  const milliseconds = (difference) => {
    assert.ok(
      difference >= -9007199254740991n && difference <= 9007199254740991n,
      'Space: clock difference',
    );
    return (Number(difference) * 1000) / frequency;
  };
  const appTime = (value) => milliseconds(value - appOrigin);
  const harnessTime = (elapsed) => [
    milliseconds(appOrigin - harnessHigh) + elapsed,
    milliseconds(appOrigin - harnessLow) + elapsed,
  ];
  const within = (elapsed, start, end, name) => {
    const [lower, upper] = harnessTime(elapsed);
    assert.ok(lower >= start && upper <= end, `Space: ${name} outside measured command`);
  };
  const fields = [
    'armStartedMs',
    'armCompletedMs',
    'inputStartedMs',
    'inputCompletedMs',
    'completeStartedMs',
    'completeCompletedMs',
  ];
  let prior = 0;
  for (const name of fields) {
    number(window[name], name);
    assert.ok(window[name] >= prior, 'Space: command order');
    prior = window[name];
  }
  assert.ok(
    window.armCompletedMs > window.armStartedMs &&
      window.inputCompletedMs > window.inputStartedMs &&
      window.completeCompletedMs > window.completeStartedMs,
    'Space: empty command window',
  );
  assert.ok(Array.isArray(captureWindow.gestures), 'Space: gestures');
  const rapid = captureWindow.gestures.filter((entry) => entry.name === 'rapid-space');
  assert.equal(rapid.length, 1, 'Space: rapid gesture identity');
  number(rapid[0].startedMs, 'rapid start');
  number(rapid[0].completedMs, 'rapid end');
  assert.ok(
    window.armStartedMs >= rapid[0].startedMs && window.completeCompletedMs <= rapid[0].completedMs,
    'Space: commands outside recorded gesture',
  );

  assert.equal(injection.pid, identity.pid, 'Space: input PID');
  integer(injection.window, 'input HWND', 1);
  assert.equal(String(injection.window), identity.window, 'Space: input HWND identity');
  const inputStart = ticks(injection.startedTicks, 'input start');
  const inputEnd = ticks(injection.completedTicks, 'input end');
  assert.ok(inputEnd >= inputStart, 'Space: input bounds');
  assert.ok(milliseconds(inputEnd - inputStart) <= 5000, 'Space: input budget');
  within(appTime(inputStart), window.inputStartedMs, window.inputCompletedMs, 'input start');
  within(appTime(inputEnd), window.inputStartedMs, window.inputCompletedMs, 'input end');
  assert.ok(
    Array.isArray(injection.events) && injection.events.length === 4,
    'Space: four OS edges',
  );
  let previousTick = inputStart;
  const edgeStarts = injection.events.map((event, index) => {
    object(event, 'OS event');
    assert.equal(event.keyDown, index % 2 === 0, 'Space: OS edge order');
    assert.equal(event.accepted, 1, 'Space: OS did not accept exactly one event');
    const start = ticks(event.startedTicks, 'OS event start');
    const end = ticks(event.completedTicks, 'OS event end');
    assert.ok(start >= previousTick && end >= start && end <= inputEnd, 'Space: OS event time');
    previousTick = end;
    return appTime(start);
  });

  number(observation.elapsedMs, 'observation end');
  within(
    observation.elapsedMs,
    window.completeStartedMs,
    window.completeCompletedMs,
    'observation end',
  );
  const events = observation.events;
  assert.ok(
    Array.isArray(events) && events.length >= 16 && events.length <= 24,
    'Space: complete bounded events',
  );
  let elapsed = -1;
  let count = before;
  let observationCount = 0;
  for (const event of events) {
    object(event, 'app event');
    number(event.elapsedMs, 'event time');
    number(event.readStartedMs, 'read start');
    assert.ok(
      event.readStartedMs >= elapsed &&
        event.elapsedMs >= event.readStartedMs &&
        event.elapsedMs <= observation.elapsedMs,
      'Space: event/read order',
    );
    elapsed = event.elapsedMs;
    assert.ok(
      [
        'armed',
        'pressed',
        'previewKeyDown',
        'previewKeyUp',
        'keyDown',
        'keyUp',
        'click',
        'focus',
        'complete',
      ].includes(event.kind),
      'Space: event kind',
    );
    for (const name of ['repeat', 'isPressed', 'focused', 'currentChannel'])
      boolean(event[name], `event ${name}`);
    assert.equal(event.focused, true, 'Space: focus lost');
    assert.equal(event.currentChannel, true, 'Space: channel replaced');
    integer(event.count, 'event count');
    assert.ok(event.count >= count && event.count <= before + 2, 'Space: count changed');
    count = event.count;
    number(event.position, 'event position', Number.NEGATIVE_INFINITY);
    integer(event.observationCount, 'event observation prefix');
    assert.ok(
      event.observationCount >= observationCount && event.observationCount <= 128,
      'Space: observation prefix order',
    );
    observationCount = event.observationCount;
    if (observationCount === 0) {
      assert.equal(event.operation, null, 'Space: empty observation operation');
      assert.equal(event.nativeRequestId, null, 'Space: empty observation request');
    } else {
      integer(event.operation, 'event operation');
      integer(event.nativeRequestId, 'event native request');
    }
    if (['previewKeyDown', 'previewKeyUp', 'keyDown', 'keyUp'].includes(event.kind))
      assert.equal(event.key, 'Space', 'Space: actual key');
    else {
      assert.equal(event.key, null, 'Space: non-key event');
      assert.equal(event.repeat, false, 'Space: non-key repeat');
    }
  }
  assert.equal(events[0].kind, 'armed', 'Space: first event');
  assert.equal(events.filter((event) => event.kind === 'armed').length, 1, 'Space: one arm');
  assert.equal(events[0].isPressed, false, 'Space: already pressed');
  assert.equal(events[0].count, before, 'Space: armed count');
  within(events[0].readStartedMs, window.armStartedMs, window.armCompletedMs, 'arm');
  within(events[0].elapsedMs, window.armStartedMs, window.armCompletedMs, 'arm read');
  const complete = events.at(-1);
  assert.equal(complete.kind, 'complete', 'Space: last event');
  assert.equal(
    events.filter((event) => event.kind === 'complete').length,
    1,
    'Space: one completion',
  );
  assert.equal(complete.isPressed, false, 'Space: latest up not applied');
  assert.equal(complete.count, before + 2, 'Space: completion count');
  assert.ok(Math.abs(complete.position) <= progressTolerance, 'Space: final readback');
  within(
    complete.readStartedMs,
    window.completeStartedMs,
    window.completeCompletedMs,
    'completion',
  );
  const keys = events.filter((event) => event.kind === 'keyDown' || event.kind === 'keyUp');
  const previews = events.filter(
    (event) => event.kind === 'previewKeyDown' || event.kind === 'previewKeyUp',
  );
  const pressed = events.filter((event) => event.kind === 'pressed');
  assert.deepEqual(
    previews.map((event) => event.kind),
    ['previewKeyDown', 'previewKeyUp', 'previewKeyDown', 'previewKeyUp'],
    'Space: four ancestor preview keys',
  );
  assert.deepEqual(
    keys.map((event) => event.kind),
    ['keyDown', 'keyUp', 'keyDown', 'keyUp'],
    'Space: four received keys',
  );
  assert.deepEqual(
    pressed.map((event) => event.isPressed),
    [true, false, true, false],
    'Space: native IsPressed transitions',
  );
  for (const [index, key] of keys.entries()) {
    const preview = previews[index];
    assert.equal(preview.isPressed, index % 2 !== 0, 'Space: preview/native old state');
    assert.equal(preview.repeat, key.repeat, 'Space: preview/key repeat identity');
    assert.ok(
      events.indexOf(preview) < events.indexOf(pressed[index]) &&
        events.indexOf(pressed[index]) < events.indexOf(key) &&
        (index === 0 || events.indexOf(preview) > events.indexOf(keys[index - 1])),
      'Space: preview precedes native processing',
    );
    assert.equal(key.isPressed, index % 2 === 0, 'Space: key/native state');
    if (index % 2 === 0) assert.equal(key.repeat, false, 'Space: autorepeat is not a new press');
    assert.ok(
      preview.readStartedMs >= edgeStarts[index] &&
        key.readStartedMs >= edgeStarts[index] &&
        pressed[index].readStartedMs >= edgeStarts[index],
      'Space: app event precedes OS edge',
    );
  }
  const clicks = events.filter((event) => event.kind === 'click');
  assert.deepEqual(
    clicks.map((event) => event.count),
    [before + 1, before + 2],
    'Space: exactly two native activations',
  );
  assert.ok(
    clicks[0].readStartedMs >= edgeStarts[1] && clicks[1].readStartedMs >= edgeStarts[3],
    'Space: click precedes release',
  );

  const samples = observation.observations;
  assert.ok(
    Array.isArray(samples) && samples.length >= 5 && samples.length <= 128,
    'Space: bounded Motion observations',
  );
  elapsed = -1;
  let seconds = -1;
  for (const sample of samples) {
    object(sample, 'Motion sample');
    number(sample.elapsedMs, 'Motion observation time');
    integer(sample.threadId, 'Motion thread', 1);
    assert.ok(
      sample.elapsedMs >= elapsed && sample.elapsedMs <= observation.elapsedMs,
      'Space: Motion time',
    );
    within(sample.elapsedMs, window.armStartedMs, window.completeCompletedMs, 'Motion observation');
    elapsed = sample.elapsedMs;
    const motion = sample.motion;
    object(motion, 'Motion observation');
    integer(motion.operation, 'operation');
    integer(motion.nativeRequestId, 'native request');
    number(motion.seconds, 'Motion seconds');
    assert.ok(motion.seconds >= seconds, 'Space: Motion clock order');
    seconds = motion.seconds;
    assert.ok(
      ['requested', 'value', 'inertia', 'idle', 'interacting', 'custom', 'ignored'].includes(
        motion.phase,
      ),
      'Space: Motion phase',
    );
    assert.ok(
      ['Animation', 'Snap', 'Input', 'Initial', 'Stop'].includes(motion.origin),
      'Space: Motion origin',
    );
    number(motion.position, 'Motion position', Number.NEGATIVE_INFINITY);
    number(motion.readbackPosition, 'Motion readback', Number.NEGATIVE_INFINITY);
    vector(motion.nativePosition, 'native position');
    vector(motion.nativeReadbackPosition, 'native readback');
    if (motion.nativeVelocity !== null)
      number(motion.nativeVelocity, 'native velocity', Number.NEGATIVE_INFINITY);
    if (motion.nativeVelocityVector !== null)
      vector(motion.nativeVelocityVector, 'native velocity vector');
  }
  const requests = samples.filter((sample) => sample.motion.phase === 'requested');
  for (const event of events) {
    const prefix = event.observationCount;
    assert.ok(prefix <= samples.length, 'Space: observation prefix outside trace');
    if (prefix > 0) {
      const last = samples[prefix - 1];
      assert.equal(event.operation, last.motion.operation, 'Space: event last observed operation');
      assert.equal(
        event.nativeRequestId,
        last.motion.nativeRequestId,
        'Space: event last observed request',
      );
      assert.ok(
        last.elapsedMs <= event.readStartedMs,
        'Space: observation prefix follows read start',
      );
    }
    if (prefix < samples.length)
      assert.ok(
        samples[prefix].elapsedMs >= event.elapsedMs,
        'Space: future observation precedes read end',
      );
  }
  assert.equal(requests.length, 4, 'Space: four Motion requests');
  assert.equal(
    new Set(requests.map((sample) => sample.motion.nativeRequestId)).size,
    4,
    'Space: native request identity',
  );
  for (const [index, request] of requests.entries()) {
    const motion = request.motion;
    assert.equal(
      motion.origin,
      observation.animationsEnabled ? 'Animation' : 'Snap',
      'Space: mode origin',
    );
    integer(motion.nativeRequestId, 'requested native identity', 1);
    if (observation.animationsEnabled) {
      integer(motion.operation, 'animation operation', 1);
      if (index > 0)
        assert.ok(
          motion.operation > requests[index - 1].motion.operation,
          'Space: operation order',
        );
    } else assert.equal(motion.operation, 0, 'Space: Snap operation');
    const preview = previews[index];
    const requestIndex = samples.indexOf(request);
    assert.ok(
      requestIndex >= preview.observationCount &&
        requestIndex < keys[index].observationCount &&
        request.elapsedMs >= preview.elapsedMs,
      'Space: request is not after preview and before bubbling',
    );
    if (index > 0) {
      assert.equal(
        preview.operation,
        requests[index - 1].motion.operation,
        'Space: preview previous operation',
      );
      assert.equal(
        preview.nativeRequestId,
        requests[index - 1].motion.nativeRequestId,
        'Space: preview previous request',
      );
      assert.ok(
        preview.observationCount > samples.indexOf(requests[index - 1]),
        'Space: preview missed previous request',
      );
    }
    assert.ok(
      request.elapsedMs >= edgeStarts[index] &&
        request.elapsedMs <= Math.max(keys[index].elapsedMs, pressed[index].elapsedMs) &&
        (index === 0 || request.elapsedMs >= keys[index - 1].elapsedMs),
      'Space: request is not tied to its edge',
    );
  }
  let current;
  for (const sample of samples) {
    if (sample.motion.phase === 'requested') current = sample.motion;
    if (current) {
      assert.ok(sameRequest(sample.motion, current), 'Space: stale Motion observation');
      assert.notEqual(sample.motion.phase, 'ignored', 'Space: Motion request ignored');
    }
  }
  if (observation.animationsEnabled) {
    for (const index of [1, 2]) {
      assert.ok(
        previews[index].position > progressTolerance &&
          previews[index].position < 1 - progressTolerance,
        'Space: before-retarget readback is within an endpoint tolerance',
      );
      // При равном времени порядок наблюдений сохраняет границу следующего requested.
      const segment = samples.slice(
        samples.indexOf(requests[index - 1]),
        samples.indexOf(requests[index]),
      );
      assert.ok(
        samples
          .slice(samples.indexOf(requests[index - 1]), previews[index].observationCount)
          .some((sample) => ['value', 'inertia'].includes(sample.motion.phase)),
        'Space: movement before interruption absent',
      );
      assert.ok(
        segment.every((sample) => sample.motion.phase !== 'idle'),
        'Space: interrupted operation already idle',
      );
    }
  }
  const final = samples.at(-1);
  assert.equal(final.motion.phase, 'idle', 'Space: final operation not idle');
  assert.ok(sameRequest(final.motion, requests[3].motion), 'Space: wrong final operation');
  assert.ok(
    final.elapsedMs >= requests[3].elapsedMs,
    'Space: idle precedes latest release request',
  );
  assert.ok(
    Math.abs(final.motion.readbackPosition) <= progressTolerance &&
      Math.abs(final.motion.position) <= progressTolerance,
    'Space: final Motion endpoint',
  );
}

async function readJSON(filename) {
  const bytes = await readFile(filename);
  assert.ok(bytes.length > 0 && bytes.length <= 256 * 1024, 'Space: JSON byte limit');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 4, 'Usage: space-observation.mjs result.json identity.json');
    const [result, identity] = await Promise.all([
      readJSON(process.argv[2]),
      readJSON(process.argv[3]),
    ]);
    assert.equal(result.spacePattern, 'interrupted', 'Space: result marker');
    for (const theme of ['Light', 'Dark']) {
      const capture = result.captures?.[theme];
      assert.equal(
        capture?.gestureTiming,
        `interaction-${theme}-window.json`,
        'Space: timing filename',
      );
      const window = await readJSON(join(dirname(resolve(process.argv[2])), capture.gestureTiming));
      validateSpaceObservation(capture.space, identity, theme, window);
    }
    process.stdout.write('Space observation: PASS\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
