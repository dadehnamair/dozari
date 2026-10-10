import type { SettingsStore } from '../settings/service.js';
import { DEFAULT_SMS_MESSAGE, SMS_PURPOSES, createIrnotiClient, createKavenegarClient } from './sms.js';
import type { SmsClient, SmsPurpose } from './sms.js';

export const SMS_PROVIDERS = ['auto', 'irnoti', 'kavenegar', 'off'] as const;
export type SmsProviderChoice = (typeof SMS_PROVIDERS)[number];

export const SMS_TEXT_MAX = 300;

export const SMS_PURPOSE_LABEL_FA: Record<SmsPurpose, string> = {
  login: 'کد ورود با شماره',
  verify: 'کد تأیید شماره‌ی پروفایل',
  delete: 'کد حذف حساب',
};

export const SMS_DEFAULT_TEXT: Record<SmsPurpose, string> = {
  login: DEFAULT_SMS_MESSAGE,
  verify: 'کد تأیید شماره‌ی دوزاری: {code}',
  delete: 'کد حذف حساب دوزاری: {code}\nاگر خودت درخواست نکرده‌ای، این پیام را نادیده بگیر.',
};

const K = {
  provider: 'sms.provider',
  irnotiKey: 'sms.irnoti_key',
  kavenegarKey: 'sms.kavenegar_key',
  kavenegarTemplate: 'sms.kavenegar_template',
  text: (p: SmsPurpose) => `sms.text.${p}`,
} as const;

// These keys are deliberately not in SETTING_DEFS: `app_settings` values listed there are shown to every client (`/config`) and in the
// settings tab, and an API key must be in neither.

export interface SmsEnv {
  irnotiKey?: string;
  irnotiMessage?: string;
  irnotiLineId?: string;
  kavenegarKey?: string;
  kavenegarTemplate?: string;
}

export type SmsResolved = { kind: 'irnoti'; key: string } | { kind: 'kavenegar'; key: string; template: string } | null;

export function validSmsText(text: string): boolean {
  return text.includes('{code}') && text.length <= SMS_TEXT_MAX;
}

export function renderSmsText(text: string, code: string): string {
  return text.split('{code}').join(code);
}

function mask(key: string | undefined): string | null {
  return key ? `••••${key.slice(-4)}` : null;
}

export interface SmsAdminState {
  provider: SmsProviderChoice;
  /** What is really used now (after `auto` and the env fallback), or null when nothing can send. */
  active: 'irnoti' | 'kavenegar' | null;
  irnoti: { keyMask: string | null; fromEnv: boolean };
  kavenegar: { keyMask: string | null; fromEnv: boolean; template: string };
  texts: { purpose: SmsPurpose; label: string; text: string; default: string; custom: boolean }[];
}

export interface SmsConfigPatch {
  provider?: SmsProviderChoice;
  /** undefined = keep, '' = remove the stored key (the env key, if any, applies again). */
  irnotiKey?: string;
  kavenegarKey?: string;
  kavenegarTemplate?: string;
}

/**
 * The SMS provider and message texts, editable from the admin panel (stored in `app_settings`, env vars are the fallback).
 * It is itself an `SmsClient`: services hold one gateway and every send reads the current config, so a change applies at once.
 * `configured` is a synchronous snapshot taken by `refresh()` (at boot and after every save) because callers check it in sync getters.
 */
export class SmsGateway implements SmsClient {
  configured = false;

  constructor(
    private readonly store: SettingsStore,
    private readonly env: SmsEnv = {},
    private readonly fetchImpl?: typeof fetch,
  ) {}

