import type { FastifyInstance, FastifyRequest } from 'fastify';
import { guestLoginSchema } from '@dozari/shared';
import { z } from 'zod';
import type { AccountDeletion } from '../account/deletion.js';
import { checkMiniAppInitData, miniAppDeviceId } from './miniapp.js';
import type { MiniAppPlatform } from './miniapp.js';
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

/** Bot tokens of the messengers that host the mini-app; a platform without a token has no login. */
export type MiniAppTokens = Partial<Record<MiniAppPlatform, string>>;

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService, deletion?: AccountDeletion, miniApp: MiniAppTokens = {}) {
  // Mini-app login: the page sends the signed `initData` of the messenger it runs in; the same messenger user always lands on the same account.
  if (miniApp.bale || miniApp.telegram) {
    app.post('/auth/miniapp', async (req, reply) => {
      const body = z.object({ platform: z.enum(['bale', 'telegram']).default('bale'), initData: z.string().min(1).max(4096) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
      const token = miniApp[body.data.platform];
      if (!token) return reply.code(404).send({ error: 'platform_off' });
      const checked = checkMiniAppInitData(body.data.initData, token);
      if (!checked.ok) {
        req.log.warn({ reason: checked.reason, platform: body.data.platform }, 'mini-app login refused');
        return reply.code(401).send({ error: 'invalid_init_data', reason: checked.reason });
      }
      const deviceId = miniAppDeviceId(token, checked.user.id, body.data.platform);
      const result = await auth.guestLogin(deviceId);
      if (!result.ok) return reply.code(403).send({ error: 'banned' });
      return { ...result.session, deviceId };
    });
  }

  app.post('/auth/guest', async (req, reply) => {
    const body = guestLoginSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = await auth.guestLogin(body.data.deviceId);
    if (!result.ok) return reply.code(403).send({ error: 'banned' });
    return result.session;
  });

  // Step 1 of deleting my account: a one-time code goes to my verified phone (SMS) or my linked Bale chat.
  app.post('/me/delete/code', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!deletion) return reply.code(501).send({ error: 'unsupported' });
    const out = await deletion.sendCode(user.id);
    if (out.ok) return { ok: true, channel: out.channel };
    if (out.error === 'too_soon') return reply.header('retry-after', String(out.retryAfterSec ?? 60)).code(429).send({ error: out.error, retryAfterSec: out.retryAfterSec });
    return reply.code(out.error === 'send_failed' ? 502 : 409).send({ error: out.error });
  });

  // Step 2: delete my account — personal data goes, the account becomes an empty banned shell, the next launch starts a fresh guest.
  // With the deletion service wired, the one-time code from step 1 is mandatory.
  app.delete('/me', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (deletion) {
      const body = z.object({ code: z.string().max(10) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'code_required' });
      const out = await deletion.confirm(user.id, body.data.code);
      if (!out.ok) return reply.code(out.error === 'too_many' ? 429 : 400).send({ error: out.error });
    }
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
