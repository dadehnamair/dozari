import { describe, expect, it } from 'vitest';
import { PENDING_WINDOW_MS, buildPending } from '../notify/pending.js';

const NOW = 10 * 86_400_000;
const msg = (id: string, createdAt: number, read = false) => ({ id, title: 't', body: 'b', createdAt, read });

describe('buildPending', () => {
  it('lists unread messages newer than the device cursor, with stable ids', () => {
    const out = buildPending(NOW, NOW - 1000, [msg('a', NOW - 500), msg('b', NOW - 2000), msg('c', NOW - 100, true)], []);
    expect(out.items.map((i) => i.id)).toEqual(['in:a']);
  });
  it('never announces messages older than the window, even for a device that never looked', () => {
    const out = buildPending(NOW, 0, [msg('old', NOW - PENDING_WINDOW_MS - 1), msg('new', NOW - 1)], []);
    expect(out.items.map((i) => i.id)).toEqual(['in:new']);
  });
  it('always lists waiting friend requests by player id and names the sender', () => {
    const out = buildPending(NOW, NOW, [], [{ id: 'u9', nickname: 'علی' }]);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ id: 'fr:u9', kind: 'friend_request' });
    expect(out.items[0]?.body).toContain('علی');
  });
  it('caps the list', () => {
    const many = Array.from({ length: 50 }, (_, i) => msg(`m${i}`, NOW - i));
    expect(buildPending(NOW, 0, many, []).items).toHaveLength(20);
  });
});
