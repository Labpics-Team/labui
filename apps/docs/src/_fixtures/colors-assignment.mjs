import '@labpics/ui-core/button';
import init, { compileProgramWire, isBindingError } from '@labpics/colors';
import wasmUrl from '@labpics/colors/pkg/labcolors_bg.wasm?url';
import {
  ProgramWireBuilderV3,
  SURROUND_AVERAGE_V1,
  WCAG22_SC143_TEXT_DEFAULT_V1,
} from '@labpics/colors/program-wire/abi-v3.js';

// Декларации потребителя. Тёмная область и primary — исторические значения CSS,
// а не новое подтверждение тёмного режима по макету. Роли в Core не передаются.
const declarations = {
  light: { accent: [0, 122, 255], primary: [16, 16, 18], surface: [255, 255, 255] },
  dark: { accent: [74, 143, 255], primary: [246, 248, 250], surface: [16, 16, 18] },
};
const fullRgb = { kind: 'box', lower: [0, 0, 0], upper: [255, 255, 255] };
const slots = new Map([
  [91, 'accent'],
  [92, 'onAccent'],
  [93, 'primary'],
]);
const modes = {
  baseline: { hardContrastFloor: null, accentMaxDelta: 0, experimental: false, limitProbe: false },
  strict: { hardContrastFloor: 4.5, accentMaxDelta: 0, experimental: false, limitProbe: false },
  diagnostic: {
    hardContrastFloor: 4.5,
    accentMaxDelta: 0.1,
    experimental: true,
    limitProbe: false,
  },
  incomplete: { hardContrastFloor: 4.5, accentMaxDelta: 1, experimental: true, limitProbe: true },
};

function wireFor(declaration, mode) {
  const options = modes[mode];
  const builder = new ProgramWireBuilderV3()
    .source(11, [255, 255, 255])
    .fixedTarget(22, 11)
    .computedTarget(21, fullRgb, declaration.accent, options.accentMaxDelta)
    .source(13, declaration.primary)
    .fixedTarget(23, 13)
    .assignment([21])
    .surfaceInputPort(31)
    .inputSurface(51, 31)
    .solidPaint(41, 21)
    .solidPaint(42, 22)
    .solidPaint(43, 23)
    .sourceOverOccurrence(61, 41, 51, 64, 0.2, SURROUND_AVERAGE_V1)
    .occurrenceSurface(52, 61)
    .sourceOverOccurrence(62, 42, 52, 64, 0.2, SURROUND_AVERAGE_V1)
    .sourceOverOccurrence(63, 43, 51, 64, 0.2, SURROUND_AVERAGE_V1)
    .presentationRoot(71, 62)
    .presentationTarget(71, 62)
    .presentationRoot(72, 63)
    .presentationTarget(72, 63)
    .output(91, 41)
    .output(92, 42)
    .output(93, 43);
  // Базовая декларация наблюдает контраст без обязательного порога.
  builder.wcag22VisibleUnary(
    options.hardContrastFloor !== null,
    81,
    62,
    WCAG22_SC143_TEXT_DEFAULT_V1,
  );
  builder.wcag22VisibleUnary(false, 83, 63, WCAG22_SC143_TEXT_DEFAULT_V1);
  if (options.limitProbe) {
    // Публичная relation несовместима с hard-контрастом. Лимит поиска Core
    // должен дать incomplete, а не выдать незавершённый поиск за пустое множество.
    builder
      .source(12, declaration.accent)
      .fixedTarget(24, 12)
      .exactIntrinsicRelationHard(82, 24, [21]);
  }
  return builder.finish();
}

function requireUnavailableOutputs(snapshot) {
  for (const method of ['outputSlot', 'outputRgb', 'outputOpacity']) {
    try {
      snapshot[method](0);
    } catch (error) {
      if (
        isBindingError(error) &&
        error.operation === 'readProgramOutput' &&
        error.code === 'invalid_output_index'
      )
        continue;
      throw error;
    }
    throw new Error(`Снимок ${snapshot.state} допускает чтение ${method}`);
  }
  return true;
}

function readTuple(snapshot) {
  if (snapshot.outputCount() !== slots.size) throw new Error('Неполный текущий набор цветов');
  const tuple = {};
  const outputs = [];
  for (let index = 0; index < snapshot.outputCount(); index += 1) {
    const slot = snapshot.outputSlot(index);
    const name = slots.get(slot);
    const rgb = Array.from(snapshot.outputRgb(index));
    const opacity = snapshot.outputOpacity(index);
    if (
      !name ||
      Object.hasOwn(tuple, name) ||
      opacity !== 1 ||
      rgb.length !== 3 ||
      !rgb.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
    ) {
      throw new Error('Снимок нарушает контракт трёх непрозрачных цветов');
    }
    tuple[name] = rgb;
    outputs.push({ slot, rgb, opacity });
  }
  return { tuple, outputs };
}

function cssTuple(tuple) {
  const rgb = (value) => `rgb(${value.join(' ')})`;
  return `display:block;--lab-fill-accent:${rgb(tuple.accent)};--lab-label-on-accent:${rgb(tuple.onAccent)};--lab-label-primary:${rgb(tuple.primary)};`;
}

const stateText = {
  waiting: 'Ожидание наблюдения: текущие цвета недоступны.',
  stale: 'Наблюдение утратило актуальность: текущие цвета недоступны.',
  unsatisfied: 'При нулевом допуске требование контраста невыполнимо.',
  incomplete: 'Достигнут лимит поиска: допустимый набор не установлен.',
  disconnected: 'Область отключена; ресурсы освобождены.',
  error: 'Ошибка вычисления: текущие цвета недоступны.',
};

