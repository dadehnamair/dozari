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
      const json = (await res.json().catch(() => ({}))) as { return?: { status?: number; message?: string } };
      if (!res.ok || json.return?.status !== 200) throw new Error(`sms provider refused (http ${res.status}, status ${json.return?.status ?? '?'}: ${json.return?.message ?? 'no message'})`);
    },
  };
}

/** Default text; `{code}` is replaced. Override with `IRNOTI_MESSAGE` (e.g. to match a provider-approved wording). */
export const DEFAULT_SMS_MESSAGE = 'کد ورود شما به دوزاری : {code}';

/** Default sender line of the owner's irnoti account (override with `IRNOTI_LINE_ID`). */
export const DEFAULT_IRNOTI_LINE_ID = '2';

/**
 * irnoti adapter, in the shape confirmed working by the owner: `POST https://api.irnoti.com/v1/sms/send` with a Bearer key and JSON
 * `{lineId, to: number, text}`. The response body is undocumented to us, so a 2xx HTTP status is treated as sent unless the JSON body
 * says otherwise (`success:false`, `ok:false` or `status:'error'`).
 */
export function createIrnotiClient(apiKey: string, opts: { message?: string; lineId?: string; baseUrl?: string; fetchImpl?: typeof fetch } = {}): SmsClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const template = opts.message?.includes('{code}') ? opts.message : DEFAULT_SMS_MESSAGE;
  const lineId = opts.lineId || DEFAULT_IRNOTI_LINE_ID;
  const url = `${opts.baseUrl ?? 'https://api.irnoti.com'}/v1/sms/send`;
  return {
    async sendCode(phone, code) {
      const to = phone.replace(/^\+98/, '0');
      const res = await doFetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId, to, text: template.replace('{code}', code) }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; ok?: boolean; status?: string };
      if (!res.ok || json.success === false || json.ok === false || json.status === 'error') throw new Error(`sms provider refused (http ${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
    },
  };
}

/**
 * Wraps a client so a failed send leaves a server log line with the provider's reason (credit, key, template, blocked IP...), which the
 * callers otherwise swallow into a bare `send_failed`. The phone number is masked and the code never logged.
 */
export function withSmsLogging(inner: SmsClient, log: (msg: string, err: unknown) => void = (m, e) => console.error(m, e)): SmsClient {
  return {
    async sendCode(phone, code) {
      try {
        await inner.sendCode(phone, code);
      } catch (err) {
        log(`[sms] send failed to ${phone.slice(0, -4).replace(/\d/g, '*')}${phone.slice(-4)}`, err instanceof Error ? err.message : err);
        throw err;
      }
    },
  };
}
