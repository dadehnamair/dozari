import { useEffect, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastItem = { id: number; text: string; kind: ToastKind };

const SHOW_MS = 3200;
let current: ToastItem | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(t: ToastItem | null) => void>();

const emit = () => listeners.forEach((l) => l(current));

/** Pops a small message at the bottom of the screen (replaces the one showing). Callable from anywhere, no hook needed. */
export function showToast(text: string | null | undefined, kind: ToastKind = 'info'): void {
  if (!text) return;
  if (timer) clearTimeout(timer);
  current = { id: ++seq, text, kind };
  emit();
  timer = setTimeout(hideToast, SHOW_MS);
}

export function hideToast(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

export function useToast(): ToastItem | null {
  const [t, setT] = useState(current);
  useEffect(() => {
    listeners.add(setT);
    setT(current);
    return () => void listeners.delete(setT);
  }, []);
  return t;
}

/** Adapter for the `{ text, bad }` notes older screens produce: good news is green, `bad` is red. */
export function noteToast(n: { text: string; bad: boolean } | null): void {
  if (n) showToast(n.text, n.bad ? 'error' : 'success');
}