  private resolveFrom(raw: Record<string, string>): SmsResolved {
    const choice = (SMS_PROVIDERS as readonly string[]).includes(raw[K.provider] ?? '') ? (raw[K.provider] as SmsProviderChoice) : 'auto';
    if (choice === 'off') return null;
    const irnotiKey = raw[K.irnotiKey] || this.env.irnotiKey;
    const kKey = raw[K.kavenegarKey] || this.env.kavenegarKey;
    const kTemplate = raw[K.kavenegarTemplate] || this.env.kavenegarTemplate;
    const irnoti = (): SmsResolved => (irnotiKey ? { kind: 'irnoti', key: irnotiKey } : null);
    const kavenegar = (): SmsResolved => (kKey && kTemplate ? { kind: 'kavenegar', key: kKey, template: kTemplate } : null);
    if (choice === 'irnoti') return irnoti();
    if (choice === 'kavenegar') return kavenegar();
    return irnoti() ?? kavenegar(); // auto = the old env behaviour: irnoti wins
  }

  private textFrom(raw: Record<string, string>, purpose: SmsPurpose): { text: string; custom: boolean; default: string } {
    const dflt = purpose !== 'delete' && this.env.irnotiMessage && validSmsText(this.env.irnotiMessage) ? this.env.irnotiMessage : SMS_DEFAULT_TEXT[purpose];
    const own = raw[K.text(purpose)];
    return own && validSmsText(own) ? { text: own, custom: true, default: dflt } : { text: dflt, custom: false, default: dflt };
  }

  async refresh(): Promise<void> {
    this.configured = this.resolveFrom(await this.store.all()) !== null;
  }

  async sendCode(phone: string, code: string, purpose: SmsPurpose = 'verify'): Promise<void> {
    const raw = await this.store.all();
    const r = this.resolveFrom(raw);
    if (!r) throw new Error('sms provider not configured');
    const client =
      r.kind === 'irnoti'
        ? createIrnotiClient(r.key, { message: this.textFrom(raw, purpose).text, lineId: this.env.irnotiLineId, fetchImpl: this.fetchImpl })
        : createKavenegarClient(r.key, r.template, { fetchImpl: this.fetchImpl });
    await client.sendCode(phone, code, purpose);
  }

  /** The text a player would get (what the panel previews). Kavenegar sends the text approved in its own panel, so this is only a draft there. */
  async textFor(purpose: SmsPurpose): Promise<string> {
    return this.textFrom(await this.store.all(), purpose).text;
  }

  async adminState(): Promise<SmsAdminState> {
    const raw = await this.store.all();
    const provider = (SMS_PROVIDERS as readonly string[]).includes(raw[K.provider] ?? '') ? (raw[K.provider] as SmsProviderChoice) : 'auto';
    const r = this.resolveFrom(raw);
    return {
      provider,
      active: r?.kind ?? null,
      irnoti: { keyMask: mask(raw[K.irnotiKey] || this.env.irnotiKey), fromEnv: !raw[K.irnotiKey] && !!this.env.irnotiKey },
      kavenegar: { keyMask: mask(raw[K.kavenegarKey] || this.env.kavenegarKey), fromEnv: !raw[K.kavenegarKey] && !!this.env.kavenegarKey, template: raw[K.kavenegarTemplate] || this.env.kavenegarTemplate || '' },
      texts: SMS_PURPOSES.map((purpose) => ({ purpose, label: SMS_PURPOSE_LABEL_FA[purpose], ...this.textFrom(raw, purpose) })),
    };
  }

  async update(patch: SmsConfigPatch): Promise<void> {
    const put = async (key: string, v: string | undefined) => {
      if (v === undefined) return;
      if (v === '') await this.store.remove(key);
      else await this.store.set(key, v);
    };
    await put(K.provider, patch.provider === 'auto' ? '' : patch.provider);
    await put(K.irnotiKey, patch.irnotiKey);
    await put(K.kavenegarKey, patch.kavenegarKey);
    await put(K.kavenegarTemplate, patch.kavenegarTemplate);
    await this.refresh();
  }

  /** `false` when the text lacks `{code}` or is too long. Empty text = back to the default. */
  async setText(purpose: SmsPurpose, text: string): Promise<boolean> {
    if (text === '') await this.store.remove(K.text(purpose));
    else if (!validSmsText(text)) return false;
    else await this.store.set(K.text(purpose), text);
    return true;
  }
}
