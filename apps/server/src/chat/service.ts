import { CHAT_HISTORY_LIMIT, CHAT_TAUNT_RATE, CHAT_TEXT_RATE, containsContactInfo, normalizeTableCode, trackRules } from '@dozari/shared';
import type { AgeTrack, ChatError, ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';

/** Rooms a player reads and writes from the chat sheet (the duel room is socket-only). */
export type PublicRoom = 'city' | 'global';
import { RateLimiter } from '../security/rate-limit.js';
import type { SettingsService } from '../settings/service.js';
import type { TextFilterService } from '../textfilter/service.js';
import type { ChatStore, MessageRow } from './store.js';

export interface ChatRules {
  maxLen: number;
  textNeedsActivation: boolean;
  enabled: boolean;
  /** The global room (D103) can be switched off on its own. */
  globalEnabled: boolean;
}

export async function chatRulesFromSettings(settings: SettingsService): Promise<ChatRules> {
  const [maxLen, needs, on, global] = await Promise.all([settings.num('chat.max_len'), settings.num('chat.text_needs_activation'), settings.num('feature.chat'), settings.num('chat.global_enabled')]);
  return { maxLen: maxLen!, textNeedsActivation: needs === 1, enabled: on === 1, globalEnabled: global === 1 };
}

export interface ChatDeps {
  cityOf(userId: string): Promise<{ id: string; nameFa: string; province?: string | null } | null>;
  profileOf(userId: string): Promise<{ nickname: string; avatarKey: string } | null>;
  badgeTitleOf(userId: string): Promise<string | null>;
  isActivated(userId: string): Promise<boolean>;
  mute(userId: string): Promise<{ until: number; reason: string } | null>;
  hasContactPerk(userId: string): Promise<boolean>;
  /** Private chat is for accepted friends only. */
  areFriends(a: string, b: string): Promise<boolean>;
  /** Players seated at a private table, or null when the table is gone or `userId` does not sit there. */
  tableMembers(userId: string, code: string): string[] | null;
  rules(): Promise<ChatRules>;
  filter?: TextFilterService;
  now?: () => number;
}

/** Age-track hook (docs/logic/age-tracks.md §Friends, duels and chat); set at start-up. Absent = everybody is adult. */
export interface ManagedChat {
  trackOf(userId: string): Promise<AgeTrack>;
  /** A kid/teen's free text is allowed once a guardian is linked (the link is the redemption of rule 7 for them). */
  hasGuardian(userId: string): Promise<boolean>;
}

/** Where a text goes: a friend's private chat, or somewhere with several or unknown readers. */
type Where = 'dm' | 'table' | 'public';

export type SendInput = { kind: 'text'; text: string } | { kind: 'taunt'; tauntId: string } | { kind: 'table'; code: string; label: string };
export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: ChatError; mutedUntil?: number };

/** Chat: the city room, the global room (D103) and canned taunts in a duel. Every rule of `docs/logic/chat-and-access.md` is checked here, on the server. */
export class ChatService {
  /** Called with a room name and a message to push live (set by the gateway). */
  broadcast?: (room: string, message: ChatMessage) => void;
  /** Called after every city message (e.g. so a bot from that city may answer). */
  onCityMessage?: (cityId: string, message: ChatMessage) => void;
  /** Called to push a message to one player (the opponent in a duel). */
  toUser?: (userId: string, message: ChatMessage) => void;
  /** Kid and teen tracks get managed chat: no public rooms, free text only to a same-track friend and only with a linked guardian. */
  managed?: ManagedChat;
  private readonly text = new RateLimiter(CHAT_TEXT_RATE.count, CHAT_TEXT_RATE.windowMs);
  private readonly taunt = new RateLimiter(CHAT_TAUNT_RATE.count, CHAT_TAUNT_RATE.windowMs);

  constructor(
    private readonly store: ChatStore,
    private readonly deps: ChatDeps,
  ) {}

  private async rulesOf(userId: string) {
    try {
      return trackRules((await this.managed?.trackOf(userId)) ?? 'adult');
    } catch {
      return trackRules('adult'); // a failing lookup never locks an adult out
    }
  }

