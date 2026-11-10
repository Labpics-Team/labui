import config from '../labui.config.json' with { type: 'json' };

/** Публичные подключения в настоящем браузере с установленным Core. */
export async function browserOwnershipScenarios(attachLabuiColors) {
  const scope = document.createElement('div');
  scope.dataset.theme = 'light';
  scope.style.setProperty('--lab-label-primary', 'rgb(31 32 33)');
  document.body.append(scope);
  const options = {
    scope,
    observe: () => ({ kind: 'observed', surface: [255, 255, 255] }),
    wasmUrl: '/core.wasm',
  };
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const rejectDuplicate = () => {
    let duplicate;
    let rejected = false;
    try {
      duplicate = attachLabuiColors(options);
    } catch (error) {
      rejected = error.message.includes('уже имеет владельца');
    } finally {
      duplicate?.dispose();
    }
    assert(rejected, 'A live scope must reject another owner without a DOM marker');
  };
  let first;
  let second;
  try {
    const before = scope.outerHTML;
    const invalid = structuredClone(config);
    invalid.authored.materials.dark.extra = Object.values(invalid.authored.materials.dark)[0];
    let invalidAttachment;
    let invalidRejected = false;
    try {
      invalidAttachment = attachLabuiColors({ ...options, config: invalid });
    } catch (error) {
      invalidRejected = error.message.includes('одинаковый набор материалов');
    } finally {
      invalidAttachment?.dispose();
    }
    assert(invalidRejected, 'Theme-only roles must be rejected before attachment');
    assert(scope.outerHTML === before, 'Invalid topology must leave the scope untouched');

    const createElement = document.createElement;
    const startupError = new Error('CSS preparation refused once');
    let refused = false;
    let reported;
    document.createElement = function (...args) {
      if (!refused) {
        refused = true;
        throw startupError;
      }
      return createElement.apply(this, args);
    };
    try {
      attachLabuiColors(options);
    } catch (error) {
      reported = error;
    } finally {
      document.createElement = createElement;
    }
    assert(reported === startupError, 'Startup rollback must retain the original error');
    assert(scope.outerHTML === before, 'Failed acquisition must restore the untouched scope');

    first = attachLabuiColors(options);
    assert((await first.ready).state === 'ready', 'Valid attachment after rejection must work');
    scope.removeAttribute('data-lab-colors-scope');
    const published = scope.style.cssText;
    rejectDuplicate();
    assert(scope.style.cssText === published, 'Rejected duplicate must not change outputs');
    assert((await first.refresh()).state === 'ready', 'The first owner must recover its marker');
    scope.removeAttribute('data-lab-colors-scope');
    assert(first.cancel().state === 'cancelled', 'Cancel must suspend the first owner');
    rejectDuplicate();
    assert((await first.refresh()).state === 'ready', 'Cancel must preserve the first owner');
    assert(first.dispose().state === 'disposed', 'Dispose must finish before replacement');

    second = attachLabuiColors(options);
    assert((await second.ready).state === 'ready', 'Dispose must permit a new owner');
    const marker = scope.getAttribute('data-lab-colors-scope');
    first.dispose();
    assert(
      scope.getAttribute('data-lab-colors-scope') === marker,
      'Old dispose must not release the new owner',
    );
    assert((await second.refresh()).state === 'ready', 'The new owner must remain current');
    assert(second.dispose().state === 'disposed', 'The new owner must finish cleanup');
    assert(
      scope.style.getPropertyValue('--lab-label-primary') === 'rgb(31 32 33)',
      'Authored input must survive ownership changes',
    );
    return [
      'invalid-topology',
      'startup-rollback',
      'marker-removal',
      'cancel-preserves-owner',
      'dispose-releases-owner',
    ];
  } finally {
    first?.dispose();
    second?.dispose();
    scope.remove();
  }
}
