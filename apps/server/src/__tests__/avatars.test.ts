import { describe, expect, it } from 'vitest';
import { CHARACTER_AVATAR_KEYS, avatarShelfSchema } from '@dozari/shared';
import { AvatarService } from '../profile/avatars.js';
import type { AvatarFacts, AvatarRow, AvatarStore } from '../profile/avatars-store.js';

/** In-memory shelf of the 9 cast characters: the first 4 free, the other 5 cost 500; the player starts on the first. */
function make(over: Partial<AvatarFacts> = {}, rules = { unlockGames: 3, minLevel: 3 }, level = 5) {
  const rows: AvatarRow[] = CHARACTER_AVATAR_KEYS.map((avatarKey, i) => ({ avatarKey, priceCoins: i < 4 ? 0 : 500, sortOrder: i, isActive: true }));
  const facts: AvatarFacts = { avatarKey: 'char-dozari', balance: 1000, games: 5, inviteRedeemed: true, bought: new Set(), ...over };
  const store: AvatarStore = {
    catalog: async () => rows,
    updateAvatar: async () => 'ok',
    facts: async () => ({ ...facts, bought: new Set(facts.bought) }),
    buy: async (_u, key, price) => {
      if (facts.balance < price) return 'insufficient';
      facts.balance -= price;
      facts.bought.add(key);
      facts.avatarKey = key;
      return 'ok';
    },
  };
  return { svc: new AvatarService(store, async () => level, async () => rules), facts, rows };
}

describe('character shelf (D230)', () => {
  it('lists the free characters as owned and the priced ones with the reason they are blocked', async () => {
    const { svc } = make({ balance: 100 });
    const shelf = avatarShelfSchema.parse(await svc.shelf('u'));
    expect(shelf.items.filter((i) => i.owned).map((i) => i.key)).toEqual(['char-dozari', 'char-dozariF', 'char-mashti', 'char-khale']);
    expect(shelf.items.find((i) => i.key === 'char-pahlevan')).toMatchObject({ priceCoins: 500, owned: false, blocked: 'NEEDS_COINS' });
    expect(shelf.items.find((i) => i.key === 'char-dozari')).toMatchObject({ current: true, blocked: null });
  });

  it('may wear free characters, gallery faces and bought ones, but not a priced one it has not bought', async () => {
    const { svc } = make();
    expect(await svc.canWear('u', 'char-mashti')).toBe(true);
    expect(await svc.canWear('u', 'avatar-07')).toBe(true);
    expect(await svc.canWear('u', 'char-pahlevan')).toBe(false);
    expect(await svc.buy('u', 'char-pahlevan')).toEqual({ ok: true, avatarKey: 'char-pahlevan', balance: 500 });
    expect(await svc.canWear('u', 'char-baqal')).toBe(false);
  });

  it('keeps a priced character the player already wears (picked while all were free)', async () => {
    const { svc } = make({ avatarKey: 'char-goli' });
    expect(await svc.canWear('u', 'char-goli')).toBe(true);
    expect((await svc.shelf('u')).items.find((i) => i.key === 'char-goli')).toMatchObject({ owned: true, current: true });
  });

  it('sells a priced character once, then wearing it again is free', async () => {
    const { svc, facts } = make();
    expect(await svc.buy('u', 'char-pahlevan')).toEqual({ ok: true, avatarKey: 'char-pahlevan', balance: 500 });
    facts.avatarKey = 'char-mashti';
    expect(await svc.buy('u', 'char-pahlevan')).toEqual({ ok: false, error: 'already_owned' });
    expect(await svc.canWear('u', 'char-pahlevan')).toBe(true);
    expect(facts.balance).toBe(500);
  });

  it('applies the gates in order: games, invite, level, coins', async () => {
    expect(await make({ games: 1 }).svc.buy('u', 'char-pahlevan')).toEqual({ ok: false, error: 'NEEDS_GAMES' });
    expect(await make({ inviteRedeemed: false }).svc.buy('u', 'char-pahlevan')).toEqual({ ok: false, error: 'NEEDS_INVITE' });
    expect(await make({}, undefined, 1).svc.buy('u', 'char-pahlevan')).toEqual({ ok: false, error: 'NEEDS_LEVEL' });
    expect(await make({ balance: 10 }).svc.buy('u', 'char-pahlevan')).toEqual({ ok: false, error: 'NEEDS_COINS' });
  });

  it('refuses buying a free character and an unknown one', async () => {
    const { svc } = make();
    expect(await svc.buy('u', 'char-mashti')).toEqual({ ok: false, error: 'already_owned' });
    expect(await svc.buy('u', 'char-nobody')).toEqual({ ok: false, error: 'unknown_avatar' });
  });

  it('follows a price the admin changed', async () => {
    const { svc, rows } = make();
    rows[4]!.priceCoins = 0;
    expect((await svc.shelf('u')).items.find((i) => i.key === 'char-pahlevan')).toMatchObject({ owned: true, blocked: null });
    rows[5]!.priceCoins = 2000;
    expect((await svc.shelf('u')).items.find((i) => i.key === 'char-baqal')?.blocked).toBe('NEEDS_COINS');
  });
});
