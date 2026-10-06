import { KEEPSAKE_MAX_LEVEL, shopPiece, upgradeCost } from '@dozari/shared';
import type { DefRow, GrantOutcome, KeepsakeStore, NewDef, NewSet, Owned, SetRow, UpgradeOutcome } from './store.js';

export type MemoryKeepsakeStore = KeepsakeStore & {
  /** Test helpers. */
  give(userId: string, coins: number): void;
  coins: Map<string, number>;
  gems: Map<string, number>;
  ledger: { userId: string; delta: number; reason: string; key: string }[];
};

/** The same rules as the DB store, in memory (tests). */
export function createMemoryKeepsakeStore(seedDefs: readonly NewDef[] = [], seedSets: readonly (NewSet & { id?: string })[] = []): MemoryKeepsakeStore {
  let seq = 0;
  const nid = () => `00000000-0000-7000-8000-${String(++seq).padStart(12, '0')}`;
  const sets: SetRow[] = seedSets.map((s, i) => ({ ...s, id: s.id ?? nid(), sortOrder: i }));
  const defs: DefRow[] = seedDefs.map((d, i) => ({ ...d, id: nid(), sortOrder: i, iconKey: null }));
  const pieces = new Map<string, { piece: number; ref: string }[]>(); // `${user}|${keepsake}`
  const done = new Map<string, { level: number; slot: number | null }>(); // `${user}|${keepsake}`
  const doneSets = new Set<string>(); // `${user}|${set}`
  const coins = new Map<string, number>();
  const gems = new Map<string, number>();
  const ledger: { userId: string; delta: number; reason: string; key: string }[] = [];
  const keys = new Set<string>();
  const k = (u: string, id: string) => `${u}|${id}`;
  const active = (d: DefRow) => d.isActive;

  const complete = (userId: string, def: DefRow): { gems: number; setCompleted: boolean } => {
    done.set(k(userId, def.id), { level: 1, slot: null });
    let g = 0;
    const credit = (amount: number, key: string) => {
      if (amount <= 0 || keys.has(key)) return;
      keys.add(key);
      gems.set(userId, (gems.get(userId) ?? 0) + amount);
      ledger.push({ userId, delta: amount, reason: 'keepsake_reward', key });
      g += amount;
    };
    credit(def.rewardGems, `keepsake_reward:${def.id}:${userId}`);
    let setCompleted = false;
    if (def.setId) {
      const members = defs.filter((d) => d.setId === def.setId && active(d));
      const set = sets.find((s) => s.id === def.setId);
      if (set?.isActive && members.length > 0 && members.every((m) => done.has(k(userId, m.id))) && !doneSets.has(k(userId, set.id))) {
        doneSets.add(k(userId, set.id));
        setCompleted = true;
        credit(set.rewardGems, `keepsake_set:${set.id}:${userId}`);
      }
    }
    return { gems: g, setCompleted };
  };

  const have = (u: string, id: string) => pieces.get(k(u, id)) ?? [];

  return {
    coins,
    gems,
    ledger,
    give: (u, n) => void coins.set(u, (coins.get(u) ?? 0) + n),
    async defs(opts) {
      return defs.filter((d) => opts?.includeHidden || active(d)).map((d) => ({ ...d }));
    },
    async sets(opts) {
      return sets.filter((s) => opts?.includeHidden || s.isActive).map((s) => ({ ...s }));
    },
    async progress(userId) {
      const out = new Map<string, Owned>();
      for (const d of defs) {
        const owned = have(userId, d.id).map((p) => p.piece).sort((a, b) => a - b);
        const c = done.get(k(userId, d.id));
        if (owned.length > 0 || c) out.set(d.id, { owned, completed: !!c, level: c?.level ?? 0, showcaseSlot: c?.slot ?? null });
      }
      return out;
    },
    async completedSets(userId) {
      return new Set(sets.filter((s) => doneSets.has(k(userId, s.id))).map((s) => s.id));
    },
    async balance(userId) {
      return coins.get(userId) ?? 0;
    },
    async grant(userId, keepsakeId, piece, source, ref): Promise<GrantOutcome> {
      const def = defs.find((d) => d.id === keepsakeId && active(d));
      if (!def || piece < 1 || piece > def.pieces) return { ok: false, error: 'unknown' };
      const mine = have(userId, keepsakeId);
      const allRefs = [...pieces.entries()].filter(([key]) => key.startsWith(`${userId}|`)).flatMap(([, v]) => v);
      if (allRefs.some((p) => p.ref === ref) || mine.some((p) => p.piece === piece)) return { ok: false, error: 'duplicate' };
      void source;
      pieces.set(k(userId, keepsakeId), [...mine, { piece, ref }]);
      const completed = mine.length + 1 >= def.pieces;
      const extra = completed ? complete(userId, def) : { gems: 0, setCompleted: false };
      return { ok: true, piece, completed, ...extra, balance: coins.get(userId) ?? 0 };
    },
    async buy(userId, keepsakeId, price, ref): Promise<GrantOutcome> {
      const def = defs.find((d) => d.id === keepsakeId && active(d));
      if (!def) return { ok: false, error: 'unknown' };
      const mine = have(userId, keepsakeId);
      const piece = shopPiece(def, { owned: mine.map((p) => p.piece) }, ref);
      if (piece === null) return { ok: false, error: 'complete' };
      const key = `keepsake_piece:${ref}:${userId}`;
      if (keys.has(key)) return { ok: false, error: 'duplicate' };
      if ((coins.get(userId) ?? 0) < price) return { ok: false, error: 'insufficient' };
      keys.add(key);
      coins.set(userId, (coins.get(userId) ?? 0) - price);
      ledger.push({ userId, delta: -price, reason: 'keepsake_piece', key });
      pieces.set(k(userId, keepsakeId), [...mine, { piece, ref }]);
      const completed = mine.length + 1 >= def.pieces;
      const extra = completed ? complete(userId, def) : { gems: 0, setCompleted: false };
      return { ok: true, piece, completed, ...extra, balance: coins.get(userId) ?? 0 };
    },
    async upgrade(userId, keepsakeId): Promise<UpgradeOutcome> {
      const def = defs.find((d) => d.id === keepsakeId && active(d));
      if (!def) return { ok: false, error: 'unknown' };
      const row = done.get(k(userId, keepsakeId));
      if (!row) return { ok: false, error: 'not_complete' };
      const cost = upgradeCost(row.level);
      if (cost === null || row.level >= KEEPSAKE_MAX_LEVEL) return { ok: false, error: 'max' };
      if ((coins.get(userId) ?? 0) < cost) return { ok: false, error: 'insufficient' };
      coins.set(userId, (coins.get(userId) ?? 0) - cost);
      ledger.push({ userId, delta: -cost, reason: 'keepsake_upgrade', key: `keepsake_upgrade:${keepsakeId}:${row.level}:${userId}` });
      row.level += 1;
      return { ok: true, level: row.level, balance: coins.get(userId) ?? 0 };
    },
    async milestone(userId, count, gemsPaid) {
      const key = `keepsake_milestone:${count}:${userId}`;
      if (gemsPaid <= 0) return true;
      if (keys.has(key)) return false;
      keys.add(key);
      gems.set(userId, (gems.get(userId) ?? 0) + gemsPaid);
      ledger.push({ userId, delta: gemsPaid, reason: 'keepsake_reward', key });
      return true;
    },
    async setShowcase(userId, ids) {
      for (const [key, v] of done) if (key.startsWith(`${userId}|`)) v.slot = null;
      ids.forEach((id, i) => {
        const v = done.get(k(userId, id));
        if (v) v.slot = i + 1;
      });
    },
    async addDef(d) {
      const row: DefRow = { ...d, id: nid(), sortOrder: defs.length, iconKey: null };
      defs.push(row);
      return { ...row };
    },
    async updateDef(id, patch) {
      const row = defs.find((d) => d.id === id);
      if (!row) return 'not_found';
      Object.assign(row, patch);
      return 'ok';
    },
    async addSet(s) {
      const row: SetRow = { ...s, id: nid(), sortOrder: sets.length };
      sets.push(row);
      return { ...row };
    },
    async updateSet(id, patch) {
      const row = sets.find((s) => s.id === id);
      if (!row) return 'not_found';
      Object.assign(row, patch);
      return 'ok';
    },
  };
}
