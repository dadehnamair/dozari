/** Provider error codes (Melipayamak REST list) -> a stable reason key. The player-facing Persian text lives in `fa.ts` under `smsErrors`. */
const PROVIDER_CODES: Record<number, string> = {
  [-110]: 'api_key_required',
  [-109]: 'ip_not_allowed',
  [-108]: 'ip_blocked',
  0: 'bad_credentials',
  2: 'no_credit',
  3: 'daily_limit',
  4: 'volume_limit',
  5: 'bad_sender',
  6: 'updating',
  7: 'filtered_word',
  9: 'public_line',
  10: 'user_inactive',
  11: 'not_sent',
  12: 'incomplete_docs',
  14: 'has_link',
  15: 'multi_receiver',
  16: 'no_receiver',
  17: 'empty_text',
  18: 'invalid_receiver',
  35: 'blacklisted',
};

/** A refused SMS send. `code` is the API error code (`sms_<reason>`); `providerCode` is kept for server logs only. */
export class SmsSendError extends Error {
  readonly code: string;
  constructor(
    readonly providerCode: number,
    message?: string,
  ) {
    const reason = PROVIDER_CODES[providerCode];
    super(message ?? `sms provider refused (code ${providerCode})`);
    this.code = reason ? `sms_${reason}` : 'send_failed';
  }
}

/** Looks for a known provider error code in a response body (`status`/`code`/`Value`/`result`, number or numeric string). */
export function smsErrorFromBody(body: unknown): SmsSendError | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  for (const key of ['status', 'code', 'Value', 'value', 'result', 'error']) {
    const raw = b[key];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^-?\d+$/.test(raw.trim()) ? Number(raw) : NaN;
    // Positive values other than the listed codes are a send id (recId) = success.
    if (Number.isInteger(n) && n in PROVIDER_CODES) return new SmsSendError(n);
  }
  return null;
}

/** The API error code to return for any error thrown by an SMS client. */
export function smsErrorCode(e: unknown): string {
  return e instanceof SmsSendError ? e.code : 'send_failed';
}
