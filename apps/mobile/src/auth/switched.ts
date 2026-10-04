/** «Another account was loaded on this device»: the app listens and starts over so no screen shows the old account's data. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onAccountSwitched(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export const announceAccountSwitched = (): void => listeners.forEach((l) => l());
