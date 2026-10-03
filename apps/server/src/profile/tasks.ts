import type { FastifyInstance } from 'fastify';
import { MISSION_KEYS, missionKeySchema } from '@dozari/shared';
import type { MissionKey, ProfileTask, ProfileTaskClaim, ProfileTasks } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

export interface ProfileTaskDeps {
  /** Which profile fields the player has filled in (read from the real rows, never from the client). */
  facts(userId: string): Promise<Record<MissionKey, boolean>>;
  /** Reward per step from the admin settings. */
  coins(): Promise<Record<MissionKey, number>>;
  claimedKeys(userId: string): Promise<MissionKey[]>;
  /** Writes the claim row and pays through the ledger in one transaction; null when it was already taken. */
  pay(userId: string, key: MissionKey, coins: number): Promise<{ balance: number } | null>;
}

export type ClaimResult = { ok: true; claim: ProfileTaskClaim } | { ok: false; error: 'not_done' | 'already_claimed' | 'no_reward' };

/** One-time missions (D161 profile steps, D163 the rest): each pays its admin-set coins once, after the server sees it done (honour missions are always done). */
export class ProfileTaskService {
  constructor(private readonly deps: ProfileTaskDeps) {}

  async list(userId: string): Promise<ProfileTasks> {
    const [facts, coins, claimed] = await Promise.all([this.deps.facts(userId), this.deps.coins(), this.deps.claimedKeys(userId)]);
    const took = new Set(claimed);
    const tasks: ProfileTask[] = MISSION_KEYS.map((key) => ({ key, done: facts[key], claimed: took.has(key), coins: coins[key] }));
    return { tasks };
  }

  async claim(userId: string, key: MissionKey): Promise<ClaimResult> {
    const task = (await this.list(userId)).tasks.find((t) => t.key === key);
    if (!task || task.coins <= 0) return { ok: false, error: 'no_reward' };
    if (task.claimed) return { ok: false, error: 'already_claimed' };
    if (!task.done) return { ok: false, error: 'not_done' };
    const paid = await this.deps.pay(userId, key, task.coins);
    if (!paid) return { ok: false, error: 'already_claimed' };
    return { ok: true, claim: { ok: true, key, coins: task.coins, balance: paid.balance } };
  }
}

export function registerProfileTaskRoutes(app: FastifyInstance, auth: AuthService, tasks: ProfileTaskService) {
  app.get('/me/profile-tasks', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return tasks.list(user.id);
  });

  app.post<{ Params: { key: string } }>('/me/profile-tasks/:key/claim', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const key = missionKeySchema.safeParse(req.params.key);
    if (!key.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await tasks.claim(user.id, key.data);
    if (!out.ok) return reply.code(out.error === 'already_claimed' ? 409 : 400).send({ error: out.error });
    return out.claim;
  });
}
