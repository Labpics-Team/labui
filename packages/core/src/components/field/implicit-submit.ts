const implicitSubmissionTypes = new Set([
  'text',
  'search',
  'tel',
  'url',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
]);

/** Shadow inputs have no native form owner. Complete the HTML default action
 * after bubbling, so an ancestor can still cancel Enter and rendering can
 * publish a committed value before constraint validation. */
export function submitFromShadowInput(
  event: KeyboardEvent,
  input: HTMLInputElement,
  getForm: () => HTMLFormElement | null,
): void {
  const form = getForm();
  if (
    event.key !== 'Enter' ||
    event.isComposing ||
    event.keyCode === 229 ||
    !form ||
    !implicitSubmissionTypes.has(input.type)
  )
    return;
  setTimeout(() => {
    if (event.defaultPrevented || !input.isConnected || getForm() !== form || input.disabled)
      return;
    const root = form.getRootNode() as Document | ShadowRoot;
    const submitter = [
      ...root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'),
    ].find(
      (element) => element.form === form && (element.type === 'submit' || element.type === 'image'),
    );
    if (submitter) {
      if (!submitter.matches(':disabled')) submitter.click();
      return;
    }
    const blocking = [...form.elements].filter((element) => {
      const control =
        element instanceof HTMLInputElement
          ? element
          : element.shadowRoot?.querySelector<HTMLInputElement>('input:not([type="hidden"])');
      return control && implicitSubmissionTypes.has(control.type);
    });
    if (blocking.length <= 1) form.requestSubmit();
  }, 0);
}
