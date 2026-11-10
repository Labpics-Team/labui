/** Только схлопываемый HTML-пробел не создаёт текстовый регион; NBSP остаётся содержимым. */
export function hasCardText(value: string): boolean {
  return /[^\t\n\f\r ]/.test(value);
}
