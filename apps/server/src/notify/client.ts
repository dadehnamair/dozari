/** Minimal Bale Bot API client. Bale's bot API mirrors Telegram's: `POST {base}/bot{token}/{method}` with a JSON body. */
export interface BaleUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number | string }; from?: { id: number | string }; text?: string };
}

export interface BaleClient {
  sendMessage(chatId: string, text: string): Promise<void>;
  /** Long poll; returns [] when nothing arrived within `timeoutSec`. */
  getUpdates(offset: number, timeoutSec: number): Promise<BaleUpdate[]>;
}

export const DEFAULT_BALE_BASE = 'https://tapi.bale.ai';

export class BaleApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
  ) {
    super(`bale ${method} ${status} ${description}`);
  }
}

export function createBaleClient(token: string, opts: { base?: string; fetchImpl?: typeof fetch } = {}): BaleClient {
  const base = (opts.base ?? DEFAULT_BALE_BASE).replace(/\/+$/, '');
  const doFetch = opts.fetchImpl ?? fetch;
  async function call<T>(method: string, body: unknown, timeoutMs: number): Promise<T> {
    const res = await doFetch(`${base}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!res.ok || json.ok === false) throw new BaleApiError(method, res.status, json.description ?? 'error');
    return json.result as T;
  }
  return {
    async sendMessage(chatId, text) {
      await call('sendMessage', { chat_id: chatId, text }, 15_000);
    },
    async getUpdates(offset, timeoutSec) {
      return (await call<BaleUpdate[]>('getUpdates', { offset, timeout: timeoutSec }, (timeoutSec + 10) * 1000)) ?? [];
    },
  };
}
