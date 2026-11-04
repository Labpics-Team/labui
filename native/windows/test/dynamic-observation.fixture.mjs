// Независимая история: системное отключение вставляет Snap между первым down и up.
export function dynamicFixture(countBefore = 9) {
  const origin = 9007199254740993n;
  const frequency = 1000000;
  const tick = (ms) => String(origin + BigInt(Math.round(ms * 1000)));
  const identity = {
    pid: 42,
    startedAtUnixMs: 1793692800000,
    window: '100',
    animation: { expected: true },
  };
  const sample = (request, phase, elapsedMs, position) => ({
    elapsedMs,
    threadId: 1,
    motion: {
      operation: request === 0 ? 7 : 0,
      nativeRequestId: 301 + request,
      origin: request === 0 ? 'Animation' : 'Snap',
      phase,
      seconds: elapsedMs / 1000,
      position,
      readbackPosition: position,
      nativePosition: { x: position * 1000, y: 0, z: 0 },
      nativeReadbackPosition: { x: position * 1000, y: 0, z: 0 },
      nativeVelocity: phase === 'idle' ? 0 : null,
      nativeVelocityVector: phase === 'idle' ? { x: 0, y: 0, z: 0 } : null,
    },
  });
  const observations = [
    sample(0, 'requested', 124.5, 0),
    sample(0, 'value', 130, 0.1),
    sample(0, 'inertia', 160, 0.3),
    sample(1, 'requested', 172, 0.4),
    sample(1, 'value', 173, 1),
    sample(2, 'requested', 204.5, 1),
    sample(2, 'value', 204.6, 0),
    sample(3, 'requested', 254.5, 0),
    sample(3, 'value', 254.6, 1),
    sample(4, 'requested', 334.5, 1),
    sample(4, 'value', 334.6, 0),
  ];
  const event = (kind, elapsedMs, isPressed, position, count = countBefore) => ({
    kind,
    elapsedMs,
    readStartedMs: elapsedMs - 0.1,
    isPressed,
    position,
    count,
    key: /^(previewKey|key)/.test(kind) ? 'Space' : null,
    repeat: kind === 'keyUp' || kind === 'previewKeyUp',
    focused: true,
    currentChannel: true,
  });
  const events = [
    event('armed', 114, false, 0),
    event('previewKeyDown', 123.5, false, 0),
    event('pressed', 125, true, 0.01),
    event('keyDown', 126, true, 0.02),
    event('dynamic-before', 166, true, 0.35),
    event('previewKeyUp', 204.3, true, 1),
    event('pressed', 205, false, 0),
    event('click', 206, false, 0, countBefore + 1),
    event('keyUp', 207, false, 0, countBefore + 1),
    event('previewKeyDown', 254.3, false, 0, countBefore + 1),
    event('pressed', 255, true, 1, countBefore + 1),
    event('keyDown', 256, true, 1, countBefore + 1),
    event('previewKeyUp', 334.3, true, 1, countBefore + 1),
    event('pressed', 335, false, 0, countBefore + 1),
    event('click', 336, false, 0, countBefore + 2),
    event('keyUp', 337, false, 0, countBefore + 2),
    event('complete', 370, false, 0, countBefore + 2),
  ];
  const prefixes = [0, 0, 1, 1, 3, 5, 7, 7, 7, 7, 9, 9, 9, 11, 11, 11, 11];
  for (const [index, value] of events.entries()) {
    value.observationCount = prefixes[index];
    const last = observations[prefixes[index] - 1]?.motion;
    value.operation = last?.operation ?? null;
    value.nativeRequestId = last?.nativeRequestId ?? null;
  }
  const trace = {
    schemaVersion: 1,
    status: 'complete',
    pid: 42,
    processStartedAtUnixMs: identity.startedAtUnixMs,
    automationId: 'LabButtonMedium',
    theme: 'Dark',
    channel: 3,
    animationsEnabled: true,
    countBefore,
    countAfter: countBefore + 2,
    overflow: 0,
    failure: null,
    firstDiscarded: null,
    clock: 'app-stopwatch-ms',
    clockOriginTicks: String(origin),
    clockFrequency: frequency,
    elapsedMs: 371,
    positionKind: 'asynchronous-readback',
    events,
    observations,
  };
  const space = {
    scenario: 'dynamic-reduced-motion',
    observation: {
      schemaVersion: 1,
      scenario: 'dynamic-reduced-motion',
      status: 'complete',
      pid: 42,
      trace,
      settings: [
        {
          kind: 'armed',
          readStartedMs: 112.9,
          elapsedMs: 113,
          animationsEnabled: true,
          observationCount: 0,
        },
        {
          kind: 'changed',
          readStartedMs: 176.9,
          elapsedMs: 177,
          animationsEnabled: false,
          observationCount: 5,
        },
      ],
      mutation: { startedMs: 167, completedMs: 180, readback: false, uiThreadId: 1, threadId: 2 },
    },
    injection: {
      pid: 42,
      window: 100,
      clockFrequency: frequency,
      startedTicks: tick(122),
      completedTicks: tick(335),
      events: [123, 204, 254, 334].map((ms, index) => ({
        keyDown: index % 2 === 0,
        accepted: 1,
        startedTicks: tick(ms),
        completedTicks: tick(ms + 0.2),
      })),
      readiness: [
        { step: 1, startedTicks: tick(123.2), completedTicks: tick(195) },
        { step: 2, startedTicks: tick(204.2), completedTicks: tick(245) },
      ],
    },
    window: {
      armStartedMs: 210,
      armCompletedMs: 215,
      inputStartedMs: 220,
      inputCompletedMs: 438,
      completeStartedMs: 445,
      completeCompletedMs: 480,
    },
  };
  const window = {
    clock: 'harness-stopwatch-ms',
    clockOriginTicks: tick(-100),
    clockOriginUpperTicks: tick(-99.999),
    clockFrequency: frequency,
    recordStartedMs: 1,
    firstFrameReceivedMs: 5,
    gestures: [{ name: 'dynamic-space', startedMs: 200, completedMs: 500 }],
  };
  return { space, identity, window, countBefore };
}
