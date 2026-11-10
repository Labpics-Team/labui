/** Реальный browser/Core public cleanup controls; без подмены математики. */
export async function browserCleanupScenarios(attachLabuiColors) {
  const controls = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  for (const failure of ['revoke', 'restore', 'canvas']) {
    // Given: healthy real Program и авторские role/canvas/несвязанные свойства.
    const scope = document.createElement('div');
    const backdrop = document.createElement('div');
    scope.dataset.theme = 'light';
    scope.style.setProperty('--lab-label-primary', 'rgb(31 32 33)');
    scope.style.setProperty('--lab-canvas-input', 'rgb(220 221 222)');
    scope.style.borderRadius = '11px';
    backdrop.style.backgroundColor = 'rgb(220, 221, 222)';
    document.body.append(scope, backdrop);
    const attachment = attachLabuiColors({
      scope,
      backdrop,
      canvas: 'authored',
      observe: () => ({ kind: 'observed', surface: [255, 255, 255] }),
      wasmUrl: '/core.wasm',
    });
    assert((await attachment.ready).state === 'ready', 'Healthy real Program must publish');
    const observations = [];
    scope.addEventListener('lab-colors-state', (event) => {
      observations.push({
        state: event.detail.state,
        marker: scope.hasAttribute('data-lab-colors-scope'),
        role: scope.style.getPropertyValue('--lab-label-primary'),
        background: backdrop.style.backgroundColor,
      });
    });
    const originalCreate = document.createElement;
    const originalSet = backdrop.style.setProperty;
    let calls = 0;
    const fault = new Error(`${failure} transient failure`);
    if (failure === 'canvas')
      backdrop.style.setProperty = () => {
        throw fault;
      };
    else
      document.createElement = function (...args) {
        if (++calls === (failure === 'revoke' ? 1 : 2)) throw fault;
        return originalCreate.apply(this, args);
      };
    // When: public dispose fails transiently and the same operation retries.
    let failed;
    try {
      failed = attachment.dispose();
    } finally {
      document.createElement = originalCreate;
      backdrop.style.setProperty = originalSet;
    }
    assert(
      failed.state === 'failed' && failed.reason === 'cleanup_failed',
      'Failure must not report terminal disposed',
    );
    assert(
      !observations.some((event) => event.state === 'disposed'),
      'Terminal event cannot precede restoration',
    );
    scope.style.borderRadius = '13px';
    const completed = attachment.dispose();
    // Then: owner/canvas restoration precedes terminal event, and retries preserve external changes.
    assert(completed.state === 'disposed', 'Restored boundary completes retry');
    assert(!scope.hasAttribute('data-lab-colors-scope'), 'Owner marker must be removed');
    assert(
      scope.style.getPropertyValue('--lab-label-primary') === 'rgb(31 32 33)',
      'Authored role must be restored',
    );
    assert(
      scope.style.getPropertyPriority('--lab-label-primary') === '',
      'Authored priority must be restored',
    );
    assert(scope.style.borderRadius === '13px', 'Retry preserves new unrelated external change');
    assert(
      scope.style.getPropertyValue('--lab-canvas-input') === 'rgb(220 221 222)',
      'Canvas source must be restored',
    );
    assert(backdrop.style.backgroundColor === 'rgb(220, 221, 222)', 'Backdrop must be restored');
    const terminal = observations.find((event) => event.state === 'disposed');
    assert(
      terminal &&
        !terminal.marker &&
        terminal.role === 'rgb(31 32 33)' &&
        terminal.background === 'rgb(220, 221, 222)',
      'Terminal observer sees complete restoration',
    );
    attachment.dispose();
    scope.remove();
    backdrop.remove();
    controls.push(failure);
  }
  return controls;
}
