import { CHAT_HISTORY_LIMIT, CHAT_TAUNT_RATE, CHAT_TEXT_RATE, containsContactInfo } from '@dozari/shared';
import type { ChatError, ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';
import { RateLimiter } from '../security/rate-limit.js';
import type { SettingsService } from '../settings/service.js';
import type { TextFilterService } from '../textfilter/service.js';
import type { ChatStore, MessageRow } from './store.js';

export interface ChatRules {
  maxLen: number;
  textNeedsActivation: boolean;
  enabled: boolean;
}

export async function chatRulesFromSettings(settings: SettingsService): Promise<ChatRules> {
  const [maxLen, needs, on] = await Promise.all([settings.num('chat.max_len'), settings.num('chat.text_needs_activation'), settings.num('feature.chat')]);
  return { maxLen: maxLen!, textNeedsActivation: needs === 1, enabled: on === 1 };
}

export interface ChatDeps {
  cityOf(userId: string): Promise<{ id: string; nameFa: string } | null>;
  profileOf(userId: string): Promise<{ nickname: string; avatarKey: string } | null>;
  badgeTitleOf(userId: string): Promise<string | null>;
  isActivated(userId: string): Promise<boolean>;
  mute(userId: string): Promise<{ until: number; reason: string } | null>;
  hasContactPerk(userId: string): Promise<boolean>;
  rules(): Promise<ChatRules>;
  filter?: TextFilterService;
  now?: () => number;
}

export type SendInput = { kind: 'text'; text: string } | { kind: 'taunt'; tauntId: string };
export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: ChatError; mutedUntil?: number };

/** Chat: the city room and canned taunts in a duel. Every rule of `docs/logic/chat-and-access.md` is checked here, on the server. */
export class ChatService {
  /** Called with a room name and a message to push live (set by the gateway). */
  broadcast?: (room: string, message: ChatMessage) => void;
  /** Called after every city message (e.g. so a bot from that city may answer). */
  onCityMessage?: (cityId: string, message: ChatMessage) => void;
  /** Called to push a message to one player (the opponent in a duel). */
  toUser?: (userId: string, message: ChatMessage) => void;
  private readonly text = new RateLimiter(CHAT_TEXT_RATE.count, CHAT_TEXT_RATE.windowMs);
  private readonly taunt = new RateLimiter(CHAT_TAUNT_RATE.count, CHAT_TAUNT_RATE.windowMs);

  constructor(
    private readonly store: ChatStore,
    private readonly deps: ChatDeps,
  ) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  static cityRoom(cityId: string): string {
    return `city:${cityId}`;
  }

  private async view(row: MessageRow, cache: Map<string, { nickname: string; avatarKey: string; badge: string | null }>): Promise<ChatMessage> {
    let who = cache.get(row.userId);
    if (!who) {
      const p = await this.deps.profileOf(row.userId);
      who = { nickname: p?.nickname ?? '؟', avatarKey: p?.avatarKey ?? 'avatar-01', badge: await this.deps.badgeTitleOf(row.userId) };
      cache.set(row.userId, who);
    }
    return { id: row.id, room: row.room, kind: row.kind, text: row.text, userId: row.userId, nickname: who.nickname, avatarKey: who.avatarKey, badge: who.badge, createdAt: row.createdAt };
  }

  async taunts(): Promise<TauntCategory[]> {
    return (await this.store.taunts()).filter((c) => c.taunts.length > 0).map((c) => ({ id: c.id, nameFa: c.nameFa, taunts: c.taunts.map((t) => ({ id: t.id, text: t.text })) }));
  }

  async history(userId: string): Promise<ChatHistory | 'NO_CITY' | 'OFF'> {
    if (!(await this.deps.rules()).enabled) return 'OFF';
    const city = await this.deps.cityOf(userId);
    if (!city) return 'NO_CITY';
    const [rows, mute, activated, rules] = await Promise.all([this.store.history('city', city.id, CHAT_HISTORY_LIMIT), this.deps.mute(userId), this.deps.isActivated(userId), this.deps.rules()]);
    const cache = new Map();
    const messages: ChatMessage[] = [];
    for (const r of rows) messages.push(await this.view(r, cache));
    return { cityName: city.nameFa, messages, canType: !mute && (activated || !rules.textNeedsActivation), muted: mute };
  }

