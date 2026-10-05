import type { FastifyInstance } from 'fastify';
import { ageOn, birthdayIn, birthdayPutSchema, birthdayStatus, gregorianToJalali, isAcceptableBirth, jalaliDayNumber, todayInTehran } from '@dozari/shared';
import type { BirthDate, BirthdayClaim, JalaliDate, MyBirthday } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

export interface BirthRecord {
  birth: BirthDate | null;
  showAge: boolean;
  notifyFriends: boolean;
}

export interface BirthdayRules {
  minAge: number;
  /** Days the week starts before the birthday, and how long it lasts. */
  before: number;
  length: number;
  coins: number;
  gems: number;
  spins: number;
}

/** I/O boundary of birth dates: the stored date, the once-a-year gift and the friend-message log. */
export interface BirthdayStore {
  get(userId: string): Promise<BirthRecord>;
  /** Birth dates of the given players (only those who set one) with whether they show their age. */
  getMany(ids: readonly string[]): Promise<Map<string, { birth: BirthDate; showAge: boolean }>>;
  save(userId: string, rec: BirthRecord): Promise<void>;
  claimed(userId: string, year: number): Promise<boolean>;
  /** Writes the year's claim row (the lock) and pays coins and gems through their ledgers in one transaction; null when already taken. */
  claim(userId: string, year: number, gift: { coins: number; gems: number }): Promise<{ balance: number } | null>;
  /** Players with a birthday on one of these (month, day) pairs who allow friend messages. */
  dueOn(pairs: readonly (readonly [number, number])[]): Promise<{ id: string; nickname: string; birth: BirthDate }[]>;
  /** Records that a friend message went out; false when it already had (so it is sent once per year and stage). */
  notice(userId: string, year: number, stage: 'week' | 'day'): Promise<boolean>;
}

export interface BirthdayDeps {
  store: BirthdayStore;
  rules(): Promise<BirthdayRules>;
  friendsOf(userId: string): Promise<string[]>;
  /** Gives wheel spins (idempotent per `ref`). */
  giveSpins(userId: string, ref: string, count: number): Promise<number>;
  /** Puts a message in these players' inbox. */
  tell(userIds: readonly string[], title: string, body: string): Promise<void>;
  texts: { weekTitle: string; weekBody(nickname: string, days: number): string; dayTitle: string; dayBody(nickname: string): string };
  now?: () => number;
}

export type SaveResult = 'ok' | 'invalid';
export type ClaimResult = { ok: true; claim: BirthdayClaim } | { ok: false; error: 'not_in_week' | 'already_claimed' | 'no_gift' | 'no_birth_date' };