class WitnessScope {
  constructor(name) {
    this.name = name;
    this.root = document.querySelector(`[data-witness-scope="${name}"]`);
    this.parent = this.root.parentElement;
    this.position = document.createComment(`Область ${name}`);
    this.root.before(this.position);
    this.node = this.root.querySelector('[data-current-tuple]');
    this.status = this.root.querySelector('[data-status]');
    this.declaration = declarations[name];
    this.runtime = null;
    this.mode = 'baseline';
    this.revision = 0n;
    this.publications = 0;
    this.resources = { created: 0, freed: 0, snapshotsCreated: 0, snapshotsFreed: 0 };
    this.current = {
      state: 'waiting',
      outputCount: 0,
      tuple: null,
      outputs: [],
      invalidOutputReadsRejected: null,
    };
  }

  releaseRuntime() {
    if (!this.runtime) return;
    this.runtime.free();
    this.runtime = null;
    this.resources.freed += 1;
  }

  selectProgram(mode) {
    if (this.runtime && this.mode === mode) return;
    this.releaseRuntime();
    this.mode = mode;
    this.runtime = compileProgramWire(wireFor(this.declaration, mode), 1);
    this.resources.created += 1;
  }

  update(unknown) {
    this.revision += 1n;
    const snapshot = unknown
      ? this.runtime.updateUnknown(this.revision, 1)
      : this.runtime.updateObserved(
          this.revision,
          new Uint32Array([1]),
          new Uint8Array(this.declaration.surface),
          1,
        );
    this.resources.snapshotsCreated += 1;
    try {
      if (snapshot.snapshotVersion !== 2) throw new Error('Ожидался снимок Program V3');
      const ready = snapshot.state === 'ready';
      const values = ready ? readTuple(snapshot) : { tuple: null, outputs: [] };
      if (!ready && snapshot.outputCount() !== 0)
        throw new Error('Недоступный снимок содержит исторические цвета');
      const invalidOutputReadsRejected = ready ? null : requireUnavailableOutputs(snapshot);
      this.current = {
        state: snapshot.state,
        reason: snapshot.reason ?? null,
        revision: snapshot.revision.toString(),
        outputCount: snapshot.outputCount(),
        invalidOutputReadsRejected,
        ...values,
      };
      // Только этот дочерний узел принадлежит публикации: хост и его роли сохраняются.
      // Готовые три значения приходят из одного снимка и меняются одной записью.
      this.node.style.cssText = ready ? cssTuple(values.tuple) : 'display:none';
      if (ready) this.publications += 1;
      this.status.textContent = ready
        ? this.mode === 'diagnostic'
          ? 'Новый акцент назначен Core. Допуск 0,1 экспериментальный; контраст 4,5:1 — жёсткое условие.'
          : 'Исходные цвета сохранены. Жёсткий порог контраста для кнопки не задан.'
        : stateText[snapshot.state];
    } finally {
      snapshot.free();
      this.resources.snapshotsFreed += 1;
    }
  }

  disconnect() {
    if (!this.root.isConnected && !this.runtime) return;
    this.node.style.cssText = 'display:none';
    this.releaseRuntime();
    this.current = {
      state: 'disconnected',
      outputCount: 0,
      tuple: null,
      outputs: [],
      invalidOutputReadsRejected: null,
    };
    this.status.textContent = stateText.disconnected;
    this.root.remove();
  }

  run(action) {
    if (action === 'disconnect') {
      this.disconnect();
      return;
    }
    if (action === 'reconnect') {
      if (this.root.isConnected && this.runtime) return;
      this.position.after(this.root);
      this.selectProgram('baseline');
      this.update(true);
      return;
    }
    if (!this.root.isConnected) throw new Error('Сначала подключите область');
    if (action === 'unknown') {
      this.update(true);
      return;
    }
    const mode = action === 'recover' ? 'baseline' : action;
    if (!Object.hasOwn(modes, mode)) throw new Error(`Неизвестное действие: ${action}`);
    this.selectProgram(mode);
    this.update(false);
  }

  read() {
    return structuredClone({
      ...this.current,
      connected: this.root.isConnected,
      mode: this.mode,
      publications: this.publications,
      diagnostics: { ...modes[this.mode], primary: 'fixed' },
      resources: {
        ...this.resources,
        live:
          this.resources.created -
          this.resources.freed +
          this.resources.snapshotsCreated -
          this.resources.snapshotsFreed,
      },
    });
  }
}

const scopes = new Map();
const ready = (async () => {
  await init({ module_or_path: wasmUrl });
  await customElements.whenDefined('lab-button');
  for (const name of Object.keys(declarations)) {
    const scope = new WitnessScope(name);
    scopes.set(name, scope);
    scope.selectProgram('baseline');
    scope.update(true);
  }
  await Promise.all(
    Array.from(document.querySelectorAll('lab-button'), (button) => button.updateComplete),
  );
})();

function scopeFor(name) {
  const scope = scopes.get(name);
  if (!scope) throw new Error(`Неизвестная область: ${name}`);
  return scope;
}

window.__labColorsWitness = Object.freeze({
  ready,
  async run(name, action) {
    await ready;
    const scope = scopeFor(name);
    try {
      scope.run(action);
    } catch (error) {
      scope.node.style.cssText = 'display:none';
      scope.current = {
        state: 'error',
        outputCount: 0,
        tuple: null,
        outputs: [],
        invalidOutputReadsRejected: null,
      };
      scope.status.textContent = stateText.error;
      throw error;
    }
    await scope.root.querySelector('lab-button').updateComplete;
    return scope.read();
  },
  read(name) {
    return scopeFor(name).read();
  },
});
