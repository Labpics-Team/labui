import assert from 'node:assert/strict';

// Consumer задаёт смысл действия; координаты и переход принадлежат Lab Icons.
export const SOURCE_STATE_GROUPS = Object.freeze(Object.fromEntries([
  { name: 'microphone', defaultState: 'unmuted', states: ['muted', 'unmuted'],
    icons: { muted: 'mic-off', unmuted: 'mic' }, heading: 'Микрофон',
    labels: { muted: 'Выключен', unmuted: 'Включён' }, selectLabel: 'Состояние микрофона',
    actionLabels: { muted: 'Включить микрофон', unmuted: 'Отключить микрофон' } },
  { name: 'visibility', defaultState: 'visible', states: ['hidden', 'visible'],
    icons: { hidden: 'eye-off', visible: 'eye' }, heading: 'Видимость',
    labels: { hidden: 'Скрыто', visible: 'Показано' }, selectLabel: 'Видимость содержимого',
    actionLabels: { hidden: 'Показать содержимое', visible: 'Скрыть содержимое' } },
].flatMap(({ name, ...configuration }) => ['outline', 'filled'].map((variant) => {
  const group = variant === 'outline' ? name : `${name}-filled`;
  return [group, Object.freeze({ ...configuration, variant, law: 'source.replace',
    enclosurePartId: null, sharedParts: [], samples: true, exportControls: true,
    heading: `${configuration.heading}, ${variant === 'outline' ? 'контурный' : 'залитый'}`,
    buttonLabel: configuration.actionLabels[configuration.defaultState] })];
}))));
export const SOURCE_STATE_ENTRIES = Object.freeze(Object.keys(SOURCE_STATE_GROUPS).map((group) => `@labpics/icons/states/${group}`));

export function sourceStateReferenceContract(group) {
  assert.ok(Object.hasOwn(SOURCE_STATE_GROUPS, group), 'consumer не запрашивал такую source state group');
  return structuredClone(SOURCE_STATE_GROUPS[group]);
}

export function sourceStateFixture() {
  return Object.entries(SOURCE_STATE_GROUPS).map(([group, configuration], index) => `
import * as sourceState${index} from '@labpics/icons/states/${group}';
const sourceConsumer${index} = mountStateConsumer(sourceState${index}, ${JSON.stringify(configuration)});
window.__iconsPacked.stateConsumers[${JSON.stringify(group)}] = sourceConsumer${index};
const sourceReady${index} = window.__iconsPacked.ready;
window.__iconsPacked.ready = Promise.all([sourceReady${index}, sourceConsumer${index}.ready]);
`).join('');
}

export function sourceStateTypeFixture() {
  return Object.entries(SOURCE_STATE_GROUPS).map(([group, configuration], index) => `
import { render as sourceRender${index}, renderStateSvg as sourceStateSvg${index}, compileStateEffect as sourceEffect${index}, exportStateTransition as sourceExport${index}, stateCapabilities as sourceCapabilities${index} } from '@labpics/icons/states/${group}';
sourceRender${index}('${configuration.defaultState}', { variant: '${configuration.variant}' });
sourceStateSvg${index}('${configuration.states[0]}');
sourceEffect${index}('${configuration.states[0]}', { duration: 160, reducedMotion: true });
sourceExport${index}('${configuration.states[0]}', { format: 'web-effect', duration: 240 });
const sourceKind${index}: 'source-replacement' = sourceCapabilities${index}().transition;
const sourceEnclosure${index}: null = sourceCapabilities${index}().enclosurePartId;
// @ts-expect-error Неподдержанное предметное состояние.
sourceRender${index}('missing');
// @ts-expect-error Геометрическая вариация не доказана для обоих masters.
sourceEffect${index}('${configuration.defaultState}', { duration: 160, variation: { bodyWidth: .9 } });
// @ts-expect-error Начертание принадлежит выбранной группе.
sourceRender${index}('${configuration.defaultState}', { variant: '${configuration.variant === 'outline' ? 'filled' : 'outline'}' });
`).join('');
}
