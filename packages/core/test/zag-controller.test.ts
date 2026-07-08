/**
 * Бетонирует инвариант мемоизации `ZagController.api` (PR #124, issue #127).
 *
 * Класс бага: `.api` кэширует результат `connect()` на один рендер (`apiCache`),
 * а `connect()` — чистый снапшот состояния машины. Кэш ОБЯЗАН инвалидироваться,
 * иначе компонент читает устаревшее `api` через переход/рендер машины (напр.
 * thumb слайдера держит старый value/`data-focus` после drag-перехода). `tsc` и
 * прочие core-тесты этого не трогают; ловит только тяжёлый Playwright/VRT.
 *
 * Три точки инвалидации в источнике:
 *   78  subscribe-колбэк   — машина сделала переход, снапшот протух;
 *   89  hostUpdate()       — новый цикл рендера, втекают reflected-props;
 *   101 hostDisconnected() — машина остановлена, кэш сброшен.
 *
 * Тест — Class-C (инвариант) на fake `MachineModule`: настоящий минимальный
 * двух-состоянийный Zag-механизм + `connect`, возвращающий НОВЫЙ объект на каждый
 * вызов, так что тождество object-ref различает memo-hit от пересборки. Помимо
 * наблюдаемого контракта (`.api`) читаем приватное поле `apiCache` напрямую —
 * это единственный способ изолированно залочить каждую точку сброса.
 *
 * ЧЕСТНАЯ ОГОВОРКА про строку 89. `VanillaMachine.updateProps` (её зовёт
 * `hostUpdate` на строке 92) вызывает `notify()` СИНХРОННО, а тот через publish
 * дёргает subscribe-колбэк контроллера — т.е. строку 78, которая тоже обнуляет
 * `apiCache`. Поэтому в Zag 1.41.2 удаление ОДНОЙ строки 89 не наблюдаемо ни
 * чёрным, ни белым ящиком: постусловие «после hostUpdate кэш пуст» держит и 78.
 * Строка 89 — defense-in-depth (не полагаться на недокументированную синхронность
 * notify). Тест лочит её КЛАСС: кейс «новый цикл рендера» краснеет, если убрать
 * ОБЕ render-cycle-инвалидации (78 И 89) — ровно тот регресс, где снапшот
 * переживает цикл рендера. Точечный сброс изолированно бетонируют строки 78 и 101.
 *
 * `VanillaMachine.send` откладывает переход через `queueMicrotask`, поэтому после
 * `send`/`hostConnected` мы прокачиваем микротаски (`flushMicrotasks`).
 */
import type { Service } from '@zag-js/core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { describe, expect, it } from 'vitest';
import type { MachineModule, MachineProps } from '../src/behaviors/types.js';
import { ZagController } from '../src/lit/zag-controller.js';

/** Дать отложенным через `queueMicrotask` переходам машины отработать. */
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

/** Схема минимальной машины: два состояния, одно событие-тумблер. */
interface ToggleSchema {
  props: MachineProps<never> & { getRootNode?: () => Node };
  context: Record<string, never>;
  state: 'off' | 'on';
  event: { type: 'TOGGLE' };
  tag: string;
  guard: string;
  action: string;
  effect: string;
  refs: Record<string, never>;
  computed: Record<string, never>;
}

/** Снапшот, который отдаёт `connect`: включает текущее состояние машины. */
interface ToggleApi {
  readonly state: string;
}

/**
 * Минимальный настоящий Zag-механизм: `off ⇄ on` по `TOGGLE`. Переход меняет
 * `state.ref`, что заставляет `VanillaMachine` уведомить подписчиков — ровно тот
 * путь, что инвалидирует `apiCache` в subscribe-колбэке контроллера. Каждый вызов
 * `connect` — НОВЫЙ объект: тождество ref различает memo-hit от пересборки.
 */
function makeToggleModule(): MachineModule<ToggleSchema, ToggleApi> {
  return {
    machine: {
      initialState: () => 'off',
      states: {
        off: { on: { TOGGLE: { target: 'on' } } },
        on: { on: { TOGGLE: { target: 'off' } } },
      },
    },
    connect(service: Service<ToggleSchema>): ToggleApi {
      return { state: String(service.state.get()) };
    },
  };
}

