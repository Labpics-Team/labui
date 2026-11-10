/** Выполняется внутри настоящего браузера; Core и CSS не подменяются. */
export async function browserAuthorityScenarios(attachLabuiColors) {
  const results = [];
  const role = '--lab-label-primary';
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const value = (scope) => getComputedStyle(scope).getPropertyValue(role).trim();
  const make = (parent = document.body, important = false) => {
    const scope = document.createElement('div');
    scope.className = 'sample';
    scope.dataset.theme = 'light';
    scope.innerHTML = '<span>Program authority consumer</span>';
    if (important) scope.style.setProperty(role, 'rgb(255 0 0)', 'important');
    parent.append(scope);
    let observation = { kind: 'observed', surface: [255, 255, 255] };
    const attachment = attachLabuiColors({
      scope,
      observe: () => observation,
      wasmUrl: '/core.wasm',
    });
    return {
      scope,
      attachment,
      observe(next) {
        observation = next;
      },
    };
  };
  const nextState = (scope) =>
    new Promise((resolve, reject) => {
      const abort = AbortSignal.timeout(10000);
      const changed = (event) => {
        abort.removeEventListener('abort', expired);
        resolve(event.detail);
      };
      const expired = () => {
        scope.removeEventListener('lab-colors-state', changed);
        reject(abort.reason);
      };
      scope.addEventListener('lab-colors-state', changed, { once: true });
      abort.addEventListener('abort', expired, { once: true });
    });
  const ready = async (fixture) => {
    assert((await fixture.attachment.ready).state === 'ready', 'Healthy Core must become ready');
    assert(value(fixture.scope) !== '', 'Healthy Core must publish');
  };
  // Given initial rejected important, When Core reads inputs, Then actual CSS is withdrawn.
  {
    const fixture = make(document.body, true);
    const state = await fixture.attachment.ready;
    assert(state.reason === 'unsupported_role_override', 'Initial important must be rejected');
    assert(value(fixture.scope) === '', 'Initial important must not render');
    fixture.attachment.dispose();
    assert(
      fixture.scope.style.getPropertyPriority(role) === 'important',
      'Dispose restores initial authored priority',
    );
    fixture.scope.remove();
    results.push('initial-important');
  }
  // Given healthy Core, When an important override appears, Then failure withdraws and recovery uses new draft.
  {
    const fixture = make();
    await ready(fixture);
    fixture.scope.style.setProperty(role, 'rgb(255 0 0)', 'important');
    const state = await fixture.attachment.refresh();
    assert(
      state.reason === 'unsupported_role_override' && value(fixture.scope) === '',
      'Live important must fail closed',
    );
    fixture.scope.style.setProperty(role, 'rgb(21 22 23)');
    assert((await fixture.attachment.refresh()).state === 'ready', 'New normal draft recovers');
    assert(value(fixture.scope) === 'rgb(21 22 23)', 'Recovery must consume new authored draft');
    fixture.attachment.dispose();
    assert(
      fixture.scope.style.getPropertyValue(role) === 'rgb(21 22 23)',
      'Dispose preserves latest draft',
    );
    assert(
      fixture.scope.style.getPropertyPriority(role) === '',
      'Dispose restores normal priority',
    );
    fixture.scope.remove();
    results.push('live-important-recovery');
  }
  // Given healthy Core, When normal author inputs/theme change, Then Program remains sole output owner.
  {
    const fixture = make();
    await ready(fixture);
    fixture.scope.style.setProperty(role, 'rgb(31 32 33)');
    assert((await fixture.attachment.refresh()).state === 'ready', 'Normal override is supported');
    assert(value(fixture.scope) === 'rgb(31 32 33)', 'Normal authored role reaches consumer');
    fixture.scope.dataset.theme = 'dark';
    assert((await fixture.attachment.refresh()).state === 'ready', 'Theme refresh is healthy');
    assert(value(fixture.scope) === 'rgb(31 32 33)', 'Theme retains authored draft');
    fixture.scope.style.setProperty(role, 'rgb(41 42 43)');
    fixture.scope.style.borderRadius = '11px';
    fixture.attachment.dispose();
    assert(
      fixture.scope.style.getPropertyValue(role) === 'rgb(41 42 43)',
      'Dispose preserves unrefreshed external change',
    );
    assert(
      fixture.scope.style.borderRadius === '11px',
      'Dispose preserves unrelated external style',
    );
    fixture.scope.remove();
    results.push('normal-theme-dispose');
  }
  // Given live marker lease, When marker changes/removes, Then exact state event comes from fresh observation.
  for (const marker of ['changed', null]) {
    const fixture = make();
    await ready(fixture);
    fixture.observe({ kind: 'unknown', reason: 'test-marker-loss' });
    const event = nextState(fixture.scope);
    if (marker === null) fixture.scope.removeAttribute('data-lab-colors-scope');
    else fixture.scope.setAttribute('data-lab-colors-scope', marker);
    await event;
    assert(
      value(fixture.scope) === '',
      'Marker loss with unknown observation must not expose static theme',
    );
    fixture.observe({ kind: 'observed', surface: [255, 255, 255] });
    assert(
      (await fixture.attachment.refresh()).state === 'ready',
      'Marker loss recovers with fresh observation',
    );
    fixture.attachment.dispose();
    fixture.scope.remove();
    results.push(`marker-${marker ?? 'removed'}`);
  }
  // Given healthy output, When all adopted sheets vanish, Then inline authority survives without reacquisition.
  {
    const fixture = make();
    await ready(fixture);
    const prior = value(fixture.scope);
    const unrelated = new CSSStyleSheet();
    unrelated.replaceSync('body{--unrelated:1}');
    document.adoptedStyleSheets = [unrelated];
    document.adoptedStyleSheets = [];
    assert(
      value(fixture.scope) === prior,
      'Sheet removal cannot remove the sole inline publication',
    );
    assert(
      (await fixture.attachment.refresh()).state === 'ready',
      'Sheet removal refresh is healthy',
    );
    fixture.attachment.dispose();
    fixture.scope.remove();
    results.push('sheet-removed');
  }
  // Given scope in document/shadow, When root moves, Then fresh unknown observation withdraws, never static fallback.
  {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = '[data-theme]{--lab-label-primary:rgb(255 0 255)}';
    shadow.append(style);
    const fixture = make();
    await ready(fixture);
    for (const parent of [shadow, document.body]) {
      fixture.observe({ kind: 'unknown', reason: 'test-root-loss' });
      const event = nextState(fixture.scope);
      parent.append(fixture.scope);
      await event;
      assert(value(fixture.scope) === '', 'Root movement cannot expose destination static theme');
      fixture.observe({ kind: 'observed', surface: [255, 255, 255] });
      assert(
        (await fixture.attachment.refresh()).state === 'ready',
        'Root movement reacquires freshly observed Program',
      );
    }
    fixture.attachment.dispose();
    fixture.scope.remove();
    host.remove();
    results.push('document-shadow-document');
  }
  // Given supported scope, When transport-independent cancellation occurs, Then withdrawal survives marker loss.
  {
    const fixture = make();
    await ready(fixture);
    fixture.scope.removeAttribute('data-lab-colors-scope');
    fixture.attachment.cancel();
    assert(value(fixture.scope) === '', 'Cancellation after marker loss withdraws actual CSS');
    assert((await fixture.attachment.refresh()).state === 'ready', 'Cancelled scope can recover');
    fixture.attachment.dispose();
    fixture.scope.remove();
    results.push('cancel-recovery');
  }
  // Given host boundary failure, When withdrawal throws, Then cleanup failure remains observable.
  {
    const fixture = make();
    await ready(fixture);
    const original = document.createElement;
    const failure = new Error('host preparation refused');
    document.createElement = () => {
      throw failure;
    };
    let state;
    try {
      state = fixture.attachment.cancel();
    } finally {
      document.createElement = original;
    }
    assert(state.reason === 'cleanup_failed', 'Host withdrawal error must not be swallowed');
    assert(state.cleanup === failure, 'Host withdrawal cause must be exposed');
    fixture.attachment.cancel();
    assert(value(fixture.scope) === '', 'Restored host boundary withdraws');
    assert(
      (await fixture.attachment.refresh()).state === 'ready',
      'Host failure recovers after boundary restoration',
    );
    fixture.attachment.dispose();
    fixture.scope.remove();
    results.push('host-failure-recovery');
  }
  return results;
}