  /** The Socket.io room a player may join for the city chat, or null (no city / chat off). */
  async roomFor(userId: string): Promise<string | null> {
    if (!(await this.deps.rules()).enabled) return null;
    const city = await this.deps.cityOf(userId);
    return city ? ChatService.cityRoom(city.id) : null;
  }

  /** Common checks: not muted, rate limit. */
  private async gate(userId: string, kind: 'text' | 'taunt'): Promise<{ ok: false; error: ChatError; mutedUntil?: number } | null> {
    if (!(await this.deps.rules()).enabled) return { ok: false, error: 'OFF' };
    const mute = await this.deps.mute(userId);
    if (mute) return { ok: false, error: 'MUTED', mutedUntil: mute.until };
    if (!(kind === 'text' ? this.text : this.taunt).take(userId)) return { ok: false, error: 'RATE_LIMITED' };
    return null;
  }

  async sendCity(userId: string, input: SendInput): Promise<SendResult> {
    const city = await this.deps.cityOf(userId);
    if (!city) return { ok: false, error: 'NO_CITY' };
    const text = await this.resolveText(userId, input);
    if (!text.ok) return text;
    const row = await this.store.addMessage({ room: 'city', roomKey: city.id, userId, kind: input.kind, text: text.text });
    const message = await this.view(row, new Map());
    this.broadcast?.(ChatService.cityRoom(city.id), message);
    try {
      this.onCityMessage?.(city.id, message);
    } catch {
      /* a hook never breaks sending */
    }
    return { ok: true, message };
  }

  /** A canned taunt to the opponent in a duel (strangers get taunts only, never free text). */
  async sendMatchTaunt(userId: string, matchId: string, opponentId: string, tauntId: string): Promise<SendResult> {
    const text = await this.resolveText(userId, { kind: 'taunt', tauntId });
    if (!text.ok) return text;
    const row = await this.store.addMessage({ room: 'match', roomKey: matchId, userId, kind: 'taunt', text: text.text });
    const message = await this.view(row, new Map());
    this.toUser?.(opponentId, message);
    this.toUser?.(userId, message);
    return { ok: true, message };
  }

  private async resolveText(userId: string, input: SendInput): Promise<{ ok: true; text: string } | { ok: false; error: ChatError; mutedUntil?: number }> {
    const blocked = await this.gate(userId, input.kind);
    if (blocked) return blocked;
    if (input.kind === 'taunt') {
      const t = await this.store.taunt(input.tauntId);
      return t && t.isActive ? { ok: true, text: t.text } : { ok: false, error: 'UNKNOWN_TAUNT' };
    }
    const rules = await this.deps.rules();
    const raw = input.text.replace(/\s+/g, ' ').trim();
    if (raw === '') return { ok: false, error: 'EMPTY' };
    if ([...raw].length > rules.maxLen) return { ok: false, error: 'TOO_LONG' };
    if (rules.textNeedsActivation && !(await this.deps.isActivated(userId))) return { ok: false, error: 'NEEDS_ACTIVATION' };
    if (containsContactInfo(raw) && !(await this.deps.hasContactPerk(userId))) return { ok: false, error: 'CONTACT_BLOCKED' };
    if (this.deps.filter) {
      const verdict = await this.deps.filter.check(raw);
      if (!verdict.ok) return { ok: false, error: 'FILTERED' };
      return { ok: true, text: verdict.text };
    }
    return { ok: true, text: raw };
  }

  async report(reporterId: string, messageId: string, reason: string): Promise<'ok' | 'duplicate' | 'not_found' | 'own'> {
    const m = await this.store.message(messageId);
    if (m && m.userId === reporterId) return 'own';
    return this.store.report(messageId, reporterId, reason.trim().slice(0, 200));
  }

  /** Retention: drop messages older than `days` (run daily). */
  purge(days: number): Promise<number> {
    return this.store.purgeBefore(this.now() - days * 86_400_000);
  }
}
