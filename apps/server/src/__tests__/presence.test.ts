import { describe, expect, it } from 'vitest';
import { Presence } from '../realtime/presence.js';

describe('Presence', () => {
  it('stays online until every connection of the player is closed', () => {
    const p = new Presence();
    expect(p.isOnline('a')).toBe(false);
    p.connect('a');
    p.connect('a');
    p.disconnect('a');
    expect(p.isOnline('a')).toBe(true);
    p.disconnect('a');
    expect(p.isOnline('a')).toBe(false);
  });

  it('ignores a stray disconnect', () => {
    const p = new Presence();
    p.disconnect('ghost');
    p.connect('ghost');
    expect(p.isOnline('ghost')).toBe(true);
  });
});
