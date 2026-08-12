/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately not a dependency. `clsx` is 200 bytes and excellent, but this is
 * the whole of what the package needs, and a shared UI library is the worst
 * place to add a transitive dependency for six lines of code.
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
