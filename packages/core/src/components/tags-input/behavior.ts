import { getActiveElement } from '@zag-js/dom-query';
import * as tagsInput from '@zag-js/tags-input';
import type { MachineModule, SchemaOf } from '../../behaviors/types.js';
import { fieldPartIds } from '../field/field-a11y.js';

export function tagsInputIds(id: string): tagsInput.ElementIds {
  const field = fieldPartIds(id);
  return {
    input: field.control,
    label: field.label,
    // The label may change while the same editor still contains a newer draft.
    item: ({ index }) => `tags-input:${id}:tag:${index}`,
  };
}

type BaseSchema = SchemaOf<tagsInput.Service>;
type PendingInput = {
  draft: string;
  value: string[];
  log: BaseSchema['refs']['log']['current'];
};
export type TagsInputSchema = BaseSchema & {
  refs: BaseSchema['refs'] & {
    pendingInput?: PendingInput | null;
    editingSource?: { index: number; value: string; request?: PendingInput } | null;
    focusFrame?: number | null;
  };
};

/** A tag request and the draft it consumes are one edit. A controlled consumer
 * may reject or defer that request: clear the draft only after acceptance, and
 * only while it is still the draft that made that request. */
export const tagsInputBehavior: MachineModule<TagsInputSchema, tagsInput.Api> = {
  ...tagsInput,
  connect(service, normalize) {
    const api = tagsInput.connect(
      {
        ...service,
        // Machine actions may be deferred. Capture the focus that caused the
        // request at the event boundary, before the consumer can move it elsewhere.
        send: (event) =>
          service.send({ ...event, focusOrigin: getActiveElement(service.scope.getDoc()) }),
      },
      normalize,
    );
    const editing = (item: tagsInput.ItemProps) =>
      service.context.get('editedTagId') === api.getItemState(item).id;
    // An edit session outlives focus. The machine's navigation state still owns
    // keyboard movement; the session alone owns the draft and its visible editor.
    return {
      ...api,
      getInputProps: () => ({
        ...api.getInputProps(),
        ...normalize.input({
          onFocus: () => {
            queueMicrotask(() => {
              const input = service.scope.getById(
                service.prop('ids')?.input ?? `tags-input:${service.scope.id}:input`,
              );
              if (service.scope.isActiveElement(input)) service.send({ type: 'FOCUS' });
            });
          },
        }),
      }),
      getItemState: (item) => ({ ...api.getItemState(item), editing: editing(item) }),
      getItemPreviewProps: (item) => ({
        ...api.getItemPreviewProps(item),
        ...normalize.element({ hidden: editing(item) }),
      }),
      getItemInputProps: (item) => ({
        ...api.getItemInputProps(item),
        ...normalize.input({
          hidden: !editing(item),
          defaultValue: editing(item) ? service.context.get('editedTagValue') : '',
          onFocus: () => service.send({ type: 'EDIT_FOCUS' }),
        }),
      }),
    };
  },
  machine: {
    ...tagsInput.machine,
    refs(params) {
      const refs = tagsInput.machine.refs?.(params);
      if (!refs) throw new Error('Tags Input requires the machine resource references.');
      return { ...refs, pendingInput: null, editingSource: null, focusFrame: null };
    },
    exit: ['cancelFocus', 'clearLog'],
    watch(params) {
      tagsInput.machine.watch?.(params);
      params.track([() => JSON.stringify(params.context.get('value'))], () => {
        params.action(['reconcileEditedTag', 'clearAcceptedInput']);
      });
    },
    on: {
      ...tagsInput.machine.on,
      DOUBLE_CLICK_TAG: {
        ...tagsInput.machine.on?.DOUBLE_CLICK_TAG,
        actions: ['setEditedId', 'focusEditedTagInput'],
      },
      EDIT_FOCUS: { guard: 'hasEditedTag', target: 'editing:tag' },
      TAG_INPUT_TYPE: { guard: 'hasEditedTag', actions: ['setEditedTagValue'] },
      TAG_INPUT_ENTER: { guard: 'hasEditedTag', actions: ['requestEditedTag'] },
      TAG_INPUT_ESCAPE: {
        guard: 'hasEditedTag',
        target: 'navigating:tag',
        actions: ['clearEditedTagValue', 'focusInput', 'clearEditedId', 'highlightTagAtIndex'],
      },
      EDIT_ACCEPTED: [
        {
          guard: ({ event }) => !!event.focused,
          target: 'navigating:tag',
          actions: ['clearEditedTagValue', 'focusInput', 'clearEditedId', 'highlightTagAtIndex'],
        },
        { actions: ['clearEditedTagValue', 'clearEditedId', 'clearHighlightedId'] },
      ],
      INSERT_TAG: {
        ...tagsInput.machine.on?.INSERT_TAG,
        actions: ['addTag'],
      },
    },
    states: {
      ...tagsInput.machine.states,
      'editing:tag': {
        ...tagsInput.machine.states['editing:tag'],
        entry: [],
        on: {
          FOCUS: { target: 'focused:input' },
          TAG_INPUT_BLUR: { target: 'idle', actions: ['clearHighlightedId'] },
        },
      },
    },
    implementations: {
      ...tagsInput.machine.implementations,
      guards: {
        ...tagsInput.machine.implementations?.guards,
        hasEditedTag: ({ refs }) => !!refs.get('editingSource'),
      },
      actions: {
        ...tagsInput.machine.implementations?.actions,
        cancelFocus({ refs, scope }) {
          const frame = refs.get('focusFrame');
          if (frame != null) scope.getWin().cancelAnimationFrame(frame);
          refs.set('focusFrame', null);
        },
        focusInput({ action, refs, scope, prop, state, event }) {
          action(['cancelFocus']);
          const previous =
            (event.focusOrigin as HTMLElement | undefined) ?? getActiveElement(scope.getDoc());
          refs.set(
            'focusFrame',
            scope.getWin().requestAnimationFrame(() => {
              refs.set('focusFrame', null);
              if (state.matches('editing:tag') || focusWasRedirected(scope.getDoc(), previous))
                return;
              scope
                .getById<HTMLInputElement>(prop('ids')?.input ?? `tags-input:${scope.id}:input`)
                ?.focus();
            }),
          );
        },
        focusEditedTagInput({ action, refs, context, scope, state, event }) {
          action(['cancelFocus']);
          const id = context.get('editedTagId');
          const previous =
            (event.focusOrigin as HTMLElement | undefined) ?? getActiveElement(scope.getDoc());
          refs.set(
            'focusFrame',
            scope.getWin().requestAnimationFrame(() => {
              refs.set('focusFrame', null);
              if (
                !id ||
                id !== context.get('editedTagId') ||
                !state.matches('editing:tag') ||
                focusWasRedirected(scope.getDoc(), previous)
              )
                return;
              const editor = scope.getById<HTMLInputElement>(`${id}:input`);
              if (editor && !scope.isActiveElement(editor)) editor.select();
            }),
          );
        },
        setEditedId(params) {
          const id = params.event.id ?? params.context.get('highlightedTagId');
          const source = params.refs.get('editingSource');
          if (
            source &&
            id === params.context.get('editedTagId') &&
            params.context.get('value')[source.index] === source.value
          )
            return;
          tagsInput.machine.implementations?.actions?.setEditedId?.(params);
          const index = params.context.get('editedTagIndex');
          const value = index === null ? undefined : params.context.get('value')[index];
          params.refs.set(
            'editingSource',
            index === null || value === undefined ? null : { index, value },
          );
        },
        clearEditedId(params) {
          params.refs.set('editingSource', null);
          tagsInput.machine.implementations?.actions?.clearEditedId?.(params);
        },
        requestEditedTag({ context, prop, refs, action, flush }) {
          const source = refs.get('editingSource');
          const previous = context.get('value');
          if (!source || previous[source.index] !== source.value) return;
          const draft = context.get('editedTagValue');
          const edited = prop('sanitizeValue')(draft);
          if (
            edited &&
            (!prop('validate')?.({ inputValue: edited, value: [...previous] }) ||
              (!prop('allowDuplicates') &&
                previous.some((value, index) => index !== source.index && value === edited)))
          ) {
            prop('onValueInvalid')?.({ reason: 'invalidTag' });
            return;
          }
          const value = edited
            ? previous.map((value, index) => (index === source.index ? edited : value))
            : previous.filter((_, index) => index !== source.index);
          refs.set('editingSource', {
            ...source,
            request: {
              draft,
              value,
              log: edited
                ? { type: 'update', value: edited }
                : { type: 'delete', value: source.value },
            },
          });
          flush(() => context.set('value', value));
          action(['reconcileEditedTag']);
        },
        reconcileEditedTag({ context, refs, send, action, scope }) {
          const source = refs.get('editingSource');
          if (!source) return;
          const accepted = context.get('value');
          const request = source.request;
          if (request && equalValues(accepted, request.value)) {
            const editorId = context.get('editedTagId');
            const focused = !!editorId && scope.isActiveElement(scope.getById(`${editorId}:input`));
            refs.set('log', { prev: refs.get('log').current, current: request.log });
            if (context.get('editedTagValue') === request.draft || request.log?.type === 'delete') {
              send({ type: 'EDIT_ACCEPTED', focused });
            } else {
              // The earlier request changed the accepted basis, not the newer draft.
              refs.set('editingSource', {
                index: source.index,
                value: accepted[source.index] ?? source.value,
              });
            }
          } else if (accepted[source.index] !== source.value) {
            // Bare strings have no entity IDs. External removal/reordering or a
            // conflicting replacement ends this session rather than editing a neighbour.
            action(['clearEditedTagValue', 'clearEditedId', 'clearHighlightedId']);
          }
        },
        addTag(params) {
          params.action(['requestInputTags']);
        },
        addTagFromPaste(params) {
          params.action(['requestInputTags']);
        },
        requestInputTags({ context, prop, event, refs, action, flush }) {
          const draft = context.get('inputValue');
          const inputValue = prop('sanitizeValue')(event.value ?? draft);
          const previous = context.get('value');
          if (!prop('validate')?.({ inputValue, value: [...previous] })) {
            prop('onValueInvalid')?.({ reason: 'invalidTag' });
            return;
          }
          const pasted = event.type === 'PASTE';
          const added =
            pasted && prop('delimiter')
              ? inputValue.split(prop('delimiter')).map(prop('sanitizeValue'))
              : [inputValue];
          const combined = [...previous, ...added];
          const value = prop('allowDuplicates') ? combined : [...new Set(combined)];
          if (!prop('allowOverflow') && value.length > prop('max')) {
            prop('onValueInvalid')?.({ reason: 'rangeOverflow' });
            return;
          }
          refs.set('pendingInput', {
            draft,
            value,
            log: pasted ? { type: 'paste', values: added } : { type: 'add', value: inputValue },
          });
          flush(() => context.set('value', value));
          action(['clearAcceptedInput']);
        },
        clearAcceptedInput({ context, refs }) {
          const pending = refs.get('pendingInput');
          if (!pending) return;
          if (context.get('inputValue') !== pending.draft) {
            refs.set('pendingInput', null);
            return;
          }
          const accepted = context.get('value');
          if (!equalValues(accepted, pending.value)) return;
          refs.set('pendingInput', null);
          refs.set('log', { prev: refs.get('log').current, current: pending.log });
          context.set('inputValue', '');
        },
        setInputValue(params) {
          params.refs.set('pendingInput', null);
          tagsInput.machine.implementations?.actions?.setInputValue?.(params);
        },
      },
    },
  },
};

function equalValues(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function focusWasRedirected(document: Document, previous: HTMLElement | null): boolean {
  const current = getActiveElement(document);
  // Hiding the completed editor moves focus to body; transferring focus to
  // another real control is a newer user/consumer intent and must win.
  return current !== previous && current !== null && current !== document.body;
}
