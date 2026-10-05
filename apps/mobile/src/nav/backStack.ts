/**
 * The web's version of the phone's back button: the same most-recent-wins stack `useHardwareBack` fills, kept in plain JS because
 * `BackHandler` does nothing on the web. The Bale mini-app's header back button reads it (shown while the stack is not empty).
 */
type Handler = () => void;

const stack: Handler[] = [];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Registers a handler on top of the stack; returns the function that removes it. */
export function pushBack(handler: Handler): () => void {
  stack.push(handler);
  changed();
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
    changed();
  };
}

/** Runs the top handler; false when there is none (the host app then does its own thing, e.g. closes the mini-app). */
export function runBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

export const canGoBack = (): boolean => stack.length > 0;

export function subscribeBack(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