const jalaliOfDayNumber = (n: number): JalaliDate => {
  const d = new Date(n * 86_400_000);
  return gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** Birth date, the birthday week, the yearly gift and the friend messages (D160 / D164). */
export class BirthdayService {
  constructor(private readonly deps: BirthdayDeps) {}

  private today(): JalaliDate {
    return todayInTehran((this.deps.now ?? Date.now)());
  }

  async mine(userId: string): Promise<MyBirthday> {
    const [rec, rules] = await Promise.all([this.deps.store.get(userId), this.deps.rules()]);
    const today = this.today();
    const status = rec.birth ? birthdayStatus(rec.birth, today, rules.before, rules.length) : null;
    const claimed = status ? await this.deps.store.claimed(userId, status.year) : false;
    const worth = rules.coins > 0 || rules.gems > 0 || rules.spins > 0;
    return {
      birth: rec.birth,
      showAge: rec.showAge,
      notifyFriends: rec.notifyFriends,
      age: rec.birth ? ageOn(rec.birth, today) : null,
      minAge: rules.minAge,
      inWeek: status?.inWeek ?? false,
      isToday: status?.isToday ?? false,
      gift: { coins: rules.coins, gems: rules.gems, spins: rules.spins, claimed, claimable: !!status?.inWeek && !claimed && worth },
    };
  }

  /** Saves (or clears with `birth: null`) the date and the two ticks; a date that is not real or makes the player younger than the minimum is refused. */
  async save(userId: string, input: { birth: BirthDate | null; showAge: boolean; notifyFriends: boolean }): Promise<SaveResult> {
    if (input.birth) {
      const rules = await this.deps.rules();
      if (!isAcceptableBirth(input.birth, this.today(), rules.minAge)) return 'invalid';
    }
    await this.deps.store.save(userId, { birth: input.birth, showAge: input.birth ? input.showAge : false, notifyFriends: input.notifyFriends });
    return 'ok';
  }

  async claim(userId: string): Promise<ClaimResult> {
    const [rec, rules] = await Promise.all([this.deps.store.get(userId), this.deps.rules()]);
    if (!rec.birth) return { ok: false, error: 'no_birth_date' };
    const status = birthdayStatus(rec.birth, this.today(), rules.before, rules.length);
    if (!status.inWeek) return { ok: false, error: 'not_in_week' };
    if (rules.coins <= 0 && rules.gems <= 0 && rules.spins <= 0) return { ok: false, error: 'no_gift' };
    const paid = await this.deps.store.claim(userId, status.year, { coins: rules.coins, gems: rules.gems });
    if (!paid) return { ok: false, error: 'already_claimed' };
    if (rules.spins > 0) await this.deps.giveSpins(userId, `birthday-${status.year}`, rules.spins);
    return { ok: true, claim: { ok: true, coins: rules.coins, gems: rules.gems, spins: rules.spins, balance: paid.balance } };
  }

  /** For the public profile and lists: who is in their birthday week, and the age of those who show it. Never the date. */
  async info(ids: readonly string[]): Promise<Map<string, { badge: boolean; age: number | null }>> {
    const out = new Map<string, { badge: boolean; age: number | null }>();
    if (ids.length === 0) return out;
    const [rows, rules] = await Promise.all([this.deps.store.getMany(ids), this.deps.rules()]);
    const today = this.today();
    for (const [id, r] of rows) out.set(id, { badge: birthdayStatus(r.birth, today, rules.before, rules.length).inWeek, age: r.showAge ? ageOn(r.birth, today) : null });
    return out;
  }

  /**
   * Tells friends: once when the week starts and once on the day, per year, no age in the text. Run it a few times a day; the
   * log makes a repeat harmless. Returns how many players' friends were told.
   */
  async announce(): Promise<number> {
    const rules = await this.deps.rules();
    const today = this.today();
    const dayNo = jalaliDayNumber(today);
    let told = 0;
    for (const [offset, stage] of [[rules.before, 'week'], [0, 'day']] as const) {
      if (stage === 'week' && rules.before === 0) continue;
      const target = jalaliOfDayNumber(dayNo + offset);
      // A 30 Esfand birthday is celebrated on the 29th in a year with no 30th.
      const pairs: [number, number][] = [[target.month, target.day]];
      if (target.month === 12 && target.day === 29 && birthdayIn({ year: 0, month: 12, day: 30 }, target.year).day === 29) pairs.push([12, 30]);
      for (const p of await this.deps.store.dueOn(pairs)) {
        const status = birthdayStatus(p.birth, today, rules.before, rules.length);
        if (status.daysUntil !== offset) continue;
        if (!(await this.deps.store.notice(p.id, status.year, stage))) continue;
        const friends = await this.deps.friendsOf(p.id);
        if (friends.length === 0) continue;
        const t = this.deps.texts;
        await this.deps.tell(friends, stage === 'week' ? t.weekTitle : t.dayTitle, stage === 'week' ? t.weekBody(p.nickname, offset) : t.dayBody(p.nickname));
        told += 1;
      }
    }
    return told;
  }
}

/** Player side: the own birth settings, the gift. */
export function registerBirthdayRoutes(app: FastifyInstance, auth: AuthService, birthday: BirthdayService) {
  app.get('/me/birthday', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return birthday.mine(user.id);
  });

  app.put('/me/birthday', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = birthdayPutSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if ((await birthday.save(user.id, body.data)) === 'invalid') return reply.code(400).send({ error: 'invalid_birth_date' });
    return birthday.mine(user.id);
  });

  app.post('/me/birthday/claim', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await birthday.claim(user.id);
    if (out.ok) return out.claim;
    return reply.code(out.error === 'already_claimed' ? 409 : 400).send({ error: out.error });
  });
}
