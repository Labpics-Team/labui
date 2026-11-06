import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Machine } from '@zag-js/core';
import type { VanillaMachine } from '@zag-js/vanilla';
import { expect, it } from 'vitest';

interface LifetimeSchema {
  props: { id: string };
  context: Record<string, never>;
  state: 'closed' | 'open';
  event: { type: 'OPEN' | 'CLOSE' | 'PING'; source?: 'old' | 'new' };
  tag: string;
  guard: string;
  action: 'record';
  effect: 'hold';
  refs: Record<string, never>;
  computed: Record<string, never>;
}

const require = createRequire(import.meta.url);
const directory = dirname(require.resolve('@zag-js/vanilla'));
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

for (const format of ['esm', 'cjs'] as const) {
  async function resource() {
    const file = join(directory, `machine.${format === 'esm' ? 'mjs' : 'js'}`);
    const runtime: { VanillaMachine: typeof VanillaMachine } =
      format === 'esm' ? await import(pathToFileURL(file).href) : require(file);
    const events: string[] = [];
    let held = 0;
    const definition: Machine<LifetimeSchema> = {
      initialState: () => 'closed',
      states: {
        closed: {
          on: { OPEN: { target: 'open' }, PING: { actions: ['record'] } },
        },
        open: {
          effects: ['hold'],
          on: { CLOSE: { target: 'closed' }, PING: { actions: ['record'] } },
        },
      },
      implementations: {
        actions: { record: ({ event }) => events.push(event.source ?? 'unlabeled') },
        effects: {
          hold() {
            held += 1;
            events.push('acquire');
            return () => {
              held -= 1;
              events.push('release');
            };
          },
        },
      },
    };
    const machine = new runtime.VanillaMachine(definition, { id: `lifetime-${format}` });
    machine.start();
    return { machine, events, held: () => held };
  }

  it(`${format}: same-instance restart отвергает transition и action прежней очереди`, async () => {
    const { machine, events, held } = await resource();
    machine.send({ type: 'OPEN', source: 'old' });
    machine.send({ type: 'PING', source: 'old' });
    machine.stop();
    machine.start();
    machine.send({ type: 'PING', source: 'new' });
    await settle();
    expect(machine.state.get()).toBe('closed');
    expect(events).toEqual(['new']);
    expect(held()).toBe(0);
    machine.send({ type: 'OPEN', source: 'new' });
    await settle();
    expect(machine.state.get()).toBe('open');
    expect(held()).toBe(1);
    machine.send({ type: 'CLOSE', source: 'new' });
    await settle();
    expect(events).toEqual(['new', 'acquire', 'release']);
    expect(held()).toBe(0);
    machine.stop();
  });

  it(`${format}: обычная очередь current lifetime сохраняет действия и cleanup`, async () => {
    const { machine, events, held } = await resource();
    machine.send({ type: 'PING', source: 'new' });
    machine.send({ type: 'OPEN', source: 'new' });
    await settle();
    expect(events).toEqual(['new', 'acquire']);
    expect(held()).toBe(1);
    machine.stop();
    machine.send({ type: 'OPEN', source: 'old' });
    await settle();
    expect(events).toEqual(['new', 'acquire', 'release']);
    expect(held()).toBe(0);
  });
}
