/** Sends the one-time code by SMS. The provider is chosen by the owner (open question); an adapter is one small function. */
export interface SmsClient {
  sendCode(phone: string, code: string): Promise<void>;
}

/**
 * Kavenegar "verify/lookup" adapter. It follows Kavenegar's public REST format from its documentation, but has NOT been run against the
 * live service from this environment: check it with a real key and template before relying on it.
 */
export function createKavenegarClient(apiKey: string, template: string, opts: { fetchImpl?: typeof fetch } = {}): SmsClient {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async sendCode(phone, code) {
      const receptor = phone.replace(/^\+98/, '0');
      const url = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json?receptor=${encodeURIComponent(receptor)}&token=${encodeURIComponent(code)}&template=${encodeURIComponent(template)}`;
      const res = await doFetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
      const json = (await res.json().catch(() => ({}))) as { return?: { status?: number } };
      if (!res.ok || json.return?.status !== 200) throw new Error(`sms provider refused (${res.status})`);
    },
  };
}
