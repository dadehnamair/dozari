import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CHARACTER_AVATAR_KEYS, avatarBlock } from '@dozari/shared';
import type { AvatarBlock, AvatarShelf } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { AvatarStore } from './avatars-store.js';

export interface AvatarRules {
  /** Finished games before any avatar can be taken (`profile.avatar_unlock_games`). */
  unlockGames: number;
  /** Minimum level to buy a paid avatar (`profile.avatar_change_min_level`). */
  minLevel: number;
}

export type AvatarResult = { ok: true; avatarKey: string; balance: number } | { ok: false; error: 'unknown_avatar' | AvatarBlock | 'already_owned' };

/** The shelf of the 9 cast characters («شخصیت»): the free ones, the priced ones, and the checks for buying (D65, D230). Wearing goes through `PUT /me/avatar`. */
export class AvatarService {
  constructor(
    private readonly store: AvatarStore,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly rules: () => Promise<AvatarRules>,
  ) {}

  async shelf(userId: string): Promise<AvatarShelf> {
    const [catalog, facts, level, rules] = await Promise.all([this.store.catalog(), this.store.facts(userId), this.levelOf(userId), this.rules()]);
    const p = { games: facts.games, level, inviteRedeemed: facts.inviteRedeemed, balance: facts.balance, unlockGames: rules.unlockGames, minLevel: rules.minLevel };
    const items = catalog.map((a) => {
      const current = a.avatarKey === facts.avatarKey;
      const owned = current || a.priceCoins <= 0 || facts.bought.has(a.avatarKey);
      return { key: a.avatarKey, priceCoins: a.priceCoins, owned, current, blocked: current ? null : avatarBlock(a.priceCoins, owned, p) };
    });
    return { items, balance: facts.balance, games: facts.games, level, unlockGames: rules.unlockGames, minLevel: rules.minLevel };
  }

  /** May this player wear `key` (a character they own or a free one)? Keys outside the shelf (the 24 gallery faces) are not priced and always pass. */
  async canWear(userId: string, key: string): Promise<boolean> {
    if (!CHARACTER_AVATAR_KEYS.includes(key)) return true;
    const view = (await this.shelf(userId)).items.find((i) => i.key === key);
    return !!view && view.owned;
  }

  /** Buys a priced character and wears it. */
  async buy(userId: string, key: string): Promise<AvatarResult> {
    const shelf = await this.shelf(userId);
    const view = shelf.items.find((i) => i.key === key);
    if (!view) return { ok: false, error: 'unknown_avatar' };
    if (view.priceCoins <= 0 || view.owned) return { ok: false, error: 'already_owned' };
    if (view.blocked) return { ok: false, error: view.blocked };
    const out = await this.store.buy(userId, key, view.priceCoins);
    if (out === 'unknown') return { ok: false, error: 'unknown_avatar' };
    if (out === 'insufficient') return { ok: false, error: 'NEEDS_COINS' };
    return { ok: true, avatarKey: key, balance: (await this.store.facts(userId)).balance };
  }
}

const keyParam = z.object({ key: z.string().regex(/^char-[A-Za-z]{2,20}$/) });

export function registerAvatarRoutes(app: FastifyInstance, auth: AuthService, avatars: AvatarService) {
  app.get('/me/avatars', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return avatars.shelf(user.id);
  });

  app.post('/me/avatars/:key/buy', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const p = keyParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await avatars.buy(user.id, p.data.key);
    if (!out.ok) return reply.code(out.error === 'unknown_avatar' ? 404 : out.error === 'already_owned' ? 409 : 403).send({ error: out.error });
    return out;
  });
}
