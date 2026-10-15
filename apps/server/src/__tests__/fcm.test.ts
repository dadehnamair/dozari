import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FcmService, createFcmSender, createMemoryFcmTokenStore, serviceAccountJwt } from '../notify/fcm.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const account = { project_id: 'proj', client_email: 'sa@proj.iam.gserviceaccount.com', private_key: privateKey };
const payload = { title: 't', body: 'b', tag: 'x' };

describe('serviceAccountJwt', () => {
  it('is a verifiable RS256 token for the messaging scope', () => {
    const jwt = serviceAccountJwt(account, 1_000);
    const [h, c, s] = jwt.split('.') as [string, string, string];
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString()) as { iss: string; scope: string; exp: number };
    expect(claims).toMatchObject({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', exp: 4_600 });
  });
});

describe('createFcmSender', () => {
  it('gets one access token, reuses it, and posts a data-only high-priority message', async () => {
    const calls: { url: string; body: string }[] = [];
    const http = (async (url: string, init: { body: unknown }) => {
      calls.push({ url, body: String(init.body) });
      if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 'AT', expires_in: 3600 }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const send = createFcmSender(account, http, () => 5_000_000);
    expect(await send('tok1', payload)).toBe(200);
    expect(await send('tok2', payload)).toBe(200);
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    const msg = JSON.parse(calls[1]!.body) as { message: { token: string; data: unknown; android: { priority: string }; notification?: unknown } };
    expect(msg.message).toMatchObject({ token: 'tok1', data: payload, android: { priority: 'HIGH' } });
    expect(msg.message.notification).toBeUndefined();
  });
  it('answers 0 when the token endpoint refuses', async () => {
    const http = (async () => new Response('no', { status: 400 })) as unknown as typeof fetch;
    expect(await createFcmSender(account, http)('tok', payload)).toBe(0);
  });
});

describe('FcmService', () => {
  it('deletes a token FCM reports unknown and keeps one that failed for another reason', async () => {
    const store = createMemoryFcmTokenStore();
    const svc = new FcmService(store, async (t) => (t === 'gone-token-aaaaaaaaaaaa' ? 404 : 503));
    await svc.register('u1', 'gone-token-aaaaaaaaaaaa');
    await svc.register('u1', 'flaky-token-bbbbbbbbbbbb');
    expect(await svc.notify('u1', payload)).toBe(0);
    expect([...store.all.keys()]).toEqual(['flaky-token-bbbbbbbbbbbb']);
  });
  it('counts delivered pushes over all devices of the player', async () => {
    const store = createMemoryFcmTokenStore();
    const svc = new FcmService(store, async () => 200);
    await svc.register('u1', 'a'.repeat(30));
    await svc.register('u1', 'b'.repeat(30));
    await svc.register('u2', 'c'.repeat(30));
    expect(await svc.notify('u1', payload)).toBe(2);
  });
});
