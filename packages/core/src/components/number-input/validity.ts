export function numberInputValidity(input: {
  value: string;
  valueAsNumber: number;
  min?: number;
  max?: number;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}): { flags: ValidityStateFlags; message: string } {
  if (input.disabled || input.readOnly) return { flags: {}, message: '' };
  if (input.required && input.value === '')
    return { flags: { valueMissing: true }, message: 'Please fill out this field.' };
  if (input.value !== '') {
    if (
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.value) ||
      !Number.isFinite(input.valueAsNumber)
    )
      return { flags: { badInput: true }, message: 'Please enter a number.' };
    const min = input.min ?? Number.MIN_SAFE_INTEGER;
    const max = input.max ?? Number.MAX_SAFE_INTEGER;
    if (input.valueAsNumber < min)
      return { flags: { rangeUnderflow: true }, message: `Value must be at least ${min}.` };
    if (input.valueAsNumber > max)
      return { flags: { rangeOverflow: true }, message: `Value must be at most ${max}.` };
  }
  return input.invalid
    ? { flags: { customError: true }, message: 'Invalid value.' }
    : { flags: {}, message: '' };
}
