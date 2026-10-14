/** Shartli klasslarni birlashtiradi (qo'shimcha bog'liqliksiz). */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(' ');
}
