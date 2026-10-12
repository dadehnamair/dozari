import { describe, expect, it } from 'vitest';
import { emitProfileChanged, onProfileChanged } from '../profileEvents';

describe('profile events', () => {
  it('tells every listener, and stops after unsubscribing', () => {
    let a = 0;
    let b = 0;
    const offA = onProfileChanged(() => void a++);
    onProfileChanged(() => void b++);
    emitProfileChanged();
    offA();
    emitProfileChanged();
    expect([a, b]).toEqual([1, 2]);
  });
});
