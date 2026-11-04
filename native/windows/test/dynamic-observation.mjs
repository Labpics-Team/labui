import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const check = (condition, name) => assert.ok(condition, `Dynamic: ${name}`);
const equal = (actual, expected, name) => assert.equal(actual, expected, `Dynamic: ${name}`);
const object = (value, name) =>
  check(value !== null && typeof value === 'object' && !Array.isArray(value), name);
const number = (value, name, minimum = 0) =>
  check(typeof value === 'number' && Number.isFinite(value) && value >= minimum, name);
const integer = (value, name, minimum = 0) =>
  check(Number.isSafeInteger(value) && value >= minimum, name);
const boolean = (value, name) => equal(typeof value, 'boolean', name);
const sameRequest = (a, b) =>
  a.operation === b.operation && a.nativeRequestId === b.nativeRequestId && a.origin === b.origin;
const endpoint = (motion, target) =>
  Math.abs(motion.position - target) <= 0.001 &&
  Math.abs(motion.readbackPosition - target) <= 0.001;
const interior = (value) => value > 0.001 && value < 0.999;
function ticks(value, name) {
  check(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), name);
  const result = BigInt(value);
  check(result <= 9223372036854775807n, name);
  return result;
}
function vector(value, name) {
  object(value, name);
  for (const axis of ['x', 'y', 'z'])
    number(value[axis], `${name}.${axis}`, Number.NEGATIVE_INFINITY);
}

