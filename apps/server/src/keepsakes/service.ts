import { SHOWCASE_MAX, cleanShowcase, completionPercent, piecePrice, rollDrop, upgradeCost } from '@dozari/shared';
import type { Drop, KeepsakeDef, KeepsakeGallery, KeepsakeProgress, KeepsakeView, ShowcaseView } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { DefRow, GrantOutcome, KeepsakeStore, Owned, UpgradeOutcome } from './store.js';

const toView = (d: DefRow, o: Owned | undefined): KeepsakeView => {
  const complete = o?.completed === true;
  return {
    id: d.id,
    titleFa: d.titleFa,
    storyFa: d.storyFa,
    eraYear: d.eraYear,
    rarity: d.rarity,
    pieces: d.pieces,
    owned: o?.owned ?? [],
    complete,
    level: complete ? o!.level : 0,
    artKey: d.artKey,
    iconKey: d.iconKey,
    setId: d.setId,
    piecePrice: complete ? 0 : piecePrice(d.rarity),
    upgradePrice: complete ? upgradeCost(o!.level) : null,
    rewardGems: d.rewardGems,
    showcaseSlot: o?.showcaseSlot ?? null,
  };
};

export type BuyPieceResult = GrantOutcome | { ok: false; error: 'off' };

/** The keepsake collection («گنجینه»): what a player sees and the rules of buying, upgrading and pinning (docs/logic/economy-v2.md). */
export class KeepsakeService {
  constructor(
    private readonly store: KeepsakeStore,
    /** Chance (0..1) a human win drops a piece; the admin setting `keepsake.drop_percent` in production. */
    private readonly dropChance: () => Promise<number> = async () => 0.15,
    private readonly newRef: () => string = uuidv7,
  ) {}

  async gallery(userId: string): Promise<KeepsakeGallery> {
    const [defs, sets, progress, doneSets, balance] = await Promise.all([this.store.defs(), this.store.sets(), this.store.progress(userId), this.store.completedSets(userId), this.store.balance(userId)]);
    const items = defs.map((d) => toView(d, progress.get(d.id)));
    const completed = items.filter((i) => i.complete).length;
    const setViews = sets.map((s) => {
      const members = items.filter((i) => i.setId === s.id);
      return { id: s.id, titleFa: s.titleFa, total: members.length, completed: members.filter((m) => m.complete).length, rewardGems: s.rewardGems, done: doneSets.has(s.id) };
    });
    return { items, sets: setViews.map(({ done: _done, ...rest }) => rest), completed, total: items.length, percent: completionPercent(completed, items.length), balance };
  }

  /** Buys one missing piece of a keepsake with coins; the piece is picked by the server. */
  async buyPiece(userId: string, keepsakeId: string): Promise<BuyPieceResult> {
    const def = (await this.store.defs()).find((d) => d.id === keepsakeId);
    if (!def) return { ok: false, error: 'unknown' };
    return this.store.buy(userId, keepsakeId, piecePrice(def.rarity), this.newRef());
  }

  async upgrade(userId: string, keepsakeId: string): Promise<UpgradeOutcome> {
    return this.store.upgrade(userId, keepsakeId);
  }

  /** Pins up to `SHOWCASE_MAX` completed keepsakes in the given order. Returns false when the list is not acceptable. */
  async setShowcase(userId: string, ids: readonly string[]): Promise<boolean> {
    const progress = await this.store.progress(userId);
    const completed = new Set([...progress].filter(([, o]) => o.completed).map(([id]) => id));
    const clean = cleanShowcase(ids, completed);
    if (!clean) return false;
    await this.store.setShowcase(userId, clean);
    return true;
  }

  /** What other players see on the profile: the pinned keepsakes in order and the totals. */
  async showcase(userId: string): Promise<ShowcaseView> {
    const [defs, progress] = await Promise.all([this.store.defs(), this.store.progress(userId)]);
    const completed = defs.filter((d) => progress.get(d.id)?.completed).length;
    const pinned = defs
      .map((d) => ({ d, o: progress.get(d.id) }))
      .filter((x) => x.o?.completed && x.o.showcaseSlot !== null)
      .sort((a, b) => a.o!.showcaseSlot! - b.o!.showcaseSlot!)
      .slice(0, SHOWCASE_MAX);
    return {
      items: pinned.map(({ d, o }) => ({ id: d.id, titleFa: d.titleFa, rarity: d.rarity, level: o!.level, artKey: d.artKey, iconKey: d.iconKey, eraYear: d.eraYear })),
      completed,
      total: defs.length,
      percent: completionPercent(completed, defs.length),
    };
  }

  /**
   * A human win may drop a piece. Deterministic and idempotent per match (`<matchId>:<userId>` seeds the roll and keys the grant), and it
   * never throws: a failed drop must not break settling a match.
   */
  async dropForWin(userId: string, matchId: string): Promise<Drop | null> {
    try {
      const [defs, progress] = await Promise.all([this.store.defs(), this.store.progress(userId)]);
      const rules: KeepsakeDef[] = defs.map((d) => ({ id: d.id, rarity: d.rarity, pieces: d.pieces }));
      const prog = new Map<string, KeepsakeProgress>([...progress].map(([id, o]) => [id, { owned: o.owned }]));
      const drop = rollDrop(rules, prog, `${matchId}:${userId}`, await this.dropChance());
      if (!drop) return null;
      const out = await this.store.grant(userId, drop.keepsakeId, drop.piece, 'drop', `drop:${matchId}`);
      return out.ok ? drop : null;
    } catch (e) {
      console.error('[keepsake] drop failed', matchId, e);
      return null;
    }
  }
}
