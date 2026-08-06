export type ClassValue = string | number | boolean | undefined | null;

/** Minimal clsx-style class-name joiner, avoids adding another dependency. */
export function clsx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
