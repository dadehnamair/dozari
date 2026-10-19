import { describe, expect, it } from 'vitest';
import { buildPending } from '../notify/pending.js';

const NOW = 10 * 86_400_000;

describe('buildPending', () => {
  it('lists waiting friend requests by player id and names the sender', () => {
    const out = buildPending(NOW, [{ id: 'u9', nickname: 'علی' }]);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ id: 'fr:u9', kind: 'friend_request' });
    expect(out.items[0]?.body).toContain('علی');
  });
  it('caps the list', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `u${i}`, nickname: 'x' }));
    expect(buildPending(NOW, many).items).toHaveLength(20);
  });
});
