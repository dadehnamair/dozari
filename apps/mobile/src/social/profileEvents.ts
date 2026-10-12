/** «My profile changed» (character, gender, name, city…): any screen that edits it calls `emitProfileChanged`, Home listens and reloads its hero and header. */
const listeners = new Set<() => void>();

export function onProfileChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitProfileChanged(): void {
  for (const l of [...listeners]) l();
}
