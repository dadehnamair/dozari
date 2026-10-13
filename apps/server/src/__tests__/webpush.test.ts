import { describe, expect, it } from 'vitest';
import { WebPushService, createMemoryPushSubStore, pushTextOf } from '../notify/webpush.js';

const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, p256dh: 'p'.repeat(20), auth: 'a'.repeat(12) });

describe('WebPushService', () => {
  it('sends to every browser of the player and counts the delivered ones', async () => {
    const store = createMemoryPushSubStore();
    const sent: string[] = [];
    const svc = new WebPushService(store, async (s) => (sent.push(s.endpoint), 201), 'k');
    await svc.subscribe('u1', sub(1));
    await svc.subscribe('u1', sub(2));
    await svc.subscribe('u2', sub(3));
    expect(await svc.notify('u1', { title: 't', body: 'b', tag: 'x' })).toBe(2);
    expect(sent).toEqual(['https://push.example/1', 'https://push.example/2']);
  });
  it('forgets a subscription the push service says is gone, keeps one that merely failed', async () => {
    const store = createMemoryPushSubStore();
    const svc = new WebPushService(store, async (s) => (s.endpoint.endsWith('/1') ? 410 : 500), 'k');
    await svc.subscribe('u1', sub(1));
    await svc.subscribe('u1', sub(2));
    expect(await svc.notify('u1', { title: 't', body: 'b', tag: 'x' })).toBe(0);
    expect([...store.all.keys()]).toEqual(['https://push.example/2']);
  });
  it('moves a browser to the newest account that subscribed on it', async () => {
    const store = createMemoryPushSubStore();
    const svc = new WebPushService(store, async () => 201, 'k');
    await svc.subscribe('u1', sub(1));
    await svc.subscribe('u2', sub(1));
    expect(await store.of('u1')).toEqual([]);
    expect(await store.of('u2')).toHaveLength(1);
  });
  it('words a private message and skips table answers', () => {
    expect(pushTextOf({ kind: 'dm', from: 'علی' })?.body).toContain('علی');
    expect(pushTextOf({ kind: 'table_answer', accepted: true })).toBeNull();
  });
});
