import type { FastifyInstance } from 'fastify';
import { SEARCH_GRID_SIZE } from '@dozari/shared';
import type { SearchCandidate } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { PlayerProfile } from './match-service.js';

export interface CandidateDeps {
  /** Ids with a live socket (humans and any bot that happens to hold one). */
  online(): string[];
  /** Ids of active bot accounts. */
  bots(): string[];
  profile(userId: string): Promise<PlayerProfile | null>;
  rng?: () => number;
}

const shuffle = <T>(list: T[], rng: () => number): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
};

/**
 * Faces for the opponent-search grid: players who are online right now come first, and when there are few of them the grid is
 * topped up from the bot roster so it is never empty. Bots and humans are indistinguishable, and nothing says who is online.
 * The grid is a show — who the match really pairs with is decided by the queue.
 */
export async function pickCandidates(deps: CandidateDeps, selfId: string, size = SEARCH_GRID_SIZE): Promise<SearchCandidate[]> {
  const rng = deps.rng ?? Math.random;
  const botIds = new Set(deps.bots());
  const humans = shuffle(deps.online().filter((id) => id !== selfId && !botIds.has(id)), rng);
  const ids = humans.slice(0, size);
  if (ids.length < size) ids.push(...shuffle([...botIds].filter((id) => id !== selfId), rng).slice(0, size - ids.length));
  const out: SearchCandidate[] = [];
  for (const id of shuffle(ids, rng)) {
    const p = await deps.profile(id);
    if (p) out.push({ nickname: p.nickname, avatarKey: p.avatarKey, level: Math.max(1, p.level) });
  }
  return out;
}

/** `GET /duel/candidates` for the search screen. */
export function registerCandidateRoutes(app: FastifyInstance, auth: AuthService, deps: CandidateDeps) {
  app.get('/duel/candidates', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { candidates: await pickCandidates(deps, user.id) };
  });
}
