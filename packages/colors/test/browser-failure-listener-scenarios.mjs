/** Persistent DOM failure перед эффектом: public state/cause не теряются при listener dispose. */
export async function browserFailureListenerScenarios(attachLabuiColors) {
  const results = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  for (const listener of [false, true]) {
    const scope = document.createElement('div');
    scope.dataset.theme = 'light';
    scope.style.setProperty('--lab-label-primary', 'rgb(31 32 33)');
    scope.style.borderRadius = '11px';
    document.body.append(scope);
    const attachment = attachLabuiColors({
      scope,
      observe: () => ({ kind: 'observed', surface: [255, 255, 255] }),
      wasmUrl: '/core.wasm',
    });
    assert((await attachment.ready).state === 'ready', 'Healthy control reaches real ready');
    const events = [];
    let nested;
    let calls = 0;
    const fault = new Error('persistent DOM revoke refused');
    const observe = (event) => {
      events.push({
        state: event.detail.state,
        reason: event.detail.reason,
        cause: event.detail.cleanup === fault,
      });
      if (listener && event.detail.reason === 'cleanup_failed') {
        assert(events.length < 5, 'failure publication cannot form a listener loop');
        nested = attachment.dispose();
      }
    };
    // Подписка до эффекта, без sleeps/polling и без suppressing one-shot guard.
    scope.addEventListener('lab-colors-state', observe);
    scope.dataset.theme = 'dark';
    const original = document.createElement;
    document.createElement = () => {
      calls++;
      throw fault;
    };
    let failed;
    let before;
    try {
      failed = await attachment.refresh();
      before = {
        state: attachment.state.state,
        reason: attachment.state.reason,
        returned: failed.state,
        returnedReason: failed.reason,
        nested: nested?.state,
        nestedReason: nested?.reason,
        cause: failed.cleanup === fault,
        nestedCause: nested?.cleanup === fault,
        role: getComputedStyle(scope).getPropertyValue('--lab-label-primary').trim(),
        marker: scope.hasAttribute('data-lab-colors-scope'),
        calls,
        events: [...events],
      };
    } finally {
      document.createElement = original;
    }
    assert(
      before.state === 'failed' && before.reason === 'cleanup_failed',
      'Known failure cannot become false pending',
    );
    assert(before.cause, 'Exact cleanup cause survives public return');
    assert(
      before.events.every((event) => event.reason === 'cleanup_failed'),
      'No pending event replaces failure',
    );
    if (listener)
      assert(
        before.nestedReason === 'cleanup_failed' && before.nestedCause && calls === 1,
        'Listener records intent without retrying persistent fault',
      );
    assert(
      before.role === 'rgb(31 32 33)' && before.marker,
      'Fault before effect preserves prior owned output',
    );
    const completed = attachment.dispose();
    assert(completed.state === 'disposed', 'Manual retry after restored boundary completes');
    assert(!scope.hasAttribute('data-lab-colors-scope'), 'Retry removes owner');
    assert(
      scope.style.getPropertyValue('--lab-label-primary') === 'rgb(31 32 33)',
      'Retry restores authored role',
    );
    assert(
      scope.style.getPropertyPriority('--lab-label-primary') === '',
      'Retry restores priority',
    );
    assert(scope.style.borderRadius === '11px', 'Unrelated style survives');
    results.push({
      listener,
      before,
      retry: completed.state,
      role: scope.style.getPropertyValue('--lab-label-primary'),
      marker: scope.hasAttribute('data-lab-colors-scope'),
    });
    scope.remove();
  }
  return results;
}
