export function isPersistableSource(source: { messageRefs: readonly unknown[] }): boolean {
  return source.messageRefs.length > 0;
}