// Только наблюдённый сценарий системного отключения; асинхронный Position не считается атомарным кадром.
export function validateDynamicObservation(space, identity, captureWindow, countBefore) {
  object(space, 'trace absent');
  object(identity, 'identity');
  object(captureWindow, 'capture window');
  check(countBefore === 9 || countBefore === 10, 'executed predecessor count');
  equal(space.scenario, 'dynamic-reduced-motion', 'scenario');
  const outer = space.observation;
  object(outer, 'observation');
  equal(outer.schemaVersion, 1, 'schema');
  equal(outer.scenario, space.scenario, 'observation scenario');
  equal(outer.status, 'complete', 'incomplete observation');
  integer(identity.pid, 'PID', 1);
  integer(identity.startedAtUnixMs, 'process start', 1);
  check(typeof identity.window === 'string' && /^[1-9][0-9]*$/.test(identity.window), 'HWND');
  equal(identity.animation?.expected, true, 'initial animation mode');
  equal(outer.pid, identity.pid, 'outer PID');
  const trace = outer.trace;
  object(trace, 'native trace');
  for (const [field, expected] of Object.entries({
    schemaVersion: 1,
    status: 'complete',
    pid: identity.pid,
    processStartedAtUnixMs: identity.startedAtUnixMs,
    automationId: 'LabButtonMedium',
    theme: 'Dark',
    channel: 3,
    animationsEnabled: true,
    countBefore,
    countAfter: countBefore + 2,
    overflow: 0,
    failure: null,
    clock: 'app-stopwatch-ms',
    positionKind: 'asynchronous-readback',
  }))
    equal(trace[field], expected, `trace ${field}`);
  check(
    trace.firstDiscarded === undefined || trace.firstDiscarded === null,
    'discarded observation',
  );
  number(trace.elapsedMs, 'trace end');
  integer(trace.clockFrequency, 'frequency', 1);
  const frequency = trace.clockFrequency;
  equal(captureWindow.clock, 'harness-stopwatch-ms', 'harness clock');
  equal(captureWindow.clockFrequency, frequency, 'harness frequency');
  const appOrigin = ticks(trace.clockOriginTicks, 'app origin');
  const lower = ticks(captureWindow.clockOriginTicks, 'harness origin');
  const upper = ticks(captureWindow.clockOriginUpperTicks, 'harness upper origin');
  check(upper >= lower, 'origin interval');
  const milliseconds = (delta) => {
    check(delta >= -9007199254740991n && delta <= 9007199254740991n, 'clock difference');
    return (Number(delta) * 1000) / frequency;
  };
  const appTime = (tick) => milliseconds(tick - appOrigin);
  const appFromLower = milliseconds(appOrigin - lower);
  let lowerMs = 0;
  let upperMs = milliseconds(upper - lower);
  const within = (elapsed, start, end, name) => {
    lowerMs = Math.max(lowerMs, appFromLower + elapsed - end);
    upperMs = Math.min(upperMs, appFromLower + elapsed - start);
    check(lowerMs <= upperMs, `${name}: no common harness origin`);
  };
  const window = space.window;
  object(window, 'command window');
  let prior = 0;
  for (const field of [
    'armStartedMs',
    'armCompletedMs',
    'inputStartedMs',
    'inputCompletedMs',
    'completeStartedMs',
    'completeCompletedMs',
  ]) {
    number(window[field], field);
    check(window[field] >= prior, 'command order');
    prior = window[field];
  }
  for (const name of ['arm', 'input', 'complete'])
    check(window[`${name}CompletedMs`] > window[`${name}StartedMs`], 'empty command');
  check(
    Array.isArray(captureWindow.gestures) && captureWindow.gestures.length === 1,
    'one dynamic gesture',
  );
  const gesture = captureWindow.gestures[0];
  object(gesture, 'gesture');
  equal(gesture.name, 'dynamic-space', 'gesture identity');
  for (const field of ['recordStartedMs', 'firstFrameReceivedMs'])
    number(captureWindow[field], field);
  number(gesture.startedMs, 'gesture start');
  number(gesture.completedMs, 'gesture end');
  check(
    captureWindow.firstFrameReceivedMs > captureWindow.recordStartedMs &&
      gesture.startedMs >= captureWindow.firstFrameReceivedMs &&
      window.armStartedMs >= gesture.startedMs &&
      window.completeCompletedMs <= gesture.completedMs,
    'recorded gesture bounds',
  );

  const injection = space.injection;
  object(injection, 'injection');
  equal(injection.pid, identity.pid, 'input PID');
  integer(injection.window, 'input HWND', 1);
  equal(String(injection.window), identity.window, 'input HWND identity');
  equal(injection.clockFrequency, frequency, 'input frequency');
  const inputStart = ticks(injection.startedTicks, 'input start');
  const inputEnd = ticks(injection.completedTicks, 'input end');
  check(inputEnd >= inputStart && milliseconds(inputEnd - inputStart) <= 5000, 'input budget');
  within(appTime(inputStart), window.inputStartedMs, window.inputCompletedMs, 'input start');
  within(appTime(inputEnd), window.inputStartedMs, window.inputCompletedMs, 'input end');
  check(Array.isArray(injection.events) && injection.events.length === 4, 'four OS edges');
  let lastTick = inputStart;
  const edges = injection.events.map((event, index) => {
    object(event, 'OS event');
    equal(event.keyDown, index % 2 === 0, 'OS edge order');
    equal(event.accepted, 1, 'OS accepted edge');
    const start = ticks(event.startedTicks, 'OS start');
    const end = ticks(event.completedTicks, 'OS end');
    check(start >= lastTick && end >= start && end <= inputEnd, 'OS edge bounds');
    lastTick = end;
    return { start: appTime(start), end: appTime(end) };
  });
  check(
    Array.isArray(injection.readiness) && injection.readiness.length === 2,
    'two readiness waits',
  );
  const readiness = injection.readiness.map((record, index) => {
    object(record, 'readiness');
    equal(record.step, index + 1, 'readiness step');
    const start = appTime(ticks(record.startedTicks, 'readiness start'));
    const end = appTime(ticks(record.completedTicks, 'readiness end'));
    check(
      start >= edges[index].end && end >= start && end <= edges[index + 1].start,
      'readiness edge bounds',
    );
    return { start, end };
  });
  within(trace.elapsedMs, window.completeStartedMs, window.completeCompletedMs, 'trace completion');

  const samples = trace.observations;
  check(
    Array.isArray(samples) && samples.length >= 10 && samples.length <= 128,
    'bounded Motion samples',
  );
  let elapsed = -1;
  let seconds = -1;
  for (const sample of samples) {
    object(sample, 'sample');
    number(sample.elapsedMs, 'sample time');
    integer(sample.threadId, 'sample thread', 1);
    check(sample.elapsedMs >= elapsed && sample.elapsedMs <= trace.elapsedMs, 'sample time order');
    elapsed = sample.elapsedMs;
    within(sample.elapsedMs, window.armStartedMs, window.completeCompletedMs, 'sample');
    const motion = sample.motion;
    object(motion, 'motion');
    integer(motion.operation, 'operation');
    integer(motion.nativeRequestId, 'native request');
    number(motion.seconds, 'Motion time');
    check(motion.seconds >= seconds, 'Motion time order');
    seconds = motion.seconds;
    check(
      ['requested', 'value', 'inertia', 'idle', 'interacting', 'custom', 'ignored'].includes(
        motion.phase,
      ),
      'Motion phase',
    );
    check(
      ['Animation', 'Snap', 'Input', 'Initial', 'Stop'].includes(motion.origin),
      'Motion origin',
    );
    number(motion.position, 'position', Number.NEGATIVE_INFINITY);
    number(motion.readbackPosition, 'readback', Number.NEGATIVE_INFINITY);
    vector(motion.nativePosition, 'native position');
    vector(motion.nativeReadbackPosition, 'native readback');
    if (motion.nativeVelocity !== null)
      number(motion.nativeVelocity, 'native velocity', Number.NEGATIVE_INFINITY);
    if (motion.nativeVelocityVector !== null)
      vector(motion.nativeVelocityVector, 'native velocity vector');
  }
  const prefix = (entry, name) => {
    integer(entry.observationCount, `${name} prefix`);
    check(entry.observationCount <= samples.length, `${name} prefix outside trace`);
    const previous = samples[entry.observationCount - 1];
    const next = samples[entry.observationCount];
    if (previous) check(previous.elapsedMs <= entry.readStartedMs, `${name} prefix follows read`);
    if (next) check(next.elapsedMs >= entry.elapsedMs, `${name} future sample precedes read`);
    return previous?.motion;
  };
  const events = trace.events;
  check(Array.isArray(events) && events.length >= 17 && events.length <= 24, 'bounded app events');
  elapsed = -1;
  let count = countBefore;
  let lastPrefix = 0;
  for (const event of events) {
    object(event, 'event');
    number(event.readStartedMs, 'event read');
    number(event.elapsedMs, 'event time');
    check(
      event.readStartedMs >= elapsed &&
        event.elapsedMs >= event.readStartedMs &&
        event.elapsedMs <= trace.elapsedMs,
      'event time order',
    );
    elapsed = event.elapsedMs;
    check(
      [
        'armed',
        'previewKeyDown',
        'previewKeyUp',
        'pressed',
        'keyDown',
        'keyUp',
        'click',
        'focus',
        'dynamic-before',
        'complete',
      ].includes(event.kind),
      'event kind',
    );
    for (const field of ['repeat', 'isPressed', 'focused', 'currentChannel'])
      boolean(event[field], field);
    equal(event.focused, true, 'focus lost');
    equal(event.currentChannel, true, 'channel changed');
    integer(event.count, 'click count');
    check(event.count >= count && event.count <= countBefore + 2, 'click count order');
    count = event.count;
    number(event.position, 'event position', Number.NEGATIVE_INFINITY);
    const latest = prefix(event, 'event');
    check(event.observationCount >= lastPrefix, 'event prefix order');
    lastPrefix = event.observationCount;
    equal(event.operation, latest?.operation ?? null, 'event operation');
    equal(event.nativeRequestId, latest?.nativeRequestId ?? null, 'event request');
    if (/^(previewKey|key)/.test(event.kind)) equal(event.key, 'Space', 'actual key');
    else {
      equal(event.key, null, 'non-key');
      equal(event.repeat, false, 'non-key repeat');
    }
  }
  const only = (kind) => {
    const matching = events.filter((event) => event.kind === kind);
    equal(matching.length, 1, `one ${kind}`);
    return matching[0];
  };
  const armed = only('armed');
  const complete = only('complete');
  const preWrite = only('dynamic-before');
  equal(events[0], armed, 'first event');
  equal(events.at(-1), complete, 'last event');
  equal(armed.isPressed, false, 'initial released');
  equal(armed.count, countBefore, 'initial count');
  equal(complete.isPressed, false, 'final released');
  equal(complete.count, countBefore + 2, 'final count');
  check(Math.abs(complete.position) <= 0.001, 'final live readback');
  within(armed.readStartedMs, window.armStartedMs, window.armCompletedMs, 'arm read');
  within(armed.elapsedMs, window.armStartedMs, window.armCompletedMs, 'arm');
  within(
    complete.readStartedMs,
    window.completeStartedMs,
    window.completeCompletedMs,
    'complete read',
  );
  const keys = events.filter((e) => e.kind === 'keyDown' || e.kind === 'keyUp');
  const previews = events.filter((e) => e.kind === 'previewKeyDown' || e.kind === 'previewKeyUp');
  const pressed = events.filter((e) => e.kind === 'pressed');
  const clicks = events.filter((e) => e.kind === 'click');
  equal(keys.length, 4, 'four native keys');
  equal(previews.length, 4, 'four ancestor previews');
  equal(pressed.length, 4, 'four IsPressed changes');
  equal(clicks.length, 2, 'two Click events');
  for (let index = 0; index < 4; index++) {
    const down = index % 2 === 0;
    const key = keys[index];
    const preview = previews[index];
    const change = pressed[index];
    equal(key.kind, down ? 'keyDown' : 'keyUp', 'key order');
    equal(preview.kind, down ? 'previewKeyDown' : 'previewKeyUp', 'preview order');
    equal(key.isPressed, down, 'key state');
    equal(preview.isPressed, !down, 'preview old state');
    equal(change.isPressed, down, 'native IsPressed');
    equal(preview.repeat, key.repeat, 'repeat identity');
    if (down) equal(key.repeat, false, 'autorepeat');
    check(
      events.indexOf(preview) < events.indexOf(change) &&
        events.indexOf(change) < events.indexOf(key) &&
        (index === 0 || events.indexOf(preview) > events.indexOf(keys[index - 1])),
      'native preview order',
    );
    for (const event of [preview, change, key])
      check(event.readStartedMs >= edges[index].start, 'event precedes OS edge');
  }
  for (const [index, click] of clicks.entries()) {
    equal(click.count, countBefore + index + 1, 'Click count');
    check(
      click.readStartedMs >= edges[index * 2 + 1].start &&
        events.indexOf(click) > events.indexOf(pressed[index * 2 + 1]) &&
        (index === 1 || events.indexOf(click) < events.indexOf(previews[2])),
      'Click belongs to release',
    );
  }

  const requests = samples.filter((sample) => sample.motion.phase === 'requested');
  equal(requests.length, 5, 'five Motion requests');
  equal(
    new Set(requests.map((sample) => sample.motion.nativeRequestId)).size,
    5,
    'distinct native requests',
  );
  for (const [index, request] of requests.entries()) {
    equal(request.motion.origin, index === 0 ? 'Animation' : 'Snap', 'request mode');
    integer(request.motion.nativeRequestId, 'requested native identity', 1);
    if (index === 0) integer(request.motion.operation, 'animation operation', 1);
    else equal(request.motion.operation, 0, 'Snap operation');
  }
  let current;
  for (const sample of samples) {
    if (sample.motion.phase === 'requested') current = sample.motion;
    if (current) {
      check(sameRequest(sample.motion, current), 'stale native callback');
      check(sample.motion.phase !== 'ignored', 'ignored request');
    }
  }
  for (const [index, requestIndex] of [0, 2, 3, 4].entries()) {
    const request = requests[requestIndex];
    const prefixIndex = samples.indexOf(request);
    check(
      prefixIndex >= previews[index].observationCount &&
        prefixIndex < keys[index].observationCount &&
        request.elapsedMs >= previews[index].elapsedMs &&
        request.elapsedMs >= edges[index].start &&
        request.elapsedMs <= Math.max(keys[index].elapsedMs, pressed[index].elapsedMs),
      'request belongs to native edge',
    );
    equal(keys[index].operation, request.motion.operation, 'key current operation');
    equal(keys[index].nativeRequestId, request.motion.nativeRequestId, 'key current request');
    if (index > 0) {
      const previous = requests[requestIndex - 1].motion;
      equal(previews[index].operation, previous.operation, 'preview prior operation');
      equal(previews[index].nativeRequestId, previous.nativeRequestId, 'preview prior request');
    }
  }
  check(
    events.indexOf(preWrite) > events.indexOf(keys[0]) &&
      events.indexOf(preWrite) < events.indexOf(previews[1]),
    'pre-write held edge',
  );
  equal(preWrite.isPressed, true, 'pre-write pressed');
  equal(preWrite.count, countBefore, 'pre-write count');
  check(interior(preWrite.position), 'pre-write interior readback');
  equal(preWrite.operation, requests[0].motion.operation, 'pre-write operation');
  equal(preWrite.nativeRequestId, requests[0].motion.nativeRequestId, 'pre-write request');
  const initialIndex = samples.indexOf(requests[0]);
  const snapIndex = samples.indexOf(requests[1]);
  check(
    preWrite.observationCount > initialIndex && preWrite.observationCount <= snapIndex,
    'pre-write prefix',
  );
  check(
    samples
      .slice(initialIndex + 1, preWrite.observationCount)
      .some(
        (sample) =>
          ['value', 'inertia'].includes(sample.motion.phase) &&
          interior(sample.motion.readbackPosition),
      ),
    'movement before setting mutation',
  );
  check(
    samples.slice(initialIndex, snapIndex).every((sample) => sample.motion.phase !== 'idle'),
    'animation already idle',
  );

  const mutation = outer.mutation;
  object(mutation, 'setting mutation');
  number(mutation.startedMs, 'mutation start');
  number(mutation.completedMs, 'mutation end');
  integer(mutation.uiThreadId, 'UI thread', 1);
  integer(mutation.threadId, 'setter thread', 1);
  check(mutation.threadId !== mutation.uiThreadId, 'setter occupies UI dispatcher');
  equal(mutation.readback, false, 'SPI readback');
  check(
    mutation.startedMs >= preWrite.elapsedMs &&
      mutation.completedMs >= mutation.startedMs &&
      mutation.startedMs >= readiness[0].start &&
      mutation.completedMs <= readiness[0].end &&
      requests[1].elapsedMs >= mutation.startedMs &&
      requests[1].elapsedMs < edges[1].start,
    'mutation held input bounds',
  );
  const settings = outer.settings;
  check(
    Array.isArray(settings) && settings.length >= 2 && settings.length <= 4,
    'setting change observed',
  );
  elapsed = -1;
  lastPrefix = 0;
  for (const [index, setting] of settings.entries()) {
    object(setting, 'setting event');
    number(setting.readStartedMs, 'setting read');
    number(setting.elapsedMs, 'setting time');
    boolean(setting.animationsEnabled, 'setting mode');
    equal(setting.kind, index === 0 ? 'armed' : 'changed', 'setting event kind');
    equal(setting.animationsEnabled, index === 0, 'setting transition');
    check(
      setting.readStartedMs >= elapsed &&
        setting.elapsedMs >= setting.readStartedMs &&
        setting.elapsedMs <= trace.elapsedMs,
      'setting time order',
    );
    elapsed = setting.elapsedMs;
    prefix(setting, 'setting');
    check(setting.observationCount >= lastPrefix, 'setting prefix order');
    lastPrefix = setting.observationCount;
    if (index === 0)
      within(setting.elapsedMs, window.armStartedMs, window.armCompletedMs, 'initial setting');
    else
      check(
        setting.readStartedMs >= mutation.startedMs && setting.elapsedMs <= readiness[0].end,
        'setting observed before first release',
      );
  }
  const targets = [1, 0, 1, 0];
  for (let index = 1; index < requests.length; index++) {
    const segment = samples.slice(
      samples.indexOf(requests[index]) + 1,
      index + 1 < requests.length ? samples.indexOf(requests[index + 1]) : samples.length,
    );
    const acknowledgement = segment.find(
      (sample) =>
        ['value', 'idle'].includes(sample.motion.phase) &&
        endpoint(sample.motion, targets[index - 1]),
    );
    check(acknowledgement !== undefined, `Snap ${index} endpoint acknowledgement`);
    if (index === 1)
      check(acknowledgement.elapsedMs <= readiness[0].end, 'same-target Snap before first release');
    if (index === 2)
      check(acknowledgement.elapsedMs <= readiness[1].end, 'release Snap before second down');
  }
  const final = samples.at(-1);
  check(
    ['value', 'idle'].includes(final.motion.phase) &&
      sameRequest(final.motion, requests[4].motion) &&
      endpoint(final.motion, 0),
    'final native Snap',
  );
  return {
    originTicks: captureWindow.clockOriginTicks,
    originUpperTicks: captureWindow.clockOriginUpperTicks,
    frequency,
    lowerMs,
    upperMs,
  };
}

async function readJSON(path) {
  const bytes = await readFile(path);
  check(bytes.length > 0 && bytes.length <= 256 * 1024, 'JSON byte limit');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    equal(process.argv.length, 4, 'usage: dynamic-observation.mjs result.json identity.json');
    const [result, identity] = await Promise.all([
      readJSON(process.argv[2]),
      readJSON(process.argv[3]),
    ]);
    equal(identity.dynamicMotionExpected, true, 'dynamic qualification expected');
    const dynamic = result.dynamicMotion;
    object(dynamic, 'dynamic result');
    equal(dynamic.scenario, 'dynamic-reduced-motion', 'result scenario');
    equal(dynamic.gestureTiming, 'interaction-Dynamic-window.json', 'timing filename');
    const window = await readJSON(join(dirname(resolve(process.argv[2])), dynamic.gestureTiming));
    validateDynamicObservation(dynamic.space, identity, window, result.lifetime ? 10 : 9);
    process.stdout.write('Dynamic observation: PASS\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
