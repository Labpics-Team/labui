export type TextMetrics = {
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  letterSpacing: number;
};
type Resolved<T> = T extends { $textStyle: string }
  ? { [K in keyof T as K extends '$textStyle' ? never : K]: Resolved<T[K]> } & TextMetrics
  : T extends object
    ? { [K in keyof T]: Resolved<T[K]> }
    : T;

export function resolveTextStyles<T>(value: T): Resolved<T>;
