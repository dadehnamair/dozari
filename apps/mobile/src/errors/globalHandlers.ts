import { crumb } from './breadcrumbs';
import { sendErrorReport } from './report';

const SEEN = new Set<string>();
const MAX_PER_SESSION = 4;

/** Errors thrown outside a render (a promise nobody awaited, a timer) do not blank the screen, but they are the other half of «something went wrong»: send them too, a few per session. */
function report(message: string, detail: string): void {
  crumb('app', `uncaught: ${message}`);
  if (SEEN.size >= MAX_PER_SESSION || SEEN.has(message)) return;
  SEEN.add(message);
  void sendErrorReport({ kind: 'screen', message, detail });
}

export function installGlobalErrorReporting(): void {
  const g = globalThis as {
    addEventListener?: (type: string, fn: (e: unknown) => void) => void;
    ErrorUtils?: { getGlobalHandler?: () => (e: Error, fatal?: boolean) => void; setGlobalHandler?: (fn: (e: Error, fatal?: boolean) => void) => void };
  };
  if (g.ErrorUtils?.setGlobalHandler) {
    const previous = g.ErrorUtils.getGlobalHandler?.();
    g.ErrorUtils.setGlobalHandler((e, fatal) => {
      report(`${e?.name ?? 'Error'}: ${e?.message ?? ''}`, e?.stack ?? '');
      previous?.(e, fatal);
    });
    return;
  }
  g.addEventListener?.('error', (e) => {
    const ev = e as { message?: string; error?: { stack?: string } };
    report(ev.message ?? 'error', ev.error?.stack ?? '');
  });
  g.addEventListener?.('unhandledrejection', (e) => {
    const r = (e as { reason?: unknown }).reason;
    report(r instanceof Error ? `${r.name}: ${r.message}` : String(r ?? 'unhandled rejection'), r instanceof Error ? (r.stack ?? '') : '');
  });
}
