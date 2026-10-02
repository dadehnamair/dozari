import { fa } from '../i18n/fa';

/** Persian text for a chat error code from the server. */
export function chatErrorText(code: string): string {
  return fa.chat.errors[code] ?? fa.chat.errors.generic ?? '';
}

/** Merges new messages into the list by id, oldest first, keeping at most `limit`. */
export function mergeMessages<T extends { id: string; createdAt: number }>(current: readonly T[], incoming: readonly T[], limit = 100): T[] {
  const byId = new Map<string, T>();
  for (const m of [...current, ...incoming]) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-limit);
}
