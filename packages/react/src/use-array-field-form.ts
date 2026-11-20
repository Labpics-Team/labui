import { useEffect, useLayoutEffect, useRef } from 'react';
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The editable draft is not a selected form value. One reset listener per mounted
 * field observes native cancellation; values travel through normal hidden inputs. */
export function useArrayFieldForm(options: {
  value: readonly string[];
  defaultValue?: string[];
  controlled: boolean;
  required: boolean;
  invalid: boolean;
  error?: string;
  reset(value: string[]): void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const initial = useRef([...(options.defaultValue ?? [])]);
  const current = useRef(options);
  current.current = options;
  useClientLayoutEffect(() => {
    const input = root.current?.querySelector<HTMLInputElement>('.lab-field-control');
    input?.setCustomValidity(
      options.invalid
        ? options.error || 'Invalid value.'
        : options.required && options.value.length === 0
          ? 'Please select a value.'
          : '',
    );
  });
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let connected = true;
    const document = node.ownerDocument;
    const reset = (event: Event) => {
      const input = node.querySelector<HTMLInputElement>('.lab-field-control');
      if (!input?.form || event.target !== input.form) return;
      setTimeout(() => {
        if (
          connected &&
          !event.defaultPrevented &&
          input.form === event.target &&
          !current.current.controlled
        )
          current.current.reset([...initial.current]);
      });
    };
    document.addEventListener('reset', reset, true);
    return () => {
      connected = false;
      document.removeEventListener('reset', reset, true);
    };
  }, []);
  return root;
}
