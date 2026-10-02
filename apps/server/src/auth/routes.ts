import type { FastifyInstance, FastifyRequest } from 'fastify';
import { guestLoginSchema } from '@dozari/shared';
import type { AuthService, UserRecord } from './service.js';

const bearer = (req: FastifyRequest): string | null => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
};

/** Resolves the caller from the Authorization header; null when missing or invalid. */
export async function currentUser(auth: AuthService, req: FastifyRequest): Promise<UserRecord | null> {
  const token = bearer(req);
  return token ? auth.authenticate(token) : null;
}

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
  app.post('/auth/guest', async (req, reply) => {
    const body = guestLoginSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = await auth.guestLogin(body.data.deviceId);
    if (!result.ok) return reply.code(403).send({ error: 'banned' });
    return result.session;
  });

  // Delete my account: personal data goes, the account becomes an empty banned shell, the next launch starts a fresh guest.
  app.delete('/me', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return (await auth.deleteAccount(user.id)) ? { ok: true } : reply.code(501).send({ error: 'unsupported' });
  });

  app.post('/me/sign-out-everywhere', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return (await auth.signOutEverywhere(user.id)) ? { ok: true } : reply.code(501).send({ error: 'unsupported' });
  });

  app.get('/me', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { id: user.id, nickname: user.nickname, avatarKey: user.avatarKey };
  });
}
