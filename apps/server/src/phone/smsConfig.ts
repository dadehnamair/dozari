import type { SettingsStore } from '../settings/service.js';
import { DEFAULT_IRNOTI_PATTERN_CODE, DEFAULT_SMS_MESSAGE, SMS_PURPOSES, createFallbackSmsClient, createIrnotiClient, createIrnotiPatternClient, createKavenegarClient } from './sms.js';
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
  patternOn: (p: SmsPurpose) => `sms.pattern.${p}.enabled`,
  patternCode: (p: SmsPurpose) => `sms.pattern.${p}.code`,
  patternParams: (p: SmsPurpose) => `sms.pattern.${p}.params`,
} as const;

export const SMS_PATTERN_MAX_PARAMS = 10;
const PATTERN_CODE_RE = /^[\w-]{1,64}$/;
const PATTERN_PARAM_NAME_RE = /^[A-Za-z_]\w{0,31}$/;

/**
 * How one message type is sent through irnoti. `enabled` = this type goes out as a pattern (template) message first and the plain text is the
 * backup; off = plain text first and the pattern is the backup (the old behaviour). `params` maps each pattern variable to its value;
 * `{code}` inside a value is replaced by the OTP (e.g. `{name: 'code', value: '{code}'}`).
 */
export interface SmsPatternConfig {
  enabled: boolean;
  code: string;
  params: { name: string; value: string }[];
}

export function validSmsPattern(p: SmsPatternConfig): boolean {
  const names = p.params.map((x) => x.name);
  return (
    PATTERN_CODE_RE.test(p.code) &&
    p.params.length >= 1 &&
    p.params.length <= SMS_PATTERN_MAX_PARAMS &&
    new Set(names).size === names.length &&
    p.params.every((x) => PATTERN_PARAM_NAME_RE.test(x.name) && x.value.length > 0 && x.value.length <= 100 && !x.value.includes('\n'))
  );
}

// `params` is stored as one `name=value` line per variable (app_settings values are plain strings).
function encodeParams(params: SmsPatternConfig['params']): string {
  return params.map((x) => `${x.name}=${x.value}`).join('\n');
}

function decodeParams(raw: string | undefined): SmsPatternConfig['params'] {
  return (raw ?? '')
    .split('\n')
    .map((line) => {
      const i = line.indexOf('=');
      return i > 0 ? { name: line.slice(0, i), value: line.slice(i + 1) } : null;
    })
    .filter((x): x is { name: string; value: string } => x !== null);
}

// These keys are deliberately not in SETTING_DEFS: `app_settings` values listed there are shown to every client (`/config`) and in the
// settings tab, and an API key must be in neither.

export interface SmsEnv {
  irnotiKey?: string;
  irnotiMessage?: string;
  irnotiLineId?: string;
  /** irnoti pattern used as the backup when the plain send fails (default `gdhsgcnt`). */
  irnotiPatternCode?: string;
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
  /** Per message type: pattern on/off, the pattern code and its variables (irnoti only). */
  patterns: ({ purpose: SmsPurpose; label: string; custom: boolean } & SmsPatternConfig)[];
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
  /** True when the active provider takes free text (irnoti), i.e. broadcasts can be sent. */
  textReady = false;

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

  private patternFrom(raw: Record<string, string>, purpose: SmsPurpose): SmsPatternConfig & { custom: boolean } {
    const params = decodeParams(raw[K.patternParams(purpose)]);
    const code = raw[K.patternCode(purpose)];
    const own = !!code && params.length > 0 && validSmsPattern({ enabled: false, code, params });
    return {
      enabled: raw[K.patternOn(purpose)] === '1' && own,
      code: own ? code! : this.env.irnotiPatternCode || DEFAULT_IRNOTI_PATTERN_CODE,
      params: own ? params : [{ name: 'code', value: '{code}' }],
      custom: own,
    };
  }

  async refresh(): Promise<void> {
    const r = this.resolveFrom(await this.store.all());
    this.configured = r !== null;
    this.textReady = r?.kind === 'irnoti';
  }

  /** Sends a free-text SMS (message center broadcast). Needs irnoti. */
  async sendText(phone: string, text: string): Promise<void> {
    const r = this.resolveFrom(await this.store.all());
    if (r?.kind !== 'irnoti') throw new Error('free-text sms needs irnoti');
    await createIrnotiClient(r.key, { lineId: this.env.irnotiLineId, fetchImpl: this.fetchImpl }).sendText!(phone, text);
  }

  async sendCode(phone: string, code: string, purpose: SmsPurpose = 'verify'): Promise<void> {
    const raw = await this.store.all();
    const r = this.resolveFrom(raw);
    if (!r) throw new Error('sms provider not configured');
    let client: SmsClient;
    if (r.kind === 'irnoti') {
      const plain = createIrnotiClient(r.key, { message: this.textFrom(raw, purpose).text, lineId: this.env.irnotiLineId, fetchImpl: this.fetchImpl });
      const pat = this.patternFrom(raw, purpose);
      const pattern = createIrnotiPatternClient(r.key, { patternCode: pat.code, params: Object.fromEntries(pat.params.map((x) => [x.name, x.value])), fetchImpl: this.fetchImpl });
      // A pattern-type message goes out as a pattern first (the error of the pattern is surfaced if both fail); otherwise plain first.
      client = pat.enabled
        ? createFallbackSmsClient(pattern, plain, (err) => console.warn(`[sms] irnoti pattern send (${purpose}) failed, retrying as plain text:`, err instanceof Error ? err.message : err))
        : createFallbackSmsClient(plain, pattern, (err) => console.warn('[sms] irnoti plain send failed, retrying via pattern:', err instanceof Error ? err.message : err));
    } else {
      client = createKavenegarClient(r.key, r.template, { fetchImpl: this.fetchImpl });
    }
    await client.sendCode(phone, code, purpose);
  }

  /** `false` when the code or a variable name is malformed. `enabled:false` keeps the stored code/variables but turns the pattern off. */
  async setPattern(purpose: SmsPurpose, cfg: SmsPatternConfig): Promise<boolean> {
    if (!validSmsPattern(cfg)) return false;
    await this.store.set(K.patternCode(purpose), cfg.code);
    await this.store.set(K.patternParams(purpose), encodeParams(cfg.params));
    if (cfg.enabled) await this.store.set(K.patternOn(purpose), '1');
    else await this.store.remove(K.patternOn(purpose));
    return true;
  }

  /** Forgets the stored pattern of a message type (back to plain text first, default backup pattern). */
  async clearPattern(purpose: SmsPurpose): Promise<void> {
    for (const key of [K.patternOn(purpose), K.patternCode(purpose), K.patternParams(purpose)]) await this.store.remove(key);
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
      patterns: SMS_PURPOSES.map((purpose) => ({ purpose, label: SMS_PURPOSE_LABEL_FA[purpose], ...this.patternFrom(raw, purpose) })),
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
