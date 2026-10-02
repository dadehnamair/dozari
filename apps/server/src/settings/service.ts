import { SETTING_DEFS, effectiveSettings, formatSetting, parseSetting, settingDef } from '@dozari/shared';
import type { SettingDef, SettingValue } from '@dozari/shared';

/** Where overrides live (`app_settings`). */
export interface SettingsStore {
  all(): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SettingRow extends SettingDef {
  value: SettingValue;
  overridden: boolean;
}

const CACHE_MS = 5_000;

/** Effective tunables = shared defaults + admin overrides, cached briefly so hot paths can read them cheaply. */
export class SettingsService {
  private cache: { at: number; raw: Record<string, string> } | null = null;

  constructor(
    private readonly store: SettingsStore,
    private readonly now: () => number = Date.now,
  ) {}

  private async raw(): Promise<Record<string, string>> {
    if (this.cache && this.now() - this.cache.at < CACHE_MS) return this.cache.raw;
    const raw = await this.store.all();
    this.cache = { at: this.now(), raw };
    return raw;
  }

  async values(): Promise<Record<string, SettingValue>> {
    return effectiveSettings(await this.raw());
  }

  async num(key: string): Promise<number> {
    const v = (await this.values())[key];
    return typeof v === 'number' ? v : Number((v as number[] | undefined)?.[0] ?? 0);
  }

  async text(key: string): Promise<string> {
    const v = (await this.values())[key];
    return typeof v === 'string' ? v : '';
  }

  async list(key: string): Promise<number[]> {
    const v = (await this.values())[key];
    return Array.isArray(v) ? v : [];
  }

  async rows(): Promise<SettingRow[]> {
    const raw = await this.raw();
    const eff = effectiveSettings(raw);
    return SETTING_DEFS.map((d) => ({ ...d, value: eff[d.key] as SettingValue, overridden: raw[d.key] !== undefined && parseSetting(d, raw[d.key] as string) !== null }));
  }

  /** `invalid_key` for an unknown key, `invalid_value` when it does not parse or is out of range. */
  async set(key: string, text: string): Promise<'ok' | 'invalid_key' | 'invalid_value'> {
    const def = settingDef(key);
    if (!def) return 'invalid_key';
    const parsed = parseSetting(def, text);
    if (parsed === null) return 'invalid_value';
    await this.store.set(key, formatSetting(parsed));
    this.cache = null;
    return 'ok';
  }

  async reset(key: string): Promise<'ok' | 'invalid_key'> {
    if (!settingDef(key)) return 'invalid_key';
    await this.store.remove(key);
    this.cache = null;
    return 'ok';
  }

  /** The subset clients need to know (no bot internals). */
  async publicValues(): Promise<Record<string, SettingValue>> {
    const all = await this.values();
    return Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith('bot.')));
  }
}
