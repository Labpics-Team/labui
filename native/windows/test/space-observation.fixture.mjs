// Независимый разрешённый trace: числа описывают историю, не вычисляются валидатором.
export function spaceFixture(theme = 'Light', animationsEnabled = true) {
  const channel = theme === 'Light' ? 1 : 2;
  const before = theme === 'Light' ? 4 : 7;
  const origin = 9007199254740993n;
  const frequency = 1000000;
  const tick = (milliseconds) => String(origin + BigInt(Math.round(milliseconds * 1000)));
  const identity = {
    pid: 42,
    window: '100',
    startedAtUnixMs: 1793692800000,
    animation: { expected: animationsEnabled },
  };
  const window = {
    clock: 'harness-stopwatch-ms',
    clockOriginTicks: tick(-100),
    clockOriginUpperTicks: tick(-99.999),
    clockFrequency: frequency,
    recordStartedMs: 1,
    firstFrameReceivedMs: 5,
    gestures: [
      { name: 'hover', startedMs: 10, completedMs: 20 },
      { name: 'pressed', startedMs: 110, completedMs: 120 },
      { name: 'rapid-space', startedMs: 210, completedMs: 520 },
      { name: 'pointer-out', startedMs: 610, completedMs: 620 },
    ],
  };
  const event = (kind, elapsedMs, isPressed, position, count = before) => ({
    kind,
    elapsedMs,
    readStartedMs: elapsedMs - 0.1,
    isPressed,
    key: kind.startsWith('key') || kind.startsWith('previewKey') ? 'Space' : null,
    repeat: kind === 'keyUp' || kind === 'previewKeyUp',
    focused: true,
    count,
    currentChannel: true,
    position,
  });
  const events = [
    event('armed', 114, false, 0),
    event('previewKeyDown', 123.5, false, 0),
    event('pressed', 125, true, animationsEnabled ? 0.01 : 1),
    event('keyDown', 126, true, animationsEnabled ? 0.02 : 1),
    event('previewKeyUp', 204.3, true, animationsEnabled ? 0.61 : 1),
    event('pressed', 205, false, animationsEnabled ? 0.6 : 0),
    event('click', 206, false, animationsEnabled ? 0.59 : 0, before + 1),
    event('keyUp', 207, false, animationsEnabled ? 0.58 : 0, before + 1),
    event('previewKeyDown', 254.3, false, animationsEnabled ? 0.31 : 0, before + 1),
    event('pressed', 255, true, animationsEnabled ? 0.3 : 1, before + 1),
    event('keyDown', 256, true, animationsEnabled ? 0.32 : 1, before + 1),
    event('previewKeyUp', 334.3, true, animationsEnabled ? 0.71 : 1, before + 1),
    event('pressed', 335, false, animationsEnabled ? 0.7 : 0, before + 1),
    event('click', 336, false, animationsEnabled ? 0.69 : 0, before + 2),
    event('keyUp', 337, false, animationsEnabled ? 0.68 : 0, before + 2),
    event('complete', 370, false, 0, before + 2),
  ];
  const sample = (index, phase, elapsedMs, position) => ({
    elapsedMs,
    threadId: 1,
    motion: {
      operation: animationsEnabled ? (channel - 1) * 4 + index + 1 : 0,
      nativeRequestId: channel * 100 + index + 1,
      origin: animationsEnabled ? 'Animation' : 'Snap',
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
  const observations = animationsEnabled
    ? [
        sample(0, 'requested', 124.5, 0),
        sample(0, 'inertia', 130, 0.1),
        sample(0, 'value', 160, 0.3),
        sample(1, 'requested', 204.5, 0.6),
        sample(1, 'value', 230, 0.4),
        sample(2, 'requested', 254.5, 0.3),
        sample(2, 'value', 280, 0.6),
        sample(3, 'requested', 334.5, 0.7),
        sample(3, 'value', 350, 0.2),
        sample(3, 'idle', 362, 0),
      ]
    : [
        sample(0, 'requested', 124.5, 1),
        sample(0, 'idle', 124.6, 1),
        sample(1, 'requested', 204.5, 0),
        sample(1, 'idle', 204.6, 0),
        sample(2, 'requested', 254.5, 1),
        sample(2, 'idle', 254.6, 1),
        sample(3, 'requested', 334.5, 0),
        sample(3, 'idle', 334.6, 0),
      ];
  const prefixes = animationsEnabled
    ? [0, 0, 1, 1, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 8, 10]
    : [0, 0, 2, 2, 2, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 8];
  for (const [index, entry] of events.entries()) {
    const prefix = prefixes[index];
    const last = observations[prefix - 1]?.motion;
    entry.observationCount = prefix;
    entry.operation = last?.operation ?? null;
    entry.nativeRequestId = last?.nativeRequestId ?? null;
  }
  const space = {
    observation: {
      schemaVersion: 1,
      status: 'complete',
      pid: identity.pid,
      processStartedAtUnixMs: identity.startedAtUnixMs,
      automationId: 'LabButtonMedium',
      theme,
      channel,
      animationsEnabled,
      countBefore: before,
      countAfter: before + 2,
      overflow: 0,
      failure: null,
      clock: 'app-stopwatch-ms',
      clockOriginTicks: String(origin),
      clockFrequency: frequency,
      elapsedMs: 371,
      positionKind: 'asynchronous-readback',
      events,
      observations,
    },
    injection: {
      pid: identity.pid,
      window: 100,
      clockFrequency: frequency,
      startedTicks: tick(122),
      completedTicks: tick(335),
      events: [123, 204, 254, 334].map((time, index) => ({
        keyDown: index % 2 === 0,
        accepted: 1,
        startedTicks: tick(time),
        completedTicks: tick(time + 0.2),
      })),
    },
    window: {
      armStartedMs: 211,
      armCompletedMs: 215,
      inputStartedMs: 216,
      inputCompletedMs: 438,
      completeStartedMs: 445,
      completeCompletedMs: 480,
    },
  };
  return { space, identity, window };
}
