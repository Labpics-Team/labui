/** Реальные публичные theme replacement controls с Core/CSS и синхронным DOM reentry. */
export async function browserReplacementScenarios(attachLabuiColors) {
  const results = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  for (const entrance of ['replacement', 'explicit']) {
    for (const action of ['cancel', 'dispose']) {
      // Given: готовый реальный Program и обычный authored draft.
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
      assert(
        (await attachment.ready).state === 'ready',
        'Healthy explicit control must become ready',
      );
      const states = [];
      scope.addEventListener('lab-colors-state', (event) => states.push(event.detail.state));
      const expected = action === 'dispose' ? 'disposed' : 'cancelled';
      const signal = AbortSignal.timeout(10000);
      const terminal = new Promise((resolve, reject) => {
        const observe = (event) => {
          if (event.detail.state !== expected) return;
          scope.removeEventListener('lab-colors-state', observe);
          signal.removeEventListener('abort', aborted);
          resolve(event.detail);
        };
        const aborted = () => {
          scope.removeEventListener('lab-colors-state', observe);
          reject(signal.reason);
        };
        scope.addEventListener('lab-colors-state', observe);
        signal.addEventListener('abort', aborted, { once: true });
      });
      const original = document.createElement;
      let fired = false;
      let nested;
      document.createElement = function (...args) {
        if (!fired) {
          fired = true;
          nested = attachment[action]();
        }
        return original.apply(this, args);
      };
      // When: обычная смена light -> dark либо explicit cleanup достигает real revoke.
      let returned;
      try {
        scope.dataset.theme = 'dark';
        returned = entrance === 'replacement' ? await attachment.refresh() : attachment[action]();
        await terminal;
      } finally {
        document.createElement = original;
      }
      // Then: без второго manual request/frame результат terminal и state truthfulness.
      assert(
        nested.state === 'waiting' && nested.reason === 'cleanup_pending',
        'Nested API must return pending rather than stale ready',
      );
      assert(
        returned.state === expected && attachment.state.state === expected,
        'Outer call must drain terminal',
      );
      const role = getComputedStyle(scope).getPropertyValue('--lab-label-primary').trim();
      const marker = scope.hasAttribute('data-lab-colors-scope');
      assert(
        action === 'dispose' ? !marker && role === 'rgb(31 32 33)' : marker && role === '',
        'Terminal observer must see correct owner restoration/withdrawal',
      );
      assert(scope.style.borderRadius === '11px', 'Unrelated authored style survives');
      results.push({
        entrance,
        action,
        nested: nested.state,
        returned: returned.state,
        role,
        marker,
        events: [...states],
      });
      attachment.dispose();
      scope.remove();
    }
  }
  return results;
}
