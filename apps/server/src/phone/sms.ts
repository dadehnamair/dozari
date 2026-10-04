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

/** Default text; `{code}` is replaced. Override with `IRNOTI_MESSAGE` (e.g. to match a provider-approved wording). */
export const DEFAULT_SMS_MESSAGE = 'کد ورود دوزاری: {code}';

/**
 * irnoti adapter: `POST https://irnoti.com/api/v1/sms/send` with a Bearer key and JSON `{to, message}` (from the provider's developer page).
 * The success/error response body is not documented to us, so a 2xx HTTP status is treated as sent unless the JSON body says otherwise
 * (`success:false`, `ok:false` or `status:'error'`). Check it with a real key before relying on it.
 */
export function createIrnotiClient(apiKey: string, opts: { message?: string; baseUrl?: string; fetchImpl?: typeof fetch } = {}): SmsClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const template = opts.message?.includes('{code}') ? opts.message : DEFAULT_SMS_MESSAGE;
  const url = `${opts.baseUrl ?? 'https://irnoti.com'}/api/v1/sms/send`;
  return {
    async sendCode(phone, code) {
      const to = phone.replace(/^\+98/, '0');
      const res = await doFetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message: template.replace('{code}', code) }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; ok?: boolean; status?: string };
      if (!res.ok || json.success === false || json.ok === false || json.status === 'error') throw new Error(`sms provider refused (${res.status})`);
    },
  };
}