/**
 * Fake-хост: отдаёт заглушку `renderRoot`. Минимальная машина никогда не делает
 * DOM-запросов (`getRootNode` не вызывается), так что пустой узел достаточен —
 * окружение тестов `node`, без DOM-шима.
 */
class FakeHost implements ReactiveControllerHost {
  readonly renderRoot = {} as unknown as HTMLElement;
  readonly controllers: ReactiveController[] = [];
  requestUpdateCount = 0;
  addController(c: ReactiveController): void {
    this.controllers.push(c);
  }
  removeController(c: ReactiveController): void {
    const i = this.controllers.indexOf(c);
    if (i >= 0) this.controllers.splice(i, 1);
  }
  requestUpdate(): void {
    this.requestUpdateCount += 1;
  }
  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

/** Прочитать приватный `apiCache` в рантайме — для изолированной проверки сброса. */
function readApiCache(controller: ZagController<ToggleSchema, ToggleApi>): ToggleApi | undefined {
  return (controller as unknown as { apiCache: ToggleApi | undefined }).apiCache;
}

/** Собрать контроллер поверх fake-хоста и запустить его как Lit при connect. */
async function mount(): Promise<{
  host: FakeHost;
  controller: ZagController<ToggleSchema, ToggleApi>;
}> {
  const host = new FakeHost();
  const controller = new ZagController<ToggleSchema, ToggleApi>(
    host,
    makeToggleModule(),
    () => ({}),
  );
  controller.hostConnected();
  await flushMicrotasks();
  return { host, controller };
}

describe('ZagController.api — инвариант мемоизации (issue #127)', () => {
  it('два чтения в одном рендере дают тот же object-ref (memo hit)', async () => {
    const { controller } = await mount();
    const a = controller.api;
    const b = controller.api;
    expect(b).toBe(a); // тот же ref → connect не пересобирал в пределах рендера
  });

  it('subscribe-колбэк (переход машины) инвалидирует кэш → новый ref/состояние', async () => {
    const { controller } = await mount();
    const before = controller.api;
    expect(before.state).toBe('off');

    controller.send({ type: 'TOGGLE' });
    await flushMicrotasks(); // переход отложен через queueMicrotask

    // Изолированно лочит строку 78: без неё apiCache переживёт переход.
    expect(readApiCache(controller)).toBeUndefined();
    const after = controller.api;
    expect(after).not.toBe(before); // кэш сброшен в subscribe → пересборка
    expect(after.state).toBe('on'); // и снапшот отражает НОВОЕ состояние
  });

  it('новый цикл рендера (hostUpdate) не даёт снапшоту пережить переход', async () => {
    const { controller } = await mount();
    const before = controller.api;
    expect(before.state).toBe('off');

    // Машина переходит, затем начинается новый цикл рендера. Обе render-cycle
    // инвалидации (78 subscribe + 89 hostUpdate) обязаны выкинуть старый снапшот;
    // тест краснеет, если убрать ИХ ОБЕ (класс «snapshot переживает рендер-цикл»).
    controller.send({ type: 'TOGGLE' });
    await flushMicrotasks();
    controller.hostUpdate();

    expect(readApiCache(controller)).toBeUndefined();
    const after = controller.api;
    expect(after).not.toBe(before);
    expect(after.state).toBe('on'); // читаем новое состояние, не залипший 'off'
  });

  it('hostDisconnected() сбрасывает кэш и последующее чтение .api бросает', async () => {
    const { controller } = await mount();
    controller.api; // прогреть кэш перед отключением
    expect(readApiCache(controller)).toBeDefined();

    controller.hostDisconnected();

    // Изолированно лочит строку 101: без неё apiCache переживёт disconnect.
    expect(readApiCache(controller)).toBeUndefined();
    // И контракт: читать `.api` после остановки машины нельзя.
    expect(() => controller.api).toThrow(/machine not started/);
  });
});
