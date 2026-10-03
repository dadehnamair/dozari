import type { FastifyInstance } from 'fastify';
import { PROFILE_TASK_KEYS, profileTaskKeySchema } from '@dozari/shared';
import type { ProfileTask, ProfileTaskClaim, ProfileTaskKey, ProfileTasks } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

export interface ProfileTaskDeps {
  /** Which profile fields the player has filled in (read from the real rows, never from the client). */
  facts(userId: string): Promise<Record<ProfileTaskKey, boolean>>;
  /** Reward per step from the admin settings. */
  coins(): Promise<Record<ProfileTaskKey, number>>;
  claimedKeys(userId: string): Promise<ProfileTaskKey[]>;
  /** Writes the claim row and pays through the ledger in one transaction; null when it was already taken. */
  pay(userId: string, key: ProfileTaskKey, coins: number): Promise<{ balance: number } | null>;
}

export type ClaimResult = { ok: true; claim: ProfileTaskClaim } | { ok: false; error: 'not_done' | 'already_claimed' | 'no_reward' };

/** Profile-completion steps (D161): each pays its admin-set coins once, after the server sees the field filled in. */
export class ProfileTaskService {
  constructor(private readonly deps: ProfileTaskDeps) {}

  async list(userId: string): Promise<ProfileTasks> {
    const [facts, coins, claimed] = await Promise.all([this.deps.facts(userId), this.deps.coins(), this.deps.claimedKeys(userId)]);
    const took = new Set(claimed);
    const tasks: ProfileTask[] = PROFILE_TASK_KEYS.map((key) => ({ key, done: facts[key], claimed: took.has(key), coins: coins[key] }));
    return { tasks };
  }

  async claim(userId: string, key: ProfileTaskKey): Promise<ClaimResult> {
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
    const key = profileTaskKeySchema.safeParse(req.params.key);
    if (!key.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await tasks.claim(user.id, key.data);
    if (!out.ok) return reply.code(out.error === 'already_claimed' ? 409 : 400).send({ error: out.error });
    return out.claim;
  });
}