  /** Managed tracks use no public rooms (city, global). */
  private async publicRoomsOpen(userId: string): Promise<boolean> {
    return (await this.rulesOf(userId)).freeTextChat === 'invite_code';
  }

  /** Both players on one track (private chat never crosses tracks, even for old friendships). */
  private async sameTrack(a: string, b: string): Promise<boolean> {
    if (!this.managed) return true;
    try {
      return (await this.managed.trackOf(a)) === (await this.managed.trackOf(b));
    } catch {
      return false;
    }
  }

  /** Whether the composer shows for this player in this place (the server still checks every send). */
  private async canType(userId: string, where: Where, muted: boolean, activated: boolean, rules: ChatRules): Promise<boolean> {
    if (muted) return false;
    if ((await this.rulesOf(userId)).freeTextChat === 'guardian_switch') return where === 'dm' && (await this.managed!.hasGuardian(userId));
    return activated || !rules.textNeedsActivation;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  static cityRoom(cityId: string): string {
    return `city:${cityId}`;
  }

  /** `roomKey` of a private chat: both ids, sorted, so each friend finds the same conversation. */
  static dmKey(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  /** Socket.io room of the global chat; its `roomKey` in the table is `all`. */
  static readonly GLOBAL_ROOM = 'chat:global';
  static readonly GLOBAL_KEY = 'all';

  private async view(row: MessageRow, cache: Map<string, { nickname: string; avatarKey: string; badge: string | null; province: string | null }>): Promise<ChatMessage> {
    let who = cache.get(row.userId);
    if (!who) {
      const [p, badge, city] = await Promise.all([this.deps.profileOf(row.userId), this.deps.badgeTitleOf(row.userId), this.deps.cityOf(row.userId)]);
      who = { nickname: p?.nickname ?? '؟', avatarKey: p?.avatarKey ?? 'avatar-01', badge, province: city?.province ?? null };
      cache.set(row.userId, who);
    }
    return { id: row.id, room: row.room, kind: row.kind, text: row.text, userId: row.userId, nickname: who.nickname, avatarKey: who.avatarKey, badge: who.badge, province: who.province, createdAt: row.createdAt };
  }

  /** The taunt list for a player: general categories plus the dialect ones of their own city. */
  async taunts(userId?: string): Promise<TauntCategory[]> {
    const cityId = userId ? ((await this.deps.cityOf(userId))?.id ?? null) : null;
    return (await this.store.taunts()).filter((c) => c.taunts.length > 0 && (!c.cityId || c.cityId === cityId)).map((c) => ({ id: c.id, nameFa: c.nameFa, taunts: c.taunts.map((t) => ({ id: t.id, text: t.text })) }));
  }

  /** History of the city room (needs a city) or the global room (open to everyone while `chat.global_enabled`). */
  async history(userId: string, room: PublicRoom = 'city'): Promise<ChatHistory | 'NO_CITY' | 'OFF'> {
    const rules = await this.deps.rules();
    if (!rules.enabled || (room === 'global' && !rules.globalEnabled)) return 'OFF';
    const city = await this.deps.cityOf(userId);
    if (!(await this.publicRoomsOpen(userId))) return 'OFF';
    if (room === 'city' && !city) return 'NO_CITY';
    const key = room === 'global' ? ChatService.GLOBAL_KEY : city!.id;
    const [rows, mute, activated] = await Promise.all([this.store.history(room, key, CHAT_HISTORY_LIMIT), this.deps.mute(userId), this.deps.isActivated(userId)]);
    const cache = new Map();
    const messages: ChatMessage[] = [];
    for (const r of rows) messages.push(await this.view(r, cache));
    return { cityName: city?.nameFa ?? null, globalOn: rules.globalEnabled, messages, canType: await this.canType(userId, 'public', !!mute, activated, rules), muted: mute };
  }

  /** History of the private chat with a friend. */
  async dmHistory(userId: string, friendId: string): Promise<ChatHistory | 'NOT_FRIENDS' | 'OFF'> {
    const rules = await this.deps.rules();
    if (!rules.enabled) return 'OFF';
    if (!(await this.deps.areFriends(userId, friendId)) || !(await this.sameTrack(userId, friendId))) return 'NOT_FRIENDS';
    const [rows, mute, activated] = await Promise.all([this.store.history('dm', ChatService.dmKey(userId, friendId), CHAT_HISTORY_LIMIT), this.deps.mute(userId), this.deps.isActivated(userId)]);
    const cache = new Map();
    const messages: ChatMessage[] = [];
    for (const r of rows) messages.push(await this.view(r, cache));
    return { cityName: null, globalOn: rules.globalEnabled, messages, canType: await this.canType(userId, 'dm', !!mute, activated, rules), muted: mute };
  }

  /** A message to a friend (same rules as the rooms, plus: only friends). It reaches both players live. */
  async sendDm(userId: string, friendId: string, input: SendInput): Promise<SendResult> {
    if (!(await this.deps.areFriends(userId, friendId)) || !(await this.sameTrack(userId, friendId))) return { ok: false, error: 'NOT_FRIENDS' };
    const text = await this.resolveText(userId, input, 'dm');
    if (!text.ok) return text;
    const row = await this.store.addMessage({ room: 'dm', roomKey: ChatService.dmKey(userId, friendId), userId, kind: input.kind, text: text.text });
    const message = await this.view(row, new Map());
    this.toUser?.(friendId, message);
    this.toUser?.(userId, message);
    return { ok: true, message };
  }

  /** History of a private table's chat; only players seated at it may read. */
  async tableHistory(userId: string, code: string): Promise<ChatHistory | 'NOT_IN_TABLE' | 'OFF'> {
    const rules = await this.deps.rules();
    if (!rules.enabled) return 'OFF';
    if (!this.deps.tableMembers(userId, code)) return 'NOT_IN_TABLE';
    const [rows, mute, activated] = await Promise.all([this.store.history('table', (normalizeTableCode(code) ?? code), CHAT_HISTORY_LIMIT), this.deps.mute(userId), this.deps.isActivated(userId)]);
    const cache = new Map();
    const messages: ChatMessage[] = [];
    for (const r of rows) messages.push(await this.view(r, cache));
    return { cityName: null, globalOn: rules.globalEnabled, messages, canType: await this.canType(userId, 'table', !!mute, activated, rules), muted: mute };
  }

  /** A message to everyone at the table (same rules as the other rooms, plus: only seated players). Reaches them live. */
  async sendTable(userId: string, code: string, input: SendInput): Promise<SendResult> {
    const members = this.deps.tableMembers(userId, code);
    if (!members) return { ok: false, error: 'NOT_IN_TABLE' };
    if (input.kind === 'table') return { ok: false, error: 'EMPTY' };
    const text = await this.resolveText(userId, input, 'table');
    if (!text.ok) return text;
    const row = await this.store.addMessage({ room: 'table', roomKey: (normalizeTableCode(code) ?? code), userId, kind: input.kind, text: text.text });
    const message = await this.view(row, new Map());
    for (const m of members) this.toUser?.(m, message);
    return { ok: true, message };
  }

  /** The Socket.io room a player may join for the city chat, or null (no city / chat off). */
  async roomFor(userId: string): Promise<string | null> {
    if (!(await this.deps.rules()).enabled || !(await this.publicRoomsOpen(userId))) return null;
    const city = await this.deps.cityOf(userId);
    return city ? ChatService.cityRoom(city.id) : null;
  }

  /** Whether the global Socket.io room is open. */
  async globalOpen(userId?: string): Promise<boolean> {
    const rules = await this.deps.rules();
    return rules.enabled && rules.globalEnabled && (!userId || (await this.publicRoomsOpen(userId)));
  }

  /** Common checks: not muted, rate limit. */
  private async gate(userId: string, kind: 'text' | 'taunt' | 'table'): Promise<{ ok: false; error: ChatError; mutedUntil?: number } | null> {
    if (!(await this.deps.rules()).enabled) return { ok: false, error: 'OFF' };
    const mute = await this.deps.mute(userId);
    if (mute) return { ok: false, error: 'MUTED', mutedUntil: mute.until };
    if (!(kind === 'text' ? this.text : this.taunt).take(userId)) return { ok: false, error: 'RATE_LIMITED' };
    return null;
  }

  /** A message to the global room: same rules as the city room (filter, activation, mute, rate), no city needed. */
  async sendGlobal(userId: string, input: SendInput): Promise<SendResult> {
    if (!(await this.globalOpen(userId))) return { ok: false, error: 'OFF' };
    const text = await this.resolveText(userId, input, 'public');
    if (!text.ok) return text;
    const row = await this.store.addMessage({ room: 'global', roomKey: ChatService.GLOBAL_KEY, userId, kind: input.kind, text: text.text });
    const message = await this.view(row, new Map());
    this.broadcast?.(ChatService.GLOBAL_ROOM, message);
    return { ok: true, message };
  }

  async sendCity(userId: string, input: SendInput): Promise<SendResult> {
    if (!(await this.publicRoomsOpen(userId))) return { ok: false, error: 'OFF' };
    const city = await this.deps.cityOf(userId);
    if (!city) return { ok: false, error: 'NO_CITY' };
    const text = await this.resolveText(userId, input, 'public');
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
    const text = await this.resolveText(userId, { kind: 'taunt', tauntId }, 'public');
    if (!text.ok) return text;
    const row = await this.store.addMessage({ room: 'match', roomKey: matchId, userId, kind: 'taunt', text: text.text });
    const message = await this.view(row, new Map());
    this.toUser?.(opponentId, message);
    this.toUser?.(userId, message);
    return { ok: true, message };
  }

  private async resolveText(userId: string, input: SendInput, where: Where): Promise<{ ok: true; text: string } | { ok: false; error: ChatError; mutedUntil?: number }> {
    const blocked = await this.gate(userId, input.kind);
    if (blocked) return blocked;
    if (input.kind === 'table') {
      // A table invite is structured (a code and a name), so it needs no activation; the name still goes through the word filter.
      const label = input.label.replace(/\s+/g, ' ').trim().slice(0, 60);
      const verdict = this.deps.filter ? await this.deps.filter.check(label) : { ok: true as const, text: label };
      if (!verdict.ok) return { ok: false, error: 'FILTERED' };
      return { ok: true, text: `${input.code}|${verdict.text}` };
    }
    if (input.kind === 'taunt') {
      const t = await this.store.taunt(input.tauntId);
      if (!t || !t.isActive) return { ok: false, error: 'UNKNOWN_TAUNT' };
      if (t.cityId && t.cityId !== (await this.deps.cityOf(userId))?.id) return { ok: false, error: 'UNKNOWN_TAUNT' };
      return { ok: true, text: t.text };
    }
    const rules = await this.deps.rules();
    const raw = input.text.replace(/\s+/g, ' ').trim();
    if (raw === '') return { ok: false, error: 'EMPTY' };
    if ([...raw].length > rules.maxLen) return { ok: false, error: 'TOO_LONG' };
    const managed = (await this.rulesOf(userId)).freeTextChat === 'guardian_switch';
    if (managed) {
      // Kid/teen: text only to a friend of the track, and only once a guardian is linked (that link stands in for the invite code).
      if (where !== 'dm') return { ok: false, error: 'PHRASES_ONLY' };
      if (!(await this.managed!.hasGuardian(userId))) return { ok: false, error: 'NEEDS_GUARDIAN' };
    } else if (rules.textNeedsActivation && !(await this.deps.isActivated(userId))) return { ok: false, error: 'NEEDS_ACTIVATION' };
    // Phone numbers, links and handles: a contact perk never lifts this for kid/teen.
    if (containsContactInfo(raw) && (managed || !(await this.deps.hasContactPerk(userId)))) return { ok: false, error: 'CONTACT_BLOCKED' };
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
